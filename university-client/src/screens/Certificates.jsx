import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";
import html2pdf from "html2pdf.js";

const API_BASE = "http://localhost:5000/api";

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

const Certificates = () => {
  const navigate = useNavigate();

  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [yearOptions, setYearOptions] = useState([]);
  const [pgPrograms, setPgPrograms] = useState([]);

  const [isHovered, setIsHovered] = useState(false);
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [programType, setProgramType] = useState("bachelor");
  const [postgraduateProgram, setPostgraduateProgram] = useState("");
  const [academicYear, setAcademicYear] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentHistory, setStudentHistory] = useState([]);
  const [borrowedBooks, setBorrowedBooks] = useState([]);
  const [isRegisteredLastTerm, setIsRegisteredLastTerm] = useState(false);
  const [isPassedLastTerm, setIsPassedLastTerm] = useState(false);

  const [finalLevelName, setFinalLevelName] = useState("");

  const [loadingFaculties, setLoadingFaculties] = useState(false);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const debounceTimer = useRef(null);


  const canPickDepartment = !!selectedFacultyId;
  const canPickProgramType = !!selectedDepartmentId;
  const canPickPostgraduateProgram = programType === "postgraduate";
const canProceedAfterProgram =
    (programType === "bachelor" || programType === "diploma") 
      ? true 
      : !!postgraduateProgram.trim();
  const canPickYear = canPickProgramType && canProceedAfterProgram;
  const canFetchStudents = canPickYear && !!academicYear.trim() && !!finalLevelName.trim();

  const getAuthHeader = () => ({
    Authorization: `Bearer ${sessionStorage.getItem("token") || ""}`,
  });

  const [isAllFeesPaid, setIsAllFeesPaid] = useState(false);
  const [unpaidYears, setUnpaidYears] = useState([]);          
  const [failedCourses, setFailedCourses] = useState([]);

  useEffect(() => {
    if (programType !== "postgraduate") {
      setPostgraduateProgram("");
      setPgPrograms([]);
      return;
    }

    fetch(`${API_BASE}/postgraduate-programs`, { headers: getAuthHeader() })
      .then((res) => res.json())
      .then((data) => setPgPrograms(Array.isArray(data) ? data : []))
      .catch(() => {
        setPgPrograms([]);
        showToast("خطأ في تحميل برامج الدراسات العليا", "error");
      });
  }, [programType]);

