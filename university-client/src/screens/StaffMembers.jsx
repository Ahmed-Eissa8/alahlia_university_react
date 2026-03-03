import React, { useEffect, useMemo, useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:5000/api";

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

const emptyForm = {
  id: null,
  full_name: "",
  email: "",
  phone: "",
  faculty_id: "",
  department_id: "",
  academic_rank: "",
  specialization: "",
};

export default function StaffMembers() {
  const navigate = useNavigate();

  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [faculties, setFaculties] = useState([]);

  const [selectedFacultyId, setSelectedFacultyId] = useState("");

  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const [q, setQ] = useState("");
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [ranks, setRanks] = useState([]);

  const filteredList = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    if (!s) return list;
    return list.filter((x) => {
      const name = (x.full_name || "").toLowerCase();
      const email = String(x.email || "").toLowerCase();
      const phone = String(x.phone || "").toLowerCase();
      const rank = String(x.academic_rank || "").toLowerCase();
      const spec = String(x.specialization || "").toLowerCase();
      return (
        name.includes(s) ||
        email.includes(s) ||
        phone.includes(s) ||
        rank.includes(s) ||
        spec.includes(s)
      );
    });
  }, [list, q]);

  // ===== Load faculties
useEffect(() => {
  const loadFaculties = async () => {
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

      // إعادة التحقق من الكلية المختارة لو كانت موجودة قبل الفلتر
      if (selectedFacultyId) {
        const stillAllowed = filtered.find(f => f.id === Number(selectedFacultyId));
        if (!stillAllowed) {
          setSelectedFacultyId("");
        }
      }
    } catch (e) {
      console.error(e);
      showToast("مشكلة في تحميل الكليات", "error");
    }
  };

  loadFaculties();
}, []);

  // ===== Load academic ranks (smart list) 
