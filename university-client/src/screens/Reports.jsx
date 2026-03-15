import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";
import html2pdf from 'html2pdf.js';

const API_BASE = "http://localhost:5000/api";

const ui = {
  page: { fontFamily: `"Cairo", "Tajawal", system-ui, -apple-system, "Segoe UI", Arial, sans-serif`, fontSize: 16, background: "#f8fafc", minHeight: "100vh" },
  header: { background: "#0a3753", color: "#fff", padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" },
  title: { fontSize: 24, fontWeight: 800, margin: 0 },
  card: { border: "1px solid #e6e8ee", background: "#fff", padding: 20, borderRadius: 12, marginBottom: 24, boxShadow: "0 4px 16px rgba(10,55,83,0.06)" },
  sectionTitle: { marginTop: 0, fontSize: 18, fontWeight: 800, color: "#0a3753", marginBottom: 16 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 14, fontWeight: 800, color: "#334155" },
  input: { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #d9dee8", outline: "none", fontSize: 16, fontFamily: `"Cairo", "Tajawal", Arial, sans-serif`, background: "#fff" },
  select: { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #d9dee8", outline: "none", fontSize: 16, fontFamily: `"Cairo", "Tajawal", Arial, sans-serif`, background: "#fff", cursor: "pointer" },
  primaryBtn: { padding: "14px 24px", background: "#0a3753", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: 16, transition: "all 0.2s" },
  secondaryBtn: { padding: "14px 24px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: 16, transition: "all 0.2s" },
  radioLabel: { display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "#334155", cursor: "pointer", padding: "8px 12px", borderRadius: 8, transition: "background 0.2s" },
};

const Report = () => {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  // State
  const [scope, setScope] = useState("all");
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [yearOptions, setYearOptions] = useState([]);
  const [levelOptions, setLevelOptions] = useState([]);

  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentSuggestions, setStudentSuggestions] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [academicYear, setAcademicYear] = useState("");
  const [levelName, setLevelName] = useState("");

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingPeriods, setLoadingPeriods] = useState(false);

  // Load Data
  useEffect(() => {
    fetch(`${API_BASE}/faculties-list`).then(r => r.json()).then(setFaculties).catch(() => showToast("خطأ في الكليات", "error"));
  }, []);

  useEffect(() => {
    if (!selectedFacultyId) { setDepartments([]); return; }
    fetch(`${API_BASE}/departments/${selectedFacultyId}`).then(r => r.json()).then(setDepartments).catch(() => showToast("خطأ في الأقسام", "error"));
  }, [selectedFacultyId]);

  useEffect(() => {
    setLoadingPeriods(true);
    fetch(`${API_BASE}/academic-periods?program_type=bachelor`)
      .then(r => r.json())
      .then(data => {
        setYearOptions([...new Set(data.map(p => p.academic_year))].sort().reverse());
        setLevelOptions([...new Set(data.map(p => p.level_name))].sort());
      })
      .finally(() => setLoadingPeriods(false));
  }, []);

  //  search
  useEffect(() => {
    if (scope !== "student" || studentSearch.trim().length < 2) {
      setStudentSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/students/search?q=${encodeURIComponent(studentSearch.trim())}`)
        .then(r => r.json())
        .then(data => setStudentSuggestions(data || []));
    }, 500);
    return () => clearTimeout(timer);
  }, [studentSearch, scope]);

  useEffect(() => {
  setSelectedFacultyId("");
  setSelectedDepartmentId("");
  setStudentSearch("");
  setStudentSuggestions([]);
  setSelectedStudent(null);
  setAcademicYear("");
  setLevelName("");
  setReportData(null);   
}, [scope]);

  // Fetch Report
  const fetchReport = async () => {
    if (!academicYear || !levelName) return showToast("اختر السنة والمستوى", "error");
    if (scope === "student" && !selectedStudent) return showToast("اختر طالب", "error");

    setLoading(true);
    const params = new URLSearchParams({
      scope,
      faculty_id: selectedFacultyId || "",
      department_id: selectedDepartmentId || "",
      student_id: selectedStudent?.id || "",
      academic_year: academicYear,
      level_name: levelName,
    });

    try {
      const res = await fetch(`${API_BASE}/fees-report?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل");
      setReportData(data);
      // showToast("تم جلب التقرير بنجاح", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Print PDF 
const printReport = () => {
  if (!reportData) {
    showToast("ما فيش بيانات للطباعة بعد", "error");
    return;
  }

  const universityName = "جامعة بورتسودان الأهلية";

  const facultyName =
    scope !== "all" && selectedFacultyId
      ? faculties.find(f => f.id === Number(selectedFacultyId))?.faculty_name || "غير محدد"
      : "";

  const departmentName =
    (scope === "department" || scope === "student") && selectedDepartmentId
      ? departments.find(d => d.id === Number(selectedDepartmentId))?.department_name || "غير محدد"
      : "";

  const studentName =
    scope === "student" && selectedStudent
      ? `${selectedStudent.university_id} - ${selectedStudent.full_name}`
      : "";

  let subtitle = "";
  if (scope === "all")        subtitle = "تقرير رسوم – كل الجامعة";
  else if (scope === "faculty")  subtitle = `تقرير رسوم – ${facultyName}`;
  else if (scope === "department") subtitle = `تقرير رسوم – ${departmentName}`;
  else if (scope === "student")  subtitle = `تقرير رسوم الطالب – ${studentName}`;

  const commonHeader = `
    <div style="text-align: center; margin-bottom: 35px; padding-bottom: 20px; border-bottom: 2px solid #0a3753;">
      <h1 style="margin: 0; color: #0a3753; font-size: 26px; font-weight: 900;">
        ${universityName}
      </h1>
      
      ${facultyName ? `
        <p style="margin: 12px 0 6px; font-size: 18px; font-weight: bold;">
          ${facultyName}
        </p>
      ` : ''}

      ${departmentName ? `
        <p style="margin: 6px 0; font-size: 16px; font-weight: bold; color: #334155;">
          القسم: ${departmentName}
        </p>
      ` : ''}

      ${studentName ? `
        <p style="margin: 8px 0; font-size: 17px; font-weight: 700; color: #0f766e;">
          ${studentName}
        </p>
      ` : ''}

      <p style="margin: 14px 0 4px; font-size: 15px; color: #444;">
        السنة الدراسية: <strong>${academicYear}</strong> 
        ${levelName ? ` | <strong>${levelName}</strong>` : ''}
      </p>

      <p style="margin: 6px 0; font-size: 13px; color: #666;">
        تاريخ الطباعة: ${new Date().toLocaleString('EG')}
      </p>
    </div>
  `;

  let content = `
    <div style="direction: rtl; font-family: 'Cairo', 'Tajawal', sans-serif; padding: 40px 25px; font-size: 14px; line-height: 1.5;">
      ${commonHeader}
      <h2 style="color: #0a3753; text-align: center; margin: 30px 0 25px; font-size: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">
        ${subtitle}
      </h2>
  `;

if (reportData.groups && reportData.groups.length > 0) {
  content += `
    <table style="width: 100%; border-collapse: collapse; margin: 25px 0 35px;">
      <thead>
        <tr style="background: #e0f2fe; color: #0a3753;">
          <th style="padding: 14px; border: 1px solid #bfdbfe; font-size: 14px; font-weight: 700; text-align: right;">
            الاسم
          </th>
          <th style="padding: 14px; border: 1px solid #bfdbfe; font-size: 14px; font-weight: 700; text-align: center;">
            المستحق
          </th>
          <th style="padding: 14px; border: 1px solid #bfdbfe; font-size: 14px; font-weight: 700; text-align: center;">
            المتحصل
          </th>
          <th style="padding: 14px; border: 1px solid #bfdbfe; font-size: 14px; font-weight: 700; text-align: center;">
            المتبقي
          </th>
          <th style="padding: 14px; border: 1px solid #bfdbfe; font-size: 14px; font-weight: 700; text-align: center;">
            نسبة التحصيل
          </th>
        </tr>
      </thead>
      <tbody>
        ${reportData.groups.map((g, i) => `
          <tr style="background: ${i % 2 === 0 ? '#f8fafc' : '#ffffff'};">
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: 600; text-align: right;">
              ${g.name}
            </td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">
              ${Number(g.total_due || 0).toLocaleString()} 
            </td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">
              ${Number(g.total_paid || 0).toLocaleString()} 
            </td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">
              ${Number(g.total_unpaid || 0).toLocaleString()}
            </td>
            <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">
              ${g.percentage}%
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

if (reportData.grand_total) {
  const gt = reportData.grand_total;

  content += `
    <div style="
      padding: 24px 20px;
      margin: 32px 0;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 3px 10px rgba(0,0,0,0.05);
      text-align: center;
    ">
      <div style="
        font-size: 19px;
        font-weight: 800;
        color: #0a3753;
        margin-bottom: 18px;
      ">
        الإجمالي الكلي لـ ${scope === "all" ? "الجامعة" : scope === "faculty" ? "الكلية" : scope === "department" ? "القسم" : "الطالب"}
      </div>
      
      <div style="
        display: flex;
        justify-content: center;
        gap: 40px;
        flex-wrap: wrap;
        font-size: 15px;
        color: #334155;
      ">
        <div>
          المستحق: 
          <strong style="color: #0a3753; font-size: 17px; font-weight: 700;">
            ${Number(gt.total_due || 0).toLocaleString()} 
          </strong>
        </div>
        
        <div>
          المتحصل: 
          <strong style="color: #0a3753; font-size: 17px; font-weight: 700;">
            ${Number(gt.total_paid || 0).toLocaleString()}
          </strong>
        </div>
        
        <div>
          المتبقي: 
          <strong style="color: ${Number(gt.total_unpaid || 0) > 0 ? '#0a3753' : '#0a3753'}; font-size: 17px; font-weight: 700;">
            ${Number(gt.total_unpaid || 0).toLocaleString()}
          </strong>
        </div>
        
        <div>
          نسبة التحصيل: 
          <strong style="color: #0a3753; font-size: 18px; font-weight: 800;">
            ${gt.percentage || 0}%
          </strong>
        </div>
      </div>
    </div>
  `;
}

  if (reportData.student_details && reportData.student_details.length > 0) {
    content += `
      <h3 style="color: #0a3753; margin: 40px 0 20px; font-size: 18px; text-align: center;">
        تفاصيل الأقساط
      </h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #e0f2fe;">
            <th style="padding: 12px; border: 1px solid #bfdbfe;">القسط</th>
            <th style="padding: 12px; border: 1px solid #bfdbfe;">المبلغ</th>
            <th style="padding: 12px; border: 1px solid #bfdbfe;">الحالة</th>
            <th style="padding: 12px; border: 1px solid #bfdbfe;">تاريخ الدفع</th>
          </tr>
        </thead>
        <tbody>
          ${reportData.student_details.map(d => `
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${d.installment_no}</td>
              <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${Number(d.amount||0).toLocaleString()}</td>
              <td style="padding: 12px; border: 1px solid #ddd; text-align: center; color: ${d.paid === 1 ? '#16a34a' : '#dc2626'}; font-weight: bold;">
                ${d.paid === 1 ? "مدفوع" : "غير مدفوع"}
              </td>
              <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${d.paid_at ? new Date(d.paid_at).toLocaleDateString('EG') : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  content += `</div>`;

  const element = document.createElement("div");
  element.innerHTML = content;

  html2pdf()
    .from(element)
    .set({
      margin: 12,
      filename: `تقرير_رسوم_${scope}_${academicYear.replace("/", "-")}_${new Date().toISOString().slice(0,10)}.pdf`,
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css'] }
    })
    .save();

  showToast("جاري تحميل ملف الـ PDF...", "success");
};

  return (
    <div dir="rtl" style={ui.page}>
      <header style={ui.header}>
        <h1 style={ui.title}>تقارير الرسوم </h1>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", fontSize: 36, color: "white", cursor: "pointer" }}>
          <IoArrowBack />
        </button>
      </header>

      <main style={{ maxWidth: 1300, margin: "0 auto", padding: "32px 16px" }}>
        <div style={ui.card}>
          <h3 style={ui.sectionTitle}>اختر نطاق التقرير</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {[{ value: "all", label: "كل الجامعة" }, { value: "faculty", label: "كلية محددة" }, { value: "department", label: "قسم محدد" }, { value: "student", label: "طالب محدد" }].map(item => (
              <label key={item.value} style={{ ...ui.radioLabel, background: scope === item.value ? "#e0f2fe" : "transparent" }}>
                <input type="radio" name="scope" value={item.value} checked={scope === item.value} onChange={e => setScope(e.target.value)} />
                {item.label}
              </label>
            ))}
          </div>
        </div>

        <div style={ui.card}>
          <div style={ui.grid}>
            {scope !== "all" && (
              <div style={ui.field}>
                <label style={ui.label}>الكلية</label>
                <select value={selectedFacultyId} onChange={e => { setSelectedFacultyId(e.target.value); setSelectedDepartmentId(""); }} style={ui.select}>
                  <option value="">— اختر الكلية —</option>
                  {faculties.map(f => <option key={f.id} value={f.id}>{f.faculty_name}</option>)}
                </select>
              </div>
            )}

            {(scope === "department" || scope === "student") && selectedFacultyId && (
              <div style={ui.field}>
                <label style={ui.label}>القسم</label>
                <select value={selectedDepartmentId} onChange={e => setSelectedDepartmentId(e.target.value)} disabled={!selectedFacultyId} style={ui.select}>
                  <option value="">— اختر القسم —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
                </select>
              </div>
            )}

            {scope === "student" && (
              <div style={ui.field}>
                <label style={ui.label}>بحث عن الطالب</label>
                <input type="text" placeholder="اكتب الاسم أو الرقم الجامعي..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} style={ui.input} />
                {studentSuggestions.length > 0 && (
                  <div style={{ marginTop: 6, maxHeight: 240, overflowY: "auto", border: "1px solid #d1d5db", borderRadius: 10, background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                    {studentSuggestions.map(s => (
                      <div key={s.id} onClick={() => { setSelectedStudent(s); setStudentSearch(`${s.university_id} — ${s.full_name}`); setStudentSuggestions([]); }} style={{ padding: "10px 16px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", background: selectedStudent?.id === s.id ? "#e0f2fe" : "transparent" }}>
                        {s.university_id} — {s.full_name}
                      </div>
                    ))}
                  </div>
                )}
                {selectedStudent && <div style={{ marginTop: 10, color: "#16a34a", fontWeight: 700 }}>الطالب: {selectedStudent.university_id} — {selectedStudent.full_name}</div>}
              </div>
            )}

            <div style={ui.field}>
              <label style={ui.label}>السنة الدراسية</label>
              <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} disabled={loadingPeriods} style={ui.select}>
                <option value="">— اختر السنة —</option>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div style={ui.field}>
              <label style={ui.label}>المستوى</label>
              <select value={levelName} onChange={e => setLevelName(e.target.value)} disabled={loadingPeriods} style={ui.select}>
                <option value="">— اختر المستوى —</option>
                {levelOptions.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <button onClick={fetchReport} disabled={loading || loadingPeriods} style={{ ...ui.primaryBtn, marginTop: 28, width: "100%", fontSize: 17, padding: "16px" }}>
            {loading ? "جاري جلب التقرير..." : "عرض تقرير الرسوم"}
          </button>
        </div>

        {reportData && (
          <div style={ui.card}>
            <h3 style={ui.sectionTitle}>
              {scope === "all" ? "كل الجامعة" : scope === "faculty" ? "الكلية" : scope === "department" ? "القسم" : "الطالب"}
            </h3>

            {reportData.groups && reportData.groups.length > 0 && (
              <div style={{ overflowX: "auto", marginBottom: 30 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#e0f2fe", color: "#0a3753" }}>
                      <th style={{ padding: "12px" }}>الاسم</th>
                      <th style={{ padding: "12px" }}>المستحق</th>
                      <th style={{ padding: "12px" }}>المتحصل</th>
                      <th style={{ padding: "12px" }}>المتبقي</th>
                      <th style={{ padding: "12px" }}>النسبة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.groups.map((g, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                        <td style={{ padding: "12px", fontWeight: 700 }}>{g.name}</td>
                        <td style={{ padding: "12px" }}>{Number(g.total_due).toLocaleString()}</td>
                        <td style={{ padding: "12px" }}>{Number(g.total_paid).toLocaleString()}</td>
                        <td style={{ padding: "12px" }}>{Number(g.total_unpaid).toLocaleString()}</td>
                        <td style={{ padding: "12px", fontWeight: 700 }}>{g.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

{reportData.grand_total && (
  <div style={{
    padding: "28px 20px",
    margin: "32px 0",
    background: "#f8fafc",
    borderRadius: 16,
    border: "2px solid #e2e8f0",
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
    textAlign: "center"
  }}>
    <div style={{fontSize: 26, fontWeight: 900, color: "#0a3753", marginBottom: 16}}>
      الإجمالي الكلي لـ {scope === "all" ? "الجامعة" : scope === "faculty" ? "الكلية" : scope === "department" ? "القسم" : "الطالب"}
    </div>
    
    <div style={{display: "flex", justifyContent: "center", gap: "60px", flexWrap: "wrap", fontSize: 20}}>
      <div>المستحق: <strong>{Number(reportData.grand_total.total_due).toLocaleString()}</strong></div>
      <div>المتحصل: <strong style={{color: "#16a34a"}}>{Number(reportData.grand_total.total_paid).toLocaleString()}</strong></div>
      <div>المتبقي: <strong style={{color: reportData.grand_total.total_unpaid > 0 ? "#dc2626" : "#16a34a"}}>{Number(reportData.grand_total.total_unpaid).toLocaleString()}</strong></div>
      <div>نسبة التحصيل: <strong>{reportData.grand_total.percentage}%</strong></div>
    </div>
  </div>
)}

            {reportData.student_details && (
              <div style={{ marginTop: 30 }}>
                <h4 style={{ color: "#0a3753" }}>تفاصيل الأقساط</h4>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: "#f1f5f9" }}><th>القسط</th><th>القيمة</th><th>الحالة</th><th>تاريخ الدفع</th></tr></thead>
                  <tbody>
                    {reportData.student_details.map((d, i) => (
                      <tr key={i}>
                        <td>القسط {d.installment_no}</td>
                        <td>{Number(d.amount).toLocaleString()}</td>
                        <td style={{ color: d.paid === 1 ? "#16a34a" : "#dc2626" }}>{d.paid === 1 ? "مدفوع" : "غير مدفوع"}</td>
                        <td>{d.paid_at ? new Date(d.paid_at).toLocaleDateString("EG") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

<button
  onClick={printReport}
  style={{
    ...ui.secondaryBtn,
    display: "block",
    width: "auto",
    minWidth: "220px",
    maxWidth: "320px",
    margin: "30px auto 0",
    padding: "12px 32px",
    textAlign: "center",
  }}
>
  طباعة التقرير (PDF)
</button>
          </div>
        )}
      </main>

      {toast && (
        <div className={`toast ${toast.type === "error" ? "toast-error" : "toast-success"}`} style={{ position: "fixed", bottom: 24, right: 24, padding: "14px 24px", borderRadius: 10, color: "white", fontWeight: 800, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", zIndex: 9999 }}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default Report;