useEffect(() => {
  const loadFaculties = async () => {
    setLoadingFaculties(true);
    try {
      const res = await fetch(`${API_BASE}/faculties-list`, { headers: getAuthHeader() });
      if (!res.ok) throw new Error("فشل جلب الكليات");

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

      // إعادة ضبط الكلية المختارة لو مش موجودة في القايمة الجديدة
      if (selectedFacultyId) {
        const stillAllowed = filtered.find(f => f.id === Number(selectedFacultyId));
        if (!stillAllowed) {
          setSelectedFacultyId("");
        }
      }
    } catch (e) {
      console.error(e);
      showToast("خطأ في تحميل الكليات", "error");
    } finally {
      setLoadingFaculties(false);
    }
  };

  loadFaculties();
}, []);

  useEffect(() => {
    if (!selectedFacultyId) {
      setDepartments([]);
      setFinalLevelName("");
      return;
    }

    setLoadingDeps(true);
    fetch(`${API_BASE}/departments/${selectedFacultyId}`, { headers: getAuthHeader() })
      .then((res) => res.json())
      .then((data) => {
        const deps = Array.isArray(data) ? data : [];
        setDepartments(deps);

        if (selectedDepartmentId) {
          const selectedDept = deps.find((d) => d.id === Number(selectedDepartmentId));
          if (selectedDept) {
            const levelCount = Number(selectedDept.levels_count) || 4;
            let levelArabic;

            if (programType === "postgraduate") {
              levelArabic = "المستوى الأول";
            } else {
              const levelNames = ["", "المستوى الأول", "المستوى الثاني", "المستوى الثالث", "المستوى الرابع"];
              levelArabic = levelNames[levelCount] || `المستوى ${levelCount}`;
            }

            setFinalLevelName(levelArabic);
          }
        }
      })
      .catch(() => showToast("خطأ في تحميل الأقسام", "error"))
      .finally(() => setLoadingDeps(false));
  }, [selectedFacultyId, selectedDepartmentId, programType]);

  useEffect(() => {
    if (!canPickYear) return;
    setLoadingPeriods(true);
    fetch(
      `${API_BASE}/academic-periods?program_type=${programType}&postgraduate_program=${encodeURIComponent(
        postgraduateProgram
      )}`,
      { headers: getAuthHeader() }
    )
      .then((res) => res.json())
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        setYearOptions([...new Set(rows.map((p) => p.academic_year))]);
      })
      .catch(() => showToast("خطأ في تحميل السنوات الأكاديمية", "error"))
      .finally(() => setLoadingPeriods(false));
  }, [programType, postgraduateProgram, canPickYear]);

  useEffect(() => {
    if (!canFetchStudents || !searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const url =
          `${API_BASE}/students-final-level-search?` +
          `faculty_id=${selectedFacultyId}&` +
          `department_id=${selectedDepartmentId}&` +
          `program_type=${programType}&` +
          `postgraduate_program=${encodeURIComponent(postgraduateProgram)}&` +
          `academic_year=${encodeURIComponent(academicYear)}&` +
          `level_name=${encodeURIComponent(finalLevelName)}&` +
          `q=${encodeURIComponent(searchQuery.trim())}`;

        const res = await fetch(url, { headers: getAuthHeader() });
        if (!res.ok) throw new Error(`مشكلة في استجابة البحث: ${res.status}`);

        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("خطأ في البحث:", err);
        setSuggestions([]);
        showToast("حدث خطأ أثناء البحث عن الطلاب", "error");
      } finally {
        setLoadingSuggestions(false);
      }
    }, 400);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [
    searchQuery,
    selectedFacultyId,
    selectedDepartmentId,
    programType,
    postgraduateProgram,
    academicYear,
    finalLevelName,
    canFetchStudents,
  ]);