const loadRanks = async () => {
  try {
    const res = await fetch(`${API_BASE}/academic-ranks`);
    const data = await res.json();
    setRanks(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error(e);
    setRanks([]);
  }
};


  // ===== Load list (by faculty only)
  const loadStaff = async (facultyIdOverride) => {
    setLoadingList(true);
    try {
      const fid = facultyIdOverride ?? selectedFacultyId;
      const qs = fid ? `faculty_id=${encodeURIComponent(fid)}` : "";
      const url = qs ? `${API_BASE}/staff-members?${qs}` : `${API_BASE}/staff-members`;

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل تحميل البيانات");
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      showToast(e.message || "مشكلة في تحميل القائمة", "error");
      setList([]);
    } finally {
      setLoadingList(false);
    }
  };

  const onSelectFaculty = (fid) => {
    setSelectedFacultyId(fid);
    setList([]);
    setRanks([]);
    setQ("");

    setForm((p) => ({
      ...p,
      faculty_id: fid,
      department_id: "",
    }));

    if (fid) {
      loadStaff(fid);
      loadRanks({ faculty_id: fid });
    }
  };

  // ===== Form handlers
  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const resetForm = () => {
    setForm(() => ({
      ...emptyForm,
      faculty_id: selectedFacultyId || "",
      department_id: "", 
    }));
  };

  const startEdit = (row) => {
    setForm({
      id: row.id,
      full_name: row.full_name || "",
      email: row.email || "",
      phone: row.phone || "",
      faculty_id: String(row.faculty_id || ""),
      department_id: String(row.department_id || ""), 
      academic_rank: row.academic_rank || "",
      specialization: row.specialization || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    if (!form.full_name.trim()) return showToast("اسم العضو مطلوب", "error");
    if (!form.faculty_id) return showToast("اختار الكلية", "error");

    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        faculty_id: Number(form.faculty_id),

        department_id: form.department_id ? Number(form.department_id) : null,

        academic_rank: form.academic_rank.trim() || null,
        specialization: form.specialization.trim() || null,
      };

      let res;
      if (form.id) {
        res = await fetch(`${API_BASE}/staff-members/${form.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_BASE}/staff-members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل الحفظ");

      showToast(form.id ? "تم التعديل بنجاح" : "تمت الإضافة بنجاح", "success");
      resetForm();
      await loadStaff();

      // لو دخل رتبة جديدة تظهر فوراً
      await loadRanks();
    } catch (e) {
      console.error(e);
      showToast(e.message || "مشكلة في الحفظ", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("متأكد من الحذف؟")) return;
    try {
      const res = await fetch(`${API_BASE}/staff-members/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "فشل الحذف");
      showToast("تم الحذف", "success");
      await loadStaff();
      await loadRanks();
    } catch (e) {
      console.error(e);
      showToast(e.message || "مشكلة في الحذف", "error");
    }
  };

  return (
    <div className="admission-layout">
      <header className="library-header">
        <div className="library-header-title">
          <span>أعضاء هيئة التدريس</span>
        </div>

        <button
          onClick={() => navigate(-1)}
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
          title="رجوع"
        >
          <IoArrowBack />
        </button>
      </header>

      <main className="library-main">
        <div className="library-container">
          {/* Filters */}
          <div className="card" style={{ marginTop: 14 }}>
            <h2 className="card-title">اختيار الكلية</h2>

            <div className="two-col-grid">
              <div className="input-group">
                <label className="input-label">الكلية</label>
                <select
                  className="input-field"
                  value={selectedFacultyId}
                  onChange={(e) => onSelectFaculty(e.target.value)}
                >
                  <option value="">— اختار —</option>
                  {faculties.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.faculty_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn btn-primary" onClick={() => loadStaff()} disabled={!selectedFacultyId || loadingList}>
                {loadingList ? "جارٍ التحميل..." : "تحديث القائمة"}
              </button>

              <input
                className="input-field"
                dir="rtl"
                placeholder="بحث (اسم/إيميل/موبايل/رتبة/تخصص)..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ maxWidth: 360 }}
                disabled={list.length === 0}
              />

              <div style={{ color: "#6b7280", fontWeight: 800 }}>
                العدد: {filteredList.length} / {list.length}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="card" style={{ marginTop: 14 }}>
            <h2 className="card-title">{form.id ? "تعديل عضو" : "إضافة عضو جديد"}</h2>

            <div className="two-col-grid">
              <div className="input-group">
                <label className="input-label">اسم العضو *</label>
                <input
                  className="input-field"
                  dir="rtl"
                  value={form.full_name}
                  onChange={(e) => setField("full_name", e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label">الإيميل (اختياري)</label>
                <input
                  className="input-field"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label">رقم الهاتف</label>
                <input
                  className="input-field"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                />
              </div>

              {/* SMART LIST: academic rank */}
              <div className="input-group">
                <label className="input-label">الرتبة العلمية</label>
                <input
                  className="input-field"
                  dir="rtl"
                  placeholder="اختر من القائمة أو اكتب رتبة جديدة..."
                  value={form.academic_rank}
                  onChange={(e) => setField("academic_rank", e.target.value)}
                  list="academic-ranks-list"
                />
                <datalist id="academic-ranks-list">
                  {ranks.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>

              <div className="input-group">
                <label className="input-label">التخصص</label>
                <input
                  className="input-field"
                  dir="rtl"
                  value={form.specialization}
                  onChange={(e) => setField("specialization", e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <button className="btn btn-primary" onClick={save} disabled={saving || !selectedFacultyId}>
                {saving ? "جارٍ الحفظ..." : form.id ? "حفظ التعديل" : "إضافة"}
              </button>

              <button className="btn btn-secondary" onClick={resetForm} disabled={saving}>
                إلغاء
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="card" style={{ marginTop: 14 }}>
            <h2 className="card-title">قائمة أعضاء هيئة التدريس</h2>

            {filteredList.length === 0 ? (
              <div style={{ color: "#6b7280", fontWeight: 800 }}>
                {selectedFacultyId ? "لا توجد بيانات" : "اختار كلية لعرض القائمة"}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="simple-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الاسم</th>
                      <th>الإيميل</th>
                      <th>رقم الهاتف</th>
                      <th>الرتبة</th>
                      <th>التخصص</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((x, idx) => (
                      <tr key={x.id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 800, whiteSpace: "nowrap" }}>{x.full_name}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{x.email || "-"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{x.phone || "-"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{x.academic_rank || "-"}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{x.specialization || "-"}</td>
                        <td style={{ whiteSpace: "nowrap", display: "flex", gap: 8 }}>
                          <button className="btn btn-small" onClick={() => startEdit(x)}>تعديل</button>
                          <button className="btn btn-danger btn-small" onClick={() => remove(x.id)}>حذف</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Toast */}
          {toast && (
            <div
              style={{
                position: "fixed",
                right: 16,
                bottom: 16,
                background: toast.type === "error" ? "#dc2626" : "#16a34a",
                color: "white",
                padding: "12px 14px",
                borderRadius: 10,
                fontWeight: 900,
                boxShadow: "0 12px 30px rgba(0,0,0,.25)",
                zIndex: 9999,
              }}
            >
              {toast.message}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
