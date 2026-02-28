import React, { useState } from 'react';
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
    marginTop: '1rem',
  },

  linkText: {
    textAlign: 'center',
    marginTop: '1.5rem',
    color: '#334155',
  },

  link: {
    color: '#0a3753',
    fontWeight: 700,
    textDecoration: 'none',
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

export default function Register() {
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!form.username.trim() || !form.password.trim()) {
      showToast('اسم المستخدم وكلمة المرور مطلوبين', 'error');
      return;
    }

    if (form.password.length < 6) {
      showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/register`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'فشل التسجيل');
      }

      showToast(data.message || 'تم إنشاء الحساب بنجاح!', 'success');
      setTimeout(() => navigate('/login'), 1500); 

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={ui.page}>
      <header style={ui.header}>
        <h1 style={ui.title}>جامعة بورتسودان الأهلية</h1>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '32px',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          <IoArrowBack />
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div style={ui.card}>
          <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: '#0a3753', fontWeight: 800 }}>
            إنشاء حساب جديد
          </h2>

          <form onSubmit={handleRegister}>
            <div style={ui.field}>
              <label style={ui.label}>اسم المستخدم</label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="أدخل اسم المستخدم"
                style={ui.input}
                disabled={loading}
              />
            </div>

            <div style={ui.field}>
              <label style={ui.label}>كلمة المرور</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="أدخل كلمة المرور (6 أحرف على الأقل)"
                style={ui.input}
                disabled={loading}
              />
            </div>

            <div style={ui.field}>
              <label style={ui.label}>الاسم الكامل</label>
              <input
                type="text"
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                placeholder="الاسم الكامل (اختياري)"
                style={ui.input}
                disabled={loading}
              />
            </div>

            <div style={ui.field}>
              <label style={ui.label}>البريد الإلكتروني</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="الإيميل (اختياري)"
                style={ui.input}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              style={ui.primaryBtn}
              disabled={loading}
            >
              {loading ? 'جاري التسجيل...' : 'إنشاء الحساب'}
            </button>
          </form>

          <div style={ui.linkText}>
            لديك حساب بالفعل؟{' '}
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'none',
                border: 'none',
                color: '#0a3753',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'none',
                padding: 0,
              }}
            >
              تسجيل الدخول
            </button>
          </div>
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