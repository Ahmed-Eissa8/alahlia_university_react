import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";
import html2pdf from 'html2pdf.js';

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000/api";

const ui = {
  page: {
    fontFamily: `"Cairo", "Tajawal", system-ui, -apple-system, "Segoe UI", Arial, sans-serif`,
    fontSize: 16,
    minHeight: "100vh",
    background: "#f8fafc",
  },
  header: {
    background: "#0a3753",
    color: "#fff",
    padding: "16px 24px",
    display: "flex",
    alignItems: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
  },
  title: {
    margin: "0 0 0 16px",
    fontSize: 22,
    fontWeight: 800,
  },
  card: {
    border: "1px solid #e6e8ee",
    background: "#fff",
    padding: 20,
    borderRadius: 12,
    margin: "20px auto",
    maxWidth: 1100,
    boxShadow: "0 4px 16px rgba(10,55,83,0.06)",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#0a3753",
    margin: "0 0 20px 0",
  },
  field: {
    position: "relative",
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 8,
    display: "block",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 16,
    fontFamily: `"Cairo", "Tajawal", sans-serif`,
    outline: "none",
    transition: "border-color 0.2s",
  },
  suggestions: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    maxHeight: 320,
    overflowY: "auto",
    boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
    zIndex: 10,
    marginTop: 4,
  },
  suggestionItem: {
    padding: "12px 16px",
    cursor: "pointer",
    borderBottom: "1px solid #f1f5f9",
    transition: "background 0.15s",
  },
  primaryBtn: {
    padding: "14px 32px",
    background: "#0a3753",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 20,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    marginTop: 16,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 15,
  },
  th: {
    background: "#f8fafc",
    padding: "12px 16px",
    textAlign: "right",
    fontWeight: 700,
    color: "#0f172a",
    borderBottom: "2px solid #e2e8f0",
  },
  td: {
    padding: "12px 16px",
    textAlign: "right",
    borderBottom: "1px solid #f1f5f9",
    color: "#1e293b",
  },
  gpaBox: {
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    borderRadius: 8,
    padding: "12px 16px",
    margin: "8px 0",
    textAlign: "center",
  },
};

