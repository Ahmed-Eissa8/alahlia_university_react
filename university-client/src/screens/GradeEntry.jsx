import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000/api";

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

const GradeEntry = () => {
  const navigate = useNavigate();

  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [periods, setPeriods] = useState([]);
  const [yearOptions, setYearOptions] = useState([]);
  const [levelOptions, setLevelOptions] = useState([]);
  const [termOptions, setTermOptions] = useState([]);

  const [courses, setCourses] = useState([]);

  const pgSmart = usePostgradProgramsSmartList();

  // ===== Filters
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");

  const [programType, setProgramType] = useState("bachelor");
  const [postgraduateProgram, setPostgraduateProgram] = useState("");

  const [academicYear, setAcademicYear] = useState("");
  const [levelName, setLevelName] = useState("");
  const [termName, setTermName] = useState("");

  const [selectedCourseId, setSelectedCourseId] = useState("");

  // ===== Grade Entry Data
  const [courseInfo, setCourseInfo] = useState(null);
  const [students, setStudents] = useState([]);

  const [facultyScale, setFacultyScale] = useState([]);

  const [loadingFaculties, setLoadingFaculties] = useState(false);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);

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

  const canLoadCourses =
    selectedFacultyId &&
    selectedDepartmentId &&
    canProceedAfterProgram &&
    academicYear.trim() &&
    levelName.trim() &&
    termName.trim();

useEffect(() => {
  const fetchFacultyScale = async () => {
    if (!selectedFacultyId) {
      setFacultyScale([]);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/grading-scale/${selectedFacultyId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.scale)) {
        // console.log("مقياس الكلية جاي من الباك:", JSON.stringify(data.scale, null, 2));
        setFacultyScale(data.scale);
      } else {
        setFacultyScale([]);
        showToast(data.error || "مشكلة في جلب مقياس الدرجات", "error");
      }
    } catch (err) {
      setFacultyScale([]);
      showToast("خطأ في جلب مقياس الدرجات", "error");
    }
  };

  fetchFacultyScale();
}, [selectedFacultyId]);

const getLetterAndPointsPreview = (total) => {
  if (total == null || facultyScale.length === 0) {
    return { letter: null, points: null };
  }

  const sortedRules = [...facultyScale].map(rule => {
    const min = Math.min(Number(rule.min_mark), Number(rule.max_mark));
    const max = Math.max(Number(rule.min_mark), Number(rule.max_mark));
    return { ...rule, min_mark: min, max_mark: max };
  }).sort((a, b) => b.min_mark - a.min_mark);  

  // console.log("النطاقات بعد التصحيح:", sortedRules);

  for (const rule of sortedRules) {
    const min = Number(rule.min_mark);
    const max = Number(rule.max_mark);

    if (total >= min && total <= max) { 
      // console.log(`طابق بعد تصحيح: ${rule.letter} (${min}-${max}) → نقاط ${rule.points}`);
      return { letter: rule.letter || 'F', points: Number(rule.points) || 0.0 };
    }
  }

  // console.log("ما طابقش بعد التصحيح → F");
  return { letter: 'F', points: 0.0 };
};

  // =========================
  // Load faculties
  // =========================
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

      // إعادة التحقق من الكلية المختارة
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

  useEffect(() => {
    if (programType === "postgraduate") {
      pgSmart.fetchPrograms();
    } else {
      setPostgraduateProgram("");
    }
  }, [programType]);

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

  // =========================
  // Load departments
  // =========================
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

  // =========================
  // Load academic periods (حسب البرنامج)
  // =========================
  const fetchAcademicPeriods = async (pType, pgProg) => {
    setLoadingPeriods(true);
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

      const ys = Array.from(
        new Set(rows.map((r) => (r.academic_year || "").trim()).filter(Boolean))
      );
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
      new Set(
        rows
          .filter((r) => (r.academic_year || "").trim() === y)
          .map((r) => (r.level_name || "").trim())
          .filter(Boolean)
      )
    );
    setLevelOptions(levels);

    const terms = Array.from(
      new Set(
        rows
          .filter(
            (r) =>
              (r.academic_year || "").trim() === y &&
              (r.level_name || "").trim() === l
          )
          .map((r) => (r.term_name || "").trim())
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
    setCourses([]);
    setSelectedCourseId("");
    setCourseInfo(null);
    setStudents([]);

    if (selectedDepartmentId) {
      fetchAcademicPeriods(programType, postgraduateProgram);
    }
  }, [programType, postgraduateProgram]);

  useEffect(() => {
    if (programType !== "postgraduate") setPostgraduateProgram("");
  }, [programType]);


  const fetchCourses = async () => {
  if (!canLoadCourses) return;

  setLoadingCourses(true);
  try {
    const params = new URLSearchParams({
      faculty_id: selectedFacultyId,
      department_id: selectedDepartmentId,
      academic_year: academicYear.trim(),
      level_name: levelName.trim(),
      term_name: termName.trim(),
      program_type: programType,
    });

    if (programType === "postgraduate" && postgraduateProgram.trim()) {
      params.append("postgraduate_program", postgraduateProgram.trim());
    }

    const res = await fetch(`${API_BASE}/grade-entry-courses?${params.toString()}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "فشل تحميل المواد");
    }

    setCourses(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error("خطأ في fetchCourses:", e);
    showToast(e.message || "مشكلة في تحميل المواد", "error");
    setCourses([]);
  } finally {
    setLoadingCourses(false);
  }
};

  useEffect(() => {
    setSelectedCourseId("");
    setCourseInfo(null);
    setStudents([]);

    if (canLoadCourses) fetchCourses();
  }, [
    selectedFacultyId,
    selectedDepartmentId,
    academicYear,
    levelName,
    termName,
    programType,
    postgraduateProgram,
  ]);

  const courseMeta = useMemo(() => {
    if (!courseInfo) return null;
    return {
      instructor: courseInfo.instructor || "—",
      hours: courseInfo.credit_hours ?? "—",
      cwMax: Number(courseInfo.coursework_max ?? 40),
      feMax: Number(courseInfo.final_exam_max ?? 60),
      total: Number(courseInfo.total_mark ?? 100),
    };
  }, [courseInfo]);


  const clampNum = (v, min, max, fieldName = "") => {
  const n = Number(v);
  if (isNaN(n)) return null;

  if (n > max) {
    showToast(`الحد الأقصى لـ ${fieldName} هو ${max}، تم تعديل القيمة`, "error");
    return max;
  }
  if (n < min) return min;

  return n;
};


const calcStudentRow = (student) => {
  const cwMax = courseMeta?.cwMax ?? 40;
  const feMax = courseMeta?.feMax ?? 60;
  const totalMax = courseMeta?.total ?? cwMax + feMax;

  const cw = clampNum(student.coursework_mark, 0, cwMax, "أعمال السنة");
  const fe = clampNum(student.final_exam_mark, 0, feMax, "النهائي");
  const total = (cw != null && fe != null) ? clampNum(cw + fe, 0, totalMax, "المجموع") : null;

  const { letter, points } = getLetterAndPointsPreview(total);

  return {
    ...student,
    coursework_mark: cw ?? "",
    final_exam_mark: fe ?? "",
    total_mark: total,
    letter,
    points,
  };
};

  // =========================
  // Fetch students for selected course
  // =========================
  const fetchStudentsForCourse = async (courseId) => {
    if (!courseId) return;
    setLoadingStudents(true);
    try {
     const params = new URLSearchParams({
  course_id: courseId,
  academic_year: academicYear.trim(),
  level_name: levelName.trim(),
  term_name: termName.trim(),
  program_type: programType,
  ...(programType === "postgraduate" && { postgraduate_program: postgraduateProgram || null })
});

const res = await fetch(`${API_BASE}/grade-entry/students?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل تحميل الطلاب");

      setCourseInfo(data.course || null);
      const raw = Array.isArray(data.students) ? data.students : [];
      setStudents(raw.map(calcStudentRow));
    } catch (e) {
      console.error(e);
      setCourseInfo(null);
      setStudents([]);
      showToast(e.message || "مشكلة في تحميل الطلاب", "error");
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    setCourseInfo(null);
    setStudents([]);
    if (selectedCourseId) fetchStudentsForCourse(selectedCourseId);
  }, [selectedCourseId]);


  const resetBelowFaculty = () => {
    setDepartments([]);
    setSelectedDepartmentId("");

    setProgramType("bachelor");
    setPostgraduateProgram("");

    setAcademicYear("");
    setLevelName("");
    setTermName("");
    setCourses([]);
    setSelectedCourseId("");
    setCourseInfo(null);
    setStudents([]);
  };

  const resetBelowDepartment = () => {
    setProgramType("bachelor");
    setPostgraduateProgram("");

    setAcademicYear("");
    setLevelName("");
    setTermName("");
    setCourses([]);
    setSelectedCourseId("");
    setCourseInfo(null);
    setStudents([]);
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


const onChangeMark = (studentId, field, value) => {
  setStudents((prev) =>
    prev.map((s) => {
      if (s.student_id !== studentId) return s;

      let clampedValue = value ? Number(value) : null;

      if (field === "coursework_mark") {
        clampedValue = clampNum(clampedValue, 0, courseMeta.cwMax, "أعمال السنة");
      } else if (field === "final_exam_mark") {
        clampedValue = clampNum(clampedValue, 0, courseMeta.feMax, "النهائي");
      }

      const newData = { ...s, [field]: clampedValue };

      const coursework = Number(newData.coursework_mark || 0);
      const final = Number(newData.final_exam_mark || 0);
      newData.total_mark = coursework + final;

      if (s.is_repeat) {
        if (newData.total_mark >= 50) {
          newData.letter = "C*";
          newData.points = 2.00;
        } else {
          newData.letter = "F";
          newData.points = 0.00;
        }
      } else {
        const { letter, points } = getLetterAndPointsPreview(newData.total_mark);
        newData.letter = letter ?? "—";
        newData.points = points ?? "—";
      }

      return newData;
    })
  );
};

const saveGrades = async () => {
  if (savingGrades || !selectedCourseId) return;

  setSavingGrades(true);

  const payload = {
    course_id: selectedCourseId,
    grades: students.map(s => ({
      student_id: s.student_id,
      coursework_mark: s.coursework_mark ?? null,
      final_exam_mark: s.final_exam_mark ?? null,
      is_repeat: s.is_repeat 
    })),
    academic_year: academicYear.trim(),
    level_name: levelName.trim(),
    term_name: termName.trim(),
    program_type: programType,
    postgraduate_program: programType === "postgraduate" ? postgraduateProgram.trim() : null
  };

  try {
    const res = await fetch(`${API_BASE}/save-grades`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "فشل الحفظ");

    showToast("تم حفظ الدرجات بنجاح!");
    await fetchStudentsForCourse(selectedCourseId);
  } catch (err) {
    showToast(err.message || "خطأ في الحفظ", "error");
  } finally {
    setSavingGrades(false);
  }
};

  return (
    <div className="admission-layout">
      <header className="library-header">
        <div className="library-header-title">
          <span style={{ fontSize: 22 }}></span>
          <span> إدخال الدرجات</span>
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
          {/* ===== Filters Card ===== */}
          <div className="card" style={{ marginTop: 14 }}>
            <h2 className="card-title">اختيار الفصل</h2>

            <div className="two-col-grid" style={{ marginBottom: 12 }}>
              {/* 1) الكلية */}
              <div className="input-group">
                <label className="input-label">الكلية</label>
                <select
                  className="input-field"
                  value={selectedFacultyId}
                  onChange={(e) => onSelectFaculty(e.target.value)}
                  disabled={loadingFaculties}
                >
                  <option value="">
                    {loadingFaculties ? "جارٍ التحميل..." : "— اختار —"}
                  </option>
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.faculty_name}
                    </option>
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
                    {!canPickDepartment
                      ? "اختار كلية أولاً"
                      : loadingDeps
                      ? "جارٍ تحميل الأقسام..."
                      : "— اختار —"}
                  </option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.department_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3) نوع البرنامج */}
              <div className="input-group" style={{ gridColumn: "1 / -1" }}>
                <label className="input-label">نوع البرنامج</label>

                <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                    <input
                      type="radio"
                      name="programTypeGrades"
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
                      name="programTypeGrades"
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
                      name="programTypeGrades"
                      value="postgraduate"
                      checked={programType === "postgraduate"}
                      onChange={(e) => setProgramType(e.target.value)}
                      disabled={!canPickProgramType}
                    />
                    دراسات عليا
                  </label>
                </div>
              </div>

              {/* 4) اسم برنامج الدراسات العليا */}
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

              {/* 5) السنة */}
              <div className="input-group">
                <label className="input-label">السنة الدراسية</label>
                <input
                  className="input-field"
                  dir="rtl"
                  list="years_list_grades"
                  placeholder="مثال: 2024/2025"
                  value={academicYear}
                  onChange={(e) => {
                    setAcademicYear(e.target.value);
                    setLevelName("");
                    setTermName("");
                    setCourses([]);
                    setSelectedCourseId("");
                    setCourseInfo(null);
                    setStudents([]);
                  }}
                  disabled={!canPickYear || loadingPeriods}
                />
                <datalist id="years_list_grades">
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
                  list="levels_list_grades"
                  placeholder="مثال: المستوى الأول"
                  value={levelName}
                  onChange={(e) => {
                    setLevelName(e.target.value);
                    setTermName("");
                    setCourses([]);
                    setSelectedCourseId("");
                    setCourseInfo(null);
                    setStudents([]);
                  }}
                  disabled={!canPickLevel}
                />
                <datalist id="levels_list_grades">
                  {levelOptions.map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </div>

              {/* 7) الفصل */}
              <div className="input-group">
                <label className="input-label">الفصل الدراسي</label>
                <input
                  className="input-field"
                  dir="rtl"
                  list="terms_list_grades"
                  placeholder="مثال: الفصل الأول"
                  value={termName}
                  onChange={(e) => {
                    setTermName(e.target.value);
                    setSelectedCourseId("");
                    setCourseInfo(null);
                    setStudents([]);
                  }}
                  disabled={!canPickTerm}
                />
                <datalist id="terms_list_grades">
                  {termOptions.map((x) => (
                    <option key={x} value={x} />
                  ))}
                </datalist>
              </div>

              {/* 8) المادة */}
              <div className="input-group" style={{ gridColumn: "1 / -1" }}>
                <label className="input-label">المادة</label>
                <select
                  className="input-field"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  disabled={!canLoadCourses || loadingCourses}
                >
                  <option value="">
                    {!canLoadCourses
                      ? "كمّل الاختيارات أولاً"
                      : loadingCourses
                      ? "جارٍ تحميل المواد..."
                      : "— اختار —"}
                  </option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.course_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Info عن المادة */}
            {courseMeta && (
              <div className="card" style={{ padding: 14, background: "#fff" }}>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontWeight: 800, color: "#0a3753" }}>
                  <div>الأستاذ: {courseMeta.instructor}</div>
                  <div>عدد الساعات: {courseMeta.hours}</div>
                  <div>أعمال السنة: {courseMeta.cwMax}</div>
                  <div>النهائي: {courseMeta.feMax}</div>
                  <div>المجموع: {courseMeta.total}</div>
                </div>
              </div>
            )}
          </div>

          {/* =========================
              Entry Only
             ========================= */}
          <div className="card" style={{ marginTop: 14 }}>
            <h2 className="card-title">الطلاب والدرجات</h2>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveGrades}
                disabled={!selectedCourseId || savingGrades || loadingStudents}
              >
                {savingGrades ? "جاري الحفظ..." : "حفظ الدرجات"}
              </button>

              <button
                type="button"
                className="btn btn-outline"
                onClick={() => fetchStudentsForCourse(selectedCourseId)}
                disabled={!selectedCourseId || loadingStudents}
              >
                {loadingStudents ? "جارٍ التحميل..." : "إعادة تحميل"}
              </button>

              <div style={{ color: "#6b7280", fontWeight: 800, alignSelf: "center" }}>
                عدد الطلاب: {students.length}
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              {!selectedCourseId ? (
                <p style={{ color: "#6b7280" }}>اختار المادة أولاً عشان نجيب الطلاب.</p>
              ) : loadingStudents ? (
                <p>جارٍ تحميل الطلاب...</p>
              ) : students.length === 0 ? (
                <p>لا توجد بيانات طلاب لهذه المادة/الفصل.</p>
              ) : (
<table className="simple-table" style={{ width: "100%" }}>
  <thead>
    <tr>
      <th>#</th>
      <th>الاسم</th>
      <th>الرقم الجامعي</th>
      {/* <th>حالة المادة</th> */}
      <th>أعمال السنة</th>
      <th>النهائي</th>
      <th>المجموع</th>
      <th>التقدير</th>
      <th>النقاط</th>
    </tr>
  </thead>
  <tbody>
    {students.map((s, idx) => (
      <tr key={s.student_id} style={s.is_repeat ? { backgroundColor: "#fff3e0" } : {}}>  
        <td>{idx + 1}</td>
        <td>{s.full_name}</td>
        <td>{s.university_id}</td>
        {/* <td style={{ fontWeight: "bold", color: s.is_repeat ? "#e65100" : "#424242" }}> 
          {s.is_repeat ? "إعادة" : "منتظم"}
        </td> */}
        <td>
          <input
            className="input-field"
            type="number"
            value={s.coursework_mark}
            onChange={(e) => onChangeMark(s.student_id, "coursework_mark", e.target.value)}
          />
        </td>
        <td>
          <input
            className="input-field"
            type="number"
            value={s.final_exam_mark}
            onChange={(e) => onChangeMark(s.student_id, "final_exam_mark", e.target.value)}
          />
        </td>
        <td style={{ fontWeight: 800 }}>{s.total_mark ?? "—"}</td>
        <td style={{ fontWeight: 800, color: s.letter === 'F' ? '#dc2626' : '#0a3753' }}>
          {s.letter || "—"}
        </td>
        <td style={{ fontWeight: 800 }}>{s.points ?? "—"}</td>
      </tr>
    ))}
  </tbody>
</table>
              )}
            </div>
          </div>
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

export default GradeEntry;