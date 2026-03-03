import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";

const API_BASE = "http://localhost:5000/api";

const allPortalTitles = [
  "المكتبة",
  "القبول والتسجيل",
  "إعدادات النظام الأكاديمي",
  "إدخال الدرجات",
  "حساب النتائج",
  "قوائم الطلاب",
  "أعضاء هيئة التدريس",
  "الجداول الدراسية",
  "الشهادات",
  "المستخدمين والصلاحيات",
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
  background: "#0a3753",
  color: "#fff",
},

secondaryBtn: {
  background: "#0f766e",
  color: "#fff",
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

  btnRow: {
  display: "flex",
  gap: 10,
  marginTop: 16,
  flexWrap: "wrap",
},

btnBase: {
  padding: "10px 18px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 15,
  border: "none",
  fontFamily: `"Cairo", "Tajawal", Arial, sans-serif`,
},
btnHover: {
  filter: "brightness(1.08)",
  transform: "translateY(-1px)",
},

btnActive: {
  transform: "translateY(0)",
  filter: "brightness(0.95)",
},


dangerBtn: {
  background: "#dc2626",
  color: "#fff",
},

ghostBtn: {
  background: "#f1f5f9",
  color: "#0a3753",
  border: "1px solid #cbd5e1",
},

smallBtn: {
  padding: "6px 12px",
  fontSize: 14,
  borderRadius: 8,
},

};

const getAuthHeaders = () => {
  const token = sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ username: '', full_name: '', email: '', role: 'user', allowed_pages: [],allowed_faculties: [] });
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', role: 'user', allowed_pages: [],allowed_faculties: [] });
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();
  const [hoverBtn, setHoverBtn] = useState(null);
  const [activeBtn, setActiveBtn] = useState(null);
  const [search, setSearch] = useState("");

  const [faculties, setFaculties] = useState([]);


  useEffect(() => {
  const fetchFaculties = async () => {
    try {
      const res = await fetch(`${API_BASE}/faculties-list`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('فشل جلب الكليات');
      const data = await res.json();
      setFaculties(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      showToast('خطأ في جلب قائمة الكليات', 'error');
    }
  };

  fetchFaculties();
}, []);

  useEffect(() => {
  const token = sessionStorage.getItem('token');
  if (!token) {
    navigate('/login', { replace: true });
  }
}, [navigate]);

  const filteredUsers = users.filter(u => {
  const q = search.toLowerCase().trim();
  if (!q) return true;

  return (
    u.username?.toLowerCase().includes(q) ||
    u.full_name?.toLowerCase().includes(q) ||
    u.email?.toLowerCase().includes(q) ||
    u.role?.toLowerCase().includes(q)
  );
});



  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

useEffect(() => {
  const token = sessionStorage.getItem('token');
  if (token) {
    fetchUsers();
  }
}, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`, {
        headers: getAuthHeaders(),
      });

      if (res.status === 401) {
sessionStorage.removeItem('token');
sessionStorage.removeItem('user');
        navigate('/login');
        showToast('انتهت الجلسة، يرجى تسجيل الدخول مجدداً', 'error');
        return;
      }

      if (!res.ok) throw new Error('فشل جلب المستخدمين');

      const data = await res.json();
      setUsers(data);
    } catch (err) {
      showToast('خطأ في جلب المستخدمين: ' + err.message, 'error');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role,
      allowed_pages: user.allowed_pages || [],
      allowed_faculties: user.allowed_faculties || [],
    });
  };

  const handleSaveEdit = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(form),
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        showToast('انتهت الجلسة، يرجى تسجيل الدخول مجدداً', 'error');
        return;
      }

      if (!res.ok) throw new Error('فشل الحفظ');

      setEditingUser(null);
      fetchUsers();
      showToast('تم الحفظ بنجاح', 'success');
    } catch (err) {
      showToast('خطأ أثناء الحفظ: ' + err.message, 'error');
    }
  };

  const handleAddUser = async () => {
    if (!newUserForm.username || !newUserForm.password) {
      showToast('اسم المستخدم وكلمة المرور مطلوبين', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(newUserForm),
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        showToast('انتهت الجلسة، يرجى تسجيل الدخول مجدداً', 'error');
        return;
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'فشل الإضافة');
      }

      setNewUserForm({ username: '', password: '', role: 'user', allowed_pages: [], allowed_faculties: [] });
      fetchUsers();
      showToast('تم إضافة المستخدم', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const togglePage = (pageTitle, isNew = false) => {
    const setter = isNew ? setNewUserForm : setForm;
    setter(prev => ({
      ...prev,
      allowed_pages: prev.allowed_pages.includes(pageTitle)
        ? prev.allowed_pages.filter(p => p !== pageTitle)
        : [...prev.allowed_pages, pageTitle]
    }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('متأكد من حذف المستخدم؟')) return;
    try {
      const res = await fetch(`${API_BASE}/users/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        showToast('انتهت الجلسة، يرجى تسجيل الدخول مجدداً', 'error');
        return;
      }

      if (!res.ok) throw new Error('فشل الحذف');

      fetchUsers();
      showToast('تم الحذف بنجاح', 'success');
    } catch (err) {
      showToast('خطأ أثناء الحذف: ' + err.message, 'error');
    }
  };

  return (
    <div className="admission-layout" dir="rtl" style={ui.page}>
      <header className="library-header">
        <div className="library-header-title">
          <span style={{ fontSize: 22, fontWeight: 800 }}>المستخدمين والصلاحيات</span>
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
          <h2 style={ui.titleH2}>إدارة المستخدمين والصلاحيات </h2>

          {/* إضافة مستخدم جديد */}
          <div style={ui.card}>
            <h3 style={ui.sectionTitle}>إضافة مستخدم جديد</h3>
            <div style={ui.grid}>
              <div style={ui.field}>
                <label style={ui.label}>اسم المستخدم</label>
                <input
                  placeholder="اسم المستخدم"
                  value={newUserForm.username}
                  onChange={e => setNewUserForm({...newUserForm, username: e.target.value})}
                  style={ui.input}
                />
              </div>
              <div style={ui.field}>
                <label style={ui.label}>كلمة المرور</label>
                <input
                  type="password"
                  placeholder="كلمة المرور"
                  value={newUserForm.password}
                  onChange={e => setNewUserForm({...newUserForm, password: e.target.value})}
                  style={ui.input}
                />
              </div>
              <div style={ui.field}>
                <label style={ui.label}>وصف المستخدم</label>
                <select
                  value={newUserForm.role}
                  onChange={e => setNewUserForm({...newUserForm, role: e.target.value})}
                  style={ui.select}
                >
                  <option value="user">مستخدم عادي</option>
                  <option value="admin">إداري</option>
                  <option value="registrar">مسجل</option>
                  <option value="instructor">مدرس</option>
                </select>
              </div>
            </div>

<div style={{ margin: '1.5rem 0' }}>
  <strong>الكليات المسموح الوصول إليها:</strong><br />
  {faculties.length === 0 ? (
    <div style={{ color: '#64748b', marginTop: 8 }}>جاري تحميل الكليات...</div>
  ) : (
    faculties.map(fac => (
      <label key={fac.id} style={{ display: 'inline-block', margin: '0.4rem 1.2rem' }}>
        <input
          type="checkbox"
          checked={newUserForm.allowed_faculties.includes(fac.id)}
          onChange={() => {
            setNewUserForm(prev => ({
              ...prev,
              allowed_faculties: prev.allowed_faculties.includes(fac.id)
                ? prev.allowed_faculties.filter(id => id !== fac.id)
                : [...prev.allowed_faculties, fac.id]
            }));
          }}
        />
        {fac.faculty_name}
      </label>
    ))
  )}
</div>

            <div style={{ margin: '1.5rem 0' }}>
              <strong>الصفحات المسموحة:</strong><br />
              {allPortalTitles.map(title => (
                <label key={title} style={{ display: 'inline-block', margin: '0.4rem 1.2rem' }}>
                  <input
                    type="checkbox"
                    checked={newUserForm.allowed_pages.includes(title)}
                    onChange={() => togglePage(title, true)}
                  />
                  {title}
                </label>
              ))}
            </div>

            <button
  onClick={handleAddUser}
  onMouseEnter={() => setHoverBtn("add")}
  onMouseLeave={() => setHoverBtn(null)}
  onMouseDown={() => setActiveBtn("add")}
  onMouseUp={() => setActiveBtn(null)}
  style={{
    ...ui.btnBase,
    ...ui.primaryBtn,
    marginTop: 16,
    ...(hoverBtn === "add" ? ui.btnHover : {}),
    ...(activeBtn === "add" ? ui.btnActive : {}),
  }}
>
  إضافة المستخدم
</button>

          </div>

          {/* قائمة المستخدمين */}
          <div style={ui.card}>
            <h3 style={ui.sectionTitle}>قائمة المستخدمين</h3>
            <div style={{ marginBottom: 12 }}>
  <input
    type="text"
    placeholder=" ابحث باسم المستخدم، الاسم الكامل،..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    style={{
      ...ui.input,
      maxWidth: 420,
    }}
  />
</div>

            <div style={ui.tableWrap}>
              <table style={ui.table}>
                <thead>
                  <tr>
                    <th style={ui.th}>اسم المستخدم</th>
                    <th style={ui.th}>الاسم الكامل</th>
                    <th style={ui.th}>وصف المستخدم</th>
                    <th style={ui.th}>الصفحات المسموحة</th>
                    <th style={ui.th}>الكليات المسموحة</th>
                    <th style={ui.th}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td style={ui.td}>{u.username}</td>
                      <td style={ui.td}>{u.full_name || '—'}</td>
                      <td style={ui.td}>{u.role}</td>
                      <td style={ui.td}>
                        {(u.allowed_pages || []).length === 0 ? 'لا يوجد' : u.allowed_pages.join(' • ')}
                      </td>
                      <td style={ui.td}>
  {(u.allowed_faculties || []).length === 0 
    ? 'لا يوجد' 
    : u.allowed_faculties.map(id => {
        const f = faculties.find(fac => fac.id === id);
        return f ? f.faculty_name : id;
      }).join(' • ')
  }
</td>
                      <td style={ui.td}>
<div style={{ display: "flex", gap: 8 }}>
  <button
  onClick={() => handleEdit(u)}
  onMouseEnter={() => setHoverBtn(`edit-${u.id}`)}
  onMouseLeave={() => setHoverBtn(null)}
  onMouseDown={() => setActiveBtn(`edit-${u.id}`)}
  onMouseUp={() => setActiveBtn(null)}
  style={{
    ...ui.btnBase,
    ...ui.primaryBtn,
    ...ui.smallBtn,
    ...(hoverBtn === `edit-${u.id}` ? ui.btnHover : {}),
    ...(activeBtn === `edit-${u.id}` ? ui.btnActive : {}),
  }}
>
  تعديل
</button>


<button
  onClick={() => handleDelete(u.id)}
  onMouseEnter={() => setHoverBtn(`delete-${u.id}`)}
  onMouseLeave={() => setHoverBtn(null)}
  onMouseDown={() => setActiveBtn(`delete-${u.id}`)}
  onMouseUp={() => setActiveBtn(null)}
  style={{
    ...ui.btnBase,
    ...ui.dangerBtn,
    ...ui.smallBtn,
    ...(hoverBtn === `delete-${u.id}` ? ui.btnHover : {}),
    ...(activeBtn === `delete-${u.id}` ? ui.btnActive : {}),
  }}
>
  حذف
</button>

</div>

                      </td>
                    </tr>
                  ))}

                {filteredUsers.length === 0 && (
  <tr>
    <td colSpan="5" style={{ ...ui.td, textAlign: "center", padding: 20 }}>
      لا توجد نتائج مطابقة 
    </td>
  </tr>
)}

                </tbody>


              </table>
            </div>
          </div>

          {/* تعديل مستخدم */}
          {editingUser && (
            <div style={ui.card}>
              <h3 style={ui.sectionTitle}>تعديل مستخدم: {editingUser.username}</h3>
              <div style={ui.grid}>
                <div style={ui.field}>
                  <label style={ui.label}>اسم المستخدم</label>
                  <input
                    value={form.username}
                    onChange={e => setForm({...form, username: e.target.value})}
                    style={ui.input}
                  />
                </div>
                <div style={ui.field}>
                  <label style={ui.label}>الاسم الكامل</label>
                  <input
                    value={form.full_name}
                    onChange={e => setForm({...form, full_name: e.target.value})}
                    style={ui.input}
                  />
                </div>
                <div style={ui.field}>
                  <label style={ui.label}>الإيميل</label>
                  <input
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                    style={ui.input}
                  />
                </div>
                <div style={ui.field}>
                  <label style={ui.label}>وصف المستخدم</label>
                  <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} style={ui.select}>
                    <option value="user">مستخدم عادي</option>
                    <option value="admin">إداري</option>
                    <option value="registrar">مسجل</option>
                    <option value="instructor">مدرس</option>
                  </select>
                </div>
              </div>
<div style={{ margin: '1.5rem 0' }}>
  <strong>الكليات المسموح الوصول إليها:</strong><br />
  {faculties.length === 0 ? (
    <div style={{ color: '#64748b', marginTop: 8 }}>جاري تحميل الكليات...</div>
  ) : (
    faculties.map(fac => (
      <label key={fac.id} style={{ display: 'inline-block', margin: '0.4rem 1.2rem' }}>
        <input
          type="checkbox"
          checked={form.allowed_faculties.includes(fac.id)}
          onChange={() => {
            setForm(prev => ({
              ...prev,
              allowed_faculties: prev.allowed_faculties.includes(fac.id)
                ? prev.allowed_faculties.filter(id => id !== fac.id)
                : [...prev.allowed_faculties, fac.id]
            }));
          }}
        />
        {fac.faculty_name}
      </label>
    ))
  )}
</div>
              <div style={{ margin: '1.5rem 0' }}>
                <strong> الصفحات المسموحة: </strong><br />
                {allPortalTitles.map(title => (
                  <label key={title} style={{ display: 'inline-block', margin: '0.4rem 1.2rem' }}>
                    <input
                      type="checkbox"
                      checked={form.allowed_pages.includes(title)}
                      onChange={() => togglePage(title)}
                    />
                    {title}
                  </label>
                ))}
              </div>

<div style={ui.btnRow}>
<button
  onClick={handleSaveEdit}
  onMouseEnter={() => setHoverBtn("save")}
  onMouseLeave={() => setHoverBtn(null)}
  onMouseDown={() => setActiveBtn("save")}
  onMouseUp={() => setActiveBtn(null)}
  style={{
    ...ui.btnBase,
    ...ui.primaryBtn,
    ...(hoverBtn === "save" ? ui.btnHover : {}),
    ...(activeBtn === "save" ? ui.btnActive : {}),
  }}
>
  حفظ التعديلات
</button>


<button
  onClick={() => setEditingUser(null)}
  onMouseEnter={() => setHoverBtn("cancel")}
  onMouseLeave={() => setHoverBtn(null)}
  onMouseDown={() => setActiveBtn("cancel")}
  onMouseUp={() => setActiveBtn(null)}
  style={{
    ...ui.btnBase,
    ...ui.ghostBtn,
    ...(hoverBtn === "cancel" ? ui.btnHover : {}),
    ...(activeBtn === "cancel" ? ui.btnActive : {}),
  }}
>
  إلغاء
</button>
</div>

            </div>
          )}

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