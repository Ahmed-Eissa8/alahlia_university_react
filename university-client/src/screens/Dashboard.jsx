import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoDocumentText, IoLogOut } from "react-icons/io5"; 

import {
  FaUsers,
  FaUniversity,
  FaBookOpen,
  FaClipboardCheck,
  FaCalculator,
  FaChalkboardTeacher,
  FaChartPie,
  FaUserCog,
  FaCalendarAlt,
  FaGraduationCap ,
 FaClipboardList,      
} from "react-icons/fa";


import "./Dashboard.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000/api";

const portalLinks = [
  { title: "المكتبة", icon: <FaBookOpen />, path: "/books", tone: "purple" },
  { title: "القبول والتسجيل", icon: <IoDocumentText />, path: "/RegistrationTabs", tone: "teal" },
  { title: "إعدادات النظام الأكاديمي", icon: <FaUniversity />, path: "/faculty", tone: "slate" },
  { title: "إدخال الدرجات", icon: <FaClipboardCheck />, path: "/GradeEntry", tone: "indigo" },
  { title: "حساب النتائج", icon: <FaCalculator />, path: "/TermResult", tone: "amber" },
  { title: "قوائم الطلاب", icon: <FaUsers />, path: "/StudentsTermList", tone: "blue" },
  { title: "أعضاء هيئة التدريس", icon: <FaChalkboardTeacher />, path: "/StaffMembers", tone: "green" },
  { title: "الجداول الدراسية", icon: <FaCalendarAlt />, path: "/schedule", tone: "cyan" },
  { title: " الشهادات", icon: <FaGraduationCap  />, path: "/certificates", tone: "pink" },
  { title: "السجل الأكاديمي", icon: <FaClipboardList />, path: "/academic-record", tone: "red" },
  { title: "التقارير", icon: <FaChartPie />, path: "/reports", tone: "orange" },
  { title: "المستخدمين والصلاحيات", icon: <FaUserCog />, path: "/UsersManagement", tone: "gray" },
];

function StatCard({ label, value, icon }) {
  return (
    <div className="dash-stat">
      <div className="dash-stat-icon">{icon}</div>
      <div className="dash-stat-body">
        <div className="dash-stat-value">{value ?? "—"}</div>
        <div className="dash-stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

useEffect(() => {
  const token = sessionStorage.getItem("token");
  if (!token) {
    navigate("/login", { replace: true });
  }
}, [navigate]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/dashboard/summary`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل تحميل ملخص لوحة التحكم");
      setSummary(data);
    } catch (e) {
      console.error(e);
      setSummary(null);
      showToast(e.message || "مشكلة في تحميل الملخص", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const stats = useMemo(
    () => [
      { label: "الطلاب", value: summary?.students, icon: <FaUsers /> },
      { label: "الذكور", value: summary?.male_count, icon: <FaUsers /> },
      { label: "الإناث", value: summary?.female_count, icon: <FaUsers /> },
      { label: "التسجيلات", value: summary?.registrations, icon: <FaUniversity /> },
      { label: "المواد", value: summary?.courses, icon: <FaClipboardCheck /> },
      { label: "نتائج الفصول", value: summary?.term_results, icon: <FaCalculator /> },
      { label: "الكتب", value: summary?.books, icon: <FaBookOpen /> },
      { label: "أعضاء هيئة التدريس", value: summary?.staff_members, icon: <FaChalkboardTeacher /> },
      { label: "الكليات", value: summary?.faculties, icon: <FaUniversity /> },
      { label: "الأقسام", value: summary?.departments, icon: <FaUniversity /> },
    ],
    [summary]
  );

  // فلترة الروابط بناءً على الصلاحيات
// const user = JSON.parse(sessionStorage.getItem('user') || '{}');
// const allowedPages = user.allowed_pages || [];

//   const visibleLinks = portalLinks.filter(link => 
//     allowedPages.includes(link.title) || user.role === 'admin'
//   );


  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
const allowedPages = Array.isArray(user.allowed_pages) ? user.allowed_pages : [];

const visibleLinks = portalLinks.filter(link => 
  user.role === 'admin' || 
  allowedPages.includes(link.title.trim()) 
);


const handleLogout = () => {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  // showToast('تم تسجيل الخروج بنجاح', 'success'); 
  setTimeout(() => {
    navigate('/login');
  }, 800);
};

  return (
    <div className="admission-layout">
      <header className="library-header">
        <div className="library-header-title">
          <h1 style={{ margin: 0, color: "#ffffffff", fontWeight: 1000 }}>
            جامعة بورتسودان الأهلية
          </h1>
        </div>

        {/* زر تسجيل الخروج */}
<button
  onClick={handleLogout}
  style={{
    background: 'rgba(255, 255, 255, 0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '10px',
    padding: '10px 16px',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '16px',
    transition: 'all 0.3s ease',  
  }}
  onMouseEnter={(e) => {
    e.target.style.background = 'rgba(255, 255, 255, 0.3)';
    e.target.style.borderColor = 'rgba(255,255,255,0.5)';
    e.target.style.transform = 'scale(1.05)';  
  }}
  onMouseLeave={(e) => {
    e.target.style.background = 'rgba(255, 255, 255, 0.15)';
    e.target.style.borderColor = 'rgba(255,255,255,0.3)';
    e.target.style.transform = 'scale(1)';  
  }}
>
  <IoLogOut size={20} />
  تسجيل الخروج
</button>

      </header>

      <main className="library-main">
        <div className="library-container">
          <div style={{ marginBottom: 12 }}>
          </div>

          <div className="dash-hero">
            <div className="dash-hero-row">
                  <div className="dash-hero-title">
      <span style={{ fontSize: 20, fontWeight: 1000 }}>
        مرحباً، {user.full_name || user.username}
      </span>
    </div>
               <div className="dash-hero-subtitle" style={{ marginTop: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 1000 }}>نظرة عامة على النظام</span>
              </div>

              <div className="dash-hero-badges">
                <span className="dash-badge">الكل: {summary?.students ?? "—"} طلاب</span>
                <span className="dash-badge">كتب: {summary?.books ?? "—"}</span>
                <span className="dash-badge">
                  آخر تحديث:{" "}
                  {summary?.updated_at ? new Date(summary.updated_at).toLocaleString("ar") : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="dash-top">
            <div>
              <h2 className="dash-title">ملخص سريع</h2>
              <div className="dash-subtitle">يعرض أعداد السجلات الأساسية </div>
            </div>

            <button className="btn btn-primary" onClick={loadSummary} disabled={loading}>
              {loading ? "جارٍ التحديث..." : "تحديث البيانات"}
            </button>
          </div>

          <div className="dash-stats-grid">
            {stats.map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} />
            ))}
          </div>

                   <div className="card" style={{ marginTop: 14 }}>
            <h2 className="card-title">أنظمة الكلية</h2>
            <div className="dash-subtitle" style={{ marginBottom: 10 }}>
            </div>

            <div className="dash-links-grid">
              {visibleLinks.map((x) => (
                <div
                  key={x.title}
                  className={`dash-link dash-link--${x.tone}`}
                  onClick={() => navigate(x.path)}
                  role="button"
                >
                  <div className="dash-link-icon">{x.icon}</div>
                  <div className="dash-link-title">{x.title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}