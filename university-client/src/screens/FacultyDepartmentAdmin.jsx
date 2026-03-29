import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000/api";

const getAllowedFaculties = () => {
  try {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (user.role === 'admin') return null; // null = كل الكليات
    return Array.isArray(user.allowed_faculties) ? user.allowed_faculties : [];
  } catch (e) {
    console.warn("مشكلة في قراءة allowed_faculties", e);
    return [];
  }
};

/* =========================
    Tab: Grade Rules Admin (Per Faculty)
   ========================= */
const GradeRulesAdmin = ({ showToast, faculties }) => {
  const [selectedFacultyId, setSelectedFacultyId] = useState("");

  const [gradeScale, setGradeScale] = useState([]); 
  const [honorsRules, setHonorsRules] = useState([]); 
  const [generalRules, setGeneralRules] = useState([]); 

  const [gpaSettings, setGpaSettings] = useState({
    term_calc_mode: "courses",           
    cumulative_calc_mode: "weighted_avg", 
    gpa_max: 4.0,

    total_mark: 100,
    final_exam_max: 60,     
    coursework_max: 40,    
    rounding_decimals: 2,   
  });

  const [loadingRules, setLoadingRules] = useState(false);
  const [savingRules, setSavingRules] = useState(false);

  const [programMode, setProgramMode] = useState("honors"); // honors | general

  const normalizeNumber = (v) => {
    if (v === "" || v === null || v === undefined) return "";
    const n = Number(v);
    return Number.isFinite(n) ? n : "";
  };

  const updateRow = (setter) => (idx, patch) => {
    setter((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const addRow = (setter, row) => () => setter((prev) => [...prev, row]);
  const removeRow = (setter) => (idx) => setter((prev) => prev.filter((_, i) => i !== idx));

  const fetchRules = async (facultyId) => {
    if (!facultyId) return;

    setLoadingRules(true);
    try {
      const res = await fetch(`${API_BASE}/grading-rules?faculty_id=${facultyId}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "فشل تحميل القواعد");

      setGradeScale(Array.isArray(data.gradeScale) ? data.gradeScale : []);
      setHonorsRules(Array.isArray(data.honorsRules) ? data.honorsRules : []);
      setGeneralRules(Array.isArray(data.generalRules) ? data.generalRules : []);

      setGpaSettings(
        data.gpaSettings || {
          term_calc_mode: "courses",
          cumulative_calc_mode: "weighted_avg",
          gpa_max: 4.0,
          total_mark: 100,
          final_exam_max: 60,
          coursework_max: 40,
          rounding_decimals: 2,
        }
      );

      showToast?.("تم تحميل قواعد الكلية من قاعدة البيانات", "success");
    } catch (e) {
      console.error(e);
      setGradeScale([]);
      setHonorsRules([]);
      setGeneralRules([]);
      setGpaSettings({
        term_calc_mode: "courses",
        cumulative_calc_mode: "weighted_avg",
        gpa_max: 4.0,
        total_mark: 100,
        final_exam_max: 60,
        coursework_max: 40,
        rounding_decimals: 2,
      });
      showToast?.(e.message || "مشكلة في تحميل القواعد", "error");
    } finally {
      setLoadingRules(false);
    }
  };

  const saveRules = async () => {
    if (!selectedFacultyId) {
      showToast?.("اختار كلية أولاً", "error");
      return;
    }

    //  Validation: لازم النهائي + أعمال الفصل = 100
    const total = Number(gpaSettings.total_mark ?? 100);
    const sum = Number(gpaSettings.final_exam_max || 0) + Number(gpaSettings.coursework_max || 0);
    if (sum !== total) {
      showToast?.(`لازم مجموع (النهائي + أعمال الفصل) = ${total}`, "error");
      return;
    }

    setSavingRules(true);
    try {
      const res = await fetch(`${API_BASE}/grading-rules?faculty_id=${selectedFacultyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradeScale, honorsRules, generalRules, gpaSettings }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل الحفظ");

      showToast?.(data.message || "تم حفظ قواعد هذه الكلية", "success");
      fetchRules(selectedFacultyId);
    } catch (e) {
      console.error(e);
      showToast?.(e.message || "مشكلة في حفظ القواعد", "error");
    } finally {
      setSavingRules(false);
    }
  };

  const onSelectFaculty = (facultyId) => {
    setSelectedFacultyId(facultyId);

    setGradeScale([]);
    setHonorsRules([]);
    setGeneralRules([]);
    setProgramMode("honors");

    setGpaSettings({
      term_calc_mode: "courses",
      cumulative_calc_mode: "weighted_avg",
      gpa_max: 4.0,
      total_mark: 100,
      final_exam_max: 60,
      coursework_max: 40,
      rounding_decimals: 2,
    });

    if (facultyId) fetchRules(facultyId);
  };

  const totalMark = Number(gpaSettings.total_mark ?? 100);
  const sumParts = Number(gpaSettings.final_exam_max || 0) + Number(gpaSettings.coursework_max || 0);
  const partsOk = sumParts === totalMark;

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h2 className="card-title">إعداد قواعد الدرجات والمعدل (حسب الكلية)</h2>

      {/* اختيار الكلية */}
      <div className="input-group" style={{ marginBottom: 12 }}>
        <label className="input-label">اختار الكلية</label>
        <select className="input-field" value={selectedFacultyId} onChange={(e) => onSelectFaculty(e.target.value)}>
          <option value="">— اختار —</option>
          {faculties.map((f) => (
            <option key={f.id} value={f.id}>
              {f.faculty_name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" className="btn btn-primary" onClick={saveRules} disabled={savingRules || !selectedFacultyId}>
          {savingRules ? "جاري الحفظ..." : "حفظ قواعد هذه الكلية"}
        </button>

        <button
          type="button"
          className="btn btn-outline"
          onClick={() => fetchRules(selectedFacultyId)}
          disabled={loadingRules || !selectedFacultyId}
        >
          {loadingRules ? "جاري التحميل..." : "إعادة تحميل"}
        </button>
      </div>

      {!selectedFacultyId ? (
        <p style={{ color: "#6b7280" }}>اختار كلية عشان نعرض/نعدل قواعدها.</p>
      ) : loadingRules ? (
        <p>جارٍ تحميل القواعد...</p>
      ) : (
        <>
          {/* إعدادات المعادلات */}
{/* ✅ طريقة حساب المعدل (حسب اللائحة) */}
{/* <h3 style={{ margin: "16px 0 10px" }}>طريقة حساب المعدل</h3>

<div className="card" style={{ padding: 14, marginBottom: 14, background: "#fff" }}>
  <div className="two-col-grid" style={{ gap: 12 }}>
    <div className="input-group">
      <label className="input-label">طريقة حساب المعدل الفصلي</label>
      <select
        className="input-field"
        value={gpaSettings.term_calc_mode}
        onChange={(e) => setGpaSettings((p) => ({ ...p, term_calc_mode: e.target.value }))}
      >
        <option value="courses">حسب المواد (نقاط × ساعات)</option>
        <option value="percentage">حسب النسبة المئوية</option>
      </select>
    </div>

    <div className="input-group">
      <label className="input-label">طريقة حساب المعدل التراكمي</label>
      <select
        className="input-field"
        value={gpaSettings.cumulative_calc_mode}
        onChange={(e) => setGpaSettings((p) => ({ ...p, cumulative_calc_mode: e.target.value }))}
      >
        <option value="weighted_avg">متوسط مرجّح بالساعات</option>
      </select>
    </div>

    <div className="input-group">
      <label className="input-label">أقصى GPA</label>
      <input
        type="number"
        step="0.01"
        className="input-field"
        value={gpaSettings.gpa_max ?? 4}
        onChange={(e) => setGpaSettings((p) => ({ ...p, gpa_max: Number(e.target.value || 0) }))}
      />
    </div>

    <div className="input-group">
      <label className="input-label">التقريب (عدد المنازل)</label>
      <input
        type="number"
        className="input-field"
        value={gpaSettings.rounding_decimals ?? 2}
        onChange={(e) => setGpaSettings((p) => ({ ...p, rounding_decimals: Number(e.target.value || 0) }))}
      />
    </div>
  </div>

  <div style={{ marginTop: 12, lineHeight: 1.9, color: "#374151", fontWeight: 700 }}>
    <div>• نقاط المقرر = (التقدير بالنقاط) × (عدد الساعات المعتمدة).</div>
    <div>• المعدل الفصلي = مجموع نقاط المقررات ÷ مجموع الساعات المعتمدة (للفصل).</div>
    <div>• المعدل التراكمي = مجموع النقاط التراكمية ÷ مجموع الساعات المعتمدة (لكل الفصول).</div>

    {gpaSettings.term_calc_mode === "percentage" && (
      <div style={{ marginTop: 8, color: "#6b7280", fontWeight: 600 }}>
        ملاحظة: عند اختيار “حسب النسبة المئوية” يتم تحويل الدرجة → رمز/نقاط من جدول التقديرات ثم تطبيق نفس المعادلة.
      </div>
    )}
  </div>
</div> */}


          {/* 1) جدول تقديرات المقررات */}
          <h3 style={{ margin: "16px 0 10px" }}>تقديرات المقررات (درجات / رمز / نقاط)</h3>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <button type="button" className="btn btn-outline" onClick={addRow(setGradeScale, { letter: "", min: 0, max: 0, points: 0 })}>
              + إضافة صف
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="simple-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>الرمز</th>
                  <th>من</th>
                  <th>إلى</th>
                  <th>النقاط</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {gradeScale.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center" }}>
                      لا توجد قواعد درجات لهذه الكلية (أضيف صفوف ثم احفظ).
                    </td>
                  </tr>
                ) : (
                  gradeScale.map((r, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>

                      <td>
                        <input
                          className="input-field"
                          style={{ minWidth: 80 }}
                          value={r.letter ?? ""}
                          onChange={(e) => updateRow(setGradeScale)(idx, { letter: e.target.value })}
                        />
                      </td>

                      <td>
                        <input
                          className="input-field"
                          type="number"
                          style={{ minWidth: 110 }}
                          value={r.min ?? ""}
                          onChange={(e) => updateRow(setGradeScale)(idx, { min: normalizeNumber(e.target.value) })}
                        />
                      </td>

                      <td>
                        <input
                          className="input-field"
                          type="number"
                          style={{ minWidth: 110 }}
                          value={r.max ?? ""}
                          onChange={(e) => updateRow(setGradeScale)(idx, { max: normalizeNumber(e.target.value) })}
                        />
                      </td>

                      <td>
                        <input
                          className="input-field"
                          type="number"
                          step="0.01"
                          style={{ minWidth: 110 }}
                          value={r.points ?? ""}
                          onChange={(e) => updateRow(setGradeScale)(idx, { points: normalizeNumber(e.target.value) })}
                        />
                      </td>

                      <td>
                        <button type="button" className="btn btn-danger" onClick={() => removeRow(setGradeScale)(idx)}>
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 2) تصنيف الإجازة */}
          <h3 style={{ margin: "18px 0 10px" }}>تصنيف الإجازة العلمية حسب المعدل التراكمي (GPA)</h3>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <button
              type="button"
              className={"btn " + (programMode === "honors" ? "btn-primary" : "btn-outline")}
              onClick={() => setProgramMode("honors")}
            >
              بكالوريوس الشرف
            </button>

            <button
              type="button"
              className={"btn " + (programMode === "general" ? "btn-primary" : "btn-outline")}
              onClick={() => setProgramMode("general")}
            >
              البكالوريوس العام / الدبلوم التقني
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={
                programMode === "honors"
                  ? addRow(setHonorsRules, { title: "", min: 0, max: 0 })
                  : addRow(setGeneralRules, { title: "", min: 0, max: 0 })
              }
            >
              + إضافة صف
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="simple-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>التصنيف</th>
                  <th>من</th>
                  <th>إلى</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {(programMode === "honors" ? honorsRules : generalRules).length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>
                      لا توجد قواعد تصنيف لهذا النوع (أضيفي صفوف ثم احفظي).
                    </td>
                  </tr>
                ) : (
                  (programMode === "honors" ? honorsRules : generalRules).map((r, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>

                      <td>
                        <input
                          className="input-field"
                          style={{ minWidth: 240 }}
                          value={r.title ?? ""}
                          onChange={(e) =>
                            programMode === "honors"
                              ? updateRow(setHonorsRules)(idx, { title: e.target.value })
                              : updateRow(setGeneralRules)(idx, { title: e.target.value })
                          }
                        />
                      </td>

                      <td>
                        <input
                          className="input-field"
                          type="number"
                          step="0.01"
                          style={{ minWidth: 110 }}
                          value={r.min ?? ""}
                          onChange={(e) =>
                            programMode === "honors"
                              ? updateRow(setHonorsRules)(idx, { min: normalizeNumber(e.target.value) })
                              : updateRow(setGeneralRules)(idx, { min: normalizeNumber(e.target.value) })
                          }
                        />
                      </td>

                      <td>
                        <input
                          className="input-field"
                          type="number"
                          step="0.01"
                          style={{ minWidth: 110 }}
                          value={r.max ?? ""}
                          onChange={(e) =>
                            programMode === "honors"
                              ? updateRow(setHonorsRules)(idx, { max: normalizeNumber(e.target.value) })
                              : updateRow(setGeneralRules)(idx, { max: normalizeNumber(e.target.value) })
                          }
                        />
                      </td>

                      <td>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() =>
                            programMode === "honors"
                              ? removeRow(setHonorsRules)(idx)
                              : removeRow(setGeneralRules)(idx)
                          }
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

const CoursesAdmin = ({ showToast, faculties }) => {
  const [periods, setPeriods] = useState([]);
  const [yearOptions, setYearOptions] = useState([]);
  const [levelOptions, setLevelOptions] = useState([]);
  const [termOptions, setTermOptions] = useState([]);

  const [programType, setProgramType] = useState("bachelor");
  const [postgraduateProgram, setPostgraduateProgram] = useState(""); 

  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [departments, setDepartments] = useState([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");

  const [academicYear, setAcademicYear] = useState("");
  const [levelName, setLevelName] = useState("");
  const [termName, setTermName] = useState("");

  const [courses, setCourses] = useState([]);

  const [courseName, setCourseName] = useState("");
  const [instructor, setInstructor] = useState("");
  const [creditHours, setCreditHours] = useState("");

  const [totalMark, setTotalMark] = useState(100);
  const [courseworkMax, setCourseworkMax] = useState(40);
  const [finalExamMax, setFinalExamMax] = useState(60);

  const [editingCourseId, setEditingCourseId] = useState(null);

  const [loadingDeps, setLoadingDeps] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [saving, setSaving] = useState(false);

  const [instructorsList, setInstructorsList] = useState([]);
  const [loadingInstructors, setLoadingInstructors] = useState(false);

  const pgSmart = usePostgradProgramsSmartList();


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

  const canLoad =
    selectedFacultyId &&
    selectedDepartmentId &&
    canProceedAfterProgram &&
    academicYear.trim() &&
    levelName.trim() &&
    termName.trim();

  useEffect(() => {
    rebuildLevelAndTermOptions(periods, academicYear, levelName);
  }, [periods, academicYear, levelName]);

  useEffect(() => {
    setAcademicYear("");
    setLevelName("");
    setTermName("");
    setCourses([]);
    resetForm();

    if (selectedDepartmentId) {
      fetchAcademicPeriods(programType, postgraduateProgram);
    }
  }, [programType, postgraduateProgram]);


  useEffect(() => {
  if (programType !== "postgraduate") setPostgraduateProgram("");
}, [programType]);

  useEffect(() => {
    if (programType === "postgraduate") {
      pgSmart.fetchPrograms();
    } else {
      setPostgraduateProgram("");
    }
  }, [programType]);


  const resetForm = () => {
    setCourseName("");
    setInstructor("");
    setCreditHours("");
    setTotalMark(100);
    setCourseworkMax(40);
    setFinalExamMax(60);
    setEditingCourseId(null);
  };

  const resetFiltersAfterDepartment = () => {
    setProgramType("bachelor");
    setPostgraduateProgram("");

    setAcademicYear("");
    setLevelName("");
    setTermName("");
    setCourses([]);
    resetForm();
  };


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
      showToast?.("مشكلة في تحميل الأقسام", "error");
    } finally {
      setLoadingDeps(false);
    }
  };

  const fetchAcademicPeriods = async (pType, pgProg) => {
    try {
      const pt = (pType || "bachelor").trim();
      const pg = (pgProg || "").trim();

      let url = `${API_BASE}/academic-periods?program_type=${encodeURIComponent(pt)}`;
      if (pt === "postgraduate" && pg) {
        url += `&postgraduate_program=${encodeURIComponent(pg)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل تحميل الفترات");

      const rows = Array.isArray(data) ? data : [];
      setPeriods(rows);

      const ys = Array.from(new Set(rows.map(r => (r.academic_year || "").trim()).filter(Boolean)));
      setYearOptions(ys);
    } catch (e) {
      console.error(e);
      setPeriods([]);
      setYearOptions([]);
      setLevelOptions([]);
      setTermOptions([]);
    }
  };

  const rebuildLevelAndTermOptions = (rows, year, level) => {
    const y = (year || "").trim();
    const l = (level || "").trim();

    const levels = Array.from(
      new Set(
        rows
          .filter(r => (r.academic_year || "").trim() === y)
          .map(r => (r.level_name || "").trim())
          .filter(Boolean)
      )
    );
    setLevelOptions(levels);

    const terms = Array.from(
      new Set(
        rows
          .filter(r =>
            (r.academic_year || "").trim() === y &&
            (r.level_name || "").trim() === l
          )
          .map(r => (r.term_name || "").trim())
          .filter(Boolean)
      )
    );
    setTermOptions(terms);
  };

  const ensurePeriodSaved = async (year, level, term) => {
    const y = (year || "").trim();
    const l = (level || "").trim();
    const t = (term || "").trim();
    if (!y || !l || !t) return;

    if (programType === "postgraduate" && !postgraduateProgram.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/academic-periods/ensure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academic_year: y,
          level_name: l,
          term_name: t,
          program_type: programType,
          postgraduate_program: programType === "postgraduate" ? postgraduateProgram.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل حفظ الفترة");

      await fetchAcademicPeriods(programType, postgraduateProgram);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCourses = async () => {
    if (!canLoad) return;
    setLoadingCourses(true);
    try {
      const qs =
        `faculty_id=${selectedFacultyId}` +
        `&department_id=${selectedDepartmentId}` +
        `&academic_year=${encodeURIComponent(academicYear.trim())}` +
        `&level_name=${encodeURIComponent(levelName.trim())}` +
        `&term_name=${encodeURIComponent(termName.trim())}` +
        `&program_type=${encodeURIComponent(programType)}` +
        (programType === "postgraduate"
          ? `&postgraduate_program=${encodeURIComponent(postgraduateProgram.trim())}`
          : "");

      const res = await fetch(`${API_BASE}/courses?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل تحميل المواد");
      setCourses(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setCourses([]);
      showToast?.(e.message || "مشكلة في تحميل المواد", "error");
    } finally {
      setLoadingCourses(false);
    }
  };


const fetchInstructors = async (facultyId) => {
  if (!facultyId) {
    setInstructorsList([]);
    return;
  }

  setLoadingInstructors(true);
  try {
    const url = `${API_BASE}/staff-members?faculty_id=${encodeURIComponent(facultyId)}`;

    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "فشل تحميل قائمة الأساتذة");

    const names = Array.from(
      new Set(
        (Array.isArray(data) ? data : [])
          .map((x) => (x.full_name || "").trim())
          .filter(Boolean)
      )
    );

    setInstructorsList(names);
  } catch (e) {
    console.error(e);
    setInstructorsList([]);
    showToast?.("مشكلة في تحميل قائمة الأساتذة", "error");
  } finally {
    setLoadingInstructors(false);
  }
};




  useEffect(() => {
    if (canLoad) fetchCourses();
  }, [selectedFacultyId, selectedDepartmentId, academicYear, levelName, termName, programType, postgraduateProgram]);

const onSelectFaculty = (facultyId) => {
  setSelectedFacultyId(facultyId);

  setDepartments([]);
  setSelectedDepartmentId("");
  setInstructorsList([]); 
  resetFiltersAfterDepartment();

  if (facultyId) {
  fetchDepartmentsByFaculty(facultyId);
  fetchInstructors(facultyId); 
}

};


const onSelectDepartment = (deptId) => {
  setSelectedDepartmentId(deptId);
  resetFiltersAfterDepartment();
  fetchAcademicPeriods("bachelor", "");
};



  const handleSaveCourse = async (e) => {
    e.preventDefault();

    if (!canLoad) return showToast?.("كمّل الاختيارات بالترتيب أولاً", "error");
    if (!courseName.trim()) return showToast?.("اكتب اسم المادة", "error");

    const tm = Number(totalMark ?? 100);
    const cw = Number(courseworkMax ?? 0);
    const fe = Number(finalExamMax ?? 0);
    if (cw + fe !== tm) return showToast?.(`لازم (أعمال السنة + الامتحان) = ${tm}`, "error");

    const chRaw = (creditHours ?? "").toString().trim();
    const ch = chRaw === "" ? null : Number(chRaw);
    if (chRaw !== "" && (!Number.isFinite(ch) || ch <= 0)) {
      return showToast?.("عدد الساعات لازم يكون رقم أكبر من 0", "error");
    }

    if (programType === "postgraduate" && !postgraduateProgram.trim()) {
      return showToast?.("اكتب اسم برنامج الدراسات العليا أولاً", "error");
    }

    const payload = {
      faculty_id: selectedFacultyId,
      department_id: selectedDepartmentId,
      academic_year: academicYear.trim(),
      level_name: levelName.trim(),
      term_name: termName.trim(),
      program_type: programType,
      postgraduate_program: programType === "postgraduate" ? postgraduateProgram.trim() : null,

      course_name: courseName.trim(),
      instructor: instructor.trim(),
      credit_hours: ch,
      total_mark: tm,
      coursework_max: cw,
      final_exam_max: fe,
    };

    setSaving(true);
    try {
      if (editingCourseId) {
        const res = await fetch(`${API_BASE}/courses/${editingCourseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "فشل تعديل المادة");
        showToast?.(data.message || "تم تعديل المادة", "success");
      } else {
        const res = await fetch(`${API_BASE}/courses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "فشل إضافة المادة");
        showToast?.(data.message || "تمت إضافة المادة", "success");
      }

      resetForm();
      fetchCourses();
    } catch (e2) {
      console.error(e2);
      showToast?.(e2.message || "مشكلة في حفظ المادة", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEditCourse = (c) => {
    setEditingCourseId(c.id);
    setCourseName(c.course_name ?? "");
    setInstructor(c.instructor ?? "");
    setCreditHours(c.credit_hours ?? "");

    setTotalMark(Number(c.total_mark ?? 100));
    setCourseworkMax(Number(c.coursework_max ?? 40));
    setFinalExamMax(Number(c.final_exam_max ?? 60));
  };

  const handleDeleteCourse = async (c) => {
    if (!window.confirm(`هل أنت متأكد من حذف المادة "${c.course_name}"؟`)) return;
    try {
      const res = await fetch(`${API_BASE}/courses/${c.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل حذف المادة");
      showToast?.(data.message || "تم حذف المادة", "success");
      fetchCourses();
    } catch (e) {
      console.error(e);
      showToast?.(e.message || "مشكلة في حذف المادة", "error");
    }
  };

  const partsOk = Number(courseworkMax || 0) + Number(finalExamMax || 0) === Number(totalMark || 100);

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h2 className="card-title">إدارة المواد</h2>

      <div className="two-col-grid" style={{ marginBottom: 12 }}>
        {/* 1) الكلية */}
        <div className="input-group">
          <label className="input-label">الكلية</label>
          <select className="input-field" value={selectedFacultyId} onChange={(e) => onSelectFaculty(e.target.value)}>
            <option value="">— اختار —</option>
            {faculties.map((f) => (
              <option key={f.id} value={f.id}>{f.faculty_name}</option>
            ))}
          </select>
        </div>

        {/* 2) القسم */}
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
              <option key={d.id} value={d.id}>{d.department_name}</option>
            ))}
          </select>
        </div>

<div className="input-group" style={{ gridColumn: "1 / -1" }}>
  <label className="input-label">نوع البرنامج</label>

  <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
      <input
        type="radio"
        name="programTypeCourses"
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
        name="programTypeCourses"
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
        name="programTypeCourses"
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

        {/* 5) السنة الدراسية */}
        <div className="input-group">
          <label className="input-label">السنة الدراسية</label>

          <input
            className="input-field"
            dir="rtl"
            list="years_list"
            placeholder="مثال: 2024/2025"
            value={academicYear}
            onChange={(e) => {
              setAcademicYear(e.target.value);
              setLevelName("");
              setTermName("");
              setCourses([]);
              resetForm();
            }}
            disabled={!canPickYear}
          />

          <datalist id="years_list">
            {yearOptions.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </div>

        {/* 6) المستوى */}
        <div className="input-group">
          <label className="input-label">المستوى</label>

          <input
            className="input-field"
            dir="rtl"
            list="levels_list"
            placeholder="مثال: المستوى الأول"
            value={levelName}
            onChange={(e) => {
              setLevelName(e.target.value);
              setTermName("");
              setCourses([]);
              resetForm();
            }}
            disabled={!canPickLevel}
          />

          <datalist id="levels_list">
            {levelOptions.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </div>

        {/* 7) الفصل الدراسي */}
        <div className="input-group">
          <label className="input-label">الفصل الدراسي</label>

          <input
            className="input-field"
            dir="rtl"
            list="terms_list"
            placeholder="مثال: الفصل الأول"
            value={termName}
            onChange={(e) => setTermName(e.target.value)}
            onBlur={() => ensurePeriodSaved(academicYear, levelName, termName)}
            disabled={!canPickTerm}
          />

          <datalist id="terms_list">
            {termOptions.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </div>
      </div>

      <form onSubmit={handleSaveCourse} className="two-col-grid" style={{ alignItems: "flex-end", marginBottom: 12 }}>
        <div className="input-group">
          <label className="input-label">المادة</label>
          <input className="input-field" value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="اسم المادة" disabled={!canLoad} />
        </div>

<div className="input-group">
  <label className="input-label">الأستاذ</label>

  <input
    className="input-field"
    dir="rtl"
    value={instructor}
    onChange={(e) => setInstructor(e.target.value)}
    placeholder={loadingInstructors ? "جارٍ تحميل الأساتذة..." : "اختار من القائمة "}
    disabled={!canLoad}
    list="instructors_list"
  />

  <datalist id="instructors_list">
    {instructorsList.map((name) => (
      <option key={name} value={name} />
    ))}
  </datalist>
</div>


        <div className="input-group">
          <label className="input-label">عدد الساعات</label>
          <input className="input-field" type="number" value={creditHours} onChange={(e) => setCreditHours(e.target.value)} placeholder="مثال: 3" disabled={!canLoad} />
        </div>

        <div className="input-group">
          <label className="input-label">المجموع الكلي</label>
          <input className="input-field" type="number" value={totalMark} onChange={(e) => setTotalMark(Number(e.target.value || 0))} disabled={!canLoad} />
        </div>

        <div className="input-group">
          <label className="input-label">أعمال السنة</label>
          <input className="input-field" type="number" value={courseworkMax} onChange={(e) => setCourseworkMax(Number(e.target.value || 0))} disabled={!canLoad} />
        </div>

        <div className="input-group">
          <label className="input-label">الامتحان النهائي</label>
          <input className="input-field" type="number" value={finalExamMax} onChange={(e) => setFinalExamMax(Number(e.target.value || 0))} disabled={!canLoad} />
        </div>

<div>
  {!partsOk && canLoad && (
    <div style={{ color: "#b91c1c", marginBottom: 4 }}>
      لازم (أعمال السنة + الامتحان) = {Number(totalMark || 100)}
    </div>
  )}

  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <button
      type="submit"
      className="btn btn-primary"
      disabled={saving || !canLoad}
    >
      {saving ? "جاري الحفظ..." : editingCourseId ? "حفظ " : "إضافة المادة"}
    </button>

    {editingCourseId && (
      <button
        type="button"
        className="btn btn-outline"
        onClick={resetForm}
      >
        إلغاء 
      </button>
    )}
  </div>
</div>

      </form>

      <div style={{ marginTop: 8, overflowX: "auto" }}>
        {!canLoad ? (
          <p style={{ color: "#6b7280" }}></p>
        ) : loadingCourses ? (
          <p>جارٍ تحميل المواد...</p>
        ) : courses.length === 0 ? (
          <p>لا توجد مواد لهذه الاختيارات.</p>
        ) : (
          <table className="simple-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>#</th>
                <th>المادة</th>
                <th>الأستاذ</th>
                <th>الساعات</th>
                <th>أعمال السنة</th>
                <th>النهائي</th>
                <th>المجموع</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c, idx) => (
                <tr key={c.id}>
                  <td>{idx + 1}</td>
                  <td>{c.course_name}</td>
                  <td>{c.instructor || "—"}</td>
                  <td>{c.credit_hours ?? "—"}</td>
                  <td>{c.coursework_max}</td>
                  <td>{c.final_exam_max}</td>
                  <td>{c.total_mark}</td>
                  <td>
                    <button type="button" className="btn btn-outline" onClick={() => handleEditCourse(c)}>
                      تعديل
                    </button>
                    {/* <button type="button" className="btn btn-danger" style={{ marginInlineStart: 4 }} onClick={() => handleDeleteCourse(c)}>
                      حذف
                    </button> */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};


const FacultyDepartmentAdmin = () => {
  const navigate = useNavigate();

  const [faculties, setFaculties] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [departments, setDepartments] = useState([]);

  const [activeTab, setActiveTab] = useState("main"); // main | grading

  const [facultyName, setFacultyName] = useState("");
  const [editingFacultyId, setEditingFacultyId] = useState(null);

  const [departmentName, setDepartmentName] = useState("");
  const [levelsCount, setLevelsCount] = useState(4);  //   افتراضي 4
  const [editingDepartmentId, setEditingDepartmentId] = useState(null);

  const [loadingFaculties, setLoadingFaculties] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [facultyType, setFacultyType] = useState("theoretical"); // default

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

useEffect(() => {
  const loadFaculties = async () => {
    setLoadingFaculties(true);
    try {
      const res = await fetch(`${API_BASE}/faculties-list`);
      const allFaculties = await res.json();

      const allowed = getAllowedFaculties();

      let filtered = allFaculties;
      if (allowed !== null) {
        filtered = allFaculties.filter(f => allowed.includes(f.id));
      }

      setFaculties(Array.isArray(filtered) ? filtered : []);

      if (filtered.length === 0 && allowed !== null) {
        showToast("لا توجد كليات مسموح لك الوصول إليها", "error");
      }

      // إعادة التحقق من الكلية المختارة
      if (selectedFaculty) {
        const stillAllowed = filtered.find(f => f.id === selectedFaculty.id);
        if (!stillAllowed) {
          setSelectedFaculty(null);
          setDepartments([]);
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

  const fetchFaculties = async () => {
    setLoadingFaculties(true);
    try {
      const res = await fetch(`${API_BASE}/faculties-list`);
      const data = await res.json();
      setFaculties(Array.isArray(data) ? data : []);

      if (selectedFaculty) {
        const stillExist = (Array.isArray(data) ? data : []).find((f) => f.id === selectedFaculty.id);
        if (!stillExist) {
          setSelectedFaculty(null);
          setDepartments([]);
        }
      }
    } catch (e) {
      console.error(e);
      showToast("مشكلة في تحميل الكليات", "error");
    } finally {
      setLoadingFaculties(false);
    }
  };

  const fetchDepartments = async (faculty) => {
    if (!faculty) return;
    setLoadingDepartments(true);
    try {
      const res = await fetch(`${API_BASE}/departments/${faculty.id}`);
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      showToast("مشكلة في تحميل الأقسام", "error");
    } finally {
      setLoadingDepartments(false);
    }
  };

  const handleSelectFaculty = (faculty) => {
    setSelectedFaculty(faculty);
    setEditingDepartmentId(null);
    setDepartmentName("");
    fetchDepartments(faculty);
  };

const handleSaveFaculty = async (e) => {
  e.preventDefault();
  if (!facultyName.trim()) {
    showToast("اكتبي اسم الكلية أولاً", "error");
    return;
  }

  setSaving(true);
  try {
    const payload = {
      faculty_name: facultyName.trim(),
      faculty_type: facultyType, // ← الجديد
    };

    let res;
    if (editingFacultyId) {
      res = await fetch(`${API_BASE}/faculties/${editingFacultyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch(`${API_BASE}/faculties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "فشل الحفظ");

    showToast(data.message || (editingFacultyId ? "تم تعديل الكلية" : "تمت إضافة الكلية"), "success");

    setFacultyName("");
    setFacultyType("theoretical");
    setEditingFacultyId(null);
    fetchFaculties();
  } catch (e) {
    console.error(e);
    showToast("مشكلة في حفظ الكلية: " + e.message, "error");
  } finally {
    setSaving(false);
  }
};

  const handleEditFaculty = (faculty) => {
    setEditingFacultyId(faculty.id);
    setFacultyName(faculty.faculty_name);
    setFacultyType(faculty.faculty_type || "theoretical");
  };

  const handleDeleteFaculty = async (faculty) => {
    if (!window.confirm(`هل أنت متأكد من حذف الكلية "${faculty.faculty_name}"؟\nسيتم حذف أقسامها أيضًا.`)) return;

    try {
      const res = await fetch(`${API_BASE}/faculties/${faculty.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) showToast(data.error || "فشل حذف الكلية", "error");
      else {
        showToast(data.message || "تم حذف الكلية", "success");
        if (selectedFaculty && selectedFaculty.id === faculty.id) {
          setSelectedFaculty(null);
          setDepartments([]);
        }
        fetchFaculties();
      }
    } catch (e) {
      console.error(e);
      showToast("مشكلة في الاتصال بالسيرفر", "error");
    }
  };

const handleSaveDepartment = async (e) => {
  e.preventDefault();
  if (!selectedFaculty) {
    showToast("اختارِ كلية أولاً", "error");
    return;
  }
  if (!departmentName.trim()) {
    showToast("اكتبي اسم القسم أولاً", "error");
    return;
  }

  setSaving(true);
  try {
    const payload = {
      faculty_id: selectedFaculty.id,
      department_name: departmentName.trim(),
      levels_count: levelsCount,  
    };

    if (editingDepartmentId) {
      // تعديل
      const res = await fetch(`${API_BASE}/departments/${editingDepartmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل تعديل القسم");
      showToast(data.message || "تم تعديل القسم", "success");
      setDepartmentName("");
      setLevelsCount(4);         
      setEditingDepartmentId(null);
      fetchDepartments(selectedFaculty);
    } else {
      // إضافة جديد
      const res = await fetch(`${API_BASE}/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل إضافة القسم");
      showToast(data.message || "تمت إضافة القسم", "success");
      setDepartmentName("");
      setLevelsCount(4);
      fetchDepartments(selectedFaculty);
    }
  } catch (e) {
    console.error(e);
    showToast("مشكلة في الاتصال بالسيرفر", "error");
  } finally {
    setSaving(false);
  }
};

const handleEditDepartment = (dept) => {
  setEditingDepartmentId(dept.id);
  setDepartmentName(dept.department_name);
  setLevelsCount(dept.levels_count || 4);  
};

  const handleDeleteDepartment = async (dept) => {
    if (!window.confirm(`هل أنت متأكد من حذف القسم "${dept.department_name}"؟`)) return;

    try {
      const res = await fetch(`${API_BASE}/departments/${dept.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) showToast(data.error || "فشل حذف القسم", "error");
      else {
        showToast(data.message || "تم حذف القسم", "success");
        fetchDepartments(selectedFaculty);
      }
    } catch (e) {
      console.error(e);
      showToast("مشكلة في الاتصال بالسيرفر", "error");
    }
  };

  return (
    <div className="admission-layout">
      <header className="library-header">
        <div className="library-header-title">
          <span style={{ fontSize: 22 }}></span>
          <span>  إعدادات النظام الأكاديمي</span>
        </div>
        <button
          onClick={() => navigate("/")}
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
          title="رجوع للصفحة الرئيسية"
        >
          <IoArrowBack />
        </button>
      </header>

      <main className="library-main">
        <div className="library-container">
          {/* Tabs */}
          <div
            style={{
              display: "flex",
               justifyContent: "center",
              gap: 10,
              marginBottom: 18,
              borderBottom: "1px solid #e6e8ee",
              paddingBottom: 10,
              flexWrap: "wrap",  
            }}
          >
            <button
              onClick={() => setActiveTab("main")}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: activeTab === "main" ? "1px solid #0a3753" : "1px solid #e6e8ee",
                background: activeTab === "main" ? "rgba(10,55,83,0.08)" : "#fff",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 15,
                color: "#0a3753",
                fontFamily: `"Cairo", "Tajawal", Arial, sans-serif`,
              }}
            >
              الكليات والأقسام
            </button>

            <button
              onClick={() => setActiveTab("grading")}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: activeTab === "grading" ? "1px solid #0a3753" : "1px solid #e6e8ee",
                background: activeTab === "grading" ? "rgba(10,55,83,0.08)" : "#fff",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 15,
                color: "#0a3753",
                fontFamily: `"Cairo", "Tajawal", Arial, sans-serif`,
              }}
            >
              تصنيف الدرجات
            </button>

            <button
  onClick={() => setActiveTab("courses")}
  style={{
    padding: "10px 16px",
    borderRadius: 12,
    border: activeTab === "courses" ? "1px solid #0a3753" : "1px solid #e6e8ee",
    background: activeTab === "courses" ? "rgba(10,55,83,0.08)" : "#fff",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 15,
    color: "#0a3753",
    fontFamily: `"Cairo", "Tajawal", Arial, sans-serif`,
  }}
>
  المواد
</button>

          </div>

          {/* ✅ تاب 1 */}
          {activeTab === "main" && (
            <>
              {/* الكليات */}
              <div className="card">
                <h2 className="card-title">الكليات</h2>

<form onSubmit={handleSaveFaculty} className="two-col-grid" style={{ alignItems: "flex-end", marginBottom: 12 }}>
  <div className="input-group">
    <label className="input-label">{editingFacultyId ? "تعديل اسم الكلية" : "إضافة كلية جديدة"}</label>
    <input
      type="text"
      dir="rtl"
      className="input-field"
      placeholder="أدخل اسم الكلية"
      value={facultyName}
      onChange={(e) => setFacultyName(e.target.value)}
      required
    />
  </div>

  <div className="input-group">
    <label className="input-label">نوع الكلية</label>
    <select
      className="input-field"
      value={facultyType}
      onChange={(e) => setFacultyType(e.target.value)}
      required
    >
      <option value="theoretical">نظرية</option>
      <option value="practical">عملية</option>
    </select>

  </div>

  <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, justifyContent: "flex-end" }}>
    <button type="submit" className="btn btn-primary" disabled={saving}>
      {saving ? "جاري الحفظ..." : editingFacultyId ? "حفظ التعديل" : "إضافة الكلية"}
    </button>

    {editingFacultyId && (
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => {
          setEditingFacultyId(null);
          setFacultyName("");
          setFacultyType("theoretical"); // reset
        }}
      >
        إلغاء التعديل
      </button>
    )}
  </div>
</form>

                <div style={{ marginTop: 8, overflowX: "auto" }}>
                  {loadingFaculties ? (
                    <p>جارٍ تحميل الكليات...</p>
                  ) : faculties.length === 0 ? (
                    <p>لا توجد كليات بعد.</p>
                  ) : (
                    <table className="simple-table" style={{ width: "100%" }}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>اسم الكلية</th>
                          <th>نوع الكلية</th>
                          <th>عدد الأقسام</th>
                          <th>إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {faculties.map((f, index) => (
                          <tr key={f.id} className={selectedFaculty && selectedFaculty.id === f.id ? "row-selected" : ""}>
                            <td>{index + 1}</td>
                            <td>{f.faculty_name}</td>
                            <td>{f.faculty_type  ? (f.faculty_type === "theoretical" ? "نظرية" : "عملية")   : "غير محدد"}</td>
                            <td>{f.departments_count}</td>
                            <td>
                              <button type="button" className="btn btn-outline" onClick={() => handleSelectFaculty(f)}>
                                عرض الأقسام
                              </button>
                              <button type="button" className="btn btn-outline" style={{ marginInlineStart: 4 }} onClick={() => handleEditFaculty(f)}>
                                تعديل
                              </button>
                              {/* <button type="button" className="btn btn-danger" style={{ marginInlineStart: 4 }} onClick={() => handleDeleteFaculty(f)}>
                                حذف
                              </button> */}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* الأقسام */}
              <div className="card">
                <h2 className="card-title">الأقسام {selectedFaculty ? `- ${selectedFaculty.faculty_name}` : ""}</h2>

                {!selectedFaculty ? (
                  <p style={{ color: "#6b7280" }}>اختر كلية من الجدول أعلاه لعرض وإدارة الأقسام الخاصة بها.</p>
                ) : (
                  <>
<form onSubmit={handleSaveDepartment} className="two-col-grid" style={{ alignItems: "flex-end", marginBottom: 12 }}>
  <div className="input-group">
    <label className="input-label">{editingDepartmentId ? "تعديل اسم القسم" : "إضافة قسم جديد"}</label>
    <input 
      className="input-field" 
      placeholder="أدخل اسم القسم" 
      value={departmentName} 
      onChange={(e) => setDepartmentName(e.target.value)} 
    />
  </div>

  <div className="input-group">
    <label className="input-label">عدد المستويات</label>
    <input 
      type="number" 
      min="1" 
      max="10" 
      className="input-field" 
      value={levelsCount} 
      onChange={(e) => setLevelsCount(Number(e.target.value) || 4)} 
      placeholder="مثال: 4 أو 5"
    />
  </div>

  <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, justifyContent: "flex-end" }}>
    <button type="submit" className="btn btn-primary" disabled={saving}>
      {saving ? "جاري الحفظ..." : editingDepartmentId ? "حفظ التعديل" : "إضافة القسم"}
    </button>

    {editingDepartmentId && (
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => {
          setEditingDepartmentId(null);
          setDepartmentName("");
          setLevelsCount(4);
        }}
      >
        إلغاء
      </button>
    )}
  </div>
</form>

                    <div style={{ marginTop: 8, overflowX: "auto" }}>
                      {loadingDepartments ? (
                        <p>جارٍ تحميل الأقسام...</p>
                      ) : departments.length === 0 ? (
                        <p>لا توجد أقسام لهذه الكلية بعد.</p>
                      ) : (
                        <table className="simple-table" style={{ width: "100%" }}>
<thead>
  <tr>
    <th>#</th>
    <th>اسم القسم</th>
    <th>عدد المستويات</th>  
    <th>إجراءات</th>
  </tr>
</thead>
<tbody>
  {departments.map((d, index) => (
    <tr key={d.id}>
      <td>{index + 1}</td>
      <td>{d.department_name}</td>
      <td>{d.levels_count || "—"}</td>
      <td>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => handleEditDepartment(d)}
          >
            تعديل
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => handleDeleteDepartment(d)}
          >
            حذف
          </button>
        </div>
      </td>
    </tr>
  ))}
</tbody>
                        </table>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {activeTab === "grading" && (
            <GradeRulesAdmin showToast={showToast} faculties={faculties} />
          )}

          {activeTab === "courses" && (
            <CoursesAdmin showToast={showToast} faculties={faculties} />
          )}
        </div>
      </main>

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default FacultyDepartmentAdmin;
          
