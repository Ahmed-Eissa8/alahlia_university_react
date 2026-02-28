import React, { useEffect, useMemo, useRef, useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import html2pdf from 'html2pdf.js';

const API_BASE = "http://localhost:5000/api";
const DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

const ui = {
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

function useLocalToast(externalShowToast) {
  const [toast, setToast] = useState({ open: false, type: "success", msg: "" });
  const timerRef = useRef(null);

  const show = (msg, type = "success") => {
    if (typeof externalShowToast === "function") {
      try {
        externalShowToast(msg, type);
      } catch (_) {}
    }

    clearTimeout(timerRef.current);
    setToast({ open: true, type, msg: String(msg || "") });

    timerRef.current = setTimeout(() => {
      setToast((t) => ({ ...t, open: false }));
    }, 3500);
  };

  const ToastView = toast.open ? (
    <div className={`toast toast-${toast.type}`} dir="rtl">
      {toast.msg}
    </div>
  ) : null;

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return { show, ToastView };
}

function RoomSearchSelect({ rooms = [], value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selected = rooms.find((r) => String(r.id) === String(value));
  const filtered = rooms.filter((r) =>
    String(r.room_name || "").toLowerCase().includes(String(q || "").toLowerCase())
  );

  return (
    <div style={{ position: "relative" }}>
      <input
        className="input-field"
        dir="rtl"
        placeholder="ابحث عن قاعة..."
        value={open ? q : selected?.room_name || ""}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        disabled={disabled}
      />

      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            left: 0,
            zIndex: 50,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            maxHeight: 220,
            overflowY: "auto",
            marginTop: 6,
          }}
        >
          {filtered.length ? (
            filtered.map((r) => (
              <div
                key={r.id}
                onMouseDown={() => {
                  onChange(String(r.id));
                  setQ("");
                  setOpen(false);
                }}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f3f4f6",
                  fontWeight: 700,
                }}
              >
                {r.room_name}
              </div>
            ))
          ) : (
            <div style={{ padding: 12, color: "#6b7280", fontWeight: 700 }}>لا توجد نتائج</div>
          )}
        </div>
      )}
    </div>
  );
}

