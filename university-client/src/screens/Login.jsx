import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoArrowBack } from "react-icons/io5";

const API_BASE = "http://localhost:5000"; 

const ui = {
  page: {
    fontFamily: `"Cairo", "Tajawal", system-ui, -apple-system, "Segoe UI", Arial, sans-serif`,
    fontSize: 16,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },

  header: {
    background: '#0a3753',
    color: '#fff',
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  title: {
    fontSize: 24,
    fontWeight: 800,
    margin: 0,
  },

  card: {
    border: "1px solid #e6e8ee",
    background: "#fff",
    padding: "2rem",
    borderRadius: 12,
    boxShadow: "0 4px 20px rgba(10,55,83,0.1)",
    width: '90%',
    maxWidth: 700,
    margin: '3rem auto',
  },

  field: {
    marginBottom: '1.5rem',
  },

  label: {
    display: 'block',
    fontSize: 14,
    fontWeight: 800,
    color: "#334155",
    marginBottom: '0.5rem',
  },

  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #d9dee8",
    outline: "none",
    fontSize: 16,
    fontFamily: `"Cairo", "Tajawal", Arial, sans-serif`,
    transition: 'border-color 0.2s',
  },

  primaryBtn: {
    width: '100%',
    padding: "14px",
    background: "#0a3753",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 17,
    fontFamily: `"Cairo", "Tajawal", Arial, sans-serif`,
    marginTop: '1rem',
  },

  toast: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '12px 24px',
    borderRadius: 8,
    color: '#fff',
    fontWeight: 700,
    zIndex: 1000,
  },
};

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

useEffect(() => {
  const token = sessionStorage.getItem('token');
  if (token) {
    navigate('/dashboard');
  }
}, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      showToast('اسم المستخدم وكلمة المرور مطلوبين', 'error');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'فشل تسجيل الدخول');
      }

      // حفظ التوكن واليوزر
sessionStorage.setItem('token', data.token);
sessionStorage.setItem('user', JSON.stringify({
  id: data.id,
  username: data.username,
  full_name: data.full_name || '',
  email: data.email || '',
  role: data.role,
  allowed_pages: data.allowed_pages || [],
  allowed_faculties: data.allowed_faculties || []
  
}));

      // showToast('تم تسجيل الدخول بنجاح', 'success');

      setTimeout(() => navigate('/dashboard'), 800);

    } catch (err) {
      console.error('Login error:', err);
      showToast(err.message || 'حدث خطأ أثناء تسجيل الدخول', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={ui.page}>
      <header style={ui.header}>
        <h1 style={ui.title}>جامعة بورتسودان الأهلية</h1>
        {/* <button onClick={() => navigate(-1)} style={{ ... }}> <IoArrowBack /> </button> */}
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div style={ui.card}>
          <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: '#0a3753', fontWeight: 800 }}>
            تسجيل الدخول
          </h2>

          <form onSubmit={handleLogin}>
            <div style={ui.field}>
              <label style={ui.label}>اسم المستخدم</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                style={ui.input}
                disabled={loading}
                autoFocus
              />
            </div>

            <div style={ui.field}>
              <label style={ui.label}>كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                style={ui.input}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              style={ui.primaryBtn}
              disabled={loading}
            >
              {loading ? 'جاري الدخول...' : 'دخول'}
            </button>
          </form>

          {/* رابط التسجيل – اختاري إذا عايزاه يظهر أو لا */}
          {/* <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '15px', color: '#334155' }}>
            ليس لديك حساب؟{' '}
            <button
              onClick={() => navigate('/register')}
              style={{ background: 'none', border: 'none', color: '#0a3753', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline', fontSize: '15px', padding: 0 }}
            >
              إنشاء حساب جديد
            </button>
          </div> */}

        </div>
      </div>

      {toast && (
        <div
          style={{
            ...ui.toast,
            background: toast.type === 'error' ? '#dc2626' : '#059669',
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}