const AcademicRecord = () => {
  const navigate = useNavigate();
  const printRef = useRef();

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [latestReg, setLatestReg] = useState(null);
  const [grades, setGrades] = useState([]);          // درجات المواد
  const [termGpas, setTermGpas] = useState([]);     // المعدلات   
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // live search (debounce)
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/search-students-live?q=${encodeURIComponent(searchQuery)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSuggestions(data.slice(0, 12));
        setShowSuggestions(true);
      } catch (err) {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectStudent = async (student) => {
    setSelectedStudent(student);
    setSearchQuery(student.full_name || student.university_id || "");
    setShowSuggestions(false);
    setSuggestions([]);

    setLoading(true);
    try {
      // آخر تسجيل
      const regRes = await fetch(`${API_BASE}/student-registrations?student_id=${student.id}&latest=true`);
      if (regRes.ok) {
        const regData = await regRes.json();
        setLatestReg(regData);
      }

      // جلب الدرجات + المعدلات
      const gradesRes = await fetch(`${API_BASE}/course-grades?student_id=${student.id}`);
      if (gradesRes.ok) {
        const data = await gradesRes.json();
        setGrades(data.grades || []);
        setTermGpas(data.term_gpas || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const groupTermGpasByLevel = () => {
    const byLevel = {};

    termGpas.forEach(term => {
      const level = term.level_name || "غير محدد";
      if (!byLevel[level]) byLevel[level] = {};

      const termKey = `${term.academic_year}-${term.term_name}`;
      byLevel[level][termKey] = {
        academic_year: term.academic_year,
        term_name: term.term_name,
        term_gpa: term.term_gpa || "—",
        cumulative_gpa: term.cumulative_gpa || "—",
      };
    });

    return byLevel;
  };

  const groupedTermGpas = groupTermGpasByLevel();

const levelOrder = [
  "المستوى الأول",
  "المستوى الثاني",
  "المستوى الثالث",
  "المستوى الرابع",
  "المستوى الخامس",
  "المستوى السادس"  
];

const sortByLevelOrder = (levelsObj) => {
  return Object.entries(levelsObj).sort(([levelA], [levelB]) => {
    const indexA = levelOrder.indexOf(levelA);
    const indexB = levelOrder.indexOf(levelB);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });
};
  
  const handlePrint = () => {
    if (!selectedStudent || grades.length === 0) {
      alert("لا توجد بيانات كافية للطباعة");
      return;
    }

    const facultyName = grades[0]?.faculty_name || "غير محدد";
    const departmentName = grades[0]?.department_name || "غير محدد";

    const byLevel = {};

    grades.forEach(grade => {
      const level = grade.level_name || "غير محدد";
      const termKey = `${grade.academic_year}-${grade.term_name}`;

      if (!byLevel[level]) byLevel[level] = {};
      if (!byLevel[level][termKey]) {
        byLevel[level][termKey] = {
          academic_year: grade.academic_year,
          term_name: grade.term_name,
          courses: [],
          term_gpa: "—",
          cumulative_gpa: "—"
        };
      }

      const term = byLevel[level][termKey];
      term.courses.push({
        name: grade.course_name || "—",
        letter: grade.letter || "—",
        hours: Number(grade.credit_hours) || "—"
      });
    });

    termGpas.forEach(term => {
      const level = term.level_name || "غير محدد";
      const termKey = `${term.academic_year}-${term.term_name}`;

      if (byLevel[level] && byLevel[level][termKey]) {
        byLevel[level][termKey].term_gpa = term.term_gpa || "—";
        byLevel[level][termKey].cumulative_gpa = term.cumulative_gpa || "—";
      }
    });

    let content = `
      <div style="direction: rtl; font-family: 'Cairo', 'Tajawal', sans-serif; padding: 35px 25px; font-size: 14.5px; line-height: 1.6; color: #1f2937;">
        <div style="text-align: center; margin-bottom: 35px; padding-bottom: 20px; border-bottom: 3px solid #0a3753;">
          <h1 style="margin: 0; color: #0a3753; font-size: 28px; font-weight: 900;">
            جامعة بورتسودان الأهلية
          </h1>
          <h3 style="margin: 10px 0 6px; color: #334155; font-size: 20px; font-weight: 700;">
            ${facultyName}
          </h3>
          <h4 style="margin: 6px 0 10px; color: #475569; font-size: 17px; font-weight: 600;">
            القسم: ${departmentName}
          </h4>
          <h2 style="margin: 16px 0 8px; color: #0f172a; font-size: 23px; font-weight: 800;">
            السجل الأكاديمي – ${selectedStudent.full_name}
          </h2>
          <p style="margin: 6px 0 0; color: #4b5563; font-size: 15.5px;">
            الرقم الجامعي: ${selectedStudent.university_id || "غير متوفر"}
          </p>
        </div>
    `;

const sortedLevels = sortByLevelOrder(byLevel);

sortedLevels.forEach(([level, termsObj]) => {
  content += `
    <h2 style="color: #0a3753; font-size: 21px; margin: 40px 0 18px 0; border-bottom: 2px solid #0f766e; padding-bottom: 8px; font-weight: 800;">
      ${level}
    </h2>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
  `;

  const orderedTerms = Object.values(termsObj).sort((a, b) => {
    const aIsFirst = a.term_name.includes("الأول") || a.term_name.includes("اول");
    const bIsFirst = b.term_name.includes("الأول") || b.term_name.includes("اول");
    if (aIsFirst && !bIsFirst) return -1;
    if (!aIsFirst && bIsFirst) return 1;
    return 0;
  });

  orderedTerms.forEach(term => {
    content += `
      <div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; background: #fdfdfd; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        <h3 style="margin: 0 0 14px 0; color: #0f766e; font-size: 17px; font-weight: 700; text-align: center;">
          ${term.academic_year} – ${term.term_name}
        </h3>

        <div style="display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 14px; font-weight: 600; color: #374151;">
          <div>المعدل الفصلي: <span style="color:#111827;">${term.term_gpa}</span></div>
          <div>المعدل التراكمي: <span style="color:#111827;">${term.cumulative_gpa}</span></div>
        </div>

        <table style="width:100%; border-collapse: collapse; font-size: 13px; line-height: 1.4;">
          <thead>
            <tr style="background: #f3f4f6; color: #374151; font-weight: 600;">
              <th style="padding: 8px 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">المادة</th>
              <th style="padding: 8px 6px; border-bottom: 2px solid #cbd5e1; width: 75px; text-align: center;">التقدير</th>
              <th style="padding: 8px 6px; border-bottom: 2px solid #cbd5e1; width: 80px; text-align: center;">الساعات</th>
            </tr>
          </thead>
          <tbody>
    `;

    term.courses.forEach((c, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
      content += `
        <tr style="background:${bg};">
          <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${c.name}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 700;">${c.letter || "—"}</td>
          <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; text-align: center;">${c.hours || "—"}</td>
        </tr>
      `;
    });

    content += `
          </tbody>
        </table>
      </div>
    `;
  });

  content += `</div>`;
});

    content += `</div>`;

    const element = document.createElement("div");
    element.innerHTML = content;

    html2pdf()
      .set({
        margin: [18, 14, 18, 14],
        filename: `سجل_اكاديمي_${selectedStudent.university_id || "طالب"}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css"] },
      })
      .from(element)
      .save();
  };

  return (
    <div style={ui.page}>
      <header className="library-header">
        <div className="library-header-title">
          <span style={{ fontSize: 22, fontWeight: 800 }}>السجل الأكاديمي</span>
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

      <main style={{ padding: "24px 16px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={ui.card}>
          <h2 style={ui.sectionTitle}>البحث عن الطالب</h2>

          <div style={ui.field}>
            <input
              type="text"
              style={ui.input}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="اكتب الاسم أو الرقم الجامعي..."
              autoComplete="off"
            />

            {showSuggestions && suggestions.length > 0 && (
              <div style={ui.suggestions}>
                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    style={ui.suggestionItem}
                    onClick={() => handleSelectStudent(s)}
                  >
                    <strong>{s.full_name}</strong>
                    <span style={{ color: "#64748b", marginRight: 12, fontSize: 14 }}>
                      — {s.university_id || "بدون رقم جامعي"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {showSuggestions && suggestions.length === 0 && searchQuery.trim().length >= 2 && !loading && (
              <div style={{ ...ui.suggestions, padding: "16px", color: "#64748b", textAlign: "center" }}>
                لا يوجد نتائج مطابقة
              </div>
            )}
          </div>
        </div>

        {selectedStudent && (
          <div ref={printRef} style={ui.card}>
            <h2 style={ui.sectionTitle}>
              السجل الأكاديمي — {selectedStudent.full_name}
            </h2>

            <div style={{ marginBottom: 24 }}>
              <strong>الرقم الجامعي:</strong> {selectedStudent.university_id || "—"}
            </div>

            {latestReg && (
              <div style={{ margin: "24px 0", padding: 16, background: "#f8fafc", borderRadius: 10 }}>
                <h3 style={{ margin: "0 0 12px 0", color: "#0a3753" }}>آخر تسجيل</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                  <div><strong>السنة:</strong> {latestReg.academic_year}</div>
                  <div><strong>المستوى:</strong> {latestReg.level_name}</div>
                  <div><strong>الفصل:</strong> {latestReg.term_name}</div>
                  <div><strong>الموقف الأكاديمي:</strong> {latestReg.academic_status || "—"}</div>
                </div>
              </div>
            )}

            {grades.length > 0 ? (
              <>
                <h3 style={{ margin: "32px 0 16px 0", color: "#0a3753" }}>
                  نتائج الطالب
                </h3>

                <div style={ui.tableWrap}>
                  <table style={ui.table}>
                    <thead>
                      <tr>
                        <th>المستوى</th>
                        <th>الفصل الأول</th>
                        <th>الفصل الثاني</th>
                      </tr>
                    </thead>
                    <tbody>
{sortByLevelOrder(groupedTermGpas).map(([level, termsObj]) => {
  const terms = Object.values(termsObj);
  const firstTerm = terms.find(t => t.term_name.includes("الأول") || t.term_name.includes("اول")) || terms[0];
  const secondTerm = terms.find(t => t.term_name.includes("الثاني") || t.term_name.includes("ثاني")) || terms[1];

  return (
    <tr key={level}>
      <td style={{ fontWeight: "bold", verticalAlign: "middle" }}>{level}</td>
      <td>
        {firstTerm ? (
          <div style={ui.gpaBox}>
            <div>الفصلي: {firstTerm.term_gpa}</div>
            <div>التراكمي: {firstTerm.cumulative_gpa}</div>
          </div>
        ) : "لا توجد بيانات"}
      </td>
      <td>
        {secondTerm ? (
          <div style={ui.gpaBox}>
            <div>الفصلي: {secondTerm.term_gpa}</div>
            <div>التراكمي: {secondTerm.cumulative_gpa}</div>
          </div>
        ) : "لا توجد بيانات"}
      </td>
    </tr>
  );
})}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p style={{ textAlign: "center", color: "#64748b", padding: "40px 0" }}>
                لا توجد درجات مسجلة بعد
              </p>
            )}

            <div style={{ textAlign: "center", marginTop: 40 }}>
              <button 
                style={ui.primaryBtn} 
                onClick={handlePrint}
                disabled={grades.length === 0}
              >
                طباعة السجل الأكاديمي
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
            جاري التحميل...
          </div>
        )}
      </main>
    </div>
  );
};

export default AcademicRecord;