function RoomRow({ r, idx, onDelete, onSaveEdit, savingId }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(r.room_name || "");

  useEffect(() => {
    setName(r.room_name || "");
  }, [r.room_name]);

  const busy = String(savingId) === String(r.id);

  return (
    <tr>
      <td>{idx + 1}</td>

      <td style={{ minWidth: 220 }}>
        {isEditing ? (
          <input
            className="input-field"
            dir="rtl"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        ) : (
          <span style={{ fontWeight: 800 }}>{r.room_name}</span>
        )}
      </td>

      <td style={{ whiteSpace: "nowrap" }}>
        {!isEditing ? (
          <>
            <button
              className="btn btn-small"
              onClick={() => setIsEditing(true)}
              disabled={busy}
              style={{ marginInlineEnd: 8 }}
            >
              تعديل
            </button>
            {/* <button className="btn btn-danger btn-small" onClick={() => onDelete(r.id)} disabled={busy}>
              حذف
            </button> */}
          </>
        ) : (
          <>
            <button
              className="btn btn-primary btn-small"
              onClick={() => onSaveEdit(r.id, name, () => setIsEditing(false))}
              disabled={busy}
              style={{ marginInlineEnd: 8 }}
            >
              {busy ? "جارٍ الحفظ..." : "حفظ"}
            </button>
            <button
              className="btn btn-small"
              onClick={() => {
                setName(r.room_name || "");
                setIsEditing(false);
              }}
              disabled={busy}
            >
              إلغاء
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

export default function ScheduleAdmin({ showToast, faculties: facultiesProp = [] }) {
  const navigate = useNavigate();
  const { show: toast, ToastView } = useLocalToast(showToast);
  const formTopRef = useRef(null);
  const scheduleRef = useRef(null);

  //  Tabs
  const [activeTab, setActiveTab] = useState("schedule"); 

  const [facultiesLocal, setFacultiesLocal] = useState([]);
  const [loadingFaculties, setLoadingFaculties] = useState(false);

  const faculties = useMemo(() => {
    const p = Array.isArray(facultiesProp) ? facultiesProp : [];
    if (p.length) return p;
    return Array.isArray(facultiesLocal) ? facultiesLocal : [];
  }, [facultiesProp, facultiesLocal]);

  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [departments, setDepartments] = useState([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");

  const [programType, setProgramType] = useState("bachelor");
  const [postgraduateProgram, setPostgraduateProgram] = useState("");

  const [periods, setPeriods] = useState([]);
  const [yearOptions, setYearOptions] = useState([]);
  const [levelOptions, setLevelOptions] = useState([]);
  const [termOptions, setTermOptions] = useState([]);

  const [academicYear, setAcademicYear] = useState("");
  const [levelName, setLevelName] = useState("");
  const [termName, setTermName] = useState("");

  // -------- lists
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // rooms global
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [editingSessionId, setEditingSessionId] = useState(""); 
  const [courseId, setCourseId] = useState("");
  const [instructorStaffId, setInstructorStaffId] = useState("");
  const [instructorDisplayName, setInstructorDisplayName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("السبت");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [saving, setSaving] = useState(false);

  // Rooms tab 
  const [newRoomName, setNewRoomName] = useState("");
  const [addingRoom, setAddingRoom] = useState(false);
  const [roomSearch, setRoomSearch] = useState("");
  const [savingRoomId, setSavingRoomId] = useState("");

  const canPickDepartment = !!selectedFacultyId;
const canProceedAfterProgram =
    (programType === "bachelor" || programType === "diploma") 
      ? true 
      : !!postgraduateProgram.trim();
  const canPickYear = !!selectedDepartmentId && canProceedAfterProgram;
  const canPickLevel = !!academicYear.trim();
  const canPickTerm = !!levelName.trim();

  const canLoad =
    selectedFacultyId &&
    selectedDepartmentId &&
    canProceedAfterProgram &&
    academicYear.trim() &&
    levelName.trim() &&
    termName.trim();

    const pgSmart = usePostgradProgramsSmartList();


    useEffect(() => {
    if (programType === "postgraduate") {
      pgSmart.fetchPrograms();
    } else {
      setPostgraduateProgram("");
    }
  }, [programType]);

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


const handlePrint = () => {
  if (!sessions?.length) {
    toast("لا يوجد محاضرات لعرضها أو طباعتها", "info");
    return;
  }

  const timeSlotsSet = new Set();
  sessions.forEach(s => {
    if (s.start_time && s.end_time) {
      timeSlotsSet.add(`${s.start_time.slice(0,5)} – ${s.end_time.slice(0,5)}`);
    }
  });

  const timeSlots = [...timeSlotsSet].sort((a, b) => {
    const [aStart] = a.split(' – ');
    const [bStart] = b.split(' – ');
    return aStart.localeCompare(bStart);
  });

const programTypeLabel =
  programType === "postgraduate"
    ? `دراسات عليا${postgraduateProgram ? " — " + postgraduateProgram.trim() : ""}`
    : programType === "diploma"
      ? "دبلوم"
      : "بكالوريوس";


  const printWindow = window.open("", "", "height=900,width=1200");
  printWindow.document.write(`
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8">
      <title>جدول محاضرات - ${levelName || ''} - ${termName || ''}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Cairo', Tahoma, Arial, sans-serif;
          margin: 0;
          padding: 20px 40px;
          color: #111;
          background: #fff;
          line-height: 1.5;
        }

        .container {
          max-width: 1100px;
          margin: 0 auto;
        }

        .header {
          text-align: center;
          margin-bottom: 25px;
        }

        h1 {
          font-size: 28px;
          margin: 0 0 8px 0;
          color: #0a3753;
          font-weight: 700;
        }

        h2 {
          font-size: 20px;
          margin: 4px 0 2px 0;
          color: #333;
          font-weight: 600;
        }

        .subtitle {
          font-size: 16px;
          color: #555;
          margin: 6px 0 20px 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 15px;
        }

        th, td {
          border: 1px solid #444;
          padding: 12px 10px;
          text-align: center;
          vertical-align: middle;
        }

        th {
          background-color: #e8f0fe;
          color: #0a3753;
          font-weight: 700;
          font-size: 15px;
        }

        .day-cell {
          background-color: #f5f5f5;
          font-weight: 700;
          width: 90px;
          color: #222;
        }

        .time-header {
          background-color: #d1e3ff;
          font-weight: 700;
          min-width: 120px;
        }

        .session-cell {
          background-color: #f9fcff;
          line-height: 1.6;
          font-size: 14.5px;
        }

        .session-cell strong {
          color: #0d47a1;
          display: block;
          margin-bottom: 4px;
        }

        .session-cell .instructor {
          color: #444;
        }

        .session-cell .room {
          color: #555;
          font-size: 13px;
        }

        .empty {
          color: #aaa;
          font-style: italic;
        }

        .footer {
          margin-top: 40px;
          text-align: center;
          color: #666;
          font-size: 13px;
        }

        @media print {
          body { 
            margin: 15mm; 
            font-size: 13px; 
          }
          .header { margin-bottom: 20px; }
          h1 { font-size: 24px; }
          h2 { font-size: 18px; }
          table { page-break-inside: avoid; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
      </style>
    </head>
    <body>
      <div class="container">

        <div class="header">
        <h1>جامعة بورتسودان الأهلية </h1>
          <h2>       
            ${faculties.find(f => f.id == selectedFacultyId)?.faculty_name || '—'}  
            / ${departments.find(d => d.id == selectedDepartmentId)?.department_name || '—'}
          </h2>
          <h2>
  ${programTypeLabel} <br/>
  ${levelName || '—'} — ${termName || '—'} — ${academicYear || '—'}
</h2>

        </div>

        <table>
          <thead>
            <tr>
              <th class="day-cell">اليوم</th>
              ${timeSlots.map(slot => `<th class="time-header">${slot}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
  `);

  DAYS.forEach(day => {
    printWindow.document.write(`<tr><td class="day-cell">${day}</td>`);

    timeSlots.forEach(slot => {
      const [slotStart, slotEnd] = slot.split(' – ').map(t => t + ':00');

      const session = sessions.find(s => 
        s.day_of_week === day &&
        s.start_time < slotEnd &&
        s.end_time > slotStart
      );

      if (session) {
        printWindow.document.write(`
          <td class="session-cell">
            <strong>${session.course_name || '—'}</strong>
            <div class="instructor">${session.instructor_name || '—'}</div>
            <div class="room">${session.room_name || '—'}</div>
          </td>
        `);
      } else {
        printWindow.document.write('<td class="empty">—</td>');
      }
    });

    printWindow.document.write('</tr>');
  });

  printWindow.document.write(`
          </tbody>
        </table>


      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();

};

  // ---------- fetch faculties 
  useEffect(() => {
    const p = Array.isArray(facultiesProp) ? facultiesProp : [];
    if (p.length) return;

    (async () => {
      setLoadingFaculties(true);
      try {
        const res = await fetch(`${API_BASE}/faculties-list`);
        const data = await res.json();
        setFacultiesLocal(Array.isArray(data) ? data : []);
      } catch (e) {
        setFacultiesLocal([]);
        toast("مشكلة في تحميل الكليات", "error");
      } finally {
        setLoadingFaculties(false);
      }
    })();
  }, []);

  // ---------- rooms GLOBAL
  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await fetch(`${API_BASE}/rooms`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل تحميل القاعات");
      setRooms(Array.isArray(data) ? data : []);
    } catch (e) {
      setRooms([]);
      toast(e.message || "مشكلة في تحميل القاعات", "error");
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  // ---------- helpers
  const rebuildLevelAndTermOptions = (rows, year, level) => {
    const y = (year || "").trim();
    const l = (level || "").trim();

    const levels = Array.from(
      new Set(
        (Array.isArray(rows) ? rows : [])
          .filter((r) => (r.academic_year || "").trim() === y)
          .map((r) => (r.level_name || "").trim())
          .filter(Boolean)
      )
    );
    setLevelOptions(levels);

    const terms = Array.from(
      new Set(
        (Array.isArray(rows) ? rows : [])
          .filter((r) => (r.academic_year || "").trim() === y && (r.level_name || "").trim() === l)
          .map((r) => (r.term_name || "").trim())
          .filter(Boolean)
      )
    );
    setTermOptions(terms);
  };

  useEffect(() => {
    rebuildLevelAndTermOptions(periods, academicYear, levelName);
  }, [periods, academicYear, levelName]);

  // ---------- fetchers
  const fetchDepartmentsByFaculty = async (facultyId) => {
    if (!facultyId) return;
    try {
      const res = await fetch(`${API_BASE}/departments/${facultyId}`);
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } catch (e) {
      setDepartments([]);
      toast("مشكلة في تحميل الأقسام", "error");
    }
  };

  const fetchAcademicPeriods = async (pType, pgProg) => {
    try {
      const pt = (pType || "bachelor").trim();
      const pg = (pgProg || "").trim();

      let url = `${API_BASE}/academic-periods?program_type=${encodeURIComponent(pt)}`;
      if (pt === "postgraduate" && pg) url += `&postgraduate_program=${encodeURIComponent(pg)}`;

      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل تحميل الفترات");

      const rows = Array.isArray(data) ? data : [];
      setPeriods(rows);

      const ys = Array.from(new Set(rows.map((r) => (r.academic_year || "").trim()).filter(Boolean)));
      setYearOptions(ys);
    } catch (e) {
      setPeriods([]);
      setYearOptions([]);
      setLevelOptions([]);
      setTermOptions([]);
    }
  };

  const fetchCourses = async () => {
    if (!canLoad) return;
    setLoadingCourses(true);
    try {
      const qs =
        `faculty_id=${selectedFacultyId}` +
        `&department_id=${selectedDepartmentId}` +
        `&academic_year=${encodeURIComponent(academicYear.trim())}` +
        `&level_name=${encodeURIComponent(levelName.trim())}` +
        `&term_name=${encodeURIComponent(termName.trim())}` +
        `&program_type=${encodeURIComponent(programType)}` +
        (programType === "postgraduate"
          ? `&postgraduate_program=${encodeURIComponent(postgraduateProgram.trim())}`
          : "");

      const res = await fetch(`${API_BASE}/courses?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل تحميل المواد");
      setCourses(Array.isArray(data) ? data : []);
    } catch (e) {
      setCourses([]);
      toast(e.message || "مشكلة في تحميل المواد", "error");
    } finally {
      setLoadingCourses(false);
    }
  };

  const fetchSessions = async () => {
    if (!canLoad) return;
    setLoadingSessions(true);
    try {
      const qs =
        `faculty_id=${selectedFacultyId}` +
        `&department_id=${selectedDepartmentId}` +
        `&academic_year=${encodeURIComponent(academicYear.trim())}` +
        `&level_name=${encodeURIComponent(levelName.trim())}` +
        `&term_name=${encodeURIComponent(termName.trim())}` +
        `&program_type=${encodeURIComponent(programType)}` +
        (programType === "postgraduate"
          ? `&postgraduate_program=${encodeURIComponent(postgraduateProgram.trim())}`
          : "");

      const res = await fetch(`${API_BASE}/timetable-sessions?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل تحميل الجدول");
      setSessions(Array.isArray(data) ? data : []);
    } catch (e) {
      setSessions([]);
      toast(e.message || "مشكلة في تحميل الجدول", "error");
    } finally {
      setLoadingSessions(false);
    }
  };

  // ---------- selection handlers (للجدول فقط)
  const resetAfterDepartment = () => {
    setAcademicYear("");
    setLevelName("");
    setTermName("");
    setCourses([]);
    setSessions([]);
    setPeriods([]);
    setYearOptions([]);
    setLevelOptions([]);
    setTermOptions([]);
  };

  const resetSessionForm = () => {
    setEditingSessionId("");
    setCourseId("");
    setInstructorStaffId("");
    setInstructorDisplayName("");
    setRoomId("");
    setDayOfWeek("السبت");
    setStartTime("08:00");
    setEndTime("10:00");
  };

  const onSelectFaculty = (fid) => {
    setSelectedFacultyId(fid);
    setSelectedDepartmentId("");
    setDepartments([]);
    resetAfterDepartment();
    resetSessionForm();
    if (fid) fetchDepartmentsByFaculty(fid);
  };

  const onSelectDepartment = (did) => {
    setSelectedDepartmentId(did);
    resetAfterDepartment();
    resetSessionForm();
    if (did) fetchAcademicPeriods(programType, postgraduateProgram);
  };

  useEffect(() => {
    if (selectedDepartmentId) fetchAcademicPeriods(programType, postgraduateProgram);
  }, [programType, postgraduateProgram]);

  useEffect(() => {
    if (programType !== "postgraduate") setPostgraduateProgram("");
  }, [programType]);

  useEffect(() => {
    if (canLoad) {
      fetchCourses();
      fetchSessions();
    }
  }, [
    selectedFacultyId,
    selectedDepartmentId,
    academicYear,
    levelName,
    termName,
    programType,
    postgraduateProgram,
  ]);

  useEffect(() => {
    if (!courseId) {
      setInstructorStaffId("");
      setInstructorDisplayName("");
      return;
    }

    const c = (courses || []).find((x) => String(x.id) === String(courseId));
    if (!c) {
      setInstructorStaffId("");
      setInstructorDisplayName("");
      return;
    }

    const nameFromCourse = String(c.instructor || c.instructor_name || "").trim();
    setInstructorDisplayName(nameFromCourse);

    const possibleKeys = ["instructor_staff_id", "default_instructor_staff_id", "staff_id", "instructor_id", "teacher_id"];
    let foundId = "";
    for (const k of possibleKeys) {
      if (c[k] !== undefined && c[k] !== null && String(c[k]).trim() !== "") {
        foundId = String(c[k]);
        break;
      }
    }
    setInstructorStaffId(foundId);
  }, [courseId, courses]);

  // ---------- Rooms tab actions
  const addRoom = async () => {
    if (!newRoomName.trim()) return toast("اكتب اسم القاعة", "error");
    setAddingRoom(true);
    try {
      const res = await fetch(`${API_BASE}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: newRoomName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل إضافة القاعة");
      toast("تمت إضافة القاعة", "success");
      setNewRoomName("");
      fetchRooms();
    } catch (e) {
      toast(e.message || "مشكلة في إضافة القاعة", "error");
    } finally {
      setAddingRoom(false);
    }
  };

  const deleteRoom = async (id) => {
    if (!window.confirm("متأكد من حذف القاعة؟")) return;
    try {
      const res = await fetch(`${API_BASE}/rooms/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل حذف القاعة");
      toast("تم حذف القاعة", "success");
      fetchRooms();
    } catch (e) {
      toast(e.message || "مشكلة في حذف القاعة", "error");
    }
  };

  //  Edit room (PUT /api/rooms/:id)
  const saveRoomEdit = async (id, newName, done) => {
    const name = String(newName || "").trim();
    if (!name) return toast("لايمكن ان يكون اسم القاعه فارغ", "error");

    setSavingRoomId(String(id));
    try {
      const res = await fetch(`${API_BASE}/rooms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل تعديل القاعة");
      toast("تم تعديل القاعة", "success");
      done?.();
      fetchRooms();
    } catch (e) {
      toast(e.message || " يوجد مشكلة في تعديل القاعة", "error");
    } finally {
      setSavingRoomId("");
    }
  };

  /**  تجهيز الفورم للتعديل */
  const startEditSession = (s) => {
    if (!s?.id) return;
    setEditingSessionId(String(s.id));
    setCourseId(String(s.course_id || ""));
    setInstructorDisplayName(String(s.instructor_name || ""));
    setInstructorStaffId(s.instructor_staff_id ? String(s.instructor_staff_id) : "");
    setRoomId(String(s.room_id || ""));
    setDayOfWeek(String(s.day_of_week || "السبت"));
    setStartTime(String(s.start_time || "08:00").slice(0, 5));
    setEndTime(String(s.end_time || "10:00").slice(0, 5));


    setTimeout(() => formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleConflictIfAny = async (res) => {
    let data = {};
    try {
      data = await res.json();
    } catch (_) {}

    if (res.status === 409) {
      toast(data?.error || "تضارب: القاعة يوجد بها محاضرة أخرى في نفس الزمن", "error");
      return { ok: false, data };
    }
    if (!res.ok) {
      toast(data?.error || "حدث خطأ", "error");
      return { ok: false, data };
    }
    return { ok: true, data };
  };

  // ---------- create/update session
const saveSession = async () => {
  if (!canLoad) return toast("كمّل الاختيارات أولاً", "error");
  if (!courseId) return toast("اختار المادة", "error");
  if (!roomId) return toast("اختار القاعة", "error");
  if (!startTime || !endTime) return toast("اختار الزمن", "error");
  if (startTime >= endTime) return toast("زمن البداية لازم يكون قبل النهاية", "error");

  setSaving(true);
  try {
    const payload = {
      faculty_id: Number(selectedFacultyId),
      department_id: Number(selectedDepartmentId),
      academic_year: academicYear.trim(),
      level_name: levelName.trim(),
      term_name: termName.trim(),
      program_type: programType,
      postgraduate_program: programType === "postgraduate" ? postgraduateProgram.trim() : null,
      course_id: Number(courseId),
      instructor_staff_id: instructorStaffId ? Number(instructorStaffId) : null,
      instructor_name: instructorDisplayName || null,
      room_id: Number(roomId),
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
    };

    const isEdit = !!editingSessionId;

    const res = await fetch(
      isEdit
        ? `${API_BASE}/timetable-sessions/${editingSessionId}`
        : `${API_BASE}/timetable-sessions`,
      {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const { ok } = await handleConflictIfAny(res);
    if (!ok) return; 

    toast(isEdit ? "تم تعديل المحاضرة" : "تمت إضافة المحاضرة للجدول", "success");
    resetSessionForm();
    fetchSessions();
  } finally {
    setSaving(false);
  }
};


  const removeSession = async (id) => {
    if (!window.confirm("متأكد من حذف المحاضرة؟")) return;
    try {
      const res = await fetch(`${API_BASE}/timetable-sessions/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحذف");
      toast("تم حذف المحاضرة", "success");
      fetchSessions();
    } catch (e) {
      toast(e.message || "مشكلة في الحذف", "error");
    }
  };

  const sessionsByDay = useMemo(() => {
    const map = {};
    DAYS.forEach((d) => (map[d] = []));
    (Array.isArray(sessions) ? sessions : []).forEach((s) => {
      const d = s.day_of_week || "السبت";
      if (!map[d]) map[d] = [];
      map[d].push(s);
    });

    Object.keys(map).forEach((d) => {
      map[d].sort((a, b) => String(a.start_time || "").localeCompare(String(b.start_time || "")));
    });

    return map;
  }, [sessions]);

  const roomsFiltered = useMemo(() => {
    const q = String(roomSearch || "").trim().toLowerCase();
    const list = Array.isArray(rooms) ? rooms : [];
    const base = list.slice().sort((a, b) => String(a.room_name).localeCompare(String(b.room_name)));
    if (!q) return base;
    return base.filter((r) => String(r.room_name || "").toLowerCase().includes(q));
  }, [rooms, roomSearch]);

  return (
    <div className="admission-layout">
      {/*  Toast overlay */}
      {ToastView}

      <header className="library-header">
        <div className="library-header-title">
          <span> الجداول الدراسية</span>
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
          <div className="card" style={{ marginTop: 14 }}>
            <h2 className="card-title">إدارة الجداول الدراسية</h2>

            <div style={ui.tabsRow}>
              <button style={ui.tabBtn(activeTab === "schedule")} onClick={() => setActiveTab("schedule")}>
                الجدول
              </button>
              <button style={ui.tabBtn(activeTab === "rooms")} onClick={() => setActiveTab("rooms")}>
                القاعات
              </button>
            </div>

            {activeTab === "schedule" && (
              <div className="two-col-grid" style={{ marginBottom: 12 }}>
                <div className="input-group">
                  <label className="input-label">الكلية</label>
                  <select
                    className="input-field"
                    value={selectedFacultyId}
                    onChange={(e) => onSelectFaculty(e.target.value)}
                    disabled={loadingFaculties}
                  >
                    <option value="">{loadingFaculties ? "جارٍ تحميل الكليات..." : "— اختار —"}</option>
                    {(faculties || []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.faculty_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">القسم</label>
                  <select
                    className="input-field"
                    value={selectedDepartmentId}
                    onChange={(e) => onSelectDepartment(e.target.value)}
                    disabled={!canPickDepartment}
                  >
                    <option value="">{!canPickDepartment ? "اختار كلية أولاً" : "— اختار —"}</option>
                    {(departments || []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.department_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="input-label">نوع البرنامج</label>
                  <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                                        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                      <input
                        type="radio"
                        name="programTypeSchedule"
                        value="diploma"
                        checked={programType === "diploma"}
                        onChange={(e) => setProgramType(e.target.value)}
                        disabled={!selectedDepartmentId}
                      />
                      دبلوم
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                      <input
                        type="radio"
                        name="programTypeSchedule"
                        value="bachelor"
                        checked={programType === "bachelor"}
                        onChange={(e) => setProgramType(e.target.value)}
                        disabled={!selectedDepartmentId}
                      />
                      بكالوريوس
                    </label>

                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 700 }}>
                      <input
                        type="radio"
                        name="programTypeSchedule"
                        value="postgraduate"
                        checked={programType === "postgraduate"}
                        onChange={(e) => setProgramType(e.target.value)}
                        disabled={!selectedDepartmentId}
                      />
                      دراسات عليا
                    </label>
                  </div>
                </div>

{programType === "postgraduate" && (
  <div className="input-group" style={{ gridColumn: "1 / -1" }}>
    <label className="input-label">اسم برنامج الدراسات العليا</label>
    <input
      className="input-field"
      dir="rtl"
      list="postgrad_programs_list"
      placeholder="مثال: ماجستير إدارة أعمال"
      value={postgraduateProgram}
      onChange={(e) => setPostgraduateProgram(e.target.value)}
      disabled={!selectedDepartmentId}
    />
    <datalist id="postgrad_programs_list">
      {pgSmart.programs.map((prog, idx) => (
        <option key={idx} value={prog} />
      ))}
    </datalist>
  </div>
)}

                <div className="input-group">
                  <label className="input-label">السنة الدراسية</label>
                  <input
                    className="input-field"
                    dir="rtl"
                    list="schedule_years"
                    placeholder="مثال: 2024/2025"
                    value={academicYear}
                    onChange={(e) => {
                      setAcademicYear(e.target.value);
                      setLevelName("");
                      setTermName("");
                      setCourses([]);
                      setSessions([]);
                      resetSessionForm();
                    }}
                    disabled={!canPickYear}
                  />
                  <datalist id="schedule_years">{(yearOptions || []).map((x) => <option key={x} value={x} />)}</datalist>
                </div>

                <div className="input-group">
                  <label className="input-label">المستوى</label>
                  <input
                    className="input-field"
                    dir="rtl"
                    list="schedule_levels"
                    placeholder="مثال: المستوى الأول"
                    value={levelName}
                    onChange={(e) => {
                      setLevelName(e.target.value);
                      setTermName("");
                      setCourses([]);
                      setSessions([]);
                      resetSessionForm();
                    }}
                    disabled={!canPickLevel}
                  />
                  <datalist id="schedule_levels">{(levelOptions || []).map((x) => <option key={x} value={x} />)}</datalist>
                </div>

                <div className="input-group">
                  <label className="input-label">الفصل الدراسي</label>
                  <input
                    className="input-field"
                    dir="rtl"
                    list="schedule_terms"
                    placeholder="مثال: الفصل الأول"
                    value={termName}
                    onChange={(e) => {
                      setTermName(e.target.value);
                      resetSessionForm();
                    }}
                    disabled={!canPickTerm}
                  />
                  <datalist id="schedule_terms">{(termOptions || []).map((x) => <option key={x} value={x} />)}</datalist>
                </div>
                    <div style={{ marginTop: 20, textAlign: "center" }}>
      <button
        className="btn btn-primary"
        onClick={handlePrint}
        disabled={!sessions.length || loadingSessions}
        style={{ padding: "12px 30px", fontSize: "16px" }}
      >
        طباعة الجدول
      </button>
    </div>
              </div>
            )}

            {/* SCHEDULE TAB */}
            {activeTab === "schedule" && (
              <>
                <div ref={formTopRef} className="card" style={{ padding: 14, background: "#fff", marginBottom: 12 }}>
                  <h3 style={{ margin: "0 0 12px" }}>
                    {editingSessionId ? "تعديل محاضرة" : "إضافة محاضرة للجدول"}
                  </h3>
                  <div className="two-col-grid" style={{ alignItems: "flex-end" }}>
                    <div className="input-group">
                      <label className="input-label">المادة</label>
                      <select
                        className="input-field"
                        value={courseId}
                        onChange={(e) => setCourseId(e.target.value)}
                        disabled={!canLoad || loadingCourses}
                      >
                        <option value="">
                          {!canLoad ? "كمّل الفلاتر أولاً" : loadingCourses ? "جارٍ تحميل..." : "— اختار —"}
                        </option>
                        {(courses || []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.course_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">الأستاذ</label>
                      <input className="input-field" dir="rtl" value={instructorDisplayName || "—"} readOnly disabled={!courseId} />
                    </div>

                    <div className="input-group">
                      <label className="input-label">القاعة</label>
                      <RoomSearchSelect rooms={rooms} value={roomId} onChange={(id) => setRoomId(id)} disabled={loadingRooms} />
                    </div>

                    <div className="input-group">
                      <label className="input-label">اليوم</label>
                      <select className="input-field" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} disabled={!canLoad}>
                        {DAYS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="input-group">
                      <label className="input-label">من</label>
                      <input className="input-field" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={!canLoad} />
                    </div>

                    <div className="input-group">
                      <label className="input-label">إلى</label>
                      <input className="input-field" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!canLoad} />
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="btn btn-primary" onClick={saveSession} disabled={!canLoad || saving}>
                        {saving ? "جاري الحفظ..." : editingSessionId ? "حفظ التعديل" : "إضافة محاضرة"}
                      </button>

                      {editingSessionId && (
                        <button className="btn" onClick={resetSessionForm} disabled={saving}>
                          إلغاء التعديل
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {!canLoad ? (
                  <p style={{ color: "#6b7280" }}>اكمل الاختيارات  لعرض الجدول.</p>
                ) : loadingSessions ? (
                  <p>جارٍ تحميل الجدول...</p>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {DAYS.map((d) => (
                      <div key={d} className="card" style={{ padding: 14, background: "#fff" }}>
                        <div style={{ fontWeight: 900, marginBottom: 10 }}>{d}</div>

                        {sessionsByDay[d]?.length ? (
                          <div style={{ overflowX: "auto" }}>
                            <table className="simple-table" style={{ width: "100%" }}>
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>الزمن</th>
                                  <th>المادة</th>
                                  <th>الأستاذ</th>
                                  <th>القاعة</th>
                                  <th>إجراء</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sessionsByDay[d].map((s, idx) => (
                                  <tr key={s.id}>
                                    <td>{idx + 1}</td>
                                    <td style={{ whiteSpace: "nowrap" }}>
                                      {String(s.start_time || "").slice(0, 5)} - {String(s.end_time || "").slice(0, 5)}
                                    </td>
                                    <td>{s.course_name || `#${s.course_id}`}</td>
                                    <td>{s.instructor_name || "—"}</td>
                                    <td>{s.room_name || `#${s.room_id}`}</td>
                                    <td style={{ whiteSpace: "nowrap" }}>
                                      <button
                                        className="btn btn-small"
                                        onClick={() => startEditSession(s)}
                                        style={{ marginInlineEnd: 8 }}
                                      >
                                        تعديل
                                      </button>
                                      <button className="btn btn-danger btn-small" onClick={() => removeSession(s.id)}>
                                        حذف
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ color: "#6b7280", fontWeight: 700 }}>لايوجد محاضرة</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ROOMS TAB */}
            {activeTab === "rooms" && (
              <div className="card" style={{ padding: 14, background: "#fff", marginBottom: 12 }}>
                <h3 style={{ margin: "0 0 12px" }}>إدارة القاعات</h3>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label">اسم القاعة</label>
                    <input
                      className="input-field"
                      dir="rtl"
                      placeholder="مثال: قاعة 1"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      style={{ minWidth: 240 }}
                    />
                  </div>

                  <button className="btn btn-primary" onClick={addRoom} disabled={addingRoom}>
                    {addingRoom ? "جاري الإضافة..." : "إضافة قاعة"}
                  </button>

                  <div className="input-group" style={{ margin: 0 }}>
                    {/* <label className="input-label"> ابحث عن قاعة</label> */}
                    <input
                      className="input-field"
                      dir="rtl"
                      placeholder="ابحث باسم القاعة..."
                      value={roomSearch}
                      onChange={(e) => setRoomSearch(e.target.value)}
                      style={{ minWidth: 260}}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  {loadingRooms ? (
                    <p>جارٍ تحميل القاعات...</p>
                  ) : roomsFiltered?.length ? (
                    <div style={{ overflowX: "auto" }}>
                      <table className="simple-table" style={{ width: "100%" }}>
                        <thead>
                          <tr>
                            <th style={{ width: 70 }}>#</th>
                            <th>اسم القاعة</th>
                            <th style={{ width: 220 }}>إجراء</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roomsFiltered.map((r, idx) => (
                            <RoomRow
                              key={r.id}
                              r={r}
                              idx={idx}
                              savingId={savingRoomId}
                              onDelete={deleteRoom}
                              onSaveEdit={saveRoomEdit}
                            />
                          ))}
                        </tbody>
                      </table>

                      <div style={{ marginTop: 10, color: "#6b7280", fontWeight: 700 }}>
                        العدد: {roomsFiltered.length} {roomSearch.trim() ? "(بعد البحث)" : ""}
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: "#6b7280", fontWeight: 700 }}>لا توجد قاعات.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
