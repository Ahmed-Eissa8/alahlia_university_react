import React, { useEffect, useState, useCallback } from "react";
import { FaBook, FaFilePdf, FaEdit, FaTrash, FaPlus } from "react-icons/fa";
import { IoArrowBack } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import html2pdf from 'html2pdf.js';

function createBookFromJson(json) {
  return {
    id: json.id,
    title: json.title || "",
    description: json.description || "",
    author: json.author || "",
    isPdf: json.is_pdf === 1,
    pdfUrl: json.pdf_url || "",
    copies: json.copies ?? 1,
    location: json.location || "",
    facultyId: json.faculty_id ?? null,
    facultyName: json.faculty_name || "",
  };
}

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

};

const BookListPage = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("books"); // "books" | "reports"

  const [books, setBooks] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [facultyFilter, setFacultyFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  const [selectedBook, setSelectedBook] = useState(null);

  const [formValues, setFormValues] = useState({
    title: "",
    description: "",
    author: "",
    faculty_id: "",
    copies: "",
    location: "",
  });

  const [pickedFile, setPickedFile] = useState(null);

  const [borrowValues, setBorrowValues] = useState({ name: "", student_id: "" });
  const [returnValues, setReturnValues] = useState({ name: "", student_id: "" });

  const [borrowLookupLoading, setBorrowLookupLoading] = useState(false);
  const [returnLookupLoading, setReturnLookupLoading] = useState(false);

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [booksByCategory, setBooksByCategory] = useState([]);
  const [borrowedBooks, setBorrowedBooks] = useState([]);

  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingBooksByCat, setLoadingBooksByCat] = useState(false);
  const [loadingBorrowed, setLoadingBorrowed] = useState(false);

  // Toast
  const [toast, setToast] = useState({ open: false, type: "success", text: "" });

  const showToast = useCallback((text, type = "success") => {
    setToast({ open: true, type, text });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      setToast((p) => ({ ...p, open: false }));
    }, 4000);
  }, []);

  const fetchBooks = async () => {
    try {
      let url = `${API_BASE}/books`;
      const params = new URLSearchParams();

      if (facultyFilter) params.append("faculty_id", facultyFilter);
      if (searchQuery) params.append("search", searchQuery);

      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("fetchBooks failed");
      const data = await res.json();
      setBooks(data.map(createBookFromJson));
    } catch (err) {
      console.error("Error fetching books:", err);
      showToast("حدث خطأ أثناء جلب الكتب", "error");
    }
  };

  const fetchFaculties = async () => {
    try {
      const res = await fetch(`${API_BASE}/library/faculties`);
      if (!res.ok) return;
      const data = await res.json();
      setFaculties(data);
    } catch (err) {
      console.error("Error fetching faculties:", err);
    }
  };

  // جلب التصنيفات الفريدة + الكتب المستعارة
  useEffect(() => {
    const loadReportsData = async () => {
      // التصنيفات
      setLoadingCategories(true);
      try {
        const res = await fetch(`${API_BASE}/book-categories`);
        if (res.ok) {
          const data = await res.json();
          setCategories(Array.isArray(data) ? data : []);
        }
      } catch {}
      setLoadingCategories(false);

      // الكتب المستعارة 
      if (activeTab === "reports") {
        setLoadingBorrowed(true);
        try {
          const res = await fetch(`${API_BASE}/borrowed-books-report`);
          if (res.ok) {
            const data = await res.json();
            setBorrowedBooks(Array.isArray(data) ? data : []);
          }
        } catch {}
        setLoadingBorrowed(false);
      }
    };

    loadReportsData();
  }, [activeTab]);

  // جلب الكتب حسب التصنيف المختار
  useEffect(() => {
    if (activeTab !== "reports" || !selectedCategory) {
      setBooksByCategory([]);
      return;
    }

    setLoadingBooksByCat(true);
    fetch(`${API_BASE}/books-by-category?category=${encodeURIComponent(selectedCategory)}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setBooksByCategory(Array.isArray(data) ? data : []))
      .catch(() => showToast("خطأ في جلب الكتب حسب التصنيف", "error"))
      .finally(() => setLoadingBooksByCat(false));
  }, [selectedCategory, activeTab]);

  useEffect(() => {
    fetchBooks();
    fetchFaculties();
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [facultyFilter, searchQuery]);

  useEffect(() => {
    const uni = (borrowValues.student_id || "").trim();
    if (!showBorrowModal || !uni) {
      setBorrowValues(prev => ({ ...prev, name: "" }));
      return;
    }

    const timer = setTimeout(async () => {
      setBorrowLookupLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/library/student-by-uni?university_id=${encodeURIComponent(uni)}`
        );
        if (res.ok) {
          const st = await res.json();
          setBorrowValues(prev => ({ ...prev, name: st.full_name || "" }));
        } else {
          setBorrowValues(prev => ({ ...prev, name: "" }));
        }
      } catch {
        setBorrowValues(prev => ({ ...prev, name: "" }));
      } finally {
        setBorrowLookupLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [borrowValues.student_id, showBorrowModal]);

  useEffect(() => {
    const uni = (returnValues.student_id || "").trim();
    if (!showReturnModal || !uni) {
      setReturnValues(prev => ({ ...prev, name: "" }));
      return;
    }

    const timer = setTimeout(async () => {
      setReturnLookupLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/library/student-by-uni?university_id=${encodeURIComponent(uni)}`
        );
        if (res.ok) {
          const st = await res.json();
          setReturnValues(prev => ({ ...prev, name: st.full_name || "" }));
        } else {
          setReturnValues(prev => ({ ...prev, name: "" }));
        }
      } catch {
        setReturnValues(prev => ({ ...prev, name: "" }));
      } finally {
        setReturnLookupLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [returnValues.student_id, showReturnModal]);



  const handleDownloadPdf = (url) => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", "");
    a.target = "_blank";
    a.click();
  };

  const handleChangeForm = (field, value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const openAddModal = () => {
    setFormValues({
      title: "",
      description: "",
      author: "",
      faculty_id: "",
      copies: "",
      location: "",
    });
    setPickedFile(null);
    setShowAddModal(true);
  };

  const submitAddBook = async () => {
    if (!formValues.title.trim()) {
      showToast("العنوان مطلوب!", "error");
      return;
    }

    const formData = new FormData();
    formData.append("title", formValues.title);
    formData.append("copies", formValues.copies);
    formData.append("description", formValues.description);
    formData.append("author", formValues.author);
    formData.append("faculty_id", formValues.faculty_id);
    formData.append("location", formValues.location);

    if (pickedFile) formData.append("pdf", pickedFile, pickedFile.name);

    try {
      const res = await fetch(`${API_BASE}/books`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.message || "حدث خطأ أثناء إضافة الكتاب", "error");
        return;
      }

      setShowAddModal(false);
      fetchBooks();
      showToast("تمت إضافة الكتاب بنجاح", "success");
    } catch (err) {
      console.error("Error adding book:", err);
      showToast("حدث خطأ أثناء إضافة الكتاب", "error");
    }
  };

  const openEditModal = (book) => {
    setSelectedBook(book);
    setFormValues({
      title: book.title,
      description: book.description,
      author: book.author,
      faculty_id: book.facultyId ? String(book.facultyId) : "",
      copies: String(book.copies ?? ""),
      location: book.location,
    });
    setPickedFile(null);
    setShowEditModal(true);
  };

  const submitEditBook = async () => {
    if (!selectedBook) return;
    if (!formValues.title.trim()) {
      showToast("العنوان مطلوب!", "error");
      return;
    }

    const formData = new FormData();
    formData.append("title", formValues.title);
    formData.append("copies", formValues.copies);
    formData.append("description", formValues.description);
    formData.append("author", formValues.author);
    formData.append("faculty_id", formValues.faculty_id);
    formData.append("location", formValues.location);
    if (pickedFile) formData.append("pdf", pickedFile, pickedFile.name);

    try {
      const res = await fetch(`${API_BASE}/books/${selectedBook.id}`, {
        method: "PUT",
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.message || "فشل تعديل الكتاب", "error");
        return;
      }

      setShowEditModal(false);
      setSelectedBook(null);
      fetchBooks();
      showToast("تم تعديل الكتاب بنجاح", "success");
    } catch (err) {
      console.error("Error editing book:", err);
      showToast("حدث خطأ أثناء تعديل الكتاب", "error");
    }
  };

  const deleteBook = async (book) => {
    const ok = window.confirm("هل أنت متأكد من حذف هذا الكتاب؟");
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/books/${book.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchBooks();
        showToast("تم حذف الكتاب بنجاح", "success");
      } else {
        showToast("فشل حذف الكتاب", "error");
      }
    } catch (err) {
      console.error("Error deleting book:", err);
      showToast("حدث خطأ أثناء حذف الكتاب", "error");
    }
  };

  const openBorrowModal = (book) => {
    setSelectedBook(book);
    setBorrowValues({ name: "", student_id: "" });
    setShowBorrowModal(true);
  };

  const submitBorrow = async () => {
    if (!selectedBook) return;
    if (!borrowValues.student_id) {
      showToast("الرقم الجامعي مطلوب!", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/borrow/${selectedBook.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          student_id: borrowValues.student_id,
        }).toString(),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        showToast(data?.error || "فشل الاستعارة", "error");
        return;
      }

      showToast(data?.message || "تمت الاستعارة", "success");
      setShowBorrowModal(false);
      setSelectedBook(null);
      fetchBooks();
    } catch (err) {
      console.error(err);
      showToast("حدث خطأ أثناء الاتصال بالسيرفر", "error");
    }
  };

  const openReturnModal = (book) => {
    setSelectedBook(book);
    setReturnValues({ name: "", student_id: "" });
    setShowReturnModal(true);
  };

  const submitReturn = async () => {
    if (!selectedBook) return;

    const uni = (returnValues.student_id || "").trim();
    if (!uni) {
      showToast("الرقم الجامعي مطلوب!", "error");
      return;
    }

    if (!returnValues.name) {
      showToast("الطالب غير موجود، تأكدي من الرقم الجامعي", "error");
      return;
    }

    try {
      const checkRes = await fetch(
        `${API_BASE}/borrow/check?book_id=${selectedBook.id}&student_id=${encodeURIComponent(uni)}`
      );
      const checkData = await checkRes.json().catch(() => null);

      if (!checkRes.ok) {
        showToast(checkData?.error || "فشل التحقق من الاستعارة", "error");
        return;
      }

      if (!checkData?.active) {
        showToast("هذا الطالب لم يستعر هذا الكتاب أو قام بإرجاعه مسبقاً", "error");
        return;
      }

      const res = await fetch(`${API_BASE}/return/${selectedBook.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ student_id: uni }).toString(),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        const deleteRes = await fetch(`${API_BASE}/borrow/delete`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            book_id: selectedBook.id,
            student_id: uni,
          }),
        });

        if (deleteRes.ok) {
          showToast(data?.message || "تم إرجاع الكتاب بنجاح", "success");
          setShowReturnModal(false);
          setSelectedBook(null);
          fetchBooks();
        } else {
          showToast("فشل حذف سجل الاستعارة", "error");
        }
      } else {
        showToast(data?.error || "فشل إرجاع الكتاب", "error");
      }
    } catch (err) {
      console.error("Error returning book:", err);
      showToast("حدث خطأ في الاتصال بالسيرفر", "error");
    }
  };

  // طباعة قائمة الكتب حسب التصنيف
  const printBooksByCategory = () => {
  if (!selectedCategory) {
    showToast("يرجى اختيار تصنيف أولاً", "error");
    return;
  }

  if (booksByCategory.length === 0) {
    showToast("لا توجد كتب في هذا التصنيف للطباعة", "error");
    return;
  }

  const reportTitle = `كتب التصنيف: ${selectedCategory}`;

  const headerHTML = `
    <div style="text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 1px solid #ccc; direction: rtl; font-family: 'Cairo', 'Tajawal', sans-serif;">
      <h1 style="margin: 0; color: #0a3753; font-size: 22px;">
        جامعة بورتسودان الأهلية - المكتبة
      </h1>
      <p style="margin: 12px 0 4px; font-weight: bold; font-size: 16px;">
        ${reportTitle}
      </p>
      <p style="margin: 8px 0; font-size: 14px; color: #4b5563;">
        تاريخ الطباعة: ${new Date().toLocaleDateString('EG')}
      </p>
      <p style="margin: 4px 0; font-size: 13px; color: #6b7280;">
        عدد الكتب: ${booksByCategory.length}
      </p>
    </div>
  `;

  const tableHTML = `
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; direction: rtl; font-family: 'Cairo', 'Tajawal', sans-serif; font-size: 14px;">
      <thead>
        <tr style="background: #6e6e6e; color: white;">
          <th style="padding: 12px; border: 1px solid #9ca3af; text-align: center; font-weight: bold;">#</th>
          <th style="padding: 12px; border: 1px solid #9ca3af; text-align: right; font-weight: bold;">العنوان</th>
          <th style="padding: 12px; border: 1px solid #9ca3af; text-align: right; font-weight: bold;">المؤلف</th>
          <th style="padding: 12px; border: 1px solid #9ca3af; text-align: center; font-weight: bold;">عدد النسخ(الحالية)</th>
          <th style="padding: 12px; border: 1px solid #9ca3af; text-align: right; font-weight: bold;">الموقع</th>
          <th style="padding: 12px; border: 1px solid #9ca3af; text-align: right; font-weight: bold;">الكلية</th>
        </tr>
      </thead>
      <tbody>
        ${booksByCategory.map((b, idx) => `
          <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="padding: 10px; border: 1px solid #d1d5db; text-align: center;">${idx + 1}</td>
            <td style="padding: 10px; border: 1px solid #d1d5db; text-align: right;">${b.title || '—'}</td>
            <td style="padding: 10px; border: 1px solid #d1d5db; text-align: right;">${b.author || '—'}</td>
            <td style="padding: 10px; border: 1px solid #d1d5db; text-align: center;">${b.copies || '—'}</td>
            <td style="padding: 10px; border: 1px solid #d1d5db; text-align: right;">${b.location || '—'}</td>
            <td style="padding: 10px; border: 1px solid #d1d5db; text-align: right;">${b.faculty_name || '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const fullContent = `<div style="padding: 20px 40px;">${headerHTML}${tableHTML}</div>`;

  const element = document.createElement('div');
  element.innerHTML = fullContent;

  html2pdf()
    .from(element)
    .set({
      margin: 1,
      filename: `كتب_تصنيف_${selectedCategory.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      html2canvas: { scale: 2 }
    })
    .save();

  showToast("جاري تجهيز قائمة الكتب للطباعة...", "success");
};

// طباعة قائمة الكتب المستعارة حالياً
const printBorrowedBooks = () => {
  if (borrowedBooks.length === 0) {
    showToast("لا توجد كتب مستعارة حالياً للطباعة", "error");
    return;
  }

  const headerHTML = `
    <div style="text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 1px solid #ccc; direction: rtl; font-family: 'Cairo', 'Tajawal', sans-serif;">
      <h1 style="margin: 0; color: #0a3753; font-size: 22px;">
        جامعة بورتسودان الأهلية - المكتبة
      </h1>
      <p style="margin: 12px 0 4px; font-weight: bold; font-size: 16px;">
        الكتب المستعارة حالياً
      </p>
      <p style="margin: 8px 0; font-size: 14px; color: #4b5563;">
        تاريخ الطباعة: ${new Date().toLocaleDateString('EG')}
      </p>
      <p style="margin: 4px 0; font-size: 13px; color: #6b7280;">
        عدد الكتب المستعارة: ${borrowedBooks.length}
      </p>
    </div>
  `;

  const tableHTML = `
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; direction: rtl; font-family: 'Cairo', 'Tajawal', sans-serif; font-size: 14px;">
      <thead>
        <tr style="background: #6e6e6e; color: white;">
          <th style="padding: 12px; border: 1px solid #9ca3af; text-align: center; font-weight: bold; width:60px;">#</th>
          <th style="padding: 12px; border: 1px solid #9ca3af; text-align: right; font-weight: bold;">عنوان الكتاب</th>
          <th style="padding: 12px; border: 1px solid #9ca3af; text-align: right; font-weight: bold;">اسم الطالب</th>
          <th style="padding: 12px; border: 1px solid #9ca3af; text-align: center; font-weight: bold;">الرقم الجامعي</th>
          <th style="padding: 12px; border: 1px solid #9ca3af; text-align: right; font-weight: bold;">الكلية</th>
          <th style="padding: 12px; border: 1px solid #9ca3af; text-align: right; font-weight: bold;">القسم</th>
          <th style="padding: 12px; border: 1px solid #9ca3af; text-align: center; font-weight: bold;">تاريخ الاستعارة</th>
        </tr>
      </thead>
      <tbody>
        ${borrowedBooks.map((item, idx) => `
          <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="padding: 10px; border: 1px solid #d1d5db; text-align: center;">${idx + 1}</td>
            <td style="padding: 10px; border: 1px solid #d1d5db; text-align: right;">${item.book_title || '—'}</td>
            <td style="padding: 10px; border: 1px solid #d1d5db; text-align: right;">${item.student_name || '—'}</td>
            <td style="padding: 10px; border: 1px solid #d1d5db; text-align: center;">${item.student_university_id || '—'}</td>
            <td style="padding: 10px; border: 1px solid #d1d5db; text-align: right;">${item.faculty_name || '—'}</td>
            <td style="padding: 10px; border: 1px solid #d1d5db; text-align: right;">${item.department_name || '—'}</td>
            <td style="padding: 10px; border: 1px solid #d1d5db; text-align: center;">
              ${item.borrowed_at ? new Date(item.borrowed_at).toLocaleDateString('EG') : '—'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const fullContent = `<div style="padding: 20px 40px;">${headerHTML}${tableHTML}</div>`;

  const element = document.createElement('div');
  element.innerHTML = fullContent;

  html2pdf()
    .from(element)
    .set({
      margin: 1,
      filename: `كتب_مستعارة_${new Date().toISOString().split('T')[0]}.pdf`,
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      html2canvas: { scale: 2 }
    })
    .save();

  showToast("جاري تجهيز قائمة الكتب المستعارة للطباعة...", "success");
};


  return (
    <div className="library-layout">
      {/* Toast */}
      {toast.open && (
        <div className={`toast ${toast.type === "success" ? "toast-success" : "toast-error"}`}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <header className="library-header">
        <div className="library-header-title">
          <span style={{ fontSize: 24 }}>Books</span>
          <span>المكتبة</span>
        </div>

        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "none",
            fontSize: "32px",
            color: "white",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          <IoArrowBack />
        </button>
      </header>

      <main className="library-main">
        <div className="library-container">

          {/* التبويبات */}
          <div style={ui.tabsRow}>
            <button
              style={ui.tabBtn(activeTab === "books")}
              onClick={() => setActiveTab("books")}
            >
المكتبة            </button>
            <button
              style={ui.tabBtn(activeTab === "reports")}
              onClick={() => setActiveTab("reports")}
            >
              التقارير
            </button>
          </div>

          {/* تب قائمة الكتب */}
          {activeTab === "books" && (
            <>
              <div className="toolbar">
                <div className="faculties-scroll">
                  <div className="chips-wrap">
                    {faculties.map((f) => {
                      const isSelected = facultyFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          className={"chip" + (isSelected ? " chip--selected" : "")}
                          onClick={() => setFacultyFilter((prev) => (prev === f.id ? null : f.id))}
                        >
                          {f.faculty_name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="toolbar-right">
                  <div className="search-box">
                    <input
                      type="text"
                      className="search-input"
                      placeholder="بحث عن كتاب (عنوان، مؤلف، كلية...)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <span className="search-icon"></span>
                  </div>

                  <button className="add-book-btn" onClick={openAddModal} title="إضافة كتاب">
                    <FaPlus />
                    <span className="add-book-text">إضافة كتاب</span>
                  </button>
                </div>
              </div>

              <div className="book-grid">
                {books.map((b) => (
                  <div key={b.id} className="book-card">
                    <div>
                      <div className="book-icon-wrapper">
                        <span
                          className="book-icon"
                          style={{ color: b.isPdf ? "#dc2626" : "#5e5f61d2" }}
                          onClick={() => {
                            if (b.isPdf) handleDownloadPdf(b.pdfUrl);
                          }}
                          title={b.isPdf ? "تحميل PDF" : ""}
                        >
                          {b.isPdf ? <FaFilePdf /> : <FaBook />}
                        </span>
                      </div>

                      <div className="book-info-title">{b.title}</div>
                      <div className="book-info-meta">
                        الكاتب: <strong>{b.author}</strong>
                      </div>
                      <div className="book-info-meta">
                        الكلية: <strong>{b.facultyName || "-"}</strong>
                      </div>

                      {b.location && (
                        <div className="book-location">
                          الموقع: <span>{b.location}</span>
                        </div>
                      )}

                      {!b.isPdf && (
                        <div className="book-availability">
                          <div className="book-availability-title">في المكتبة</div>
                          <div>عدد النسخ: {b.copies}</div>
                        </div>
                      )}
                    </div>

                    {!b.isPdf && (
                      <div className="actions-main">
                        {b.copies > 0 ? (
                          <button className="btn btn-primary" onClick={() => openBorrowModal(b)}>
                            استعارة
                          </button>
                        ) : (
                          <div
                            style={{
                              color: "var(--danger)",
                              fontSize: 12,
                              textAlign: "center",
                            }}
                          >
                            لا توجد نسخ متاحة حالياً
                          </div>
                        )}

                        <button className="btn btn-muted" onClick={() => openReturnModal(b)}>
                          إرجاع كتاب
                        </button>
                      </div>
                    )}

                    <div className="btn-icon-row">
                      <button className="icon-btn edit" title="تعديل" onClick={() => openEditModal(b)}>
                        <FaEdit />
                      </button>
{/* 
                      <button className="icon-btn delete" title="حذف" onClick={() => deleteBook(b)}>
                        <FaTrash />
                      </button> */}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* تب التقارير */}
{activeTab === "reports" && (
  <div style={{
    padding: "0 12px",
    fontSize: "16px",           
    lineHeight: "1.6"           
  }}>

    <div style={ui.card}>
      <h2 style={{
        ...ui.titleH2,
        fontSize: "24px",         
        marginBottom: "24px"
      }}>
        الكتب حسب التصنيف
      </h2>

      <div style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "16px",
        flexWrap: "wrap",
        marginBottom: "28px"
      }}>
        <div style={{ flex: "1", minWidth: "280px" }}>
          <label style={{
            ...ui.label,
            fontSize: "15px",      
            marginBottom: "10px"
          }}>
            اختر التصنيف
          </label>
          {loadingCategories ? (
            <div style={{ color: "#64748b", padding: "14px", fontSize: "15px" }}>
              جاري تحميل التصنيفات...
            </div>
          ) : (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                ...ui.select,
                fontSize: "16px",     
                padding: "13px 12px"
              }}
            >
              <option value="">— اختر تصنيف —</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={printBooksByCategory}
          disabled={!selectedCategory || booksByCategory.length === 0 || loadingBooksByCat}
          style={{
            ...ui.primaryBtn,
            minWidth: "240px",
            fontSize: "16px",
            padding: "13px 24px",
            marginTop: "0"
          }}
        >
          طباعة الكتب حسب التصنيف
        </button>
      </div>

      {loadingBooksByCat ? (
        <div style={{ color: "#0a3753", fontWeight: 600, padding: "24px 0", fontSize: "16px" }}>
          جاري جلب الكتب...
        </div>
      ) : booksByCategory.length > 0 ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "16px"           
          }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "14px 16px", textAlign: "right", fontSize: "15px" }}>العنوان</th>
                <th style={{ padding: "14px 16px", textAlign: "right", fontSize: "15px" }}>المؤلف</th>
                <th style={{ padding: "14px 16px", textAlign: "center", fontSize: "15px" }}>عدد النسخ (الحالية)</th>
                <th style={{ padding: "14px 16px", textAlign: "right", fontSize: "15px" }}>الموقع</th>
                <th style={{ padding: "14px 16px", textAlign: "right", fontSize: "15px" }}>الكلية</th>
              </tr>
            </thead>
            <tbody>
              {booksByCategory.map((b, idx) => (
                <tr key={b.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "14px 16px" }}>{b.title}</td>
                  <td style={{ padding: "14px 16px" }}>{b.author || "—"}</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>{b.copies}</td>
                  <td style={{ padding: "14px 16px" }}>{b.location || "—"}</td>
                  <td style={{ padding: "14px 16px" }}>{b.faculty_name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : selectedCategory ? (
        <div style={{ color: "#64748b", padding: "24px 0", textAlign: "center", fontSize: "16px" }}>
          لا توجد كتب مسجلة في هذا التصنيف حالياً
        </div>
      ) : null}
    </div>

    <div style={{ ...ui.card, marginTop: "40px" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
        flexWrap: "wrap",
        gap: "20px"
      }}>
        <h2 style={{
          ...ui.titleH2,
          fontSize: "24px",        
          margin: 0
        }}>
          الكتب المستعارة حالياً
        </h2>

        <button
          onClick={printBorrowedBooks}
          disabled={borrowedBooks.length === 0 || loadingBorrowed}
          style={{
            ...ui.primaryBtn,
            background: "#0a3753",
            minWidth: "240px",
            fontSize: "16px",
            padding: "13px 24px"
          }}
        >
          طباعة الكتب المستعارة
        </button>
      </div>

      {loadingBorrowed ? (
        <div style={{ color: "#0a3753", fontWeight: 600, padding: "24px 0", fontSize: "16px" }}>
          جاري تحميل التقرير...
        </div>
      ) : borrowedBooks.length === 0 ? (
        <div style={{ color: "#64748b", padding: "24px 0", textAlign: "center", fontSize: "16px" }}>
          لا توجد كتب مستعارة في الوقت الحالي
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "16px"           
          }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "14px", textAlign: "center", width: "60px", fontSize: "15px" }}>#</th>
                <th style={{ padding: "14px", textAlign: "right", fontSize: "15px" }}>عنوان الكتاب</th>
                <th style={{ padding: "14px", textAlign: "right", fontSize: "15px" }}>اسم الطالب</th>
                <th style={{ padding: "14px", textAlign: "center", fontSize: "15px" }}>الرقم الجامعي</th>
                <th style={{ padding: "14px", textAlign: "right", fontSize: "15px" }}>الكلية</th>
                <th style={{ padding: "14px", textAlign: "right", fontSize: "15px" }}>القسم</th>
                <th style={{ padding: "14px", textAlign: "center", fontSize: "15px" }}>تاريخ الاستعارة</th>
              </tr>
            </thead>
            <tbody>
              {borrowedBooks.map((item, index) => (
                <tr key={item.borrow_id || index} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "14px", textAlign: "center" }}>{index + 1}</td>
                  <td style={{ padding: "14px" }}>{item.book_title}</td>
                  <td style={{ padding: "14px" }}>{item.student_name}</td>
                  <td style={{ padding: "14px", textAlign: "center" }}>{item.student_university_id}</td>
                  <td style={{ padding: "14px" }}>{item.faculty_name}</td>
                  <td style={{ padding: "14px" }}>{item.department_name}</td>
                  <td style={{ padding: "14px", textAlign: "center" }}>
                    {item.borrowed_at
                      ? new Date(item.borrowed_at).toLocaleDateString("EG")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

  </div>
)}
        </div>
      </main>

      {(showAddModal || showEditModal) && (
        <Modal
          onClose={() => {
            setShowAddModal(false);
            setShowEditModal(false);
          }}
        >
          <h2>{showAddModal ? "إضافة كتاب" : "تعديل كتاب"}</h2>

          <TextInput
            label="عنوان الكتاب"
            value={formValues.title}
            onChange={(v) => handleChangeForm("title", v)}
          />

          <TextInput
            label="عدد النسخ"
            type="number"
            value={formValues.copies}
            onChange={(v) => handleChangeForm("copies", v)}
          />

          <TextInput
            label="التصنيف"
            value={formValues.description}
            onChange={(v) => handleChangeForm("description", v)}
          />

          <TextInput
            label="المؤلف"
            value={formValues.author}
            onChange={(v) => handleChangeForm("author", v)}
          />

          <div className="input-group">
            <label className="input-label">الكلية</label>
            <select
              className="input-field"
              value={formValues.faculty_id}
              onChange={(e) => handleChangeForm("faculty_id", e.target.value)}
            >
              <option value="">-- اختر الكلية --</option>
              {faculties.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.faculty_name}
                </option>
              ))}
            </select>
          </div>

          <TextInput
            label="موقع الكتاب في المكتبة"
            value={formValues.location}
            onChange={(v) => handleChangeForm("location", v)}
          />

          <div className="input-group">
            <span className="input-label">
              {showAddModal ? "إرفاق PDF (اختياري)" : "تغيير PDF (اختياري)"}
            </span>

            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setPickedFile(file);
              }}
            />

            <div className="file-hint">
              {pickedFile ? (
                <>
                  تم اختيار: <strong>{pickedFile.name}</strong>
                </>
              ) : (
                "يمكنك تركه فارغاً إذا لا تريد رفع ملف PDF"
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button
              className="btn btn-outline"
              onClick={() => {
                setShowAddModal(false);
                setShowEditModal(false);
              }}
            >
              إلغاء
            </button>

            <button
              className="btn btn-primary"
              onClick={showAddModal ? submitAddBook : submitEditBook}
            >
              {showAddModal ? "إضافة" : "حفظ"}
            </button>
          </div>
        </Modal>
      )}

      {showBorrowModal && (
        <Modal onClose={() => setShowBorrowModal(false)}>
          <h2>استعارة كتاب</h2>

          <div className="input-group">
            <label className="input-label">
              اسم الطالب {borrowLookupLoading ? "(جارٍ البحث...)" : ""}
            </label>

            <input
              type="text"
              className="input-field"
              value={borrowValues.name || ""}
              readOnly
              onClick={() => showToast("أدخل الرقم الجامعي أولاً", "error")}
              style={{ cursor: "pointer" }}
            />
          </div>

          <TextInput
            label="الرقم الجامعي"
            value={borrowValues.student_id}
            onChange={(v) => setBorrowValues((prev) => ({ ...prev, student_id: v }))}
          />

          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setShowBorrowModal(false)}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={submitBorrow}>
              تأكيد
            </button>
          </div>
        </Modal>
      )}

      {showReturnModal && (
        <Modal onClose={() => setShowReturnModal(false)}>
          <h2>إرجاع كتاب</h2>

          <div className="input-group">
            <label className="input-label">
              اسم الطالب {returnLookupLoading ? "(جارٍ البحث...)" : ""}
            </label>

            <input
              type="text"
              className="input-field"
              value={returnValues.name || ""}
              readOnly
              onClick={() => showToast("أدخل الرقم الجامعي أولاً", "error")}
              style={{ cursor: "pointer" }}
            />
          </div>

          <TextInput
            label="الرقم الجامعي للطالب"
            value={returnValues.student_id}
            onChange={(v) => setReturnValues((prev) => ({ ...prev, student_id: v }))}
          />

          <div className="modal-actions">
            <button className="btn btn-outline" onClick={() => setShowReturnModal(false)}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={submitReturn}>
              تأكيد
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Modal = ({ children, onClose }) => (
  <div className="modal-backdrop" onClick={onClose}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  </div>
);

const TextInput = ({ label, value, onChange, type = "text" }) => (
  <div className="input-group">
    <label className="input-label">{label}</label>
    <input
      type={type}
      className="input-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

export default BookListPage;