useEffect(() => {
  if (!selectedStudentId) {
    setSelectedStudent(null);
    setStudentHistory([]);
    setBorrowedBooks([]);
    setIsRegisteredLastTerm(false);
    setIsPassedLastTerm(false);
    setIsAllFeesPaid(false);
    setUnpaidYears([]);
    return;
  }

  setLoadingHistory(true);

  const found = suggestions.find((s) => s.id === selectedStudentId);

  // الـ student_id اللي هنستخدمه
  const studentIdToUse = found ? found.id : selectedStudentId;

  // أول حاجة: نجيب university_id (من found أو من /student-basic)
  let universityIdPromise;

  if (found) {
    setSelectedStudent(found);
    universityIdPromise = Promise.resolve(found.university_id);
  } else {
    universityIdPromise = fetch(`${API_BASE}/student-basic?student_id=${studentIdToUse}`, {
      headers: getAuthHeader(),
    })
      .then((res) => {
        if (!res.ok) throw new Error("خطأ في جلب بيانات الطالب الأساسية");
        return res.json();
      })
      .then((basic) => {
        setSelectedStudent(basic);
        return basic.university_id;
      })
      .catch((err) => {
        console.error(err);
        setSelectedStudent({
          id: studentIdToUse,
          full_name: "اسم الطالب غير معروف",
          university_id: "غير معروف",
        });
        showToast("حدث خطأ أثناء جلب بيانات الطالب", "error");
        return null;
      });
  }

  universityIdPromise
    .then((universityId) => {
      const promises = [
        // السجل الدراسي
        fetch(`${API_BASE}/student-history?student_id=${studentIdToUse}`, { headers: getAuthHeader() }),
        // حالة الرسوم لكل السنين (الشرط الجديد)
        fetch(`${API_BASE}/student-certificate-status?student_id=${studentIdToUse}&final_level=${encodeURIComponent(finalLevelName)}`, {
          headers: getAuthHeader(),
        }),
      ];

      // لو عندنا university_id → نجيب الكتب المستعارة
      if (universityId) {
        promises.push(
          fetch(`${API_BASE}/student-borrowed-books?university_id=${universityId}`, { headers: getAuthHeader() })
        );
      }

      return Promise.all(promises);
    })
    .then((responses) => {
      const histRes = responses[0];
      const statusRes = responses[1];
      const bookRes = responses.length > 2 ? responses[2] : null;

      if (!histRes.ok) throw new Error("خطأ في جلب السجل الدراسي");
      if (!statusRes.ok) throw new Error("خطأ في جلب حالة الشهادة");

      return Promise.all([
        histRes.json(),
        statusRes.json(),
        bookRes ? bookRes.json() : Promise.resolve([]),
      ]);
    })
    .then(([historyData, statusData, booksData]) => {
      // السجل الدراسي
      const history = Array.isArray(historyData) ? historyData : [];
      setStudentHistory(history);

      // الكتب
      setBorrowedBooks(Array.isArray(booksData) ? booksData : []);

      // الشروط من /student-certificate-status
      setIsPassedLastTerm(statusData.is_passed_last_term || false);
      // setIsRegisteredLastTerm(statusData.is_registered_last_term || false);  ← ممكن نحتفظ بيه للعرض بس

      setFailedCourses(statusData.failed_courses || []);

      // الشرط الجديد الأساسي: كل السنين مدفوعة؟
      setIsAllFeesPaid(statusData.is_all_fees_paid || false);
      setUnpaidYears(statusData.unpaid_years || []);

      // لو مفيش سجل دراسي → نعطل النجاح
    let isPassedLastTerm = false;
let isRegisteredLastTerm = false;

if (history.length > 0) {
  const lastSecondTerm = history.find(r => 
    r.term_name && 
    ["الفصل الثاني", "فصل ثاني", "الفصل الثانى"].some(t => r.term_name.includes(t))
  );

  if (lastSecondTerm) {
    isRegisteredLastTerm = true;
    isPassedLastTerm = lastSecondTerm.status === "نجاح";
  }
}

setIsPassedLastTerm(isPassedLastTerm);
setIsRegisteredLastTerm(isRegisteredLastTerm);
    })
    .catch((err) => {
      console.error("خطأ في جلب بيانات الطالب:", err);
      showToast("حدث خطأ أثناء جلب بيانات الطالب", "error");
    })
    .finally(() => {
      setLoadingHistory(false);
    });
}, [selectedStudentId, suggestions, finalLevelName]);   // ← أضفنا finalLevelName كـ dependency

