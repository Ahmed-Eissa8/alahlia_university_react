import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";
import html2pdf from 'html2pdf.js';

const API_BASE = "http://localhost:5000/api";

const getAllowedFaculties = () => {
  try {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (user.role === 'admin') return null;
    return Array.isArray(user.allowed_faculties) ? user.allowed_faculties : [];
  } catch (e) {
    console.warn("مشكلة في قراءة allowed_faculties", e);
    return [];
  }
};

const StudentsTermList = () => {
  const navigate = useNavigate();

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Lists
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [periods, setPeriods] = useState([]);
  const [yearOptions, setYearOptions] = useState([]);
  const [levelOptions, setLevelOptions] = useState([]);
  const [termOptions, setTermOptions] = useState([]);

  // Filters
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");

  const [programType, setProgramType] = useState("bachelor");
  const [postgraduateProgram, setPostgraduateProgram] = useState("");

  const [academicYear, setAcademicYear] = useState("");
  const [levelName, setLevelName] = useState("");
  const [termName, setTermName] = useState("");

  const [registrationFilter, setRegistrationFilter] = useState("all"); // all | registered | unregistered

  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [searchText, setSearchText] = useState("");

  const [loadingFaculties, setLoadingFaculties] = useState(false);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [loadingPeriods, setLoadingPeriods] = useState(false);

  const canPickDepartment = !!selectedFacultyId;
  const canPickProgramType = !!selectedDepartmentId;
  const canPickPostgraduateProgram = programType === "postgraduate";
  const canProceedAfterProgram =
    (programType === "bachelor" || programType === "diploma") 
      ? true 
      : !!postgraduateProgram.trim();

  const canPickYear = canPickProgramType && canProceedAfterProgram;
  const canPickLevel = !!academicYear.trim();
  const canPickTerm = !!levelName.trim();

  const canLoadStudents =
    selectedFacultyId &&
    selectedDepartmentId &&
    canProceedAfterProgram &&
    academicYear.trim() &&
    levelName.trim() &&
    termName.trim();

  const pgSmart = usePostgradProgramsSmartList();

  useEffect(() => {
    if (programType === "postgraduate") {
      pgSmart.fetchPrograms();
    } else {
      setPostgraduateProgram("");
    }
  }, [programType]);

  // Load faculties
useEffect(() => {
  const loadFaculties = async () => {
    setLoadingFaculties(true);
    try {
      const res = await fetch(`${API_BASE}/faculties-list`);
      const allFaculties = await res.json();

      const allowed = getAllowedFaculties();

      let filtered = allFaculties;
      if (allowed !== null) {
        filtered = allFaculties.filter(fac => allowed.includes(fac.id));
      }

      setFaculties(Array.isArray(filtered) ? filtered : []);

      if (filtered.length === 0 && allowed !== null) {
        showToast("لا توجد كليات مسموح لك الوصول إليها", "error");
      }

      // إعادة التحقق من الكلية المختارة لو كانت موجودة قبل الفلتر
      if (selectedFacultyId) {
        const stillAllowed = filtered.find(f => f.id === Number(selectedFacultyId));
        if (!stillAllowed) {
          setSelectedFacultyId("");
        }
      }
    } catch (e) {
      console.error(e);
      showToast("مشكلة في تحميل الكليات", "error");
    } finally {
      setLoadingFaculties(false);
    }
  };

  loadFaculties();
}, []);

  function usePostgradProgramsSmartList() {
    const [programs, setPrograms] = useState([]);

    const fetchPrograms = async () => {
      try {
        const res = await fetch(`${API_BASE}/postgraduate-programs`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "فشل تحميل البرامج");
        setPrograms(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setPrograms([]);
      }
    };

    return { programs, fetchPrograms };
  }

  const fetchDepartmentsByFaculty = async (facultyId) => {
    if (!facultyId) return;
    setLoadingDeps(true);
    try {
      const res = await fetch(`${API_BASE}/departments/${facultyId}`);
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setDepartments([]);
      showToast("مشكلة في تحميل الأقسام", "error");
    } finally {
      setLoadingDeps(false);
    }
  };

  const fetchAcademicPeriods = async (pType, pgProg) => {
    setLoadingPeriods(true);
    try {
      const pt = (pType || "bachelor").trim();
      const pg = (pgProg || "").trim();

      let url = `${API_BASE}/academic-periods?program_type=${encodeURIComponent(pt)}`;
      if (pt === "postgraduate" && pg) url += `&postgraduate_program=${encodeURIComponent(pg)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل تحميل الفترات");

      const rows = Array.isArray(data) ? data : [];
      setPeriods(rows);

      const ys = Array.from(new Set(rows.map(r => r.academic_year?.trim()).filter(Boolean)));
      setYearOptions(ys);
    } catch (e) {
      console.error(e);
      setPeriods([]);
      setYearOptions([]);
      setLevelOptions([]);
      setTermOptions([]);
    } finally {
      setLoadingPeriods(false);
    }
  };

  const rebuildLevelAndTermOptions = (rows, year, level) => {
    const y = (year || "").trim();
    const l = (level || "").trim();

    const levels = Array.from(
      new Set(rows.filter(r => r.academic_year?.trim() === y).map(r => r.level_name?.trim()).filter(Boolean))
    );
    setLevelOptions(levels);

    const terms = Array.from(
      new Set(
        rows
          .filter(r => r.academic_year?.trim() === y && r.level_name?.trim() === l)
          .map(r => r.term_name?.trim())
          .filter(Boolean)
      )
    );
    setTermOptions(terms);
  };

  useEffect(() => {
    rebuildLevelAndTermOptions(periods, academicYear, levelName);
  }, [periods, academicYear, levelName]);

  useEffect(() => {
    setAcademicYear("");
    setLevelName("");
    setTermName("");
    setStudents([]);
    setSearchText("");

    if (selectedDepartmentId) fetchAcademicPeriods(programType, postgraduateProgram);
  }, [programType, postgraduateProgram, selectedDepartmentId]);

  useEffect(() => {
    if (programType !== "postgraduate") setPostgraduateProgram("");
  }, [programType]);

  const resetBelowFaculty = () => {
    setDepartments([]);
    setSelectedDepartmentId("");
    setProgramType("bachelor");
    setPostgraduateProgram("");
    setAcademicYear("");
    setLevelName("");
    setTermName("");
    setStudents([]);
    setSearchText("");
  };

  const resetBelowDepartment = () => {
    setProgramType("bachelor");
    setPostgraduateProgram("");
    setAcademicYear("");
    setLevelName("");
    setTermName("");
    setStudents([]);
    setSearchText("");
  };

  const onSelectFaculty = (facultyId) => {
    setSelectedFacultyId(facultyId);
    resetBelowFaculty();
    if (facultyId) fetchDepartmentsByFaculty(facultyId);
  };

  const onSelectDepartment = (deptId) => {
    setSelectedDepartmentId(deptId);
    resetBelowDepartment();
    if (deptId) fetchAcademicPeriods(programType, postgraduateProgram);
  };

  const loadStudents = async () => {
    if (!canLoadStudents) return showToast("كمّل الاختيارات أولاً", "error");

    setLoadingStudents(true);
    setStudents([]);

    try {
      const qs =
        `department_id=${encodeURIComponent(selectedDepartmentId)}` +
        `&program_type=${encodeURIComponent(programType)}` +
        (programType === "postgraduate"
          ? `&postgraduate_program=${encodeURIComponent(postgraduateProgram.trim())}`
          : `&postgraduate_program=`) +
        `&academic_year=${encodeURIComponent(academicYear.trim())}` +
        `&level_name=${encodeURIComponent(levelName.trim())}` +
        `&term_name=${encodeURIComponent(termName.trim())}`;

      const res = await fetch(`${API_BASE}/term-students?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل تحميل الطلاب");

      setStudents(Array.isArray(data) ? data : []);
      showToast(`تم تحميل ${data.length} طالب`, "success");
    } catch (e) {
      console.error(e);
      showToast(e.message || "مشكلة في تحميل الطلاب", "error");
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (canLoadStudents) loadStudents();
  }, [canLoadStudents]);

  const filteredStudents = useMemo(() => {
    let result = [...students];

    // فلترة حسب حالة التسجيل
    if (registrationFilter === "registered") {
      result = result.filter(s => 
        (s.registration_status || "").trim() === "مسجّل" ||
        (s.registration_status || "").trim() === "مسجل"
      );
    } else if (registrationFilter === "unregistered") {
      result = result.filter(s => {
        const status = (s.registration_status || "").trim();
        return status === "غير مسجّل" || 
               status === "غير مسجل" || 
               status === "";
      });
    }

    // فلترة البحث
    const q = (searchText || "").trim().toLowerCase();
    if (!q) return result;

    return result.filter(s => {
      const name = (s.full_name || "").toLowerCase();
      const uni = String(s.university_id || "").toLowerCase();
      return name.includes(q) || uni.includes(q);
    });
  }, [students, searchText, registrationFilter]);

  const printTermStudentsList = () => {
    if (filteredStudents.length === 0) {
      showToast("لا توجد بيانات للطباعة", "error");
      return;
    }

    const facultyName = faculties.find(f => f.id === Number(selectedFacultyId))?.faculty_name || "غير محدد";
    const departmentName = departments.find(d => d.id === Number(selectedDepartmentId))?.department_name || "غير محدد";

    const filterText = 
      registrationFilter === "registered" ? "المسجلين فقط" :
      registrationFilter === "unregistered" ? "غير المسجلين فقط" : 
      "جميع الطلاب";

    const headerHTML = `
      <div style="text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 1px solid #ccc; direction: rtl; font-family: 'Cairo', 'Tajawal', sans-serif; margin-top: -20px;">
        <h1 style="margin: 0; color: #0a3753; font-size: 22px;">
          جامعة بورتسودان الأهلية
        </h1>
        <p style="margin: 8px 0 4px; font-weight: bold; font-size: 16px;">
          ${facultyName} - ${departmentName}
        </p>
        <p style="margin: 4px 0; font-size: 14px;">
          السنة الدراسية: ${academicYear} | المستوى: ${levelName} | الفصل: ${termName}
        </p>
        <p style="margin: 12px 0 0; color: #4b5563; font-size: 13px;">
          قوائم الطلاب - ${filterText}
        </p>
      </div>
    `;

    const tableHTML = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px; direction: rtl; font-family: 'Cairo', 'Tajawal', sans-serif; font-size: 14px;">
        <thead>
          <tr style="background: #6e6e6e; color: white;">
            <th style="padding: 12px; border: 1px solid #9ca3af; text-align: center; font-weight: bold;">#</th>
            <th style="padding: 12px; border: 1px solid #9ca3af; text-align: center; font-weight: bold;">الرقم الجامعي</th>
            <th style="padding: 12px; border: 1px solid #9ca3af; text-align: right; font-weight: bold;">اسم الطالب</th>
            <th style="padding: 12px; border: 1px solid #9ca3af; text-align: center; font-weight: bold;">الحالة الأكاديمية</th>
            <th style="padding: 12px; border: 1px solid #9ca3af; text-align: center; font-weight: bold;">حالة التسجيل</th>
          </tr>
        </thead>
        <tbody>
          ${filteredStudents.map((s, idx) => `
            <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
              <td style="padding: 10px; border: 1px solid #d1d5db; text-align: center;">${idx + 1}</td>
              <td style="padding: 10px; border: 1px solid #d1d5db; text-align: center;">${s.university_id || '—'}</td>
              <td style="padding: 10px; border: 1px solid #d1d5db; text-align: right;">${s.full_name || '—'}</td>
              <td style="padding: 10px; border: 1px solid #d1d5db; text-align: center;">${s.academic_status || '—'}</td>
              <td style="padding: 10px; border: 1px solid #d1d5db; text-align: center;">
                ${s.registration_status || 'غير مسجل'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const fullContent = `<div style="padding: 20px 40px;">${headerHTML}${tableHTML}</div>`;

    const element = document.createElement('div');
    element.innerHTML = fullContent;

    html2pdf()
      .from(element)
      .set({
        margin: 1,
        filename: `قائمة_طلاب_${academicYear.replace('/', '-')}_${termName.replace(/ /g, '_')}.pdf`,
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
        html2canvas: { scale: 2 }
      })
      .save();

    showToast("جاري تجهيز القائمة للطباعة...", "success");
  };

  return (
    <div className="admission-layout">
      <header className="library-header">
        <div className="library-header-title">
          <span> قوائم الطلاب</span>
        </div>

        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "white",
            fontSize: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="رجوع"
        >
          <IoArrowBack />
        </button>
      </header>

      <main className="library-main">
        <div className="library-container">
          {/* اختيار الفصل */}
          <div className="card" style={{ marginTop: 14 }}>
            <h2 className="card-title">اختيار الفصل</h2>

            <div className="two-col-grid" style={{ marginBottom: 12 }}>
              <div className="input-group">
                <label className="input-label">الكلية</label>
                <select
                  className="input-field"
                  value={selectedFacultyId}
                  onChange={(e) => onSelectFaculty(e.target.value)}
                  disabled={loadingFaculties}
                >
                  <option value="">{loadingFaculties ? "جارٍ التحميل..." : "— اختار —"}</option>
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.faculty_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">القسم</label>
                <select
                  className="input-field"
                  value={selectedDepartmentId}
                  onChange={(e) => onSelectDepartment(e.target.value)}
                  disabled={!canPickDepartment || loadingDeps}
                >
                  <option value="">
                    {!canPickDepartment ? "اختار كلية أولاً" : loadingDeps ? "جارٍ تحميل الأقسام..." : "— اختار —"}
                  </option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.department_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ gridColumn: "1 / -1" }}>
                <label className="input-label">نوع البرنامج</label>
                <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                    <input
                      type="radio"
                      name="programTypeStudents"
                      value="diploma"
                      checked={programType === "diploma"}
                      onChange={(e) => setProgramType(e.target.value)}
                      disabled={!canPickProgramType}
                    />
                    دبلوم
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                    <input
                      type="radio"
                      name="programTypeStudents"
                      value="bachelor"
                      checked={programType === "bachelor"}
                      onChange={(e) => setProgramType(e.target.value)}
                      disabled={!canPickProgramType}
                    />
                    بكالوريوس
                  </label>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                    <input
                      type="radio"
                      name="programTypeStudents"
                      value="postgraduate"
                      checked={programType === "postgraduate"}
                      onChange={(e) => setProgramType(e.target.value)}
                      disabled={!canPickProgramType}
                    />
                    دراسات عليا
                  </label>
                </div>
              </div>

              {programType === "postgraduate" && (
                <div className="input-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="input-label">اسم برنامج الدراسات العليا</label>
                  <input
                    className="input-field"
                    dir="rtl"
                    list="postgrad_programs_list"
                    placeholder="مثال: ماجستير إدارة أعمال"
                    value={postgraduateProgram}
                    onChange={(e) => setPostgraduateProgram(e.target.value)}
                    disabled={!canPickProgramType}
                  />
                  <datalist id="postgrad_programs_list">
                    {pgSmart.programs.map((prog, idx) => (
                      <option key={idx} value={prog} />
                    ))}
                  </datalist>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">السنة الدراسية</label>
                <input
                  className="input-field"
                  dir="rtl"
                  list="years_list_students"
                  placeholder="مثال: 2024/2025"
                  value={academicYear}
                  onChange={(e) => {
                    setAcademicYear(e.target.value);
                    setLevelName("");
                    setTermName("");
                    setStudents([]);
                    setSearchText("");
                  }}
                  disabled={!canPickYear || loadingPeriods}
                />
                <datalist id="years_list_students">
                  {yearOptions.map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </div>

              <div className="input-group">
                <label className="input-label">المستوى</label>
                <input
                  className="input-field"
                  dir="rtl"
                  list="levels_list_students"
                  placeholder="مثال: المستوى الأول"
                  value={levelName}
                  onChange={(e) => {
                    setLevelName(e.target.value);
                    setTermName("");
                    setStudents([]);
                    setSearchText("");
                  }}
                  disabled={!canPickLevel}
                />
                <datalist id="levels_list_students">
                  {levelOptions.map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </div>

              <div className="input-group">
                <label className="input-label">الفصل الدراسي</label>
                <input
                  className="input-field"
                  dir="rtl"
                  list="terms_list_students"
                  placeholder="مثال: الفصل الأول"
                  value={termName}
                  onChange={(e) => {
                    setTermName(e.target.value);
                    setStudents([]);
                    setSearchText("");
                  }}
                  disabled={!canPickTerm}
                />
                <datalist id="terms_list_students">
                  {termOptions.map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* قائمة الطلاب */}
          <div className="card" style={{ marginTop: 14 }}>
            <h2 className="card-title">قائمة الطلاب</h2>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={printTermStudentsList}
                disabled={!canLoadStudents || loadingStudents || filteredStudents.length === 0}
                style={{ backgroundColor: "#0a3753", borderColor: "#0a3753" }}
              >
                طباعة القائمة
              </button>

              <div style={{ color: "#6b7280", fontWeight: 800 }}>
                العدد: {filteredStudents.length} / {students.length}
              </div>

              {/* فلتر حالة التسجيل */}
              <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="registrationFilter"
                    checked={registrationFilter === "all"}
                    onChange={() => setRegistrationFilter("all")}
                    disabled={loadingStudents || students.length === 0}
                  />
                  الكل
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="registrationFilter"
                    checked={registrationFilter === "registered"}
                    onChange={() => setRegistrationFilter("registered")}
                    disabled={loadingStudents || students.length === 0}
                  />
                  الطلاب المسجلين 
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="registrationFilter"
                    checked={registrationFilter === "unregistered"}
                    onChange={() => setRegistrationFilter("unregistered")}
                    disabled={loadingStudents || students.length === 0}
                  />
                  الطلاب غير المسجلين  
                </label>
              </div>

              <div style={{ flex: 1 }} />

              <input
                className="input-field"
                dir="rtl"
                placeholder="بحث بالاسم أو الرقم الجامعي..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ maxWidth: 320 }}
                disabled={students.length === 0}
              />
            </div>

            {students.length === 0 && canLoadStudents && !loadingStudents && (
              <div style={{ color: "#6b7280", fontWeight: 800, textAlign: "center" }}>
                لا يوجد طلاب (أو لم يتم تسجيل طلاب لهذا الفصل).
              </div>
            )}

            {filteredStudents.length > 0 && (
              <div style={{ marginTop: 10, overflowX: "auto" }}>
                <table className="simple-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ whiteSpace: "nowrap" }}>#</th>
                      <th style={{ whiteSpace: "nowrap" }}>الرقم الجامعي</th>
                      <th style={{ whiteSpace: "nowrap" }}>اسم الطالب</th>
                      <th style={{ whiteSpace: "nowrap" }}>الحالة الأكاديمية</th>
                      <th style={{ whiteSpace: "nowrap" }}>حالة التسجيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s, idx) => (
                      <tr key={s.student_id ?? idx}>
                        <td>{idx + 1}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{s.university_id || "—"}</td>
                        <td style={{ fontWeight: 800 }}>{s.full_name || "—"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{s.academic_status || "—"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {s.registration_status || "غير مسجل"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Toast */}
          {toast && (
            <div
              style={{
                position: "fixed",
                right: 16,
                bottom: 16,
                background: toast.type === "error" ? "#dc2626" : "#16a34a",
                color: "white",
                padding: "12px 14px",
                borderRadius: 10,
                fontWeight: 900,
                boxShadow: "0 12px 30px rgba(0,0,0,.25)",
                zIndex: 9999,
              }}
            >
              {toast.message}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentsTermList;