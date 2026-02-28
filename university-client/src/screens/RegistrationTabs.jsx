import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";

const API_BASE = "http://localhost:5000/api";
const DEFAULT_REGISTRAR = "";

const TERM_OPTIONS = ["الفصل الأول", "الفصل الثاني"];
const INSTALLMENT_OPTIONS = [
  // { label: "بدون أقساط (دفع كامل)", value: 0 },
  { label: "قسط واحد", value: 1 },
  { label: "قسطين", value: 2 },
  { label: "3 أقساط", value: 3 },
  { label: "4 أقساط", value: 4 },
  { label: "5 أقساط", value: 5 },
  { label: "6 أقساط", value: 6 },
];

const SCHOLARSHIP_OPTIONS = [
  { type: "لا منحة", percentage: 0 },
  { type: "منحة أبناء مؤسسين", percentage: 100 },
  { type: "منحة أبناء عاملين", percentage: 75 },
  { type: "منحة تفوق", percentage: 100 },
  { type: "منحة أشقاء", percentage: null },
  { type: "تخفيضات المدير", percentage: null },
  { type: "أخرى", percentage: null },
];

const ui = {
  page: {
    fontFamily: `"Cairo", "Tajawal", system-ui, -apple-system, "Segoe UI", Arial, sans-serif`,
    fontSize: 16,
  },

  titleH2: {
    fontSize: 22,
    fontWeight: 800,
    color: "#0a3753",
    margin: "10px 0 16px",
  },

  card: {
    border: "1px solid #e6e8ee",
    background: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 18,
    boxShadow: "0 4px 16px rgba(10,55,83,0.06)",
  },

  sectionTitle: {
    marginTop: 0,
    fontSize: 18,
    fontWeight: 800,
    color: "#0a3753",
    marginBottom: 12,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  label: {
    fontSize: 14,
    fontWeight: 800,
    color: "#334155",
  },

  hint: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },

  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 10,
    border: "1px solid #d9dee8",
    outline: "none",
    fontSize: 16,
    fontFamily: `"Cairo", "Tajawal", Arial, sans-serif`,
    background: "#fff",
  },

  select: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 10,
    border: "1px solid #d9dee8",
    outline: "none",
    fontSize: 16,
    fontFamily: `"Cairo", "Tajawal", Arial, sans-serif`,
    background: "#fff",
    cursor: "pointer",
  },

  textarea: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 10,
    border: "1px solid #d9dee8",
    outline: "none",
    fontSize: 16,
    fontFamily: `"Cairo", "Tajawal", Arial, sans-serif`,
    background: "#fff",
    resize: "vertical",
  },

  primaryBtn: {
    marginTop: 16,
    padding: "12px 18px",
    background: "#0a3753",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 16,
    fontFamily: `"Cairo", "Tajawal", Arial, sans-serif`,
  },

  secondaryBtn: {
    marginTop: 16,
    padding: "12px 18px",
    background: "#0f766e",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 16,
    fontFamily: `"Cairo", "Tajawal", Arial, sans-serif`,
  },

  tabsRow: {
    display: "flex",
     justifyContent: "center",
    gap: 10,
    marginBottom: 18,
    borderBottom: "1px solid #e6e8ee",
    paddingBottom: 10,
    flexWrap: "wrap",  
  },

  tabBtn: (active) => ({
    padding: "10px 16px",
    borderRadius: 12,
    border: active ? "1px solid #0a3753" : "1px solid #e6e8ee",
    background: active ? "rgba(10,55,83,0.08)" : "#fff",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 15,
    color: "#0a3753",
    fontFamily: `"Cairo", "Tajawal", Arial, sans-serif`,
  }),

  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e6e8ee",
    borderRadius: 12,
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 15,
  },

  th: {
    borderBottom: "1px solid #e6e8ee",
    padding: "10px 10px",
    textAlign: "right",
    background: "#f8fafc",
    color: "#0a3753",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  td: {
    borderBottom: "1px solid #f1f5f9",
    padding: "10px 10px",
    textAlign: "right",
    color: "#0f172a",
  },
};


const ACADEMIC_STATUS_OPTIONS = [
  "نظامي",
  "إعاده",
  "محوّل",
  "مجمّد",
  "منسحب",
  "تجسير",
  "فصل",
];

const REGISTRATION_STATUS_OPTIONS = ["مسجّل", "غير مسجّل"];

function useAcademicPeriodsSmartList({ programType, postgraduateProgram }) {
  const [periods, setPeriods] = useState([]);
  const [yearOptions, setYearOptions] = useState([]);
  const [levelOptions, setLevelOptions] = useState([]);
  const [termOptions, setTermOptions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
  const token = sessionStorage.getItem('token');
  if (!token) {
    navigate('/login', { replace: true });
  }
}, [navigate]);

  const fetchAcademicPeriods = async () => {
    try {
      const qs = new URLSearchParams({
        program_type: programType || "bachelor",
      });
      if ((programType || "bachelor") === "postgraduate" && (postgraduateProgram || "").trim()) {
        qs.set("postgraduate_program", postgraduateProgram.trim());
      }

      const res = await fetch(`${API_BASE}/academic-periods?${qs.toString()}`);
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

  const rebuildOptions = (academicYear, levelName) => {
    const y = (academicYear || "").trim();
    const l = (levelName || "").trim();

    const levels = Array.from(
      new Set(
        periods
          .filter(r => (r.academic_year || "").trim() === y)
          .map(r => (r.level_name || "").trim())
          .filter(Boolean)
      )
    );
    setLevelOptions(levels);

    const terms = Array.from(
      new Set(
        periods
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

  const ensurePeriodSaved = async (academicYear, levelName, termName) => {
    const y = (academicYear || "").trim();
    const l = (levelName || "").trim();
    const t = (termName || "").trim();
    if (!y || !l || !t) return;

    try {
      const res = await fetch(`${API_BASE}/academic-periods/ensure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academic_year: y,
          level_name: l,
          term_name: t,
          program_type: programType || "bachelor",
          postgraduate_program:
            (programType || "bachelor") === "postgraduate"
              ? (postgraduateProgram || "").trim() || null
              : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل حفظ الفترة");

      await fetchAcademicPeriods();
    } catch (e) {
      console.error(e);
    }
  };

  return {
    periods,
    yearOptions,
    levelOptions,
    termOptions,
    fetchAcademicPeriods,
    rebuildOptions,
    ensurePeriodSaved,
  };
}


function RegistrationTabs() {
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("promotion");

    // ──── state جديدة لتبويب الرسوم ────
  const [searchQuery, setSearchQuery] = useState("");
  const [studentSuggestions, setStudentSuggestions] = useState([]);
  const [selectedFeesStudent, setSelectedFeesStudent] = useState(null);
  const [feesData, setFeesData] = useState({
    faculty_name: "",
    department_name: "",
    academic_year: "",
    level_name: "",
    term_name: "",
    registration_fee: "",
    tuition_fee: "",
    late_fee: "",
    installment_1: "",
    installment_2: "",
    installment_3: "",
    installment_4: "",
    installment_5: "",   
    installment_6: "",
    scholarship_type: "لا منحة",
    scholarship_percentage: 0,
    payment_start_date: "",
    payment_end_date: "",
  });
  const [loadingFees, setLoadingFees] = useState(false);
  const [isDefaultFeesMode, setIsDefaultFeesMode] = useState(true); // true = رسوم مبدئية بدون طالب

  // ──── فلاتر تبويب الرسوم (نفس طريقة PromotionTab) ────
  const [feesProgramType, setFeesProgramType] = useState("bachelor");
  const [feesPostgradProgram, setFeesPostgradProgram] = useState("");
  const [feesFacultyId, setFeesFacultyId] = useState("");
  const [feesDepartmentId, setFeesDepartmentId] = useState("");
  const [feesAcademicYear, setFeesAcademicYear] = useState("");
  const [feesLevelName, setFeesLevelName] = useState("");
  const [feesTermName, setFeesTermName] = useState("");

  // الكليات والأقسام لتبويب الرسوم
  const [feesFaculties, setFeesFaculties] = useState([]);
  const [feesDepartments, setFeesDepartments] = useState([]);

  // عدد الأقساط المختار
  const [installmentCount, setInstallmentCount] = useState(0);

  // periods الذكية لتبويب الرسوم
  const feesSmart = useAcademicPeriodsSmartList({
    programType: feesProgramType,
    postgraduateProgram: feesPostgradProgram,
  });

  // تحميل الكليات مرة واحدة
  useEffect(() => {
    fetch(`${API_BASE}/faculties-list`)
      .then(res => res.json())
      .then(setFeesFaculties)
      .catch(() => showToast("خطأ في تحميل الكليات", "error"));
  }, []);

  // تحميل الأقسام عند اختيار كلية
  useEffect(() => {
    if (!feesFacultyId) {
      setFeesDepartments([]);
      setFeesDepartmentId("");
      return;
    }
    fetch(`${API_BASE}/departments/${feesFacultyId}`)
      .then(res => res.json())
      .then(setFeesDepartments)
      .catch(() => showToast("خطأ في تحميل الأقسام", "error"));
  }, [feesFacultyId]);

  // تحميل الفترات الدراسية
  useEffect(() => {
    if (feesDepartmentId || (feesProgramType === "postgraduate" && feesPostgradProgram.trim())) {
      feesSmart.fetchAcademicPeriods();
    }
  }, [feesDepartmentId, feesProgramType, feesPostgradProgram, feesSmart]);

  // إعادة بناء خيارات المستوى والفصل
  useEffect(() => {
    feesSmart.rebuildOptions(feesAcademicYear, feesLevelName);
  }, [feesAcademicYear, feesLevelName, feesSmart.periods]);
  
  

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };




  return (
    <div className="admission-layout" dir="rtl" style={ui.page}>
  
      <header className="library-header">
        <div className="library-header-title">
          <span style={{ fontSize: 22, fontWeight: 800 }}>القبول والتسجيل </span>
        </div>

        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "none",
            fontSize: "32px",
            color: "white",
            cursor: "pointer",
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
          {/* Tabs */}
<div style={ui.tabsRow}>
  <button
    onClick={() => setActiveTab("promotion")}
    style={ui.tabBtn(activeTab === "promotion")}
  >
    بدء سنة/فصل جديد
  </button>

  <button
    onClick={() => setActiveTab("single")}
    style={ui.tabBtn(activeTab === "single")}
  >
    تسجيل طالب
  </button>

  <button
    onClick={() => setActiveTab("failed-courses")}
    style={ui.tabBtn(activeTab === "failed-courses")}
  >
    تسجيل المواد 
  </button>

<button
    onClick={() => setActiveTab("fees")}
    style={ui.tabBtn(activeTab === "fees")}
  >
    الرسوم
  </button>

</div>

{activeTab === "promotion" ? (
  <PromotionTab showToast={showToast} />
) : activeTab === "single" ? (
  <SingleRegistrationTab showToast={showToast} />
) : activeTab === "failed-courses" ? (
  <FailedCoursesRegistrationTab showToast={showToast} />
) : activeTab === "fees" ? (
  <FeesTab showToast={showToast} />
) : null}

          {toast && (
  <div className={"toast " + (toast.type === "error" ? "toast-error" : "toast-success")}>
    {toast.message}
  </div>
)}

        </div>
      </main>
    </div>
  );
}

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

/* =========================================================
   تاب 1 – بدء سنة/فصل جديد (ترحيل جماعي)
   ========================================================= */
function PromotionTab({ showToast }) {
  const [postgradProgram, setPostgradProgram] = useState("");
  const [programType, setProgramType] = useState("bachelor");
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState("");
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const pgSmart = usePostgradProgramsSmartList();

  const [fromYear, setFromYear] = useState("");
  const [fromLevel, setFromLevel] = useState("");
  const [fromTerm, setFromTerm] = useState("");

  const [toYear, setToYear] = useState("");
  const [toLevel, setToLevel] = useState("");
  const [termName, setTermName] = useState("");

  const [candidates, setCandidates] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [batchTransferring, setBatchTransferring] = useState(false); 
  const [promotionResults, setPromotionResults] = useState(null);

  const navigate = useNavigate();


  useEffect(() => {
    if (programType === "postgraduate") {
      pgSmart.fetchPrograms();
    } else {
      setPostgradProgram("");
    }
  }, [programType]);

  const smart = useAcademicPeriodsSmartList({
    programType,
    postgraduateProgram: postgradProgram,
  });

  // =========================
  // (1) تحميل الفترات عند اختيار القسم
  // =========================
  useEffect(() => {
    if (!departmentId) {
      setFromYear("");
      setFromLevel("");
      setFromTerm("");
      return;
    }

    if (programType === "postgraduate" && !postgradProgram.trim()) {
      setFromYear("");
      setFromLevel("");
      setFromTerm("");
      return;
    }

    smart.fetchAcademicPeriods();
  }, [departmentId, programType, postgradProgram]);

  // =========================
  // (2) خيارات المستوى الحالي حسب السنة الحالية
  // =========================
  const [fromLevelOptions, setFromLevelOptions] = useState([]);
  useEffect(() => {
    const y = (fromYear || "").trim();
    const rows = smart.periods;

    const levels = Array.from(
      new Set(
        rows
          .filter((r) => (r.academic_year || "").trim() === y)
          .map((r) => (r.level_name || "").trim())
          .filter(Boolean)
      )
    );
    setFromLevelOptions(levels);
  }, [fromYear, smart.periods]);

  // =========================
  // (3)  السنة + المستوى الحالي → جيب آخر فصل تلقائي
  // =========================
  useEffect(() => {
    if (!departmentId) return;
    if (!fromYear || !fromLevel) {
      setFromTerm("");
      return;
    }

    if (programType === "postgraduate" && !postgradProgram.trim()) {
      setFromTerm("");
      return;
    }

    const qs = new URLSearchParams({
      department_id: departmentId,
      program_type: programType,
      academic_year: fromYear,
      level_name: fromLevel,
    });

    if (programType === "postgraduate") {
      qs.set("postgraduate_program", postgradProgram.trim());
    }

    fetch(`${API_BASE}/registrations/last-period?${qs.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        const lp = data?.lastPeriod;
        setFromTerm(lp?.term_name || "");
      })
      .catch(() => setFromTerm(""));
  }, [departmentId, programType, postgradProgram, fromYear, fromLevel]);

  // =========================
  // (4) حساب الفترة الجديدة تلقائياً بناءً على الفصل الحالي
  // =========================
useEffect(() => {
  if (!fromTerm || !fromYear || !fromLevel) {
    setToYear("");
    setToLevel("");
    setTermName("");
    return;
  }

  const currentOrder = termOrder(fromTerm);

  if (currentOrder === 1) {
    setToYear(fromYear);
    setToLevel(fromLevel);
    setTermName("الفصل الثاني");
  } 
  else if (currentOrder === 2) {
    const nextYear = getNextAcademicYear(fromYear);
    const nextLevel = getNextLevel(fromLevel);

    setToYear(nextYear);
    setToLevel(nextLevel);
    setTermName("الفصل الأول");

  } 
  else {
    setToYear("");
    setToLevel("");
    setTermName("");
  }
}, [fromTerm, fromYear, fromLevel]);

  // =========================
  // (5) جلب الكليات والأقسام
  // =========================
  useEffect(() => {
    fetch(`${API_BASE}/faculties-list`)
      .then((res) => res.json())
      .then(setFaculties)
      .catch((err) => console.error("Error loading faculties", err));
  }, []);

  useEffect(() => {
    if (!selectedFacultyId) {
      setDepartments([]);
      return;
    }
    fetch(`${API_BASE}/departments/${selectedFacultyId}`)
      .then((res) => res.json())
      .then(setDepartments)
      .catch((err) => console.error("Error loading departments", err));
  }, [selectedFacultyId]);

  // =========================
  // (6) عرض المرشحين ( fromYear + fromLevel + fromTerm)
  // =========================
  const loadCandidates = () => {
    if (!departmentId) {
      showToast("اختاري القسم أولاً", "error");
      return;
    }
    if (programType === "postgraduate" && !postgradProgram.trim()) {
      showToast("اختاري/اكتبي برنامج الدراسات العليا أولاً", "error");
      return;
    }

    if (!fromYear || !fromLevel || !fromTerm) {
      showToast("اختاري السنة الدراسية الحالية والمستوى والفصل أولاً", "error");
      return;
    }

    setLoading(true);

    const qs = new URLSearchParams({
      department_id: departmentId,
      from_year: fromYear,
      from_level: fromLevel,
      from_term: fromTerm || "",
      program_type: programType,
    });

    if (programType === "postgraduate") {
      qs.set("postgraduate_program", postgradProgram.trim());
    }

    fetch(`${API_BASE}/promotion/candidates?${qs.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "فشل جلب المرشحين");
        return data;
      })
      .then((data) => {
        setCandidates(data);
        setSelectedIds(data.map((s) => s.student_id));
      })
      .catch((err) => {
        console.error("Error loading candidates", err);
        showToast(err.message || "خطأ في جلب الطلاب المرشحين", "error");
      })
      .finally(() => setLoading(false));
  };

  const resetPromotion = () => {
    setProgramType("bachelor");
    setPostgradProgram("");

    setSelectedFacultyId("");
    setDepartmentId("");
    setDepartments([]);

    setFromYear("");
    setFromLevel("");
    setFromTerm("");

    setToYear("");
    setToLevel("");
    setTermName("");

    setCandidates([]);
    setSelectedIds([]);
    setLoading(false);
    setBatchTransferring(false);
  };

  const toggleStudent = (studentId) => {
    setSelectedIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  // =========================
  // (7) دالة الترحيل الجماعي الجديدة 
  // =========================


const handleBatchPromote = async () => {
    if (!toYear || !toLevel || !termName) {
      showToast("الفترة الجديدة ناقصة (السنة أو المستوى أو الفصل)", "error");
      return;
    }
    if (!selectedIds.length) {
      showToast("لا يوجد طلاب مختارين", "error");
      return;
    }
    setBatchTransferring(true);
    try {
      const token = sessionStorage.getItem("token");
      if (!token) {
        showToast("انتهت الجلسة – يرجى تسجيل الدخول مرة أخرى", "error");
          navigate("/login");
        return;
      }

      console.log("Sending batch promote:", {
        current_academic_year: fromYear,
        current_level_name: fromLevel,
        current_term_name: fromTerm,
        new_academic_year: toYear,
        new_level_name: toLevel,
        new_term_name: termName,
        program_type: programType,
        postgraduate_program: programType === "postgraduate" ? postgradProgram || null : null,
        department_id: departmentId,
        student_ids: selectedIds
      });

      const response = await fetch(`${API_BASE}/batch-promote-to-next-level`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_academic_year: fromYear,
          current_level_name: fromLevel,
          current_term_name: fromTerm,
          new_academic_year: toYear,
          new_level_name: toLevel,
          new_term_name: termName,
          program_type: programType,
          postgraduate_program: programType === "postgraduate" ? postgradProgram || null : null,
          department_id: departmentId,
          student_ids: selectedIds
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "فشل في عملية الترحيل الجماعي");
      }

      setPromotionResults(data.data);

      let message = `تم الترحيل: ${data.data.success.length} ناجح`;
      if (data.data.already_promoted?.length) {
        message += `, ${data.data.already_promoted.length} تم ترحيلهم سابقًا`;
      }
      message += `, ${data.data.failed.length} مرفوض, ${data.data.required_repeat.length} إعادة`;

      showToast(message, "success");
      resetPromotion();
    } catch (err) {
      console.error("Batch promote error:", err);
      showToast("حدث خطأ أثناء الترحيل: " + (err.message || "غير معروف"), "error");
    } finally {
      setBatchTransferring(false);
    }
  };

const termOrder = (t) => {
  if (!t) return 0;
  const term = (t || "").toString().trim();
  if (term.includes("أول") || term === "الفصل الأول" || term === "فصل أول") return 1;
  if (term.includes("ثان") || term === "الفصل الثاني" || term === "فصل ثاني") return 2;

  return 0;
};

const getNextLevel = (currentLevel) => {
  if (!currentLevel) return "";

  const cleanLevel = (currentLevel || "").trim();

  const levelMap = {
    "المستوى الأول":   "المستوى الثاني",
    "المستوى الثاني":  "المستوى الثالث",
    "المستوى الثالث":  "المستوى الرابع",
    "المستوى الرابع":  "المستوى الخامس",
    "المستوى الخامس":  "المستوى السادس",

    "مستوى أول":       "المستوى الثاني",
    "مستوى ثاني":      "المستوى الثالث",
    "مستوى ثالث":      "المستوى الرابع",
  };

  return levelMap[cleanLevel] || cleanLevel; 
};

const getNextAcademicYear = (year) => {
  if (!year || !year.includes("/")) return year;
  
  const [start, end] = year.split("/").map(Number);
  if (isNaN(start) || isNaN(end)) return year;
  
  return `${start + 1}/${end + 1}`;
};


  return (
    <div>
      <h2 style={ui.titleH2}>بدء سنة / فصل دراسي جديد (جماعي)</h2>

      <div style={ui.card}>
        <h3 style={ui.sectionTitle}>نوع البرنامج</h3>

        <div style={{ display: "flex", gap: 20 }}>
          <label>
            <input
              type="radio"
              value="diploma"
              checked={programType === "diploma"}
              onChange={(e) => setProgramType(e.target.value)}
            />
            دبلوم
          </label>
          <label>
            <input
              type="radio"
              value="bachelor"
              checked={programType === "bachelor"}
              onChange={(e) => setProgramType(e.target.value)}
            />
            بكالوريوس
          </label>

          <label>
            <input
              type="radio"
              value="postgraduate"
              checked={programType === "postgraduate"}
              onChange={(e) => setProgramType(e.target.value)}
            />
            دراسات عليا
          </label>
        </div>
      </div>

      {programType === "postgraduate" && (
        <div style={ui.card}>
          <h3 style={ui.sectionTitle}>برنامج الدراسات العليا</h3>

          <input
            type="text"
            list="pg_programs_list"
            value={postgradProgram}
            onChange={(e) => setPostgradProgram(e.target.value)}
            placeholder="مثال: ماجستير إدارة أعمال"
            style={ui.input}
          />
          <datalist id="pg_programs_list">
            {pgSmart.programs.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
      )}

      <div style={ui.card}>
        <div style={ui.grid}>
          <div style={ui.field}>
            <label style={ui.label}>الكلية</label>
            <select
              value={selectedFacultyId}
              onChange={(e) => {
                const newFacultyId = e.target.value;
                setSelectedFacultyId(newFacultyId);

                setDepartmentId("");
                setDepartments([]);

                setFromYear("");
                setFromLevel("");
                setFromTerm("");

                setToYear("");
                setToLevel("");
                setTermName("");

                setCandidates([]);
                setSelectedIds([]);
              }}
              style={ui.select}
            >
              <option value="">اختر الكلية</option>
              {faculties.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.faculty_name}
                </option>
              ))}
            </select>
          </div>

          <div style={ui.field}>
            <label style={ui.label}>القسم</label>
            <select
              value={departmentId}
              onChange={(e) => {
                const newDept = e.target.value;
                setDepartmentId(newDept);

                setFromYear("");
                setFromLevel("");
                setFromTerm("");

                setToYear("");
                setToLevel("");
                setTermName("");

                setCandidates([]);
                setSelectedIds([]);
              }}
              style={ui.select}
            >
              <option value="">اختر القسم</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.department_name}
                </option>
              ))}
            </select>
          </div>

          <div style={ui.field}>
            <label style={ui.label}>السنة الدراسية الحالية</label>
            <input
              type="text"
              list="promo_from_years"
              placeholder="اختار السنة"
              value={fromYear}
              onChange={(e) => {
                setFromYear(e.target.value);
                setFromLevel("");
                setFromTerm("");
                setToYear("");
                setToLevel("");
                setTermName("");
              }}
              style={ui.input}
            />
            <datalist id="promo_from_years">
              {smart.yearOptions.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </div>

          <div style={ui.field}>
            <label style={ui.label}>المستوى الحالي</label>
            <input
              type="text"
              list="promo_from_levels"
              placeholder="اختار المستوى"
              value={fromLevel}
              onChange={(e) => {
                setFromLevel(e.target.value);
                setFromTerm("");
                setToYear("");
                setToLevel("");
                setTermName("");
              }}
              style={ui.input}
            />
            <datalist id="promo_from_levels">
              {fromLevelOptions.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </div>

          <div style={ui.field}>
            <label style={ui.label}>الفصل الحالي (آخر فصل مسجل)</label>
            <input
              type="text"
              list="promo_from_terms" 
              placeholder="اختار الفصل"
              value={fromTerm}
              onChange={(e) => {
                setFromTerm(e.target.value);
                setToYear("");
                setToLevel("");
                setTermName("");
              }}
              style={ui.input}
            />
            <datalist id="promo_from_terms">
              {TERM_OPTIONS.map((x) => ( 
                <option key={x} value={x} />
              ))}
            </datalist>
          </div>

          <div style={ui.field}>
            <label style={ui.label}>السنة الدراسية الجديدة</label>
            <input
              type="text"
              list="promo_to_years" 
              placeholder="اختار السنة الجديدة"
              value={toYear}
              onChange={(e) => {
                setToYear(e.target.value);
                setToLevel("");
                setTermName("");
              }}
              style={ui.input}
            />
            <datalist id="promo_to_years">
              {smart.yearOptions.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </div>

          <div style={ui.field}>
            <label style={ui.label}>المستوى الجديد</label>
            <input
              type="text"
              list="promo_to_levels" 
              placeholder="اختار المستوى الجديد"
              value={toLevel}
              onChange={(e) => {
                setToLevel(e.target.value);
                setTermName("");
              }}
              style={ui.input}
            />
            <datalist id="promo_to_levels">
              {smart.levelOptions.map((x) => ( 
                <option key={x} value={x} />
              ))}
            </datalist>
          </div>

          <div style={ui.field}>
            <label style={ui.label}>الفصل الدراسي (الجديد)</label>
            <input
              type="text"
              list="promo_terms"
              placeholder="اختار الفصل الجديد"
              value={termName}
              onChange={(e) => setTermName(e.target.value)}
              style={ui.input}
            />
            <datalist id="promo_terms">
              {TERM_OPTIONS.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </div>
        </div>

        <button onClick={loadCandidates} disabled={loading} style={ui.primaryBtn}>
          {loading ? "جاري التحميل..." : "عرض الطلاب"}
        </button>
      </div>

      {candidates.length > 0 && (
        <div style={ui.card}>
          <h3 style={ui.sectionTitle}>الطلاب</h3>

          <div style={ui.tableWrap}>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>اختيار</th>
                  <th style={ui.th}>الرقم الجامعي</th>
                  <th style={ui.th}>اسم الطالب</th>
                  <th style={ui.th}>السنة الدراسية</th>
                  <th style={ui.th}>المستوى</th>
                  <th style={ui.th}>الفصل الدراسي</th>
                  <th style={ui.th}>الموقف الأكاديمي</th>
                  <th style={ui.th}>النجاح</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.student_id}>
                    <td style={ui.td}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.student_id)}
                        onChange={() => toggleStudent(c.student_id)}
                      />
                    </td>
                    <td style={ui.td}>{c.university_id}</td>
                    <td style={ui.td}>{c.full_name}</td>
                    <td style={ui.td}>{c.current_year}</td>
                    <td style={ui.td}>{c.current_level}</td>
                    <td style={ui.td}>{c.current_term || "-"}</td>
                    <td style={ui.td}>{c.academic_status || "غير محدد"}</td>
                    <td style={ui.td}>{c.passed_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

  <button onClick={handleBatchPromote} disabled={batchTransferring} style={ui.secondaryBtn}>
  {batchTransferring ? "جاري الترحيل..." : "بدء سنة / فصل جديد"}
</button>

{promotionResults && (
  <div style={{ marginTop: 24, padding: 16, background: "#f8f9fa", borderRadius: 12, border: "1px solid #e6e8ee" }}>
    <h3 style={ui.sectionTitle}>نتيجة الترحيل الجماعي</h3>

    <div style={{ color: "#16a34a", fontWeight: 800, marginBottom: 12 }}>
      تم ترحيل: {promotionResults.success.length} طالب
    </div>

{promotionResults.already_promoted?.length > 0 && (
      <div style={{ marginBottom: 16 }}>
        <strong style={{ color: "#0891b2" }}>
          تم ترحيلهم سابقًا ({promotionResults.already_promoted.length}):
        </strong>
        <ul style={{ paddingRight: 20, marginTop: 8, listStyleType: "disc" }}>
          {promotionResults.already_promoted.map((a, idx) => (
            <li key={idx} style={{ marginBottom: 6, color: "#0891b2" }}>
              {a.full_name || a.student_id} - {a.reason}
            </li>
          ))}
        </ul>
      </div>
    )}

    {promotionResults.failed.length > 0 && (
      <div style={{ marginBottom: 16 }}>
        <strong style={{ color: "#b91c1c" }}>مرفوضين ({promotionResults.failed.length}):</strong>
        <ul style={{ paddingRight: 20, marginTop: 8, listStyleType: "disc" }}>
          {promotionResults.failed.map((f, idx) => (
            <li key={idx} style={{ marginBottom: 6, color: "#b91c1c" }}>
              {f.full_name || f.student_id} - {f.reason}
            </li>
          ))}
        </ul>
      </div>
    )}

    {promotionResults.required_repeat.length > 0 && (
      <div>
        <strong style={{ color: "#b45309" }}>مطلوب إعادة ({promotionResults.required_repeat.length}):</strong>
        <ul style={{ paddingRight: 20, marginTop: 8, listStyleType: "disc" }}>
          {promotionResults.required_repeat.map((r, idx) => (
            <li key={idx} style={{ marginBottom: 6, color: "#b45309" }}>
              {r.full_name || r.student_id} - {r.reason}
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
)}
        </div>
      )}

      {candidates.length === 0 && !loading && (
        <div style={{ color: "#64748b", fontWeight: 700 }}>
          لم يتم تحميل أي طلاب بعد. اضغط "عرض الطلاب".
        </div>
      )}
    </div>
  );
}



/* =========================================================
   تاب 2 – تسجيل طالب (فردي)
   ========================================================= */
function SingleRegistrationTab({ showToast }) {
  const [hasSearched, setHasSearched] = useState(false);
  const [programType, setProgramType] = useState("bachelor");

  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [lastRegistration, setLastRegistration] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const pgSmart = usePostgradProgramsSmartList();
  const navigate = useNavigate();



  const [studentForm, setStudentForm] = useState({
    full_name: "",
    university_id: "",
    phone: "",
  });

  const [form, setForm] = useState({
    academic_year: "",
    level_name: "",
    term_name: "",
    academic_status: "منتظم",
    registration_status: "مسجّل",
    notes: "",
    postgraduate_program: "",

    prev_degree: "",
    prev_university: "",
    prev_grad_year: "",
    study_type: "",
  });


  useEffect(() => {
  if (programType === "postgraduate") {
    pgSmart.fetchPrograms();
  } else {
    setForm((p) => ({
      ...p,
      postgraduate_program: "",
      prev_degree: "",
      prev_university: "",
      prev_grad_year: "",
      study_type: "",
    }));
  }
}, [programType]);

  const smart = useAcademicPeriodsSmartList({
    programType,
    postgraduateProgram: form.postgraduate_program,
  });

  useEffect(() => {
    fetch(`${API_BASE}/faculties-list`)
      .then((res) => res.json())
      .then(setFaculties)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (programType !== "postgraduate") {
      setForm((p) => ({
        ...p,
        postgraduate_program: "",
        prev_degree: "",
        prev_university: "",
        prev_grad_year: "",
        study_type: "",
      }));
    }
  }, [programType]);

  useEffect(() => {
    if (!selectedFacultyId) {
      setDepartments([]);
      return;
    }

    fetch(`${API_BASE}/departments/${selectedFacultyId}`)
      .then((res) => res.json())
      .then(setDepartments)
      .catch(() => {});
  }, [selectedFacultyId]);

  useEffect(() => {
    if (departmentId) smart.fetchAcademicPeriods();
  }, [departmentId, programType, form.postgraduate_program]);

  useEffect(() => {
    smart.rebuildOptions(form.academic_year, form.level_name);
  }, [form.academic_year, form.level_name, smart.periods]);


const searchStudents = async (q) => {
  const text = (q ?? query).trim();

  if (!text) {
    setSearchResults([]);
    setHasSearched(false);
    setSearchLoading(false);
    setSearchError("");
    return;
  }

  try {
    setHasSearched(true);
    setSearchLoading(true);
    setSearchError("");

    const res = await fetch(
      `${API_BASE}/students/search?q=${encodeURIComponent(text)}`
    );
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || "خطأ في البحث");
    }

    setSearchResults(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error(err);
    setSearchResults([]);
    setSearchError(err.message || "خطأ في البحث عن الطلاب");
  } finally {
    setSearchLoading(false);
  }
};
useEffect(() => {


  const t = setTimeout(() => {
    searchStudents(query);
  }, 350); 

  return () => clearTimeout(t);
}, [query]);



const selectStudent = (studentId) => {
  fetch(`${API_BASE}/students/${studentId}`)
    .then((res) => res.json())
    .then((data) => {
      setSelectedStudent(data.student);
      setLastRegistration(data.lastRegistration || null);

      const lastProgType = data.lastRegistration?.program_type || "bachelor";
      setProgramType(lastProgType);

      const lastPGProgram = data.lastRegistration?.postgraduate_program || "";

      const pgData = data.lastRegistration?.postgraduate_data || {};

      setForm((prev) => ({
        ...prev,

        academic_year: data.lastRegistration ? data.lastRegistration.academic_year : "",
        level_name: data.lastRegistration ? data.lastRegistration.level_name : "",
        term_name: data.lastRegistration ? (data.lastRegistration.term_name || "") : "",
        academic_status: data.lastRegistration ? data.lastRegistration.academic_status : "منتظم",
        registration_status: data.lastRegistration ? data.lastRegistration.registration_status : "مسجّل",
        notes: "",

        postgraduate_program: lastPGProgram,
        prev_degree: pgData.prev_degree || "",
        prev_university: pgData.prev_university || "",
        prev_grad_year: pgData.prev_grad_year || "",
        study_type: pgData.study_type || "",
      }));

      setStudentForm({
        full_name: data.student.full_name || "",
        university_id: Number(data.student.university_id) === 0 ? "" : String(data.student.university_id),
        phone: data.student.phone || "",
      });

if (data.student?.faculty_id) {
  setSelectedFacultyId(String(data.student.faculty_id));
} else {
  setSelectedFacultyId("");
}

if (data.student?.department_id) {
  setDepartmentId(String(data.student.department_id));
} else {
  setDepartmentId("");
}

    })
    .catch((err) => {
      console.error(err);
     showToast("خطأ في جلب بيانات الطالب", "error");
    });
};


const resetStudentForm = () => {
  setSelectedStudent(null);
  setLastRegistration(null);
  setQuery("");
  setSearchResults([]);
  setHasSearched(false);

  setStudentForm({
    full_name: "",
    university_id: "",
    phone: "",
  });

  setForm({
    academic_year: "",
    level_name: "",
    term_name: "",
    academic_status: "منتظم",
    registration_status: "مسجّل",
    notes: "",
    postgraduate_program: "",

    prev_degree: "",
    prev_university: "",
    prev_grad_year: "",
    study_type: "",
  });

  setProgramType("bachelor");
  setSelectedFacultyId("");
  setDepartmentId("");
};


  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

const saveStudentOnly = async () => {
  if (!studentForm.full_name.trim()) {
    showToast("الاسم الرباعي مطلوب", "error");

    return;
  }

  try {
    if (!selectedStudent?.id) {
      const studentBody = {
        full_name: studentForm.full_name,
        university_id: (studentForm.university_id || "").trim(),
        phone: studentForm.phone || null,
        receipt_number: null,
        department_id: departmentId ? Number(departmentId) : null,
        notes: null,
        registrar: DEFAULT_REGISTRAR,
      };

      const res = await fetch(`${API_BASE}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentBody),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || "فشل إضافة الطالب", "error");
        return;
      }

      showToast("تم حفظ بيانات الطالب", "success");
     resetStudentForm();
window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const updStudentBody = {
      full_name: studentForm.full_name,
      university_id: (studentForm.university_id || "").trim(),
      phone: studentForm.phone || null,
      department_id: departmentId ? Number(departmentId) : null,
    };

    const resUpd = await fetch(`${API_BASE}/students/${selectedStudent.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updStudentBody),
    });

    const dataUpd = await resUpd.json();
    if (!resUpd.ok) {
      showToast(dataUpd.message || "فشل تحديث بيانات الطالب", "error");
      return;
    }

    showToast("تم تحديث بيانات الطالب", "success");

    resetStudentForm();
window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (e) {
    console.error(e);
   showToast("حدث خطأ أثناء تعديل بيانات الطالب", "error");

  }
};


const saveRegistration = async () => {
  if (!studentForm.full_name.trim()) {
    showToast("الاسم الرباعي مطلوب", "error");
    return;
  }

  if (programType === "postgraduate" && !form.postgraduate_program?.trim()) {
    showToast("اختاري/اكتبي برنامج الدراسات العليا", "error");
    return;
  }

  if (!form.academic_year || !form.level_name) {
    showToast("السنة الدراسية والمستوى مطلوبان", "error");
    return;
  }

  try {
const token = sessionStorage.getItem("token");
    if (!token) {
      showToast("انتهت الجلسة – يرجى تسجيل الدخول مرة أخرى", "error");
      navigate("/login");
      return;
    }

    let studentId = selectedStudent ? selectedStudent.id : null;

    // 1. تحديث بيانات الطالب إذا موجود
    if (studentId) {
      const updStudentBody = {
        full_name: studentForm.full_name,
        university_id: (studentForm.university_id || "").trim(),
        phone: studentForm.phone || null,
        department_id: departmentId ? Number(departmentId) : null,
      };

      const resUpd = await fetch(`${API_BASE}/students/${studentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,  
        },
        body: JSON.stringify(updStudentBody),
      });

      if (!resUpd.ok) {
        const errData = await resUpd.json();
        showToast(errData.message || "فشل تحديث بيانات الطالب", "error");
        return;
      }
    }

    // 2. إنشاء طالب جديد إذا م موجود
    if (!studentId) {
      const studentBody = {
        full_name: studentForm.full_name,
        university_id: (studentForm.university_id || "").trim(),
        phone: studentForm.phone || null,
        receipt_number: null,
        department_id: departmentId ? Number(departmentId) : null,
        notes: null,
        registrar: DEFAULT_REGISTRAR,
      };

      const resStudent = await fetch(`${API_BASE}/students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,  
        },
        body: JSON.stringify(studentBody),
      });

      const dataStudent = await resStudent.json();

      if (!resStudent.ok) {
        showToast(dataStudent.message || "فشل في إضافة الطالب الجديد", "error");
        return;
      }

      studentId = dataStudent.student_id;
    }

    // 3. التحقق من وجود تسجيل سابق مطابق للفترة
    if (
      lastRegistration &&
      lastRegistration.academic_year === form.academic_year &&
      lastRegistration.level_name === form.level_name &&
      lastRegistration.term_name === form.term_name
    ) {
      // تعديل الموقف الأكاديمي فقط (PUT)
      const regBody = {
        academic_status: form.academic_status,
      };

      const resReg = await fetch(`${API_BASE}/registrations/${lastRegistration.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,  
        },
        body: JSON.stringify(regBody),
      });

      const dataReg = await resReg.json();

      if (!resReg.ok) {
        if (resReg.status === 401) {
          showToast("انتهت الجلسة – يرجى تسجيل الدخول مرة أخرى", "error");
          navigate("/login");
        } else {
          showToast(dataReg.message || "فشل في تعديل الموقف الأكاديمي", "error");
        }
        return;
      }

      showToast("تم تعديل الموقف الأكاديمي", "success");
    } 
    else {
      // إنشاء تسجيل جديد (POST)
      const regBody = {
        student_id: studentId,
        academic_year: form.academic_year,
        level_name: form.level_name,
        term_name: form.term_name || null,
        academic_status: form.academic_status,
        registration_status: form.registration_status,
        notes: form.notes || null,
        program_type: programType,
        postgraduate_data:
          programType === "postgraduate"
            ? {
                prev_degree: form.prev_degree,
                prev_university: form.prev_university,
                prev_grad_year: form.prev_grad_year,
                study_type: form.study_type,
              }
            : null,
        postgraduate_program: programType === "postgraduate" ? (form.postgraduate_program || null) : null,
      };

      const resReg = await fetch(`${API_BASE}/registrations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,  
        },
        body: JSON.stringify(regBody),
      });

      const dataReg = await resReg.json();

      if (!resReg.ok) {
        showToast(dataReg.message || "فشل في حفظ التسجيل الجديد", "error");
        return;
      }

      showToast("تم تسجيل الطالب بنجاح", "success");
    }

    resetStudentForm();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error("خطأ في عملية التسجيل:", err);
    showToast("حدث خطأ غير متوقع أثناء حفظ التسجيل", "error");
  }
};

  return (
    <div>
      <h2 style={ui.titleH2}>تسجيل طالب (فردي)</h2>

      <div style={ui.card}>
        <h3 style={ui.sectionTitle}>البحث عن الطالب</h3>

        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="text"
            placeholder="اكتب الاسم أو الرقم الجامعي"
            value={query}
            onChange={(e) => {
  setQuery(e.target.value);
  setSelectedStudent(null);   
  setLastRegistration(null); 
}}

            style={ui.input}
          />
          {searchLoading && (
  <div style={{ marginTop: 10, color: "#64748b", fontWeight: 700 }}>
    جاري البحث...
  </div>
)}

{!!searchError && (
  <div style={{ marginTop: 10, color: "#b91c1c", fontWeight: 800 }}>
    {searchError}
  </div>
)}

        </div>

        {searchResults.length > 0 && (
          <div style={{ marginTop: 12, ...ui.tableWrap }}>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>اختيار</th>
                  <th style={ui.th}>الاسم</th>
                  <th style={ui.th}>الرقم الجامعي</th>
                  <th style={ui.th}>القسم</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((s) => (
                  <tr key={s.id}>
                    <td style={ui.td}>
                      <button
                        onClick={() => selectStudent(s.id)}
                        style={{
                          padding: "8px 12px",
                          border: "1px solid #0a3753",
                          background: "#fff",
                          cursor: "pointer",
                          borderRadius: 10,
                          fontWeight: 800,
                          fontFamily: `"Cairo", Arial`,
                        }}
                      >
                        اختر
                      </button>
                    </td>
                    <td style={ui.td}>{s.full_name}</td>
                    <td style={ui.td}>{s.university_id}</td>
                    <td style={ui.td}>{s.department_name || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

{hasSearched && !searchLoading && searchResults.length === 0 && (
  <div style={{ marginTop: 10, color: "#64748b", fontWeight: 700 }}>
    لا توجد نتائج
  </div>
)}

      </div>

      <div style={ui.card}>
        <div style={ui.card}>
  <h3 style={ui.sectionTitle}>نوع البرنامج</h3>

  <div style={{ display: "flex", gap: 20 }}>
                        <label>
            <input
              type="radio"
              value="diploma"
              checked={programType === "diploma"}
              onChange={(e) => setProgramType(e.target.value)}
            />
            دبلوم
          </label>
    <label>
      <input
        type="radio"
        value="bachelor"
        checked={programType === "bachelor"}
        onChange={(e) => setProgramType(e.target.value)}
      />
      بكالوريوس
    </label>

    <label>
      <input
        type="radio"
        value="postgraduate"
        checked={programType === "postgraduate"}
        onChange={(e) => setProgramType(e.target.value)}
      />
      دراسات عليا
    </label>
  </div>
</div>

        <h3 style={ui.sectionTitle}>بيانات الطالب الأساسية</h3>

        <div style={ui.grid}>
          <div style={ui.field}>
            <label style={ui.label}>الاسم الرباعي</label>
            <input
              type="text"
              value={studentForm.full_name}
              onChange={(e) =>
                setStudentForm((prev) => ({ ...prev, full_name: e.target.value }))
              }
              placeholder="اكتب الاسم الرباعي"
              style={ui.input}
            />
          </div>

          <div style={ui.field}>
            <label style={ui.label}>الرقم الجامعي</label>
            <input
              type="text"
              value={studentForm.university_id}
              onChange={(e) =>
                setStudentForm((prev) => ({ ...prev, university_id: e.target.value }))
              }
              placeholder=" مثال: 20260001"
              style={ui.input}
            />
          </div>

          <div style={ui.field}>
            <label style={ui.label}>رقم الهاتف</label>
            <input
              type="text"
              value={studentForm.phone}
              onChange={(e) =>
                setStudentForm((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="مثال: 09xxxxxxxx"
              style={ui.input}
            />
          </div>

          <div style={ui.field}>
            <label style={ui.label}>الكلية</label>
            <select
              value={selectedFacultyId}
              onChange={(e) => setSelectedFacultyId(e.target.value)}
              style={ui.select}
            >
              <option value="">اختر الكلية</option>
              {faculties.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.faculty_name}
                </option>
              ))}
            </select>
          </div>

          <div style={ui.field}>
            <label style={ui.label}>القسم</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              style={ui.select}
              disabled={!selectedFacultyId}
            >
              <option value="">اختر القسم</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.department_name}
                </option>
              ))}
            </select>
          </div>
        </div>
{hasSearched && selectedStudent && (
  <button onClick={saveStudentOnly} style={ui.secondaryBtn}>
    تعديل بيانات الطالب 
  </button>
)}

        {selectedStudent && (
          <div style={{ marginTop: 12, color: "#334155", fontWeight: 800 }}>
            يتم استخدام بيانات الطالب: <span style={{ color: "#0a3753" }}>{selectedStudent.full_name}</span>
          </div>
        )}
      </div>
      <div>
        {programType === "postgraduate" && (
  <div style={ui.card}>
    <h3 style={ui.sectionTitle}>بيانات الدراسات العليا</h3>

    <div style={ui.grid}>
      <div style={ui.field}>
        <label style={ui.label}>المؤهل السابق</label>
        <select
          value={form.prev_degree || ""}
          onChange={(e) =>
            setForm((p) => ({ ...p, prev_degree: e.target.value }))
          }
          style={ui.select}
        >
          <option value="">اختر</option>
          <option value="بكالوريوس">بكالوريوس</option>
          <option value="دبلوم عالي">دبلوم عالي</option>
          <option value="ماجستير">ماجستير</option>
        </select>
      </div>

      <div style={ui.field}>
        <label style={ui.label}>الجامعة</label>
        <input
          type="text"
          value={form.prev_university || ""}
          onChange={(e) =>
            setForm((p) => ({ ...p, prev_university: e.target.value }))
          }
          style={ui.input}
        />
      </div>

      <div style={ui.field}>
        <label style={ui.label}>سنة التخرج</label>
        <input
          type="text"
          value={form.prev_grad_year || ""}
          onChange={(e) =>
            setForm((p) => ({ ...p, prev_grad_year: e.target.value }))
          }
          style={ui.input}
        />
      </div>

      <div style={ui.field}>
        <label style={ui.label}>نوع الدراسة</label>
        <select
          value={form.study_type || ""}
          onChange={(e) =>
            setForm((p) => ({ ...p, study_type: e.target.value }))
          }
          style={ui.select}
        >
          <option value="">اختر</option>
          <option value="بالبحث">بحث</option>
          <option value="بالكورسات">كورسات</option>
        </select>
      </div>
<div style={ui.field}>
  <label style={ui.label}>برنامج الدراسات العليا</label>
  <input
    type="text"
    list="single_pg_programs"
    value={form.postgraduate_program || ""}
    onChange={(e) => setForm((p) => ({ ...p, postgraduate_program: e.target.value }))}
    placeholder="مثال: ماجستير إدارة أعمال"
    style={ui.input}
  />
  <datalist id="single_pg_programs">
    {pgSmart.programs.map((p) => (
      <option key={p} value={p} />
    ))}
  </datalist>
</div>

    </div>
  </div>
)}
</div>

      <div style={ui.card}>
        <h3 style={ui.sectionTitle}>تسجيل جديد لسنة/فصل دراسي</h3>

        <div style={ui.grid}>
          <div style={ui.field}>
            <label style={ui.label}>السنة الدراسية</label>
<input
  type="text"
  name="academic_year"
  list="single_years"
  placeholder="مثال: 2025/2026"
  value={form.academic_year}
  onChange={(e) => {
    setForm((p) => ({ ...p, academic_year: e.target.value, level_name: "", term_name: "" }));
  }}
  style={ui.input}
/>
<datalist id="single_years">
  {smart.yearOptions.map((x) => <option key={x} value={x} />)}
</datalist>

          </div>

          <div style={ui.field}>
            <label style={ui.label}>المستوى الدراسي</label>
<input
  type="text"
  name="level_name"
  list="single_levels"
  placeholder="مثال: المستوى الثاني"
  value={form.level_name}
  onChange={(e) => {
    setForm((p) => ({ ...p, level_name: e.target.value, term_name: "" }));
  }}
  style={ui.input}
/>
<datalist id="single_levels">
  {smart.levelOptions.map((x) => <option key={x} value={x} />)}
</datalist>

          </div>

          <div style={ui.field}>
            <label style={ui.label}>الفصل الدراسي</label>
<input
  type="text"
  name="term_name"
  list="single_terms"
  placeholder="مثال:الفصل الأول/الفصل الثاني"
  value={form.term_name}
  onChange={(e) => setForm((p) => ({ ...p, term_name: e.target.value }))}
  onBlur={() => smart.ensurePeriodSaved(form.academic_year, form.level_name, form.term_name)}
  style={ui.input}
/>
<datalist id="single_terms">
  {smart.termOptions.map((x) => <option key={x} value={x} />)}
</datalist>

            <datalist id="termOptionsSingle">
              {TERM_OPTIONS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          <div style={ui.field}>
            <label style={ui.label}>الموقف الأكاديمي</label>
            <select
              name="academic_status"
              value={form.academic_status}
              onChange={handleFormChange}
              style={ui.select}
            >
              {ACADEMIC_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div style={ui.field}>
            <label style={ui.label}>حالة التسجيل</label>
            <select
              name="registration_status"
              value={form.registration_status}
              onChange={handleFormChange}
              style={ui.select}
            >
              {REGISTRATION_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div style={{ ...ui.field, gridColumn: "1 / span 2" }}>
            <label style={ui.label}>ملاحظات</label>
            <textarea
              name="notes"
              rows={3}
              value={form.notes}
              onChange={handleFormChange}
              style={ui.textarea}
              placeholder="أي ملاحظات إضافية..."
            />
          </div>
        </div>

        <button onClick={saveRegistration} style={ui.primaryBtn}>
          حفظ التسجيل
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   تاب 3 – تسجيل مواد الرسوب / إعادة المواد
   ========================================================= */
function FailedCoursesRegistrationTab({ showToast }) {
  const [programType, setProgramType] = useState("bachelor");
  const [postgradProgram, setPostgradProgram] = useState("");

  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const [academicYear, setAcademicYear] = useState("");
  const [levelName, setLevelName] = useState("");
  const [termName, setTermName] = useState("");

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [failedCourses, setFailedCourses] = useState([]);
  const [registeredInCurrentPeriod, setRegisteredInCurrentPeriod] = useState([]);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const pgSmart = usePostgradProgramsSmartList();
  const smart = useAcademicPeriodsSmartList({
    programType,
    postgraduateProgram: postgradProgram,
  });

  // تحميل الكليات
  useEffect(() => {
    fetch(`${API_BASE}/faculties-list`)
      .then((res) => res.json())
      .then(setFaculties)
      .catch(() => showToast("خطأ في تحميل الكليات", "error"));
  }, []);

  // تحميل الأقسام
  useEffect(() => {
    if (!selectedFacultyId) {
      setDepartments([]);
      setDepartmentId("");
      return;
    }
    fetch(`${API_BASE}/departments/${selectedFacultyId}`)
      .then((res) => res.json())
      .then(setDepartments)
      .catch(() => showToast("خطأ في تحميل الأقسام", "error"));
  }, [selectedFacultyId]);

  useEffect(() => {
    if (departmentId || (programType === "postgraduate" && postgradProgram.trim())) {
      smart.fetchAcademicPeriods();
    }
  }, [departmentId, programType, postgradProgram]);

  useEffect(() => {
    smart.rebuildOptions(academicYear, levelName);
  }, [academicYear, levelName, smart.periods]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      fetch(`${API_BASE}/students/search?q=${encodeURIComponent(query.trim())}`)
        .then(r => r.json())
        .then(data => setSearchResults(Array.isArray(data) ? data : []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const selectStudent = (id) => {
    fetch(`${API_BASE}/students/${id}`)
      .then(r => r.json())
      .then(data => {
        setSelectedStudent(data.student || null);
        setPostgradProgram(data.lastRegistration?.postgraduate_program || "");
        setProgramType(data.lastRegistration?.program_type || "bachelor");

        if (data.student?.faculty_id) setSelectedFacultyId(String(data.student.faculty_id));
        if (data.student?.department_id) setDepartmentId(String(data.student.department_id));

        loadFailedCourses(id);
      })
      .catch(() => showToast("خطأ في جلب بيانات الطالب", "error"));
  };

  const loadFailedCourses = async (studentId) => {
    try {
      const res = await fetch(`${API_BASE}/student-failed-courses?student_id=${studentId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطأ");
      setFailedCourses(Array.isArray(data) ? data : []);
      setRegisteredInCurrentPeriod([]); 
    } catch (err) {
      showToast(err.message || "تعذر جلب مواد الرسوب", "error");
      setFailedCourses([]);
    }
  };

  const resetPeriodForm = () => {
    setAcademicYear("");
    setLevelName("");
    setTermName("");
    setRegisteredInCurrentPeriod([]);
  };

  const registerFailedCourse = async (course) => {
    if (!departmentId || !academicYear || !levelName || !termName) {
      showToast("املئي السنة والمستوى والفصل أولاً", "error");
      return;
    }

    try {
      const body = {
        student_id: selectedStudent.id,
        course_id: course.course_id,
        academic_year: academicYear,
        level_name: levelName,
        term_name: termName,
        program_type: programType,
        postgraduate_program: programType === "postgraduate" ? postgradProgram : null,
        registration_status: "مسجل",
        notes: "إعادة مادة راسبة"
      };

      const res = await fetch(`${API_BASE}/register-failed-course`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          showToast(
            `المادة "${course.course_name}" مسجلة بالفعل في الفترة: ${academicYear} - ${levelName} - ${termName}`,
            "warning"
          );
          setRegisteredInCurrentPeriod(prev => [...new Set([...prev, course.course_id])]);
        } else {
          throw new Error(data.error || "فشل التسجيل");
        }
        return;
      }

      showToast("تم تسجيل إعادة المادة بنجاح", "success");

      setRegisteredInCurrentPeriod(prev => [...new Set([...prev, course.course_id])]);
      setFailedCourses(prev => prev.filter(c => c.course_id !== course.course_id));
      resetPeriodForm();

    } catch (err) {
      showToast(err.message || "حدث خطأ أثناء التسجيل", "error");
    }
  };

  const isCourseRegisteredInPeriod = (courseId) => {
    return registeredInCurrentPeriod.includes(courseId);
  };

  return (
    <div>
      <h2 style={ui.titleH2}>تسجيل مواد الرسوب / إعادة المواد</h2>

      {/* نوع البرنامج */}
      <div style={ui.card}>
        <h3 style={ui.sectionTitle}>نوع البرنامج</h3>
        <div style={{ display: "flex", gap: 20 }}>
                              <label>
            <input
              type="radio"
              value="diploma"
              checked={programType === "diploma"}
              onChange={(e) => setProgramType(e.target.value)}
            />
            دبلوم
          </label>
          <label>
            <input
              type="radio"
              value="bachelor"
              checked={programType === "bachelor"}
              onChange={(e) => setProgramType(e.target.value)}
            />
            بكالوريوس
          </label>
          <label>
            <input
              type="radio"
              value="postgraduate"
              checked={programType === "postgraduate"}
              onChange={(e) => setProgramType(e.target.value)}
            />
            دراسات عليا
          </label>
        </div>
      </div>

      {/* برنامج الدراسات العليا */}
      {programType === "postgraduate" && (
        <div style={ui.card}>
          <h3 style={ui.sectionTitle}>برنامج الدراسات العليا</h3>
          <input
            type="text"
            list="pg_programs_failed"
            value={postgradProgram}
            onChange={(e) => setPostgradProgram(e.target.value)}
            placeholder="مثال: ماجستير إدارة أعمال"
            style={ui.input}
          />
          <datalist id="pg_programs_failed">
            {pgSmart.programs.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
      )}

      {/* الكلية + القسم */}
      <div style={ui.card}>
        <div style={ui.grid}>
          <div style={ui.field}>
            <label style={ui.label}>الكلية</label>
            <select
              value={selectedFacultyId}
              onChange={(e) => {
                setSelectedFacultyId(e.target.value);
                setDepartmentId("");
              }}
              style={ui.select}
            >
              <option value="">اختر الكلية</option>
              {faculties.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.faculty_name}
                </option>
              ))}
            </select>
          </div>

          <div style={ui.field}>
            <label style={ui.label}>القسم</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={!selectedFacultyId}
              style={ui.select}
            >
              <option value="">اختر القسم</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.department_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* البحث عن الطالب */}
      <div style={ui.card}>
        <h3 style={ui.sectionTitle}>البحث عن الطالب</h3>
        <input
          type="text"
          placeholder="اكتب الاسم أو الرقم الجامعي"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={ui.input}
        />

        {searchLoading && <div style={{ marginTop: 10, color: "#64748b" }}>جاري البحث...</div>}

        {searchResults.length > 0 && (
          <div style={{ marginTop: 12, ...ui.tableWrap }}>
            <table style={ui.table}>
              <thead>
                <tr>
                  <th style={ui.th}>اختيار</th>
                  <th style={ui.th}>الاسم</th>
                  <th style={ui.th}>الرقم الجامعي</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((s) => (
                  <tr key={s.id}>
                    <td style={ui.td}>
                      <button
                        onClick={() => selectStudent(s.id)}
                        style={{
                          padding: "6px 12px",
                          background: "#0a3753",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                      >
                        اختر
                      </button>
                    </td>
                    <td style={ui.td}>{s.full_name}</td>
                    <td style={ui.td}>{s.university_id || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* فلاتر الفترة الجديدة - بالطريقة الذكية زي PromotionTab */}
      {selectedStudent && departmentId && (
        <>
          <div style={ui.card}>
            <h3 style={ui.sectionTitle}>الفترة الدراسية لإعادة المواد</h3>
            <div style={ui.grid}>
              {/* السنة الدراسية */}
              <div style={ui.field}>
                <label style={ui.label}>السنة الدراسية</label>
                <input
                  type="text"
                  list="re_year_list"
                  placeholder="مثال: 2025/2026"
                  value={academicYear}
                  onChange={(e) => {
                    setAcademicYear(e.target.value);
                    setLevelName("");
                    setTermName("");
                    setRegisteredInCurrentPeriod([]);
                  }}
                  style={ui.input}
                />
                <datalist id="re_year_list">
                  {smart.yearOptions.map((y) => (
                    <option key={y} value={y} />
                  ))}
                </datalist>
              </div>

              {/* المستوى */}
              <div style={ui.field}>
                <label style={ui.label}>المستوى</label>
                <input
                  type="text"
                  list="re_level_list"
                  placeholder="مثال: المستوى الثاني"
                  value={levelName}
                  onChange={(e) => {
                    setLevelName(e.target.value);
                    setTermName("");
                    setRegisteredInCurrentPeriod([]);
                  }}
                  style={ui.input}
                  disabled={!academicYear}
                />
                <datalist id="re_level_list">
                  {smart.levelOptions.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </div>

              {/* الفصل */}
              <div style={ui.field}>
                <label style={ui.label}>الفصل الدراسي</label>
                <input
                  type="text"
                  list="re_term_list"
                  placeholder="مثال: فصل أول"
                  value={termName}
                  onChange={(e) => {
                    setTermName(e.target.value);
                    setRegisteredInCurrentPeriod([]);
                  }}
                  onBlur={() => {
                    if (academicYear && levelName && termName) {
                      smart.ensurePeriodSaved(academicYear, levelName, termName);
                    }
                  }}
                  style={ui.input}
                  disabled={!levelName}
                />
                <datalist id="re_term_list">
                  {smart.termOptions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* قائمة المواد الراسبة */}
          <div style={ui.card}>
            <h3 style={ui.sectionTitle}>
              مواد الرسوب للطالب: {selectedStudent?.full_name || "غير محدد"}
            </h3>

            {failedCourses.length === 0 ? (
              <p style={{ color: "#64748b", fontWeight: 700 }}>
                لا توجد مواد  تم الرسوب فيها   لهذا الطالب
              </p>
            ) : (
              <div style={ui.tableWrap}>
                <table style={ui.table}>
                  <thead>
                    <tr>
                      <th style={ui.th}>اسم المادة</th>
                      <th style={ui.th}>السنة السابقة</th>
                      <th style={ui.th}>المستوى السابق</th>
                      <th style={ui.th}>الفصل السابق</th>
                      <th style={ui.th}>الدرجة</th>
                      <th style={ui.th}>إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedCourses.map((c) => {
                      const isRegistered = isCourseRegisteredInPeriod(c.course_id);
                      return (
                        <tr key={c.course_id}>
                          <td style={ui.td}>{c.course_name}</td>
                          <td style={ui.td}>{c.academic_year}</td>
                          <td style={ui.td}>{c.level_name}</td>
                          <td style={ui.td}>{c.term_name}</td>
                          <td style={ui.td}>
                            {c.total_mark ? `${c.total_mark}/100` : "—"} ({c.letter || "غير مدخلة"})
                          </td>
                          <td style={ui.td}>
                            {isRegistered ? (
                              <span style={{ color: "#16a34a", fontWeight: 800 }}>
                                تم تسجيلها بالفعل في {academicYear} - {levelName} - {termName}
                              </span>
                            ) : (
                              <button
                                onClick={() => registerFailedCourse(c)}
                                style={{
                                  padding: "8px 16px",
                                  background: "#b45309",
                                  color: "white",
                                  border: "none",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  fontWeight: 700,
                                }}
                              >
                                سجّل إعادة
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!departmentId && selectedStudent && (
        <div style={{ color: "#b91c1c", fontWeight: 700, margin: "20px 0" }}>
          يرجى اختيار الكلية والقسم أولاً لتحديد الفترة الدراسية الجديدة
        </div>
      )}
    </div>
  );
}

/* =========================================================
   تاب 4 – إدارة الرسوم (على مستوى كامل - بدون فصل)
   ========================================================= */
function FeesTab({ showToast }) {
  const [programType, setProgramType] = useState("bachelor");
  const [postgradProgram, setPostgradProgram] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [levelName, setLevelName] = useState("");
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [installmentCount, setInstallmentCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [studentSuggestions, setStudentSuggestions] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loadingStudentFees, setLoadingStudentFees] = useState(false);
  const [feesSource, setFeesSource] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const navigate = useNavigate();

  const defaultFeesData = {
    registration_fee: "",
    tuition_fee: "",
    tuition_fee_original: "",
    late_fee: "",
    freeze_fee: "0",
    unfreeze_fee: "0",
    repeat_discount: "50",
    scholarship_type: "لا منحة",
    scholarship_percentage: 0,
    installment_1: "", installment_1_start: "", installment_1_end: "",
    installment_2: "", installment_2_start: "", installment_2_end: "",
    installment_3: "", installment_3_start: "", installment_3_end: "",
    installment_4: "", installment_4_start: "", installment_4_end: "",
    installment_5: "", installment_5_start: "", installment_5_end: "",
    installment_6: "", installment_6_start: "", installment_6_end: "",
  };

  const [feesData, setFeesData] = useState(defaultFeesData);

  const [calculatedFees, setCalculatedFees] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [academicStatus, setAcademicStatus] = useState("");
  const [facultyType, setFacultyType] = useState("");

  const smart = useAcademicPeriodsSmartList({
    programType,
    postgraduateProgram: postgradProgram,
  });

  const cleanNumber = (val) => {
    if (!val && val !== 0) return 0;
    const cleaned = String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const formatCurrency = (amount) => {
    return cleanNumber(amount).toLocaleString('EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " جنيه";
  };

  // الإجمالي المستحق الأساسي (بدون أي أقساط)
  const mainTotal = React.useMemo(() => {
    return (
      cleanNumber(feesData.registration_fee) +
      cleanNumber(feesData.tuition_fee) +
      cleanNumber(feesData.late_fee) +
      cleanNumber(feesData.freeze_fee) +
      cleanNumber(feesData.unfreeze_fee)
    );
  }, [feesData]);

  // مجموع الأقساط (منفصل تمامًا - للعرض فقط)
  const installmentsTotal = React.useMemo(() => {
    return (
      cleanNumber(feesData.installment_1) +
      cleanNumber(feesData.installment_2) +
      cleanNumber(feesData.installment_3) +
      cleanNumber(feesData.installment_4) +
      cleanNumber(feesData.installment_5) +
      cleanNumber(feesData.installment_6)
    );
  }, [feesData]);

  // دالة تقسيم الإجمالي المستحق تلقائيًا على عدد الأقساط
  const autoDivideInstallments = () => {
    if (installmentCount <= 0) return;

    if (mainTotal <= 0) {
      showToast("الإجمالي المستحق صفر، لا يمكن التقسيم", "warning");
      return;
    }

    const perInstallment = mainTotal / installmentCount;
    const rounded = Math.round(perInstallment * 100) / 100;

    setFeesData(prev => {
      const newData = { ...prev };

      // ملء الأقساط بالقيمة المتساوية
      for (let i = 1; i <= installmentCount; i++) {
        newData[`installment_${i}`] = rounded.toFixed(2);
      }

      // مسح الأقساط الزائدة
      for (let i = installmentCount + 1; i <= 6; i++) {
        newData[`installment_${i}`] = "";
        newData[`installment_${i}_start`] = "";
        newData[`installment_${i}_end`] = "";
      }

      return newData;
    });

    showToast(`تم تقسيم الإجمالي المستحق (${formatCurrency(mainTotal)}) على ${installmentCount} أقساط → كل قسط ≈ ${formatCurrency(rounded)}`, "success");
  };

  // تطبيق خصم المنحة بدقة
  const applyScholarshipDiscount = (percentage) => {
    setFeesData(prev => {
      let base = cleanNumber(prev.tuition_fee_original) || cleanNumber(prev.tuition_fee) || 0;

      if (academicStatus === "إعاده") {
        const repeatPerc = cleanNumber(prev.repeat_discount) / 100 || 0.5;
        base = base * (1 - repeatPerc);
      }

      const discounted = Math.round(base * (1 - (percentage / 100)) * 100) / 100;

      return {
        ...prev,
        scholarship_percentage: percentage,
        tuition_fee: discounted.toFixed(2),
      };
    });
  };

  // تغيير نوع المنحة
  const handleScholarshipChange = (e) => {
    const val = e.target.value;
    const opt = SCHOLARSHIP_OPTIONS.find(o => o.type === val);
    
    let perc = opt?.percentage ?? 0;
    if (perc === null) perc = 0;

    setFeesData(prev => {
      let base = cleanNumber(prev.tuition_fee_original) || cleanNumber(prev.tuition_fee) || 0;

      if (academicStatus === "إعاده") {
        const repeatPerc = cleanNumber(prev.repeat_discount) / 100 || 0.5;
        base = base * (1 - repeatPerc);
      }

      return {
        ...prev,
        scholarship_type: val,
        scholarship_percentage: perc,
        tuition_after_repeat: base.toFixed(2),
        tuition_fee: base.toFixed(2),
      };
    });

    if (perc > 0) {
      applyScholarshipDiscount(perc);
    }
  };

  // تحميل الكليات
  useEffect(() => {
    fetch(`${API_BASE}/faculties-list`)
      .then(res => res.json())
      .then(setFaculties)
      .catch(() => showToast("خطأ في تحميل الكليات", "error"));
  }, []);

  // تحميل الأقسام
  useEffect(() => {
    if (!facultyId) {
      setDepartments([]);
      setDepartmentId("");
      return;
    }
    fetch(`${API_BASE}/departments/${facultyId}`)
      .then(res => res.json())
      .then(setDepartments)
      .catch(() => showToast("خطأ في تحميل الأقسام", "error"));
  }, [facultyId]);

  // تحميل الفترات
  useEffect(() => {
    if (departmentId || (programType === "postgraduate" && postgradProgram.trim())) {
      smart.fetchAcademicPeriods();
    }
  }, [departmentId, programType, postgradProgram]);

  useEffect(() => {
    smart.rebuildOptions(academicYear, levelName);
  }, [academicYear, levelName, smart.periods]);

  // بحث الطالب
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setStudentSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/students/search?q=${encodeURIComponent(searchQuery.trim())}`)
        .then(res => res.json())
        .then(data => setStudentSuggestions(Array.isArray(data) ? data : []))
        .catch(() => setStudentSuggestions([]));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // اختيار الطالب
  const selectStudent = (student) => {
    setSelectedStudent(student);
    setSearchQuery("");
    setStudentSuggestions([]);
    setLoadingStudentFees(true);
    setFeesSource("");

    setFeesData(defaultFeesData);
    setInstallmentCount(0);
    setCalculatedFees(null);
    setAcademicStatus("");
    setFacultyType("");

    fetch(`${API_BASE}/students/${student.id}`)
      .then(res => {
        if (!res.ok) throw new Error("فشل جلب بيانات الطالب");
        return res.json();
      })
      .then(data => {
        const studentData = data.student;
        const lastReg = data.lastRegistration || {};

        setFacultyId(studentData?.faculty_id ? String(studentData.faculty_id) : "");
        setDepartmentId(studentData?.department_id ? String(studentData.department_id) : "");
        setProgramType(lastReg?.program_type || programType);
        setPostgradProgram(lastReg?.postgraduate_program || postgradProgram);
      })
      .catch(err => showToast("خطأ في جلب بيانات الطالب", "error"))
      .finally(() => setLoadingStudentFees(false));
  };

  // جلب الرسوم + الموقف الأكاديمي
  useEffect(() => {
    if (!selectedStudent || !academicYear || !levelName) {
      setFeesSource("");
      return;
    }

    const loadFees = async () => {
      setLoadingStudentFees(true);
      try {
        const params = new URLSearchParams({
          student_id: selectedStudent.id,
          academic_year: academicYear,
          level_name: levelName,
        });

        let res = await fetch(`${API_BASE}/student-fees?${params}`);
        if (res.ok) {
          const fees = await res.json();
          fillFeesData(fees);
          setFeesSource("student");
          showToast("تم تحميل رسوم خاصة بالطالب", "success");
        } else if (res.status === 404) {
          const defParams = new URLSearchParams({
            academic_year: academicYear,
            level_name: levelName,
            program_type: programType,
            ...(postgradProgram && { postgraduate_program: postgradProgram.trim() }),
          });
          res = await fetch(`${API_BASE}/term-default-fees?${defParams}`);
          if (res.ok) {
            const defFees = await res.json();
            fillFeesData(defFees);
            setFeesSource("default");
            showToast("لا رسوم خاصة – تم تحميل الرسوم العامة", "info");
          }
        }

        res = await fetch(`${API_BASE}/student-fees-calculated?${params}`);
        if (res.ok) {
          const calc = await res.json();
          setCalculatedFees(calc);
          setAcademicStatus(calc.academic_status || "نظامي");
          setFacultyType(calc.faculty_type || "غير محدد");

          let original = calc.tuition_fee?.toString() || "";
          let afterRepeat = original;

          if (calc.academic_status === "إعاده" && calc.repeat_discount) {
            const repeatPerc = cleanNumber(calc.repeat_discount) / 100 || 0.5;
            original = (cleanNumber(afterRepeat) / (1 - repeatPerc)).toFixed(2);
          }

          setFeesData(prev => ({
            ...prev,
            tuition_fee: calc.tuition_fee?.toString() || prev.tuition_fee,
            tuition_fee_original: original,
            tuition_after_repeat: afterRepeat,
            freeze_fee: calc.total_extra && calc.notes?.includes("تجميد") ? calc.total_extra.toString() : "0",
            unfreeze_fee: "0",
          }));
        }
      } catch (err) {
        showToast(err.message || "لا رسوم متاحة لهذه الفترة", "warning");
        setFeesSource("");
      } finally {
        setLoadingStudentFees(false);
      }
    };

    loadFees();
  }, [selectedStudent, academicYear, levelName, programType, postgradProgram]);

  // ملء البيانات
  const fillFeesData = (fees) => {
    const tuition = fees.tuition_fee?.toString() || "";
    let original = tuition;
    let afterRepeat = tuition;

    if (academicStatus === "إعاده" && fees.repeat_discount) {
      const repeatPerc = cleanNumber(fees.repeat_discount) / 100 || 0.5;
      original = (cleanNumber(tuition) / (1 - repeatPerc)).toFixed(2);
    }

    setFeesData(prev => ({
      ...prev,
      registration_fee: fees.registration_fee?.toString() || "",
      tuition_fee: tuition,
      tuition_fee_original: original,
      tuition_after_repeat: afterRepeat,
      late_fee: fees.late_fee?.toString() || "",
      freeze_fee: fees.freeze_fee?.toString() || "0",
      unfreeze_fee: fees.unfreeze_fee?.toString() || "0",
      repeat_discount: fees.repeat_discount?.toString() || "50",
      scholarship_type: fees.scholarship_type || "لا منحة",
      scholarship_percentage: fees.scholarship_percentage || 0,
      installment_1: fees.installment_1?.toString() || "",
      installment_1_start: fees.installment_1_start || "",
      installment_1_end: fees.installment_1_end || "",
      installment_2: fees.installment_2?.toString() || "",
      installment_2_start: fees.installment_2_start || "",
      installment_2_end: fees.installment_2_end || "",
      installment_3: fees.installment_3?.toString() || "",
      installment_3_start: fees.installment_3_start || "",
      installment_3_end: fees.installment_3_end || "",
      installment_4: fees.installment_4?.toString() || "",
      installment_4_start: fees.installment_4_start || "",
      installment_4_end: fees.installment_4_end || "",
      installment_5: fees.installment_5?.toString() || "",
      installment_5_start: fees.installment_5_start || "",
      installment_5_end: fees.installment_5_end || "",
      installment_6: fees.installment_6?.toString() || "",
      installment_6_start: fees.installment_6_start || "",
      installment_6_end: fees.installment_6_end || "",
    }));

    let count = 0;
    if (fees.installment_6) count = 6;
    else if (fees.installment_5) count = 5;
    else if (fees.installment_4) count = 4;
    else if (fees.installment_3) count = 3;
    else if (fees.installment_2) count = 2;
    else if (fees.installment_1) count = 1;
    setInstallmentCount(count);

    if (fees.scholarship_percentage > 0) {
      applyScholarshipDiscount(fees.scholarship_percentage);
    }
  };

  // حساب الرسوم النهائية تلقائيًا
  const calculateFinalFees = async () => {
    if (!selectedStudent || !academicYear || !levelName) {
      showToast("يرجى اختيار طالب وسنة ومستوى", "error");
      return;
    }
    setCalculating(true);
    try {
      const params = new URLSearchParams({
        student_id: selectedStudent.id,
        academic_year: academicYear,
        level_name: levelName,
      });
      const res = await fetch(`${API_BASE}/student-fees-calculated?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل في حساب الرسوم");

      setCalculatedFees(data);
      setAcademicStatus(data.academic_status || "نظامي");
      setFacultyType(data.faculty_type || "غير محدد");

      let original = data.tuition_fee?.toString() || "";
      let afterRepeat = original;

      if (data.academic_status === "إعاده" && data.repeat_discount) {
        const repeatPerc = cleanNumber(data.repeat_discount) / 100 || 0.5;
        original = (cleanNumber(afterRepeat) / (1 - repeatPerc)).toFixed(2);
      }

      setFeesData(prev => ({
        ...prev,
        tuition_fee: data.tuition_fee?.toString() || prev.tuition_fee,
        tuition_fee_original: original,
        tuition_after_repeat: afterRepeat,
        freeze_fee: data.total_extra && data.notes?.includes("تجميد") ? data.total_extra.toString() : "0",
        unfreeze_fee: "0",
      }));

      showToast("تم حساب الرسوم النهائية بنجاح", "success");
    } catch (err) {
      showToast("خطأ أثناء الحساب: " + err.message, "error");
    } finally {
      setCalculating(false);
    }
  };

  // حفظ الرسوم + reset بعد الحفظ
  const saveFees = async () => {
    if (!academicYear || !levelName) {
      showToast("يرجى اختيار السنة والمستوى", "error");
      return;
    }
    const token = sessionStorage.getItem("token");
    if (!token) {
      showToast("يرجى تسجيل الدخول أولاً", "error");
      navigate("/login");
      return;
    }
    try {
      const body = {
        academic_year: academicYear,
        level_name: levelName,
        program_type: programType,
        postgraduate_program: programType === "postgraduate" ? postgradProgram || null : null,
        department_id: departmentId ? Number(departmentId) : null,
        registration_fee: Number(feesData.registration_fee) || 0,
        tuition_fee: Number(feesData.tuition_fee) || 0,
        late_fee: Number(feesData.late_fee) || 0,
        freeze_fee: Number(feesData.freeze_fee) || 0,
        unfreeze_fee: Number(feesData.unfreeze_fee) || 0,
        repeat_discount: Number(feesData.repeat_discount) || 50,
        scholarship_type: feesData.scholarship_type,
        scholarship_percentage: Number(feesData.scholarship_percentage) || 0,
        installment_1: feesData.installment_1 || null,
        installment_1_start: feesData.installment_1_start || null,
        installment_1_end: feesData.installment_1_end || null,
        installment_2: feesData.installment_2 || null,
        installment_2_start: feesData.installment_2_start || null,
        installment_2_end: feesData.installment_2_end || null,
        installment_3: feesData.installment_3 || null,
        installment_3_start: feesData.installment_3_start || null,
        installment_3_end: feesData.installment_3_end || null,
        installment_4: feesData.installment_4 || null,
        installment_4_start: feesData.installment_4_start || null,
        installment_4_end: feesData.installment_4_end || null,
        installment_5: feesData.installment_5 || null,
        installment_5_start: feesData.installment_5_start || null,
        installment_5_end: feesData.installment_5_end || null,
        installment_6: feesData.installment_6 || null,
        installment_6_start: feesData.installment_6_start || null,
        installment_6_end: feesData.installment_6_end || null,
      };

      let url = `${API_BASE}/term-default-fees`;
      if (selectedStudent) {
        url = `${API_BASE}/student-fees`;
        body.student_id = selectedStudent.id;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `فشل الحفظ (كود: ${res.status})`);
      }

      showToast(
        selectedStudent ? "تم حفظ/تحديث رسوم الطالب بنجاح" : "تم حفظ الرسوم المبدئية بنجاح",
        "success"
      );

      // Reset كامل بعد الحفظ الناجح
      setFeesData(defaultFeesData);
      setInstallmentCount(0);
      setCalculatedFees(null);
      setAcademicStatus("");
      setFacultyType("");
      setFeesSource("");

      if (selectedStudent) {
        selectStudent(selectedStudent);
      }
    } catch (err) {
      showToast("خطأ أثناء الحفظ: " + err.message, "error");
    }
  };

const printFeesReport = () => {
  if (!selectedStudent || !calculatedFees) {
    showToast("اختر طالب أولاً وحساب الرسوم", "error");
    return;
  }

  const paid = 0; 
  const remaining = mainTotal - paid;

  const reportWindow = window.open("", "_blank");
  reportWindow.document.write(`
    <html dir="rtl" lang="ar">
      <head>
        <title>تقرير رسوم الطالب</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; background: #f9f9f9; }
          .report { max-width: 800px; margin: auto; background: white; padding: 30px; border: 1px solid #ddd; border-radius: 10px; }
          h1 { text-align: center; color: #0a3753; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
          th { background: #0a3753; color: white; }
          .total { font-size: 22px; font-weight: bold; color: #b91c1c; text-align: center; margin: 20px 0; }
          .footer { text-align: center; margin-top: 40px; color: #666; }
        </style>
      </head>
      <body>
        <div class="report">
          <h1>تقرير رسوم الطالب</h1>
          <p><strong>الاسم:</strong> ${selectedStudent.full_name}</p>
          <p><strong>الرقم الجامعي:</strong> ${selectedStudent.university_id || "—"}</p>
          <p><strong>السنة:</strong> ${academicYear} | <strong>المستوى:</strong> ${levelName}</p>
          
          <table>
            <tr><th>البند</th><th>المبلغ</th></tr>
            <tr><td>الإجمالي / الرسوم الدراسية</td><td>${formatCurrency(mainTotal)}</td></tr>
            <tr><td>رسوم التسجيل</td><td>${formatCurrency(feesData.registration_fee)}</td></tr>
            <tr><td>إجمالي المسدد</td><td>${formatCurrency(paid)}</td></tr>
            <tr><td><strong>المتبقي</strong></td><td class="total">${formatCurrency(remaining)}</td></tr>
          </table>

          <div class="footer">
            تم الطباعة بتاريخ: ${new Date().toLocaleDateString('ar-EG')} | ${new Date().toLocaleTimeString('ar-EG')}
          </div>
        </div>
        <script>window.print();</script>
      </body>
    </html>
  `);
  reportWindow.document.close();
};

  return (
    <div>
      <h2 style={ui.titleH2}>إدارة الرسوم</h2>

      {/* بحث الطالب */}
      <div style={ui.card}>
        <div style={ui.field}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="اكتب اسم الطالب أو الرقم الجامعي..."
            style={ui.input}
          />
        </div>

        {studentSuggestions.length > 0 && (
          <div style={{ marginTop: 8, border: "1px solid #d9dee8", borderRadius: 10, maxHeight: 220, overflowY: "auto" }}>
            {studentSuggestions.map(s => (
              <div
                key={s.id}
                onClick={() => selectStudent(s)}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid #eee",
                  background: "#fff",
                }}
              >
                {s.full_name} – {s.university_id || "بدون رقم"}
              </div>
            ))}
          </div>
        )}

        {selectedStudent && (
          <div style={{ marginTop: 12, padding: 10, background: "#f0f9ff", borderRadius: 8, color: "#0a3753" }}>
            <strong>الطالب المختار:</strong> {selectedStudent.full_name} ({selectedStudent.university_id || "—"})
            <button
              onClick={() => {
                setSelectedStudent(null);
                setFeesData(defaultFeesData);
                setInstallmentCount(0);
                setFacultyId(""); setDepartmentId("");
                setAcademicYear(""); setLevelName("");
                setFeesSource("");
                setCalculatedFees(null);
                setAcademicStatus("");
                setFacultyType("");
              }}
              style={{
                marginRight: 12, marginLeft: 12,
                padding: "4px 12px", fontSize: 13,
                background: "#ef4444", color: "white", border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              إلغاء الاختيار
            </button>
          </div>
        )}
      </div>

      {/* نوع البرنامج */}
      <div style={ui.card}>
        <h3 style={ui.sectionTitle}>نوع البرنامج</h3>
        <div style={{ display: "flex", gap: 20 }}>
          <label><input type="radio" value="diploma" checked={programType === "diploma"} onChange={e => setProgramType(e.target.value)} /> دبلوم</label>
          <label><input type="radio" value="bachelor" checked={programType === "bachelor"} onChange={e => setProgramType(e.target.value)} /> بكالوريوس</label>
          <label><input type="radio" value="postgraduate" checked={programType === "postgraduate"} onChange={e => setProgramType(e.target.value)} /> دراسات عليا</label>
        </div>
      </div>

      {programType === "postgraduate" && (
        <div style={ui.card}>
          <h3 style={ui.sectionTitle}>برنامج الدراسات العليا</h3>
          <input
            type="text"
            list="fees_pg_list"
            value={postgradProgram}
            onChange={e => setPostgradProgram(e.target.value)}
            placeholder="مثال: ماجستير إدارة أعمال"
            style={ui.input}
          />
          <datalist id="fees_pg_list" />
        </div>
      )}

      {/* الفترة الدراسية */}
      <div style={ui.card}>
        <h3 style={ui.sectionTitle}>الفترة الدراسية</h3>
        {selectedStudent && (!academicYear || !levelName) && (
          <p style={{ color: "#d97706", fontWeight: 600, margin: "8px 0" }}>
            يرجى اختيار السنة والمستوى كاملين لعرض الرسوم
          </p>
        )}
        <div style={ui.grid}>
          <div style={ui.field}>
            <label>الكلية</label>
            <select value={facultyId} onChange={e => setFacultyId(e.target.value)} style={ui.select}>
              <option value="">اختر الكلية</option>
              {faculties.map(f => <option key={f.id} value={f.id}>{f.faculty_name}</option>)}
            </select>
          </div>
          <div style={ui.field}>
            <label>القسم</label>
            <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} disabled={!facultyId} style={ui.select}>
              <option value="">اختر القسم</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
            </select>
          </div>
          <div style={ui.field}>
            <label>السنة الدراسية</label>
            <input 
              list="fees_years" 
              value={academicYear} 
              onChange={e => setAcademicYear(e.target.value)} 
              placeholder="مثال: 2025/2026" 
              style={ui.input} 
            />
            <datalist id="fees_years">
              {smart.yearOptions.map(y => <option key={y} value={y} />)}
            </datalist>
          </div>
          <div style={ui.field}>
            <label>المستوى</label>
            <input 
              list="fees_levels" 
              value={levelName} 
              onChange={e => setLevelName(e.target.value)} 
              placeholder="مثال: المستوى الثاني" 
              disabled={!academicYear} 
              style={ui.input} 
            />
            <datalist id="fees_levels">
              {smart.levelOptions.map(l => <option key={l} value={l} />)}
            </datalist>
          </div>
        </div>
      </div>

      {academicYear && levelName && (
        <div style={ui.card}>
          <h3 style={ui.sectionTitle}>
            {selectedStudent ? `رسوم الطالب: ${selectedStudent.full_name}` : "الرسوم المبدئية للمستوى"}
          </h3>

          {academicStatus && (
            <div style={{
              padding: 12,
              background: "#f0f9ff",
              borderRadius: 10,
              marginBottom: 16,
              textAlign: "center",
              fontWeight: 600,
              fontSize: 16,
            }}>
              الموقف الأكاديمي: <span style={{ color: academicStatus === "مجمّد" ? "#b91c1c" : "#0f766e" }}>{academicStatus}</span> ({facultyType})
            </div>
          )}

          {/* عرض الإجماليات */}
          <div style={{
            background: "#f8fafc",
            padding: 20,
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            marginBottom: 24,
          }}>
            <div style={{
              textAlign: "center",
              fontSize: 28,
              fontWeight: 900,
              color: "#0a3753",
              padding: 16,
              background: "#e0f2fe",
              borderRadius: 12,
              margin: "12px 0",
            }}>
              الإجمالي المستحق: {formatCurrency(mainTotal)}
            </div>

            {installmentsTotal > 0 && (
              <div style={{
                textAlign: "center",
                fontSize: 18,
                color: installmentsTotal === mainTotal ? "#166534" : "#b91c1c",
                marginTop: 12,
                fontWeight: installmentsTotal === mainTotal ? "bold" : "normal",
              }}>
                مجموع الأقساط المدخلة: {formatCurrency(installmentsTotal)}
                {installmentsTotal !== mainTotal && " (غير متطابق مع الإجمالي المستحق)"}
              </div>
            )}

            {feesSource && (
              <div style={{
                marginTop: 16,
                padding: 12,
                background: feesSource === "student" ? "#dbeafe" : "#fefce8",
                borderRadius: 10,
                textAlign: "center",
                fontWeight: 700,
                fontSize: 15,
                color: feesSource === "student" ? "#1d4ed8" : "#92400e",
              }}>
                {feesSource === "student" ? "رسوم خاصة بالطالب" : "رسوم عامة"}
              </div>
            )}
          </div>

          {selectedStudent && (
            <button
              onClick={calculateFinalFees}
              disabled={calculating}
              style={{
                ...ui.primaryBtn,
                background: calculating ? "#94a3b8" : "#0a3753",
                marginBottom: 20,
                width: "100%",
              }}
            >
              {calculating ? "جاري الحساب..." : "حساب الرسوم النهائية"}
            </button>
          )}

          {calculatedFees && (
            <div style={{ marginBottom: 24, padding: 16, background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <h4 style={{ margin: "0 0 16px", color: "#0a3753", fontSize: 18 }}>الرسوم المحسوبة</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><strong>رسوم التسجيل:</strong> {formatCurrency(calculatedFees.registration_fee || 0)}</div>
                <div><strong>رسوم الدراسة:</strong> {formatCurrency(calculatedFees.tuition_fee || 0)}</div>
                <div><strong>رسوم المتأخرات:</strong> {formatCurrency(calculatedFees.late_fee || 0)}</div>
                {calculatedFees.total_extra > 0 && (
                  <div><strong>إضافي (تجميد/فك):</strong> {formatCurrency(calculatedFees.total_extra)}</div>
                )}
                <div><strong>سنة الدخول الأولى:</strong> {calculatedFees.first_enrollment_year || "غير محددة"}</div>
                <div><strong>آخر سنة نشطة:</strong> {calculatedFees.last_active_year || "غير محددة"}</div>
                <div><strong>سنوات الغياب:</strong> {Math.max(0, calculatedFees.years_absent || 0)}</div>
                <div style={{ gridColumn: "1 / -1", color: calculatedFees.notes?.includes("غياب") ? "#b91c1c" : "#0f766e" }}>
                  <strong>ملاحظات:</strong> {calculatedFees.notes || "لا ملاحظات خاصة"}
                </div>
              </div>
            </div>
          )}

          {loadingStudentFees ? (
            <p style={{ color: "#0a3753", textAlign: "center", fontWeight: 600 }}>جاري التحميل...</p>
          ) : (
            <div style={ui.grid}>
              <div style={ui.field}>
                <label>رسوم التسجيل</label>
                <input type="number" value={feesData.registration_fee} onChange={e => setFeesData({...feesData, registration_fee: e.target.value})} style={ui.input} />
              </div>

              <div style={ui.field}>
                <label>رسوم الدراسة</label>
                <input 
                  type="number" 
                  value={feesData.tuition_fee} 
                  onChange={e => {
                    const newValue = e.target.value;
                    setFeesData(prev => ({
                      ...prev,
                      tuition_fee: newValue,
                      tuition_fee_original: newValue,
                    }));
                  }}
                  style={ui.input} 
                />
              </div>

              <div style={ui.field}>
                <label>رسوم المتأخرات</label>
                <input type="number" value={feesData.late_fee} onChange={e => setFeesData({...feesData, late_fee: e.target.value})} style={ui.input} />
              </div>

              {academicStatus === "مجمّد" && (
                <>
                  <div style={ui.field}>
                    <label>رسوم التجميد</label>
                    <input 
                      type="number" 
                      value={feesData.freeze_fee} 
                      onChange={e => setFeesData({...feesData, freeze_fee: e.target.value})} 
                      style={ui.input} 
                    />
                  </div>

                  <div style={ui.field}>
                    <label>رسوم فك التجميد</label>
                    <input 
                      type="number" 
                      value={feesData.unfreeze_fee} 
                      onChange={e => setFeesData({...feesData, unfreeze_fee: e.target.value})} 
                      style={ui.input} 
                    />
                  </div>
                </>
              )}

              {academicStatus === "إعاده" && (
                <div style={ui.field}>
                  <label>نسبة خصم الإعادة (%)</label>
                  <input type="number" value={feesData.repeat_discount} onChange={e => setFeesData({...feesData, repeat_discount: e.target.value})} style={ui.input} placeholder="50" />
                </div>
              )}

              <div style={ui.field}>
                <label>نوع المنحة</label>
                <select value={feesData.scholarship_type} onChange={handleScholarshipChange} style={ui.select}>
                  {SCHOLARSHIP_OPTIONS.map(opt => (
                    <option key={opt.type} value={opt.type}>
                      {opt.type}{opt.percentage !== null && opt.percentage !== 0 ? ` (${opt.percentage}%)` : opt.percentage === null ? " (يدوي)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {["منحة أشقاء", "تخفيضات المدير", "أخرى"].includes(feesData.scholarship_type) && (
                <div style={ui.field}>
                  <label>نسبة الخصم (%)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    step="0.1" 
                    value={feesData.scholarship_percentage || ""} 
                    onChange={e => applyScholarshipDiscount(Number(e.target.value) || 0)} 
                    style={ui.input} 
                    placeholder="مثال: 35" 
                  />
                </div>
              )}

              {feesData.scholarship_percentage > 0 && (
                <div style={{
                  gridColumn: "1 / -1",
                  padding: 14,
                  background: "#ecfdf5",
                  borderRadius: 10,
                  border: "1px solid #86efac",
                  textAlign: "center",
                  margin: "12px 0",
                  fontWeight: 600,
                  color: "#166534",
                  fontSize: 16,
                }}>
                  تم تطبيق خصم {feesData.scholarship_percentage}% بسبب "{feesData.scholarship_type}"<br />
                  رسوم الدراسة بعد الخصم: {formatCurrency(feesData.tuition_fee)}
                </div>
              )}

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={ui.label}>عدد الأقساط</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 10 }}>
                  {INSTALLMENT_OPTIONS.map(opt => (
                    <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input 
                        type="radio" 
                        name="installment_count" 
                        checked={installmentCount === opt.value} 
                        onChange={() => {
                          setInstallmentCount(opt.value);
                          // تقسيم تلقائي فور اختيار العدد
                          setTimeout(autoDivideInstallments, 100);
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>

                {installmentCount > 0 && (
                  <button
                    onClick={autoDivideInstallments}
                    style={{
                      marginTop: 12,
                      padding: "8px 16px",
                      background: "#3b82f6",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                     تقسيم الأقساط تلقائيًا
                  </button>
                )}
              </div>

              {installmentCount > 0 && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <h4 style={{ margin: "24px 0 16px", color: "#0a3753", fontSize: 18, textAlign: "center" }}>
                    تفاصيل الأقساط (تقسيم الإجمالي المستحق)
                  </h4>

                  <div 
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 20,
                      marginBottom: installmentCount > 3 ? 32 : 0,
                    }}
                  >
                    {Array.from({ length: Math.min(3, installmentCount) }).map((_, i) => {
                      const idx = i + 1;
                      return (
                        <div 
                          key={idx} 
                          style={{
                            border: "1px solid #e2e8f0",
                            padding: 20,
                            borderRadius: 12,
                            background: "#f8fafc",
                          }}
                        >
                          <div style={{ fontWeight: 700, marginBottom: 12, textAlign: "center", fontSize: 17 }}>
                            القسط {idx}
                          </div>
                          
                          <input
                            type="number"
                            placeholder="المبلغ"
                            value={feesData[`installment_${idx}`] || ""}
                            onChange={e => setFeesData({ ...feesData, [`installment_${idx}`]: e.target.value })}
                            style={{ ...ui.input, marginBottom: 16, width: "100%" }}
                          />
                          
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div>
                              <label style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>بداية الدفع</label>
                              <input
                                type="date"
                                value={feesData[`installment_${idx}_start`] || ""}
                                onChange={e => setFeesData({ ...feesData, [`installment_${idx}_start`]: e.target.value })}
                                style={{ ...ui.input, width: "100%" }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>نهاية الدفع</label>
                              <input
                                type="date"
                                value={feesData[`installment_${idx}_end`] || ""}
                                onChange={e => setFeesData({ ...feesData, [`installment_${idx}_end`]: e.target.value })}
                                style={{ ...ui.input, width: "100%" }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {installmentCount > 3 && (
                    <div 
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 20,
                        marginTop: 32,
                      }}
                    >
                      {Array.from({ length: installmentCount - 3 }).map((_, i) => {
                        const idx = i + 4;
                        return (
                          <div 
                            key={idx} 
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: 20,
                              borderRadius: 12,
                              background: "#f8fafc",
                            }}
                          >
                            <div style={{ fontWeight: 700, marginBottom: 12, textAlign: "center", fontSize: 17 }}>
                              القسط {idx}
                            </div>
                            
                            <input
                              type="number"
                              placeholder="المبلغ"
                              value={feesData[`installment_${idx}`] || ""}
                              onChange={e => setFeesData({ ...feesData, [`installment_${idx}`]: e.target.value })}
                              style={{ ...ui.input, marginBottom: 16, width: "100%" }}
                            />
                            
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                              <div>
                                <label style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>بداية الدفع</label>
                                <input
                                  type="date"
                                  value={feesData[`installment_${idx}_start`] || ""}
                                  onChange={e => setFeesData({ ...feesData, [`installment_${idx}_start`]: e.target.value })}
                                  style={{ ...ui.input, width: "100%" }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>نهاية الدفع</label>
                                <input
                                  type="date"
                                  value={feesData[`installment_${idx}_end`] || ""}
                                  onChange={e => setFeesData({ ...feesData, [`installment_${idx}_end`]: e.target.value })}
                                  style={{ ...ui.input, width: "100%" }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          <button onClick={saveFees} style={ui.primaryBtn}>
            {selectedStudent ? "حفظ/تحديث رسوم الطالب" : "حفظ الرسوم المبدئية"}
          </button>
          {selectedStudent && (
  <button
    onClick={printFeesReport}
    style={{
      ...ui.primaryBtn,
      background: "#0f766e", 
      marginTop: 15,
      // width: "100%",
    }}
  >
    طباعة تقرير الرسوم
  </button>
)}
        </div>
      )}
    </div>
  );
}
export default RegistrationTabs;