const generateCertificate = () => {
  if (borrowedBooks.length > 0 || !isPassedLastTerm || !isAllFeesPaid) {
    showToast("الطالب غير مؤهل لإصدار الشهادة حالياً", "error");
    return;
  }

  if (!selectedStudent || studentHistory.length === 0) {
    showToast("لا توجد بيانات كافية لإصدار الشهادة", "error");
    return;
  }

  const facultyDisplay = faculties.find(f => f.id === Number(selectedFacultyId))?.faculty_name || "غير محدد";
  const departmentDisplay = departments.find(d => d.id === Number(selectedDepartmentId))?.department_name || "غير محدد";

  const commonHeader = `
    <div style="text-align: center; margin-bottom: 35px; padding-bottom: 18px; border-bottom: 1px solid #ccc;">
      <h1 style="margin: 0; color: #0a3753; font-size: 22px; font-weight: bold;">
        جامعة بورتسودان الأهلية
      </h1>
      <p style="margin: 10px 0 6px; font-weight: bold; font-size: 16px;">
        ${facultyDisplay} - ${departmentDisplay}
      </p>
      <p style="margin: 6px 0; font-size: 14px; color: #334155;">
        السنة الدراسية: ${academicYear || "غير محدد"} 
        | المستوى: ${finalLevelName || "غير محدد"} 
        | الفصل: الثاني
      </p>
    </div>
  `;

  const pdfHTML = `
    <div style="direction: rtl; font-family: 'Cairo', 'Tajawal', sans-serif; padding: 30px 25px; font-size: 14px; color: #0f172a;">
      
      ${commonHeader}

      <h2 style="color: #0a3753; text-align: center; margin: 40px 0 30px; font-size: 20px; font-weight: bold;">
        شهادة خلو طرف الطالب
      </h2>

      <div style="text-align: center; margin: 30px 0; font-size: 16px; font-weight: bold;">
        ${selectedStudent.full_name || "اسم الطالب"}<br>
        <span style="font-size: 15px; color: #475569; font-weight: normal;">
          الرقم الجامعي: ${selectedStudent.university_id || "غير معروف"}
        </span>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin: 25px 0; font-size: 13.5px;">
        <thead>
          <tr style="background: #6e6e6e; color: white;">
            <th style="padding: 12px; border: 1px solid #ccc; font-weight: bold;">#</th>
            <th style="padding: 12px; border: 1px solid #ccc; font-weight: bold;">المستوى</th>
            <th style="padding: 12px; border: 1px solid #ccc; font-weight: bold;">الفصل</th>
            <th style="padding: 12px; border: 1px solid #ccc; font-weight: bold;">الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${studentHistory
            .map((row, i) => `
              <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
                <td style="padding: 11px; border: 1px solid #ddd; text-align: center;">${i + 1}</td>
                <td style="padding: 11px; border: 1px solid #ddd; text-align: center;">${row.level_name || "—"}</td>
                <td style="padding: 11px; border: 1px solid #ddd; text-align: center;">${row.term_name || "—"}</td>
                <td style="padding: 11px; border: 1px solid #ddd; text-align: center; font-weight: ${row.status === "نجاح" ? "bold" : "normal"}; color: ${row.status === "نجاح" ? "#16a34a" : "#dc2626"};">
                  ${row.status || "—"}
                </td>
              </tr>
            `)
            .join("")}
        </tbody>
      </table>

      <div style="margin: 40px 0; line-height: 1.8; font-size: 14.5px;">
        <p><strong>مسجل في آخر فصل:</strong> ${isRegisteredLastTerm ? "نعم" : "لا"}</p>
        <p><strong>نجح في آخر مستوى:</strong> ${isPassedLastTerm ? "نعم" : "لا"}</p>
        <p><strong>كتب مستعارة غير مرجعة:</strong> ${borrowedBooks.length > 0 ? "نعم" : "لا"}</p>
      </div>

      ${borrowedBooks.length > 0 ? `
        <div style="margin-top: 20px; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;">
          <strong style="color: #b91c1c; display: block; margin-bottom: 8px;">الكتب المستعارة حاليًا:</strong>
          <ul style="margin: 0; padding-right: 20px; list-style-type: disc; font-size: 13.5px;">
            ${borrowedBooks.map(book => `
              <li style="margin-bottom: 6px;">
                ${book.title} — ${book.borrowed_at?.split("T")[0] || "غير محدد"}
              </li>
            `).join("")}
          </ul>
        </div>
      ` : ""}

      <div style="text-align: center; margin-top: 60px; font-size: 13.5px; color: #475569;">
        تاريخ الإصدار: ${new Date().toLocaleDateString("EG", {
          year: "numeric",
          month: "long",
          day: "numeric"
        })}
      </div>

    </div>
  `;

  const opt = {
    margin: [10, 8, 15, 8],         
    filename: `شهادة_خلو_طرف_${selectedStudent.university_id || "طالب"}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      letterRendering: true
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "portrait"
    },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] }
  };

  html2pdf()
    .from(pdfHTML)
    .set(opt)
    .save()
    .catch(err => {
      console.error("خطأ في إنشاء PDF:", err);
      showToast("حدث خطأ أثناء إنشاء ملف الشهادة", "error");
    });

  showToast("جاري إنشاء شهادة خلو الطرف...", "success");
};


  return (
    <div dir="rtl" style={ui.page} className="min-h-screen bg-gray-50">
      <header className="library-header">
        <div className="library-header-title">
          <span style={{ fontSize: 22, fontWeight: 800 }}>خلو طرف الطالب</span>
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
          {/* نوع البرنامج - radio buttons */}
          <div style={ui.card}>
            <h3 style={ui.sectionTitle}>نوع البرنامج</h3>
            <div style={{ display: "flex", gap: 24 }}>
                            <label>
                <input
                  type="radio"
                  value="diploma"
                  checked={programType === "diploma"}
                  onChange={(e) => setProgramType(e.target.value)}
                />
دبلوم              </label>
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
                list="pg_programs_list"
                value={postgraduateProgram}
                onChange={(e) => setPostgraduateProgram(e.target.value)}
                placeholder="اكتب اسم البرنامج أو اختر"
                style={ui.input}
              />
              <datalist id="pg_programs_list">
                {pgPrograms.map((p, i) => (
                  <option key={i} value={p} />
                ))}
              </datalist>
            </div>
          )}

          {/* الفلاتر الرئيسية */}
          <div style={ui.card}>
            <div style={ui.grid}>
              <div style={ui.field}>
                <label style={ui.label}>الكلية</label>
                <select
                  style={ui.select}
                  value={selectedFacultyId}
                  onChange={(e) => {
                    setSelectedFacultyId(e.target.value);
                    setSelectedDepartmentId("");
                    setFinalLevelName("");
                  }}
                  disabled={loadingFaculties}
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
                  style={ui.select}
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  disabled={!canPickDepartment || loadingDeps}
                >
                  <option value="">اختر القسم</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.department_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ ...ui.field, gridColumn: "1 / -1" }}>
                <label style={ui.label}>السنة الأكاديمية</label>
                <input
                  type="text"
                  list="year_options"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  disabled={!canPickYear || loadingPeriods}
                  placeholder="مثال: 2025/2026"
                  style={ui.input}
                />
                <datalist id="year_options">
                  {yearOptions.map((y) => (
                    <option key={y} value={y} />
                  ))}
                </datalist>
              </div>
            </div>

            {finalLevelName && (
              <div style={{ marginTop: 16, color: "#0a3753", fontWeight: 700 }}>
                المستوى النهائي المحدد: {finalLevelName}
              </div>
            )}
          </div>

          {/* البحث عن الطالب */}
          {canFetchStudents && (
            <div style={ui.card}>
              <h3 style={ui.sectionTitle}>البحث عن طالب</h3>
              <input
                type="text"
                placeholder="اكتب الاسم أو الرقم الجامعي..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={ui.input}
                autoComplete="off"
              />

              {searchQuery.trim() && (
                <div
                  style={{
                    marginTop: 8,
                    maxHeight: 280,
                    overflowY: "auto",
                    border: "1px solid #e6e8ee",
                    borderRadius: 8,
                    background: "white",
                  }}
                >
                  {loadingSuggestions ? (
                    <div style={{ padding: 16, color: "#64748b" }}>جاري البحث...</div>
                  ) : suggestions.length > 0 ? (
                    suggestions.map((student) => (
                      <div
                        key={student.id}
                        onClick={() => {
                          setSelectedStudentId(student.id);
                          setSearchQuery(`${student.full_name} — ${student.university_id}`);
                          setSuggestions([]);
                        }}
                        style={{
                          padding: "10px 14px",
                          cursor: "pointer",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{student.full_name}</div>
                        <div style={{ fontSize: "0.9em", color: "#64748b" }}>
                          {student.university_id}
                        </div>
                      </div>
                    ))
                  ) : (
                    // <div style={{ padding: 16, color: "#b91c1c" }}></div>
                    <div style={{ padding: 16, color: "#b91c1c" }}>لا يوجد نتائج مطابقة</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* عرض بيانات الطالب + الشهادة */}
          {loadingHistory ? (
            <div style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
              جاري تحميل بيانات الطالب...
            </div>
          ) : selectedStudentId && selectedStudent ? (
            <div id="certificate-content" style={ui.card}>
              <h2 style={{ ...ui.titleH2, textAlign: "center" }}>
                خلو طرف الطالب
                <br />
                <small style={{ fontSize: 16, color: "#475569" }}>
                  {selectedStudent.full_name} — {selectedStudent.university_id}
                </small>
              </h2>

              <div style={ui.tableWrap}>
                <table style={ui.table}>
                  <thead>
                    <tr>
                      <th style={ui.th}>#</th>
                      <th style={ui.th}>المستوى</th>
                      <th style={ui.th}>الفصل</th>
                      <th style={ui.th}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentHistory.map((r, i) => (
                      <tr key={i}>
                        <td style={ui.td}>{i + 1}</td>
                        <td style={ui.td}>{r.level_name || "—"}</td>
                        <td style={ui.td}>{r.term_name || "—"}</td>
                        <td style={{ ...ui.td, fontWeight: r.status === "نجاح" ? 700 : 400 }}>
                          {r.status || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ margin: "24px 0", lineHeight: 1.8 }}>
                <p>
                  <strong>مسجل في آخر فصل:</strong> {isRegisteredLastTerm ? "نعم" : "لا"}
                </p>
                <p>
                  <strong>نجح في آخر مستوى:</strong> {isPassedLastTerm ? "نعم" : "لا"}
                </p>
                <p>
                  <strong>كتب مستعارة غير مرجعة:</strong> {borrowedBooks.length > 0 ? "نعم" : "لا"}
                </p>

                {borrowedBooks.length > 0 && (
                  <div style={{ marginTop: 16, padding: 12, background: "#fef2f2", borderRadius: 8 }}>
                    <strong style={{ color: "#b91c1c" }}>الكتب المستعارة حاليًا:</strong>
                    <ul style={{ marginTop: 8, paddingRight: 20 }}>
                      {borrowedBooks.map((book, i) => (
                        <li key={i} style={{ marginBottom: 6 }}>
                          {book.title} — {book.borrowed_at?.split("T")[0] || "غير محدد"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* عرض تفاصيل الأقساط الغير مدفوعة لو موجودة */}
{!isAllFeesPaid && unpaidYears.length > 0 && (
  <div style={{
    background: "#fef2f2",
    padding: "16px",
    borderRadius: "8px",
    marginTop: "16px",
    border: "1px solid #fecaca"
  }}>
    <strong style={{ color: "#b91c1c", display: "block", marginBottom: "8px" }}>
      الأقساط غير مكتملة في السنوات التالية:
    </strong>
    <ul style={{ paddingRight: "24px", margin: "8px 0 0 0" }}>
      {unpaidYears.map((item, idx) => (
        <li key={idx} style={{ marginBottom: "6px" }}>
          <strong>{item.academic_year} – {item.level_name}</strong><br />
          الأقساط غير المدفوعة: {item.unpaid_installments.join("، ")}
        </li>
      ))}
    </ul>
  </div>
)}

{/* عرض المواد الراسبة لو موجودة */}
{failedCourses.length > 0 && (
  <div style={{
    background: "#fef2f2",
    padding: "16px",
    borderRadius: "8px",
    marginTop: "16px",
    border: "1px solid #fecaca"
  }}>
    <strong style={{ color: "#b91c1c", display: "block", marginBottom: "12px", fontSize: "1.1em" }}>
      مواد راسبة / إعادة لم يتم النجاح فيها بعد:
    </strong>
    
    <div style={{ maxHeight: "240px", overflowY: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95em" }}>
        <thead>
          <tr style={{ background: "#fee2e2" }}>
            <th style={{ padding: "8px", border: "1px solid #fecaca", textAlign: "right" }}>السنة</th>
            <th style={{ padding: "8px", border: "1px solid #fecaca", textAlign: "right" }}>المستوى</th>
            {/* <th style={{ padding: "8px", border: "1px solid #fecaca", textAlign: "right" }}>الفصل الدراسي</th> */}
            <th style={{ padding: "8px", border: "1px solid #fecaca", textAlign: "right" }}>اسم المادة</th>
            {/* <th style={{ padding: "8px", border: "1px solid #fecaca", textAlign: "center" }}>الدرجة</th> */}
            <th style={{ padding: "8px", border: "1px solid #fecaca", textAlign: "center" }}>التقدير</th>
          </tr>
        </thead>
        <tbody>
          {failedCourses.map((course, idx) => (
            <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#fff5f5" }}>
              <td style={{ padding: "8px", border: "1px solid #fecaca" }}>{course.academic_year}</td>
              <td style={{ padding: "8px", border: "1px solid #fecaca" }}>{course.level_name}</td>
              {/* <td style={{ padding: "8px", border: "1px solid #fecaca", textAlign: "right" }}>
                {course.term_name || "غير محدد"}
              </td> */}
              <td style={{ padding: "8px", border: "1px solid #fecaca" }}>{course.course_name || "غير معروف"}</td>
              {/* <td style={{ padding: "8px", border: "1px solid #fecaca", textAlign: "center", fontWeight: "bold", color: "#dc2626" }}>
                {course.total_mark ?? "—"}
              </td> */}
              <td style={{ padding: "8px", border: "1px solid #fecaca", textAlign: "center", fontWeight: "bold", color: "#dc2626" }}>
                {course.letter || ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}

              <div style={{ textAlign: "center", marginTop: 24 }}>


<button
  onClick={generateCertificate}
  disabled={
    borrowedBooks.length > 0 || 
    !isPassedLastTerm || 
    !isAllFeesPaid ||           // ← ده موجود في disabled بس مش في opacity
    failedCourses.length > 0   
  }
  onMouseEnter={() => setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
  style={{
    ...ui.primaryBtn,
    padding: "14px 40px",
    fontSize: 17,
    // هنا الشرط الكامل عشان الزر يبقى باهت في كل الحالات الممنوعة
    opacity: (
      borrowedBooks.length > 0 || 
      !isPassedLastTerm || 
      !isAllFeesPaid ||           // ← أضفناه هنا
      failedCourses.length > 0   
    ) ? 0.6 : 1,
    backgroundColor: isHovered ? "#0c4a6e" : "#0a3753",
    transform: isHovered ? "scale(1.05)" : "scale(1)",
    boxShadow: isHovered ? "0 6px 20px rgba(10,55,83,0.3)" : "none",
    transition: "all 0.3s ease",
    cursor: (
      borrowedBooks.length > 0 || 
      !isPassedLastTerm || 
      !isAllFeesPaid || 
      failedCourses.length > 0   
    ) ? "not-allowed" : "pointer"
  }}
>
  طباعة
</button>

{(borrowedBooks.length > 0 || !isPassedLastTerm || !isAllFeesPaid) && (
  <p style={{ marginTop: 16, color: "#dc2626", fontWeight: 700 }}>
    لا يمكن إصدار خلو طرف حاليًا – يرجى مراجعة الشروط أعلاه
  </p>
)}

              </div>
            </div>
          ) : null}
        </div>
      </main>

      {/* Toast بنفس الستايل */}
      {toast && (
        <div
          style={{
            position: "fixed",
            right: 24,
            bottom: 24,
            background: toast.type === "error" ? "#dc2626" : "#16a34a",
            color: "white",
            padding: "14px 24px",
            borderRadius: 12,
            fontWeight: 700,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            zIndex: 1000,
            maxWidth: 400,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default Certificates;