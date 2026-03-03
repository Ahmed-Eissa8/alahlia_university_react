const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
require('dotenv').config();
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');   
const crypto = require("crypto");
const jwt = require('jsonwebtoken');
const DEFAULT_REGISTRAR = "";

const JWT_SECRET = crypto.randomBytes(48).toString("base64url");
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, res, next) => {
    console.log("REQ:", req.method, req.url);
    next();
});

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '0000',
    database: process.env.DB_NAME || 'university_db'
});
const dbp = db.promise();
// Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });


function buildFileUrl(req, filename) {
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}

// Middleware للتحقق من التوكن 
function authMiddleware(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;  
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

function buildFileUrl(req, filename) {
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}


function termOrder(t) {
  const x = (t || "").toString().trim();
  if (x === "فصل الأول" || x === "الفصل الأول") return 1;
  if (x === "فصل الثاني" || x === "الفصل الثاني") return 2;
  return 0;
}

function parseAcademicYear(y) {
  const m = (y || "").toString().match(/(\d{4})\s*\/\s*(\d{4})/);
  if (!m) return [0, 0];
  return [Number(m[1]), Number(m[2])];
}

function parseLevelNumber(levelName) {
  const s = (levelName || "").toString().trim();

  const m = s.match(/(\d+)/);
  if (m) return Number(m[1]);

  const map = {
    "الأول": 1, "اول": 1,
    "الثاني": 2,
    "الثالث": 3,
    "الرابع": 4,
    "الخامس": 5,
    "السادس": 6,
    "السابع": 7,
    "الثامن": 8,
    "التاسع": 9,
    "العاشر": 10,
  };

  for (const k of Object.keys(map)) {
    if (s.includes(k)) return map[k];
  }

  return 0;
}


function comparePeriods(a, b) {
  const [a1, a2] = parseAcademicYear(a.academic_year);
  const [b1, b2] = parseAcademicYear(b.academic_year);

  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;

  const al = parseLevelNumber(a.level_name);
  const bl = parseLevelNumber(b.level_name);
  if (al !== bl) return al - bl;

  return termOrder(a.term_name) - termOrder(b.term_name);
}


function parseAcademicYear(y) {
  const m = (y || "").toString().match(/(\d{4})\s*\/\s*(\d{4})/);
  if (!m) return [0, 0];
  return [Number(m[1]), Number(m[2])];
}

function parseLevelNumber(levelName) {
  const m = (levelName || "").toString().match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function comparePeriods(a, b) {
  const [a1, a2] = parseAcademicYear(a.academic_year);
  const [b1, b2] = parseAcademicYear(b.academic_year);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;

  const al = parseLevelNumber(a.level_name);
  const bl = parseLevelNumber(b.level_name);
  if (al !== bl) return al - bl;

  return termOrder(a.term_name) - termOrder(b.term_name);
}


function inferProgramModeFromRules(programType, rules) {
  if ((programType || "undergraduate").trim() === "postgraduate") return "general";

  const hasHonors = Array.isArray(rules?.classifications?.honors) && rules.classifications.honors.length > 0;
  const hasGeneral = Array.isArray(rules?.classifications?.general) && rules.classifications.general.length > 0;

  if (hasHonors) return "honors";
  if (hasGeneral) return "general";
  return "honors";
}


app.get("/api/library/faculties", (req, res) => {
  const sql = `SELECT id, faculty_name FROM faculties ORDER BY faculty_name`;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("LIB FACULTIES ERROR:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});


// جلب التصنيفات  ( descriptions)
app.get("/api/book-categories", async (req, res) => {
  try {
    const [rows] = await dbp.query(`
      SELECT DISTINCT description 
      FROM books 
      WHERE description IS NOT NULL AND description != ''
      ORDER BY description ASC
    `);
    res.json(rows.map(r => r.description));  // رجع array من التصنيفات
  } catch (err) {
    console.error("Book categories error:", err);
    res.status(500).json({ error: "خطأ في جلب التصنيفات" });
  }
});

// جلب الكتب حسب تصنيف مع ترتيب بالكميات
app.get("/api/books-by-category", async (req, res) => {
  const { category } = req.query;
  if (!category) return res.status(400).json({ error: "التصنيف مطلوب" });

  try {
    const [rows] = await dbp.query(`
      SELECT b.id, b.title, b.author, b.copies, b.location, f.faculty_name
      FROM books b
      LEFT JOIN faculties f ON b.faculty_id = f.id
      WHERE b.description = ?
      ORDER BY b.copies DESC  -- مرتب تنازلي بالكميات
    `, [category]);
    res.json(rows);
  } catch (err) {
    console.error("Books by category error:", err);
    res.status(500).json({ error: "خطأ في جلب الكتب" });
  }
});

// تقرير الكتب المستعارة مع تفاصيل الطالب
app.get("/api/borrowed-books-report", async (req, res) => {
  try {
    const [rows] = await dbp.query(`
      SELECT 
        bb.id AS borrow_id,
        b.title AS book_title,
        s.full_name AS student_name,
        s.university_id AS student_university_id,
        f.faculty_name AS faculty_name,
        d.department_name AS department_name,
        bb.borrowed_at
      FROM borrowed_books bb
      LEFT JOIN books b ON bb.book_id = b.id
      LEFT JOIN students s ON bb.student_id = s.university_id   -- ← غيرنا هنا من s.id إلى s.university_id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN faculties f ON d.faculty_id = f.id
      WHERE bb.returned_at IS NULL
      ORDER BY bb.borrowed_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("Borrowed books report error:", err);
    res.status(500).json({ error: "خطأ في جلب التقرير", details: err.message });
  }
});



// Add book
app.post("/api/books", upload.single("pdf"), (req, res) => {
  const { title, description, author, faculty_id, location, copies } = req.body;

  let pdfUrl = "";
  let isPdf = 0;
  if (req.file) {
    pdfUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    isPdf = 1;
  }

  const sql = `
    INSERT INTO books
      (title, description, author, faculty_id, location, pdf_url, is_pdf, copies)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      title || "",
      description || "",
      author || "",
      faculty_id ? Number(faculty_id) : null,
      location || "",
      pdfUrl,
      isPdf,
      copies ? Number(copies) : 1,
    ],
    (err) => {
      if (err) {
        console.error("ADD BOOK ERROR:", err);
        return res.status(500).json({ message: "Database error" });
      }
      res.json({ message: "Book added successfully" });
    }
  );
});





// List books
app.get("/api/books", (req, res) => {
  const search = (req.query.search || "").trim();
  const facultyId = req.query.faculty_id ? Number(req.query.faculty_id) : null;

  let sql = `
    SELECT
      b.*,
      f.faculty_name
    FROM books b
    LEFT JOIN faculties f ON f.id = b.faculty_id
    WHERE 1=1
  `;
  const params = [];

  if (facultyId) {
    sql += ` AND b.faculty_id = ? `;
    params.push(facultyId);
  }

  if (search) {
    const like = `%${search}%`;
    sql += `
      AND (
        b.title LIKE ?
        OR b.author LIKE ?
        OR b.description LIKE ?
        OR f.faculty_name LIKE ?
      )
    `;
    params.push(like, like, like, like);
  }

  sql += " ORDER BY b.id DESC";

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("LIST BOOKS ERROR:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});


app.get('/api/faculties', (req, res) => {
  const sql = "SELECT DISTINCT faculty FROM books WHERE faculty IS NOT NULL AND faculty != ''";

  db.query(sql, (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json(result.map(r => r.faculty));
  });
});


// Edit book
app.put("/api/books/:id", upload.single("pdf"), (req, res) => {
  const bookId = Number(req.params.id);
  const { title, description, author, faculty_id, location, copies } = req.body;

  let pdfUrl = "";
  let isPdf = 0;

  if (req.file) {
    pdfUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    isPdf = 1;
  }

  let sql, params;

  if (req.file) {
    sql = `
      UPDATE books
      SET
        title = ?, description = ?, author = ?,
        faculty_id = ?, location = ?,
        pdf_url = ?, is_pdf = ?, copies = ?
      WHERE id = ?
    `;
    params = [
      title || "",
      description || "",
      author || "",
      faculty_id ? Number(faculty_id) : null,
      location || "",
      pdfUrl,
      isPdf,
      copies ? Number(copies) : 1,
      bookId,
    ];
  } else {
    sql = `
      UPDATE books
      SET
        title = ?, description = ?, author = ?,
        faculty_id = ?, location = ?, copies = ?
      WHERE id = ?
    `;
    params = [
      title || "",
      description || "",
      author || "",
      faculty_id ? Number(faculty_id) : null,
      location || "",
      copies ? Number(copies) : 1,
      bookId,
    ];
  }

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("EDIT BOOK ERROR:", err);
      return res.status(500).json({ message: "Database error" });
    }
    if (result.affectedRows === 0) return res.status(404).json({ message: "Book not found" });

    res.json({ message: "Book updated successfully" });
  });
});



// Delete book
app.delete('/api/books/:id', (req, res) => {
  const bookId = req.params.id;

  const sql = "DELETE FROM books WHERE id = ?";
  db.query(sql, [bookId], (err, result) => {
    if (err) {
      console.log("MYSQL ERROR:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json({ message: "Book deleted successfully" });
  });
});

// البحث عن طالب بالرقم الجامعي
app.get("/api/library/student-by-uni", async (req, res) => {
  try {
    const uni = (req.query.university_id || "").trim();
    if (!uni) return res.status(400).json({ error: "university_id مطلوب" });

    const [rows] = await dbp.query(
      `SELECT id, full_name, university_id
       FROM students
       WHERE university_id = ?
       LIMIT 1`,
      [uni]
    );

    if (rows.length === 0) return res.status(404).json({ error: "الطالب غير موجود" });
    res.json(rows[0]);
  } catch (e) {
    console.error("LOOKUP STUDENT ERROR:", e);
    res.status(500).json({ error: "Database error" });
  }
});


// استعار كتاب
app.post("/api/borrow/:id", async (req, res) => {
  try {
    const bookId = Number(req.params.id);
    const uni = (req.body.student_id || "").trim();

    if (!bookId || !uni) {
      return res.status(400).json({ error: "book_id و student_id مطلوبين" });
    }

    // 1)  الطالب
    const [stRows] = await dbp.query(
      `SELECT full_name, university_id FROM students WHERE university_id = ? LIMIT 1`,
      [uni]
    );
    if (stRows.length === 0) return res.status(404).json({ error: "الطالب غير موجود" });

    const studentName = stRows[0].full_name;

    // 2)  الكتاب + تحقق النسخ +  اسم الكلية
    const [bookRows] = await dbp.query(
      `
      SELECT b.copies, f.faculty_name
      FROM books b
      LEFT JOIN faculties f ON f.id = b.faculty_id
      WHERE b.id = ?
      LIMIT 1
      `,
      [bookId]
    );

    if (bookRows.length === 0) return res.status(404).json({ error: "الكتاب غير موجود" });
    if (Number(bookRows[0].copies) <= 0) return res.status(400).json({ error: "لا توجد نسخ متاحة" });

    //  2.5) تحقق من استعارة نشطة لنفس الطالب ونفس الكتاب
    const [activeBorrow] = await dbp.query(
      `
      SELECT id
      FROM borrowed_books
      WHERE book_id = ? AND student_id = ? AND returned_at IS NULL
      LIMIT 1
      `,
      [bookId, uni]
    );
    if (activeBorrow.length > 0) {
      return res.status(400).json({ error: "الطالب مستعير هذا الكتاب بالفعل" });
    }

    // 3) انقص نسخة
    const [upd] = await dbp.query(
      `UPDATE books SET copies = copies - 1 WHERE id = ? AND copies > 0`,
      [bookId]
    );
    if (upd.affectedRows === 0) return res.status(400).json({ error: "لا توجد نسخ متاحة" });

    // 4) سجل الاستعارة
    await dbp.query(
      `
      INSERT INTO borrowed_books (book_id, student_id, student_name, faculty)
      VALUES (?, ?, ?, ?)
      `,
      [bookId, uni, studentName, bookRows[0].faculty_name || null]
    );

    res.json({ message: "تم استعارة الكتاب بنجاح", student_name: studentName });
  } catch (e) {
    console.error("BORROW ERROR:", e);
    res.status(500).json({ error: "Database error" });
  }
});


// Route to delete the borrowing record
app.delete("/api/borrow/delete", async (req, res) => {
    const { book_id, student_id } = req.body;

    if (!book_id || !student_id) {
        return res.status(400).json({ error: "book_id and student_id are required" });
    }

    try {
        // Delete the borrowing record
        const deleteSql = `
            DELETE FROM borrowed_books
            WHERE book_id = ? AND student_id = ?
        `;
        db.query(deleteSql, [book_id, student_id], (err, result) => {
            if (err) {
                console.error("MYSQL ERROR (delete borrow record):", err);
                return res.status(500).json({ message: "Database error" });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Borrowing record not found" });
            }

            res.json({ message: "Borrowing record deleted successfully" });
        });
    } catch (e) {
        console.error("BORROW RECORD DELETE ERROR:", e);
        res.status(500).json({ error: "Database error" });
    }
});


// إرجاع كتاب
app.post('/api/return/:id', (req, res) => {
  const bookId = req.params.id;
  const { student_id } = req.body;

  if (!student_id) {
    return res.status(400).json({ error: "student_id مطلوب" });
  }

  // 1) لقِ أقرب استعارة لنفس الطالب لسه ما اتقفلت
  const updateBorrowSql = `
    UPDATE borrowed_books
    SET returned_at = NOW()
    WHERE book_id = ? AND student_id = ? AND returned_at IS NULL
    ORDER BY borrowed_at ASC
    LIMIT 1
  `;

  db.query(updateBorrowSql, [bookId, student_id], (err, result) => {
    if (err) {
      console.error("RETURN UPDATE BORROW ERROR:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: "لا توجد استعارة نشطة لهذا الطالب" });
    }

    // 2) زوِّد نسخة في books.copies
    const updateCopiesSql = `
      UPDATE books
      SET copies = copies + 1
      WHERE id = ?
    `;

    db.query(updateCopiesSql, [bookId], (err2, result2) => {
      if (err2) {
        console.error("RETURN UPDATE COPIES ERROR:", err2);
        return res.status(500).json({ error: "Database error" });
      }

      res.json({ message: "تم إرجاع الكتاب بنجاح" });
    });
  });
});

// تحقق هل الطالب مستعير الكتاب حالياً (استعارة نشطة)
app.get("/api/borrow/check", async (req, res) => {
  try {
    const bookId = Number(req.query.book_id);
    const uni = (req.query.student_id || "").trim();

    if (!bookId || !uni) {
      return res.status(400).json({ error: "book_id و student_id مطلوبين" });
    }

    const [rows] = await dbp.query(
      `
      SELECT id, borrowed_at
      FROM borrowed_books
      WHERE book_id = ? AND student_id = ? AND returned_at IS NULL
      ORDER BY borrowed_at DESC
      LIMIT 1
      `,
      [bookId, uni]
    );

    if (rows.length === 0) {
      return res.json({ active: false });
    }

    return res.json({ active: true, borrowed_at: rows[0].borrowed_at });
  } catch (e) {
    console.error("BORROW CHECK ERROR:", e);
    return res.status(500).json({ error: "Database error" });
  }
});



// قائمة الكليات (مع عدد الأقسام لكل كلية)
app.get("/api/faculties-list", (req, res) => {
  const sql = `
    SELECT 
      f.id, 
      f.faculty_name,
      f.faculty_type,
      COUNT(d.id) AS departments_count
    FROM faculties f
    LEFT JOIN departments d ON d.faculty_id = f.id
    GROUP BY f.id, f.faculty_name, f.faculty_type
    ORDER BY f.faculty_name
  `;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("FACULTIES LIST ERROR:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

// إضافة كلية
app.post("/api/faculties", async (req, res) => {
  const { faculty_name, faculty_type = 'theoretical' } = req.body;

  if (!faculty_name?.trim()) {
    return res.status(400).json({ error: "اسم الكلية مطلوب" });
  }

  try {
    const [result] = await dbp.query(
      "INSERT INTO faculties (faculty_name, faculty_type) VALUES (?, ?)",
      [faculty_name.trim(), faculty_type]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("Add faculty error:", err);
    res.status(500).json({ error: "خطأ في إضافة الكلية" });
  }
});

app.put("/api/faculties/:id", async (req, res) => {
  const { id } = req.params;
  const { faculty_name, faculty_type } = req.body;

  if (!faculty_name?.trim()) {
    return res.status(400).json({ error: "اسم الكلية مطلوب" });
  }

  try {
    const [result] = await dbp.query(
      "UPDATE faculties SET faculty_name = ?, faculty_type = ? WHERE id = ?",
      [faculty_name.trim(), faculty_type || 'theoretical', id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "الكلية غير موجودة" });
    }

    res.json({ success: true, message: "تم تعديل الكلية" });
  } catch (err) {
    console.error("Update faculty error:", err);
    res.status(500).json({ error: "خطأ في تعديل الكلية" });
  }
});

// تعديل كلية
app.put("/api/faculties/:id", (req, res) => {
  const { id } = req.params;
  const { faculty_name } = req.body;

  if (!faculty_name || !faculty_name.trim()) {
    return res.status(400).json({ error: "اسم الكلية مطلوب" });
  }

  const sql = "UPDATE faculties SET faculty_name = ?, faculty_type = ? WHERE id = ?";
  db.query(sql, [faculty_name.trim(), req.body.faculty_type || 'theoretical', id], (err, result) => {
    if (err) {
      console.error("UPDATE FACULTY ERROR:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "الكلية غير موجودة" });
    }
    res.json({ message: "تم تعديل الكلية بنجاح" });
  });
});

// حذف كلية (تلقائياً يحذف أقسامها بسبب ON DELETE CASCADE)
app.delete("/api/faculties/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM faculties WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("DELETE FACULTY ERROR:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "الكلية غير موجودة" });
    }
    res.json({ message: "تم حذف الكلية بنجاح" });
  });
});


// جلب الأقسام لكلية معينة
app.get("/api/departments/:facultyId", async (req, res) => {
  const { facultyId } = req.params;
  try {
    const [rows] = await dbp.query(
      "SELECT id, department_name, levels_count FROM departments WHERE faculty_id = ?",
      [facultyId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "خطأ في جلب الأقسام" });
  }
});

// إضافة قسم
app.post("/api/departments", async (req, res) => {
  const { faculty_id, department_name, levels_count = 4 } = req.body;  
  try {
    const [result] = await dbp.query(
      "INSERT INTO departments (faculty_id, department_name, levels_count) VALUES (?, ?, ?)",
      [faculty_id, department_name, levels_count]
    );
    res.json({ id: result.insertId, faculty_id, department_name, levels_count });
  } catch (err) {
    res.status(500).json({ error: "خطأ في إضافة القسم" });
  }
});

// تعديل قسم
app.put("/api/departments/:id", async (req, res) => {
  const { id } = req.params;
  const { department_name, levels_count } = req.body; 
  try {
    await dbp.query(
      "UPDATE departments SET department_name = ?, levels_count = ? WHERE id = ?",
      [department_name, levels_count, id]
    );
    res.json({ message: "تم التعديل" });
  } catch (err) {
    res.status(500).json({ error: "خطأ في التعديل" });
  }
});

// حذف قسم
app.delete("/api/departments/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM departments WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("DELETE DEPARTMENT ERROR:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "القسم غير موجود" });
    }
    res.json({ message: "تم حذف القسم بنجاح" });
  });
});



app.post("/add", (req, res) => {
  const data = req.body;

  const sql = `
    INSERT INTO students 
    (full_name, university_id, phone, receipt_number, college, level, academic_year, academic_status, registration_status, notes, registrar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [
    data.full_name,
    data.university_id || 0,
    data.phone,
    data.receipt_number,
    data.college,
    data.level,
    data.academic_year,
    data.academic_status,
    data.registration_status,
    data.notes,
    data.registrar
  ], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Student added successfully" });
  });
});

// إحصائيات الداشبورد
app.get("/stats", (req, res) => {
  db.query(`
      SELECT 
      (SELECT COUNT(*) FROM students WHERE DATE(created_at) = CURDATE()) AS today_students,
      (SELECT COUNT(*) FROM students) AS total_students,
      (SELECT COUNT(*) FROM students WHERE DATE(created_at) = CURDATE()) AS todays_updates
  `, (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows[0]);
  });
});


/* =========================================================
   (students) – إضافة + بحث + عرض طالب
   ========================================================= */

// إضافة طالب جديد 
app.put("/api/students/:id", async (req, res) => {
  try {
    const studentId = req.params.id;
    const { full_name, university_id, phone, department_id } = req.body;

    const name = (full_name || "").trim();
    if (!name) {
      return res.status(400).json({ message: "الاسم الرباعي مطلوب" });
    }

    const uniIdRaw = (university_id ?? "").toString().trim();
const uniId = uniIdRaw === "" ? "0" : uniIdRaw;   


    //  تحقق من تكرار الرقم الجامعي (لو ما 0)
    if (uniId && uniId !== "0") {
      const [rows] = await dbp.query(
        "SELECT id FROM students WHERE university_id = ? AND id <> ? LIMIT 1",
        [uniId, studentId]
      );

      if (rows.length > 0) {
        return res.status(409).json({ message: "الرقم الجامعي مستخدم من قبل طالب آخر" });
      }
    }

    const [result] = await dbp.query(
      `
      UPDATE students
      SET full_name = ?, university_id = ?, phone = ?, department_id = ?
      WHERE id = ?
      `,
      [name, uniId || "0", phone || null, department_id || null, studentId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "الطالب غير موجود" });
    }

    return res.json({ message: "تم تحديث بيانات الطالب" });
  } catch (e) {
    console.error("UPDATE STUDENT ERROR:", e);
    return res.status(500).json({ message: e.message });
  }
});



// البحث عن الطلاب بالاسم أو الرقم الجامعي
app.get('/api/students/search', (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) return res.json([]);

  const like = `%${q.trim()}%`;

  const sql = `
    SELECT
      s.*,
      d.department_name,
      f.faculty_name,

      -- آخر تسجيل (اختياري لكن مفيد)
      lr.academic_year      AS last_academic_year,
      lr.level_name         AS last_level_name,
      lr.term_name          AS last_term_name,
      lr.academic_status    AS last_academic_status,
      lr.registration_status AS last_registration_status,
      lr.program_type       AS last_program_type,
      lr.postgraduate_program AS last_postgraduate_program

    FROM students s
    LEFT JOIN departments d ON d.id = s.department_id
    LEFT JOIN faculties f ON f.id = d.faculty_id

    LEFT JOIN (
      SELECT sr1.*
      FROM student_registrations sr1
      JOIN (
        SELECT student_id, MAX(id) AS max_id
        FROM student_registrations
        GROUP BY student_id
      ) x ON x.max_id = sr1.id
    ) lr ON lr.student_id = s.id

    WHERE
      s.full_name LIKE ?
      OR CAST(s.university_id AS CHAR) LIKE ?
      OR CAST(s.phone AS CHAR) LIKE ?
      OR d.department_name LIKE ?
      OR f.faculty_name LIKE ?

    ORDER BY s.full_name
    LIMIT 100
  `;

  db.query(sql, [like, like, like, like, like], (err, rows) => {
    if (err) {
      console.log("MYSQL ERROR (search students full):", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(rows);
  });
});


// جلب بيانات طالب + آخر تسجيل ليه
app.get("/api/students/:id", (req, res) => {
  const studentId = req.params.id;

  // const sqlStudent = `
  //   SELECT s.*, d.department_name, f.faculty_name
  //   FROM students s
  //   LEFT JOIN departments d ON d.id = s.department_id
  //   LEFT JOIN faculties f ON f.id = d.faculty_id
  //   WHERE s.id = ?
  // `;
  const sqlStudent = `
  SELECT s.*, d.department_name, d.faculty_id, f.faculty_name
  FROM students s
  LEFT JOIN departments d ON d.id = s.department_id
  LEFT JOIN faculties f ON f.id = d.faculty_id
  WHERE s.id = ?
`;


  const sqlLastReg = `
    SELECT *
    FROM student_registrations
    WHERE student_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;

  db.query(sqlStudent, [studentId], (err, rowsStudent) => {
    if (err) {
      console.log("MYSQL ERROR (get student):", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (!rowsStudent || rowsStudent.length === 0) {
      return res.status(404).json({ message: "الطالب غير موجود" });
    }

    db.query(sqlLastReg, [studentId], (err2, rowsReg) => {
      if (err2) {
        console.log("MYSQL ERROR (last registration):", err2);
        return res.status(500).json({ message: "Database error" });
      }

      const lastReg = rowsReg && rowsReg.length ? rowsReg[0] : null;

      if (lastReg && lastReg.postgraduate_data) {
        try {
          lastReg.postgraduate_data = JSON.parse(lastReg.postgraduate_data);
        } catch (e) {
          lastReg.postgraduate_data = null;
        }
      }

      return res.json({
        student: rowsStudent[0],
        lastRegistration: lastReg,
      });
    });
  });
});


app.post("/api/registrations", async (req, res) => {
  const registrar = req.user?.username || DEFAULT_REGISTRAR;
  const {
    student_id,
    academic_year,
    level_name,
    term_name,             
    academic_status,
    registration_status,
    notes,
    program_type,           // diploma | bachelor | postgraduate
    postgraduate_data,     
    postgraduate_program, 
  } = req.body;

  // ──── التحقق  من program_type 
  const validProgramTypes = ['diploma', 'bachelor', 'postgraduate'];
  if (!program_type || !validProgramTypes.includes(program_type)) {
    return res.status(400).json({
      message: `نوع البرنامج غير صالح. القيم المسموح بها: ${validProgramTypes.join(', ')}`
    });
  }

  const programType = program_type.trim();

  const year = (academic_year || "").toString().trim();
  const level = (level_name || "").toString().trim();
  const term = (term_name || "").toString().trim(); 

  const pgProgram = programType === 'postgraduate' ? (postgraduate_program || "").trim() || null : null;

  if (!student_id || !year || !level || !term) {
    return res.status(400).json({
      message: "الحقول التالية مطلوبة: student_id, academic_year, level_name, term_name"
    });
  }

  if (programType === 'postgraduate' && !pgProgram) {
    return res.status(400).json({
      message: "postgraduate_program مطلوب عند اختيار نوع البرنامج postgraduate"
    });
  }

  // ────   منع التسجيل في فترة أقدم أو نفس آخر تسجيل ─────
  const lastSql = `
    SELECT academic_year, level_name, term_name
    FROM student_registrations
    WHERE student_id = ?
      AND program_type = ?
      AND (postgraduate_program <=> ?)
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;

  db.query(lastSql, [student_id, programType, pgProgram], (lastErr, lastRows) => {
    if (lastErr) {
      console.error("خطأ في جلب آخر تسجيل:", lastErr);
      return res.status(500).json({ message: "خطأ في السيرفر (جلب آخر تسجيل)" });
    }

    const last = lastRows.length > 0 ? lastRows[0] : null;

    if (last) {
      const reqPeriod = { academic_year: year, level_name: level, term_name: term };
      const lastPeriod = {
        academic_year: last.academic_year,
        level_name: last.level_name,
        term_name: last.term_name,
      };

      if (comparePeriods(reqPeriod, lastPeriod) <= 0) {
        return res.status(400).json({
          message: `لا يمكن التسجيل في فترة سابقة أو نفس آخر تسجيل. آخر تسجيل: ${last.academic_year} - ${last.level_name} - ${last.term_name}`
        });
      }
    }

    // ────  حفظ/تثبيت الفترة الأكاديمية ─────
    const upsertPeriodSql = `
      INSERT INTO academic_periods
        (academic_year, level_name, term_name, program_type, postgraduate_program)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE id = id
    `;

    db.query(
      upsertPeriodSql,
      [year, level, term, programType, pgProgram],
      (periodErr) => {
        if (periodErr) {
          console.error("خطأ في حفظ الفترة الأكاديمية:", periodErr);
          return res.status(500).json({ message: "خطأ في حفظ الفترة الأكاديمية" });
        }

        // ──── التحقق هل في تسجيل موجود بنفس الفترة ─────
        const checkSql = `
          SELECT id
          FROM student_registrations
          WHERE student_id = ?
            AND academic_year = ?
            AND level_name = ?
            AND term_name = ?
            AND program_type = ?
            AND (postgraduate_program <=> ?)
          LIMIT 1
        `;

        db.query(
          checkSql,
          [student_id, year, level, term, programType, pgProgram],
          (checkErr, rows) => {
            if (checkErr) {
              console.error("خطأ في التحقق من التسجيل:", checkErr);
              return res.status(500).json({ message: "خطأ في السيرفر" });
            }

            const existing = rows.length > 0 ? rows[0] : null;

            if (existing) {
              // ──── تحديث التسجيل الموجود ─────
              const updSql = `
                UPDATE student_registrations
                SET
                  academic_status = ?,
                  registration_status = ?,
                  notes = ?,
                  registrar = ?,
                  postgraduate_data = ?,
                  updated_at = NOW()
                WHERE id = ?
              `;

              db.query(
                updSql,
                [
                  academic_status || "نظامي",
                  registration_status || "مسجّل",
                  notes || null,
                  registrar || "المسجل",
                  postgraduate_data ? JSON.stringify(postgraduate_data) : null,
                  existing.id,
                ],
                (updErr) => {
                  if (updErr) {
                    console.error("خطأ في تحديث التسجيل:", updErr);
                    return res.status(500).json({ message: "خطأ في تحديث التسجيل" });
                  }

                  return res.json({
                    message: "تم تحديث تسجيل الطالب بنجاح",
                    registration_id: existing.id,
                    action: "updated"
                  });
                }
              );
            } else {
              // ──── إضافة تسجيل جديد ─────
              const insSql = `
                INSERT INTO student_registrations
                (
                  student_id, academic_year, level_name, term_name,
                  academic_status, registration_status,
                  notes, registrar,
                  program_type, postgraduate_program, postgraduate_data
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;

              db.query(
                insSql,
                [
                  student_id,
                  year,
                  level,
                  term,
                  academic_status || "نظامي",
                  registration_status || "مسجّل",
                  notes || null,
                  registrar || "المسجل",
                  programType,
                  pgProgram,
                  postgraduate_data ? JSON.stringify(postgraduate_data) : null,
                ],
                (insErr, result) => {
                  if (insErr) {
                    console.error("خطأ في إضافة التسجيل:", insErr);
                    return res.status(500).json({ message: "خطأ في إضافة التسجيل" });
                  }

                  return res.json({
                    message: "تم إضافة تسجيل جديد للطالب بنجاح",
                    registration_id: result.insertId,
                    action: "inserted"
                  });
                }
              );
            }
          }
        );
      }
    );
  });
});

app.put("/api/registrations/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { academic_status } = req.body;
  const registrar = req.user?.username || DEFAULT_REGISTRAR;

  if (!academic_status) return res.status(400).json({ error: "academic_status required" });

  try {
    await dbp.query(`
      UPDATE student_registrations
      SET academic_status = ?, registrar = ?
      WHERE id = ?
    `, [academic_status, registrar, id]);
    res.json({ success: true, message: "تم تعديل الموقف الأكاديمي" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/students', (req, res) => {
  const {
    full_name,
    university_id,
    phone,
    receipt_number,
    department_id,
    notes,
    registrar
  } = req.body;

  const name = (full_name || "").trim();
  if (!name) {
    return res.status(400).json({ message: "الاسم الرباعي مطلوب" });
  }

 const uniIdRaw = (university_id ?? "").toString().trim();
const uniId = uniIdRaw === "" ? "0" : uniIdRaw;  


  // 1) منع تكرار الاسم الرباعي 
  const checkNameSql = `SELECT id FROM students WHERE full_name = ? LIMIT 1`;
  db.query(checkNameSql, [name], (err, nameRows) => {
    if (err) return res.status(500).json({ message: "Database error" });

    if (nameRows.length > 0) {
      return res.status(409).json({ message: "اسم الطالب موجود مسبقاً" });
    }

    // 2) منع تكرار الرقم الجامعي لو ما 0
    const checkUniSql = `SELECT id FROM students WHERE university_id = ? LIMIT 1`;

    const doInsert = () => {
      const insertSql = `
        INSERT INTO students
        (full_name, university_id, phone, receipt_number, department_id, notes, registrar)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      db.query(
        insertSql,
        [
          name,
          uniId || "0",
          phone || null,
          receipt_number || null,
          department_id || null,
          notes || null,
          registrar || null,
        ],
        (err2, result) => {
          if (err2) {
            console.log("MYSQL ERROR (add student):", err2);
            return res.status(500).json({ message: err2.message });
          }
          return res.json({ message: "تم إضافة الطالب", student_id: result.insertId });
        }
      );
    };

    if (uniId && uniId !== "0") {
      return db.query(checkUniSql, [uniId], (err3, uniRows) => {
        if (err3) return res.status(500).json({ message: "Database error" });
        if (uniRows.length > 0) {
          return res.status(409).json({ message: "الرقم الجامعي مستخدم من قبل طالب آخر" });
        }
        return doInsert();
      });
    }

    return doInsert();
  });
});


// كل تسجيلات طالب معيّن (history)
app.get('/api/registrations/by-student/:studentId', (req, res) => {
    const studentId = req.params.studentId;

    const sql = `
      SELECT *
      FROM student_registrations
      WHERE student_id = ?
      ORDER BY created_at DESC
    `;

    db.query(sql, [studentId], (err, rows) => {
        if (err) {
            console.log("MYSQL ERROR (registrations by student):", err);
            return res.status(500).json({ message: "Database error" });
        }
        res.json(rows);
    });
});


/* =========================================================
    الترحيل الجماعي (بدء عام/فصل جديد)
   ========================================================= */
// جلب المرشحين
app.get('/api/promotion/candidates', (req, res) => {
  const {
    department_id,
    from_year,
    from_level,
    from_term,
    program_type,
    postgraduate_program
  } = req.query;

  const programType = (program_type || "bachelor").trim();

  if (!department_id || !from_year || !from_level) {
    return res.status(400).json({ message: "department_id + from_year + from_level مطلوبة" });
  }

  if (programType === "postgraduate" && !(postgraduate_program || "").trim()) {
    return res.status(400).json({ message: "postgraduate_program مطلوب للدراسات العليا" });
  }

  const pgFilterSql = programType === "postgraduate" ? " AND postgraduate_program = ? " : "";
  const pgFilterParams = programType === "postgraduate" ? [postgraduate_program.trim()] : [];

  const termFilterSql = (from_term || "").trim() ? " AND term_name = ? " : "";
  const termFilterParams = (from_term || "").trim() ? [from_term.trim()] : [];

  const sql = `
    SELECT 
      s.id AS student_id,
      s.full_name,
      s.university_id,
      
      sr.academic_year   AS current_year,
      sr.level_name      AS current_level,
      sr.term_name       AS current_term,
      
      -- هنا نرجّع القيمة الحقيقية من academic_status مباشرة
      sr.academic_status AS academic_status,
      
      CASE 
        WHEN sr.result_status = 1 THEN 'ناجح'
        WHEN sr.result_status = 0 THEN 'راسب'
        ELSE 'غير محسوب'
      END AS passed_status

    FROM students s

    INNER JOIN student_registrations sr 
      ON sr.student_id = s.id

    INNER JOIN (
      SELECT student_id, MAX(id) AS max_reg_id
      FROM student_registrations
      WHERE academic_year = ?
        AND level_name = ?
        ${termFilterSql}
        AND program_type = ?
        ${pgFilterSql}
        AND registration_status = 'مسجّل'
      GROUP BY student_id
    ) latest ON latest.max_reg_id = sr.id

    WHERE s.department_id = ?
      AND sr.program_type = ?
      ${pgFilterSql}

    ORDER BY s.full_name
  `;

  const params = [
    from_year,
    from_level,
    ...termFilterParams,
    programType,
    ...pgFilterParams,
    department_id,
    programType,
    ...pgFilterParams
  ];

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("MYSQL ERROR (promotion candidates):", err);
      return res.status(500).json({ message: err.message });
    }
    res.json(rows);
  });
});

// ترحيل جماعي للطلاب
app.post('/api/batch-transfer-students', async (req, res) => {
  const {
    department_id,
    academic_year,
    level_name,
    term_name,
    program_type,
    postgraduate_program,
    transfer_type,
    new_academic_year,
    new_level_name,
    new_term_name,
    student_ids,
    registrar = DEFAULT_REGISTRAR  
  } = req.body;

  if (!department_id || !student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
    return res.status(400).json({ error: "البيانات ناقصة أو student_ids فارغ" });
  }

  try {
    // التأكد من الفترة الجديدة
    await dbp.query(
      `INSERT IGNORE INTO academic_periods 
       (academic_year, level_name, term_name, program_type, postgraduate_program)
       VALUES (?, ?, ?, ?, ?)`,
      [new_academic_year, new_level_name, new_term_name, program_type, postgraduate_program || null]
    );

    let transferredCount = 0;

    for (const studentId of student_ids) {
      // جلب التسجيل الحالي
      const [current] = await dbp.query(
        `SELECT id FROM student_registrations 
         WHERE student_id = ? 
           AND academic_year = ? 
           AND level_name = ? 
           AND term_name = ? 
           AND program_type = ?
           AND (postgraduate_program <=> ?)`,
        [studentId, academic_year, level_name, term_name, program_type, postgraduate_program || null]
      );

      if (current.length === 0) continue;

      await dbp.query(
        `UPDATE student_registrations SET registration_status = 'مسجّل' WHERE id = ?`,
        [current[0].id]
      );

      // إنشاء جديد
      await dbp.query(
        `INSERT INTO student_registrations 
         (student_id, academic_year, level_name, term_name, program_type, postgraduate_program,
          academic_status, registration_status, registrar, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'منتظم', 'مسجّل', ?, NOW())`,
        [
          studentId,
          new_academic_year,
          new_level_name,
          new_term_name,
          program_type,
          postgraduate_program || null,
          registrar
        ]
      );

      transferredCount++;
    }

    res.json({
      success: true,
      message: "تم الترحيل الجماعي بنجاح",
      transferred_count: transferredCount
    });

  } catch (err) {
    console.error("Batch transfer error:", err);
    res.status(500).json({ error: err.message || "خطأ في الترحيل الجماعي" });
  }
});


// تنفيذ الترحيل الجماعي
app.post('/api/promotion/start', (req, res) => {
  const { 
    student_ids, 
    to_year, 
    to_level, 
    term_name, 
    registrar, 
    program_type, 
    postgraduate_program 
  } = req.body;

  // 1. التحقق من program_type
  const validProgramTypes = ['diploma', 'bachelor', 'postgraduate'];
  if (!program_type || !validProgramTypes.includes(program_type)) {
    return res.status(400).json({
      message: `نوع البرنامج غير صالح. القيم المسموح بها: ${validProgramTypes.join(', ')}`
    });
  }

  const programType = program_type.trim();
  const pgProgram = programType === "postgraduate" ? ((postgraduate_program || "").trim() || null) : null;

  if (!student_ids || !Array.isArray(student_ids) || !student_ids.length || !to_year || !to_level || !term_name) {
    return res.status(400).json({ message: "student_ids + to_year + to_level + term_name مطلوبة" });
  }

  if (programType === "postgraduate" && !pgProgram) {
    return res.status(400).json({ message: "postgraduate_program مطلوب للدراسات العليا" });
  }

  const target = {
    academic_year: String(to_year).trim(),
    level_name: String(to_level).trim(),
    term_name: String(term_name).trim(),
  };

  const lastSql = `
    SELECT 
      academic_year, 
      level_name, 
      term_name,
      registration_status,
      result_status  
    FROM student_registrations
    WHERE student_id = ?
      AND program_type = ?
      AND (postgraduate_program <=> ?)
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;

  const insertSql = `
    INSERT INTO student_registrations
      (student_id, academic_year, level_name, term_name,
       academic_status, registration_status, registrar,
       program_type, postgraduate_program)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  let completed = 0;
  let hasError = false;

  student_ids.forEach((sid) => {
    if (hasError) return;

    db.query(lastSql, [sid, programType, pgProgram], (eLast, rLast) => {
      if (hasError) return;

      if (eLast) {
        hasError = true;
        console.log("MYSQL ERROR (promotion last check):", eLast);
        return res.status(500).json({ message: eLast.message });
      }

      const last = rLast && rLast.length ? rLast[0] : null;

      if (last) {
        const lastP = {
          academic_year: last.academic_year,
          level_name: last.level_name,
          term_name: last.term_name || "",
        };

        if (comparePeriods(target, lastP) <= 0) {
          hasError = true;
          return res.status(400).json({
            message: `لا يمكن الترحيل لنفس/أقدم فترة. مثال الطالب ${sid}: آخر تسجيل ${last.academic_year} - ${last.level_name} - ${last.term_name}`,
          });
        }

        const lastLevelNum = parseLevelNumber(last.level_name);
        const targetLevelNum = parseLevelNumber(target.level_name);
        const isSameLevel = lastLevelNum === targetLevelNum;

        // حالة 1: من الفصل الأول للفصل الثاني (نفس المستوى) → يمشي عادي
        if (isSameLevel && termOrder(last.term_name) === 1 && termOrder(target.term_name) === 2) {
          return insertNewRegistration(sid, "منتظم", "مسجّل");
        }

        // حالة 2: من الفصل الثاني إلى الفصل الأول في مستوى جديد → لازم result_status = 1 (ناجح)
        else if (!isSameLevel && termOrder(last.term_name) === 2 && termOrder(target.term_name) === 1) {
          if (last.result_status === 1) {
            return insertNewRegistration(sid, "ناجح", "مسجّل");
          } else {
            hasError = true;
            return res.status(400).json({
              message: `الطالب ${sid} لم يكن ناجحًا في الفصل الثاني (result_status = ${last.result_status})، لا يمكن الترحيل إلى مستوى جديد`
            });
          }
        }

        else {
          hasError = true;
          return res.status(400).json({
            message: `نوع الترحيل غير مدعوم للطالب ${sid}. من: ${last.term_name} → إلى: ${target.term_name}`
          });
        }
      } else {
        // ما فيش تسجيل سابق → مسجّل عادي
        return insertNewRegistration(sid, "منتظم", "مسجّل");
      }
    });
  });

  function insertNewRegistration(sid, academicStatus, registrationStatus) {
    db.query(
      insertSql,
      [
        sid,
        target.academic_year,
        target.level_name,
        target.term_name,
        academicStatus,
        registrationStatus,
        registrar || null,
        programType,
        pgProgram,
      ],
      (err) => {
        if (hasError) return;

        if (err) {
          hasError = true;
          console.log("MYSQL ERROR (promotion insert):", err);
          return res.status(500).json({ message: err.message });
        }

        completed++;
        if (completed === student_ids.length && !hasError) {
          return res.json({
            message: "تم ترحيل الطلاب وبداية العام/الفصل الجديد",
            count: student_ids.length,
          });
        }
      }
    );
  }
});

// القواعد
app.get("/api/grading-rules", async (req, res) => {
  try {
    const facultyId = Number(req.query.faculty_id);
    if (!facultyId) return res.status(400).json({ error: "faculty_id مطلوب" });

    const [rows] = await dbp.query(
      `SELECT
         rule_type, program_mode, label, min_value, max_value, points,
         term_calc_mode, cumulative_calc_mode, gpa_max,
         sort_order, id
       FROM grading_rules
       WHERE faculty_id = ?
       ORDER BY rule_type, program_mode, sort_order, id`,
      [facultyId]
    );

    const gradeScale = rows
      .filter((r) => r.rule_type === "grade_scale")
      .map((r) => ({
        letter: r.label,
        min: Number(r.min_value),
        max: Number(r.max_value),
        points: Number(r.points || 0),
      }));

    const honorsRules = rows
      .filter((r) => r.rule_type === "gpa_classification" && r.program_mode === "honors")
      .map((r) => ({
        title: r.label,
        min: Number(r.min_value),
        max: Number(r.max_value),
      }));

    const generalRules = rows
      .filter((r) => r.rule_type === "gpa_classification" && r.program_mode === "general")
      .map((r) => ({
        title: r.label,
        min: Number(r.min_value),
        max: Number(r.max_value),
      }));

    const settingsRow = rows.find((r) => r.rule_type === "gpa_settings");

    let gpaSettings = {
      term_calc_mode: "courses",
      cumulative_calc_mode: "weighted_avg",
      gpa_max: 4.0,

      total_mark: 100,
      final_exam_max: 60,
      coursework_max: 40,
      rounding_decimals: 2,
    };

    if (settingsRow) {
      if (settingsRow.term_calc_mode) gpaSettings.term_calc_mode = settingsRow.term_calc_mode;
      if (settingsRow.cumulative_calc_mode) gpaSettings.cumulative_calc_mode = settingsRow.cumulative_calc_mode;
      if (settingsRow.gpa_max != null) gpaSettings.gpa_max = Number(settingsRow.gpa_max);

      if (settingsRow.label) {
        try {
          const parsed = JSON.parse(settingsRow.label);
          gpaSettings.total_mark = Number(parsed?.total_mark ?? gpaSettings.total_mark);
          gpaSettings.final_exam_max = Number(parsed?.final_exam_max ?? gpaSettings.final_exam_max);
          gpaSettings.coursework_max = Number(parsed?.coursework_max ?? gpaSettings.coursework_max);
          gpaSettings.rounding_decimals = Number(parsed?.rounding_decimals ?? gpaSettings.rounding_decimals);
        } catch (e) {
          // ignore
        }
      }
    }

    return res.json({ gradeScale, honorsRules, generalRules, gpaSettings });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Database error" });
  }
});


app.put("/api/grading-rules", async (req, res) => {
  const facultyId = Number(req.query.faculty_id);
  if (!facultyId) return res.status(400).json({ error: "faculty_id مطلوب" });

  const { gradeScale, honorsRules, generalRules, gpaSettings } = req.body;

  if (!Array.isArray(gradeScale) || !Array.isArray(honorsRules) || !Array.isArray(generalRules)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const termCalc = gpaSettings?.term_calc_mode || "courses";
  const cumCalc = gpaSettings?.cumulative_calc_mode || "weighted_avg";
  const gpaMax = Number(gpaSettings?.gpa_max ?? 4.0);

  const settingsPayload = {
    total_mark: Number(gpaSettings?.total_mark ?? 100),
    final_exam_max: Number(gpaSettings?.final_exam_max ?? 60),
    coursework_max: Number(gpaSettings?.coursework_max ?? 40),
    rounding_decimals: Number(gpaSettings?.rounding_decimals ?? 2),
  };

  //  Validation
  const sumParts = (settingsPayload.final_exam_max || 0) + (settingsPayload.coursework_max || 0);
  if (sumParts !== settingsPayload.total_mark) {
    return res.status(400).json({
      error: `لازم مجموع (final_exam_max + coursework_max) = total_mark (${settingsPayload.total_mark})`,
    });
  }

  const conn = await dbp.getConnection();
  try {
    await conn.beginTransaction();

    // امسح كل قواعد الكلية القديمة
    await conn.query("DELETE FROM grading_rules WHERE faculty_id = ?", [facultyId]);

  
    await conn.query(
      `INSERT INTO grading_rules
        (faculty_id, rule_type, program_mode, label, min_value, max_value, points,
         term_calc_mode, cumulative_calc_mode, gpa_max,
         sort_order, created_at, updated_at)
       VALUES (?, 'gpa_settings', NULL, ?, 0, 0, NULL,
               ?, ?, ?,
               0, NOW(), NOW())`,
      [facultyId, JSON.stringify(settingsPayload), termCalc, cumCalc, gpaMax]
    );

   // grade_scale
    for (let i = 0; i < gradeScale.length; i++) {
      const r = gradeScale[i];
      await conn.query(
        `INSERT INTO grading_rules
          (faculty_id, rule_type, program_mode, label, min_value, max_value, points, sort_order, created_at, updated_at)
         VALUES (?, 'grade_scale', NULL, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          facultyId,
          r.letter || "",
          Number(r.min) || 0,
          Number(r.max) || 0,
          Number(r.points) || 0,
          i + 1,
        ]
      );
    }

    // 3) honors
    for (let i = 0; i < honorsRules.length; i++) {
      const r = honorsRules[i];
      await conn.query(
        `INSERT INTO grading_rules
          (faculty_id, rule_type, program_mode, label, min_value, max_value, points, sort_order, created_at, updated_at)
         VALUES (?, 'gpa_classification', 'honors', ?, ?, ?, NULL, ?, NOW(), NOW())`,
        [facultyId, r.title || "", Number(r.min) || 0, Number(r.max) || 0, i + 1]
      );
    }

    // 4) general
    for (let i = 0; i < generalRules.length; i++) {
      const r = generalRules[i];
      await conn.query(
        `INSERT INTO grading_rules
          (faculty_id, rule_type, program_mode, label, min_value, max_value, points, sort_order, created_at, updated_at)
         VALUES (?, 'gpa_classification', 'general', ?, ?, ?, NULL, ?, NOW(), NOW())`,
        [facultyId, r.title || "", Number(r.min) || 0, Number(r.max) || 0, i + 1]
      );
    }

    await conn.commit();
    return res.json({ message: "تم حفظ قواعد التصنيف + إعدادات الحساب للكلية" });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return res.status(500).json({ error: "Database error" });
  } finally {
    conn.release();
  }
});

app.get("/api/grading-scale/:facultyId", async (req, res) => {
  try {
    const { facultyId } = req.params;

    const [rules] = await dbp.query(
      `SELECT label AS letter, points, min_value AS min_mark, max_value AS max_mark, sort_order
       FROM grading_rules
       WHERE faculty_id = ? AND rule_type = 'grade_scale'
       ORDER BY sort_order ASC`,
      [facultyId]
    );

    if (rules.length === 0) {
      return res.status(404).json({ error: "لا يوجد مقياس تقديرات لهذه الكلية" });
    }

    res.json({ success: true, scale: rules });
  } catch (err) {
    console.error("GRADING SCALE ERROR:", err);
    res.status(500).json({ error: "خطأ في جلب مقياس الدرجات: " + err.message });
  }
});


//  الدرجات
app.post("/api/save-grades", async (req, res) => {
  const { 
    course_id, 
    grades, 
    academic_year, 
    level_name, 
    term_name, 
    program_type, 
    postgraduate_program 
  } = req.body;

  if (!course_id || !Array.isArray(grades) || grades.length === 0) {
    return res.status(400).json({ error: "البيانات ناقصة (course_id و grades مطلوبين)" });
  }

  try {
    // جيب faculty_id من courses
    const [courseRows] = await dbp.query(
      "SELECT faculty_id FROM courses WHERE id = ?",
      [course_id]
    );

    if (courseRows.length === 0) {
      return res.status(404).json({ error: "المادة غير موجودة" });
    }

    const faculty_id = courseRows[0].faculty_id;

    //  مقياس الدرجات 
    const [scaleRows] = await dbp.query(
      `SELECT min_value AS min_mark, 
              max_value AS max_mark, 
              label AS letter, 
              points 
       FROM grading_rules 
       WHERE rule_type = 'grade_scale' 
         AND faculty_id = ? 
       ORDER BY min_value DESC`,
      [faculty_id]
    );

    // لكل طالب
    for (const g of grades) {
      const { 
        student_id, 
        coursework_mark, 
        final_exam_mark 
      } = g;

      const cm = Number(coursework_mark) || 0;
      const fm = Number(final_exam_mark) || 0;
      const total_mark = cm + fm;

      //  نشيك هل المادة دي إعادة للطالب في الفصل ده؟
      const [regRows] = await dbp.query(
        `SELECT repeated_courses 
         FROM student_registrations 
         WHERE student_id = ? 
           AND academic_year = ? 
           AND level_name = ? 
           AND term_name = ? 
           AND program_type = ?
           AND (postgraduate_program <=> ?)`,
        [student_id, academic_year, level_name, term_name, program_type, postgraduate_program || null]
      );

      let isRepeat = false;
      if (regRows.length > 0) {
        const repeated = regRows[0].repeated_courses || "";
        // repeated_courses  نشيك لو  
        isRepeat = repeated.split(',').map(id => id.trim()).includes(String(course_id));
      }

      // جيب أكبر attempt_number
      const [maxAttemptRows] = await dbp.query(
        `SELECT MAX(attempt_number) AS max_attempt 
         FROM course_grades 
         WHERE student_id = ? AND course_id = ?`,
        [student_id, course_id]
      );

      const currentMaxAttempt = maxAttemptRows[0].max_attempt || 0;

      let letter = null;
      let points = null;

      if (isRepeat) {
        // إعادة: INSERT جديد دايمًا + C* أو F
        if (total_mark >= 50) {
          letter = "C*";
          points = 2.00;
        } else {
          letter = "F";
          points = 0.00;
        }
      } else {
        // عادي: حسب grading_rules
        let found = false;
        for (const s of scaleRows) {
          const min = Number(s.min_mark);
          const max = s.max_mark !== null ? Number(s.max_mark) : Infinity;

          if (total_mark >= min && total_mark <= max) {
            letter = s.letter;
            points = Number(s.points);
            found = true;
            break;
          }
        }

        if (!found) {
          letter = "F";
          points = 0.00;
        }
      }

      // الحفظ
      if (!isRepeat) {
        // عادي: UPDATE على attempt_number = 1
        const [existingRows] = await dbp.query(
          `SELECT id FROM course_grades 
           WHERE student_id = ? AND course_id = ? AND attempt_number = 1`,
          [student_id, course_id]
        );

        if (existingRows.length > 0) {
          const recordId = existingRows[0].id;
          await dbp.query(
            `UPDATE course_grades 
             SET coursework_mark = ?, 
                 final_exam_mark = ?, 
                 total_mark = ?, 
                 letter = ?, 
                 points = ?, 
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [cm, fm, total_mark, letter, points, recordId]
          );

          console.log(`UPDATE للطالب العادي ${student_id} | مادة ${course_id} | مجموع ${total_mark} → ${letter} (${points})`);
          continue;
        }

        // لو ماف ريكورد  → INSERT أول مرة
      }

      // الإعادة أو أول حفظ عادي → INSERT جديد
      const newAttempt = currentMaxAttempt + 1;

      await dbp.query(
        `INSERT INTO course_grades 
         (course_id, student_id, attempt_number, is_repeat, 
          coursework_mark, final_exam_mark, total_mark, letter, points, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          course_id,
          student_id,
          newAttempt,
          isRepeat ? 1 : 0,
          cm,
          fm,
          total_mark,
          letter,
          points
        ]
      );

      console.log(`INSERT جديد - الطالب ${student_id} | مادة ${course_id} | محاولة ${newAttempt} | إعادة؟ ${isRepeat} | مجموع ${total_mark} → ${letter} (${points})`);
    }

    res.json({ 
      success: true, 
      message: "تم حفظ الدرجات بنجاح" 
    });

  } catch (err) {
    console.error("SAVE GRADES ERROR:", err);
    res.status(500).json({ 
      success: false, 
      error: "خطأ في السيرفر أو قاعدة البيانات" 
    });
  }
});

app.get("/api/courses", async (req, res) => {
  try {
    const facultyId = Number(req.query.faculty_id);
    const departmentId = Number(req.query.department_id);
    const academicYear = (req.query.academic_year || "").trim();
    const levelName = (req.query.level_name || "").trim();
    const termName = (req.query.term_name || "").trim();

    
    const programType = (req.query.program_type || "undergraduate").trim(); 
    const pgProgramRaw = (req.query.postgraduate_program || "").trim();
    const pgProgram = programType === "postgraduate" ? (pgProgramRaw || null) : null;

    if (!facultyId || !departmentId || !academicYear || !levelName || !termName) {
      return res.status(400).json({
        error:
          "faculty_id + department_id + academic_year + level_name + term_name مطلوبة",
      });
    }

    //  Validation للدراسات العليا
    if (programType === "postgraduate" && !pgProgram) {
      return res.status(400).json({ error: "postgraduate_program مطلوب للدراسات العليا" });
    }

    const [rows] = await dbp.query(
      `
      SELECT
        id, faculty_id, department_id,
        academic_year, level_name, term_name,
        program_type, postgraduate_program,
        course_name, instructor, credit_hours,
        total_mark, coursework_max, final_exam_max
      FROM courses
      WHERE faculty_id = ?
        AND department_id = ?
        AND academic_year = ?
        AND level_name = ?
        AND term_name = ?
        AND program_type = ?
        AND (postgraduate_program <=> ?)
      ORDER BY course_name
      `,
      [facultyId, departmentId, academicYear, levelName, termName, programType, pgProgram]
    );

    return res.json(rows);
  } catch (e) {
    console.error("LIST COURSES ERROR:", e);
    return res.status(500).json({ error: "Database error" });
  }
});


app.get("/api/course-students", async (req, res) => {
  try {
    const {
      course_id,
      academic_year,
      level_name,
      term_name,
      program_type,
      postgraduate_program
    } = req.query;

    if (!course_id || !academic_year || !level_name || !term_name || !program_type) {
      return res.status(400).json({ error: "البيانات ناقصة" });
    }

    const pgProgram = program_type === "postgraduate" ? (postgraduate_program || null) : null;

    const [rows] = await dbp.query(
      `
      SELECT 
        s.id AS student_id,
        s.full_name,
        s.university_id,
        cg.coursework_mark,
        cg.final_exam_mark,
        cg.total_mark,
        cg.letter,
        cg.points,
        COALESCE(cg.is_repeat, 0) AS is_repeat   //  أو 0 إذا مش موجود
      FROM students s
      JOIN student_registrations sr ON sr.student_id = s.id
      JOIN courses c ON 1=1  
      LEFT JOIN course_grades cg 
          ON cg.student_id = s.id 
          AND cg.course_id = ?
      WHERE 
          c.id = ?   
          AND (
              -- التسجيل العادي
              sr.academic_year = c.academic_year 
              AND sr.level_name = c.level_name 
              AND sr.term_name = c.term_name 
              AND sr.program_type = c.program_type 
              AND (sr.postgraduate_program <=> c.postgraduate_program)
              OR
              -- الإعادة (جديد كاملاً)
              (FIND_IN_SET(?, sr.repeated_courses) > 0
               AND sr.academic_year = ?
               AND sr.level_name = ?
               AND sr.term_name = ?
               AND sr.program_type = ?
               AND (sr.postgraduate_program <=> ?))
          )
      GROUP BY s.id
      ORDER BY s.full_name ASC
      `,
      [course_id, course_id, course_id, academic_year, level_name, term_name, program_type, pgProgram]  
    );

    res.json(rows);
  } catch (e) {
    console.error("COURSE STUDENTS ERROR:", e);
    res.status(500).json({ error: "خطأ في السيرفر" });
  }
});

app.get("/api/courses", async (req, res) => {
  try {
    const facultyId = Number(req.query.faculty_id);
    const departmentId = Number(req.query.department_id);
    const academicYear = (req.query.academic_year || "").trim();
    const levelName = (req.query.level_name || "").trim();
    const termName = (req.query.term_name || "").trim();

    
    const programType = (req.query.program_type || "undergraduate").trim(); // undergraduate | postgraduate
    const pgProgramRaw = (req.query.postgraduate_program || "").trim();
    const pgProgram = programType === "postgraduate" ? (pgProgramRaw || null) : null;

    if (!facultyId || !departmentId || !academicYear || !levelName || !termName) {
      return res.status(400).json({
        error:
          "faculty_id + department_id + academic_year + level_name + term_name مطلوبة",
      });
    }

    //  Validation للدراسات العليا
    if (programType === "postgraduate" && !pgProgram) {
      return res.status(400).json({ error: "postgraduate_program مطلوب للدراسات العليا" });
    }

    const [rows] = await dbp.query(
      `
      SELECT
        id, faculty_id, department_id,
        academic_year, level_name, term_name,
        program_type, postgraduate_program,
        course_name, instructor, credit_hours,
        total_mark, coursework_max, final_exam_max
      FROM courses
      WHERE faculty_id = ?
        AND department_id = ?
        AND academic_year = ?
        AND level_name = ?
        AND term_name = ?
        AND program_type = ?
        AND (postgraduate_program <=> ?)
      ORDER BY course_name
      `,
      [facultyId, departmentId, academicYear, levelName, termName, programType, pgProgram]
    );

    return res.json(rows);
  } catch (e) {
    console.error("LIST COURSES ERROR:", e);
    return res.status(500).json({ error: "Database error" });
  }
});



app.post("/api/courses", async (req, res) => {
  try {
    const {
      faculty_id,
      department_id,
      academic_year,
      level_name,
      term_name,
      course_name,
      instructor,
      credit_hours,
      total_mark,
      coursework_max,
      final_exam_max,


      program_type,
      postgraduate_program,
    } = req.body;

    const facultyId = Number(faculty_id);
    const deptId = Number(department_id);
    const year = (academic_year || "").trim();
    const level = (level_name || "").trim();
    const term = (term_name || "").trim();
    const name = (course_name || "").trim();
    const instr = (instructor || "").trim() || null;

    const programType = (program_type || "undergraduate").trim(); // undergraduate | postgraduate
    const pgProgramRaw = (postgraduate_program || "").toString().trim();
    const pgProgram = programType === "postgraduate" ? (pgProgramRaw || null) : null;

    const tm = Number(total_mark ?? 100);
    const cw = Number(coursework_max ?? 40);
    const fe = Number(final_exam_max ?? 60);

    let ch = null;
    if (credit_hours !== "" && credit_hours !== null && credit_hours !== undefined) {
      ch = Number(credit_hours);
      if (!Number.isFinite(ch) || ch <= 0)
        return res.status(400).json({ error: "عدد الساعات لازم يكون رقم > 0" });
    }

    if (!facultyId || !deptId || !year || !level || !term || !name) {
      return res.status(400).json({ error: "بيانات ناقصة" });
    }

    //  Validation للدراسات العليا
    if (programType === "postgraduate" && !pgProgram) {
      return res.status(400).json({ error: "postgraduate_program مطلوب للدراسات العليا" });
    }

    //  تحقق: أعمال السنة + الامتحان = total_mark
    if (cw + fe !== tm) {
      return res.status(400).json({ error: `لازم (أعمال السنة + الامتحان) = ${tm}` });
    }

    //  تأكد القسم تابع للكلية
    const [depRows] = await dbp.query(
      "SELECT id FROM departments WHERE id = ? AND faculty_id = ? LIMIT 1",
      [deptId, facultyId]
    );
    if (depRows.length === 0) {
      return res.status(400).json({ error: "القسم لا يتبع لهذه الكلية" });
    }

    const [result] = await dbp.query(
      `
      INSERT INTO courses
      (
        faculty_id, department_id,
        academic_year, level_name, term_name,
        program_type, postgraduate_program,
        course_name, instructor, credit_hours,
        total_mark, coursework_max, final_exam_max
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        facultyId,
        deptId,
        year,
        level,
        term,
        programType,
        pgProgram,
        name,
        instr,
        ch,
        tm,
        cw,
        fe,
      ]
    );

    return res.json({ message: "تمت إضافة المادة", id: result.insertId });
  } catch (e) {
    console.error("ADD COURSE ERROR:", e);

    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: "المادة موجودة مسبقاً لنفس السنة/المستوى/الفصل/البرنامج",
      });
    }
    return res.status(500).json({ error: "Database error" });
  }
});



app.put("/api/courses/:id", async (req, res) => {
  try {
    const courseId = Number(req.params.id);

    const {
      faculty_id,
      department_id,
      academic_year,
      level_name,
      term_name,
      course_name,
      instructor,
      credit_hours,
      total_mark,
      coursework_max,
      final_exam_max,

      program_type,
      postgraduate_program,
    } = req.body;

    const facultyId = Number(faculty_id);
    const deptId = Number(department_id);
    const year = (academic_year || "").trim();
    const level = (level_name || "").trim();
    const term = (term_name || "").trim();
    const name = (course_name || "").trim();
    const instr = (instructor || "").trim() || null;

    const programType = (program_type || "undergraduate").trim();
    const pgProgramRaw = (postgraduate_program || "").toString().trim();
    const pgProgram = programType === "postgraduate" ? (pgProgramRaw || null) : null;

    const tm = Number(total_mark ?? 100);
    const cw = Number(coursework_max ?? 40);
    const fe = Number(final_exam_max ?? 60);

    let ch = null;
    if (credit_hours !== "" && credit_hours !== null && credit_hours !== undefined) {
      ch = Number(credit_hours);
      if (!Number.isFinite(ch) || ch <= 0) {
        return res.status(400).json({ error: "عدد الساعات لازم يكون رقم > 0" });
      }
    }

    if (!courseId || !facultyId || !deptId || !year || !level || !term || !name) {
      return res.status(400).json({ error: "بيانات ناقصة" });
    }

    //  Validation للدراسات العليا
    if (programType === "postgraduate" && !pgProgram) {
      return res.status(400).json({ error: "postgraduate_program مطلوب للدراسات العليا" });
    }

    if (cw + fe !== tm) {
      return res.status(400).json({ error: `لازم (أعمال السنة + الامتحان) = ${tm}` });
    }

    const [result] = await dbp.query(
      `
      UPDATE courses
      SET
        faculty_id = ?, department_id = ?,
        academic_year = ?, level_name = ?, term_name = ?,
        program_type = ?, postgraduate_program = ?,
        course_name = ?, instructor = ?, credit_hours = ?,
        total_mark = ?, coursework_max = ?, final_exam_max = ?
      WHERE id = ?
      `,
      [
        facultyId,
        deptId,
        year,
        level,
        term,
        programType,
        pgProgram,
        name,
        instr,
        ch,
        tm,
        cw,
        fe,
        courseId,
      ]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "المادة غير موجودة" });

    return res.json({ message: "تم تعديل المادة" });
  } catch (e) {
    console.error("UPDATE COURSE ERROR:", e);

    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: "المادة موجودة مسبقاً لنفس السنة/المستوى/الفصل/البرنامج",
      });
    }
    return res.status(500).json({ error: "Database error" });
  }
});



app.delete("/api/courses/:id", async (req, res) => {
  try {
    const courseId = Number(req.params.id);
    const [result] = await dbp.query("DELETE FROM courses WHERE id = ?", [courseId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "المادة غير موجودة" });
    return res.json({ message: "تم حذف المادة" });
  } catch (e) {
    console.error("DELETE COURSE ERROR:", e);
    return res.status(500).json({ error: "Database error" });
  }
});



/* =========================================================
  Academic Periods (Smart List)
   ========================================================= */

// جلب كل الفترات 
app.get("/api/academic-periods", (req, res) => {
  const programType = (req.query.program_type || "undergraduate").trim();
  const pgProgram = (req.query.postgraduate_program || "").trim();

  let sql = `
    SELECT id, academic_year, level_name, term_name, program_type, postgraduate_program
    FROM academic_periods
    WHERE program_type = ?
  `;
  const params = [programType];

  if (programType === "postgraduate" && pgProgram) {
    sql += " AND postgraduate_program = ? ";
    params.push(pgProgram);
  }

  sql += " ORDER BY academic_year DESC, level_name, term_name";

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.log("MYSQL ERROR (list academic_periods):", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(rows);
  });
});

//  (لو ما موجودة يضيفها – لو موجودة ما يكرر)
app.post("/api/academic-periods/ensure", (req, res) => {
  const { academic_year, level_name, term_name, program_type, postgraduate_program } = req.body;

  const year = (academic_year || "").toString().trim();
  const level = (level_name || "").toString().trim();
  const term = (term_name || "").toString().trim();

  const programType = (program_type || "undergraduate").toString().trim();
  const pgProgram = (postgraduate_program || "").toString().trim() || null;

  if (!year || !level || !term) {
    return res.status(400).json({ error: "academic_year + level_name + term_name مطلوبة" });
  }
  if (programType === "postgraduate" && !pgProgram) {
    return res.status(400).json({ error: "postgraduate_program مطلوب للدراسات العليا" });
  }

  const sql = `
    INSERT INTO academic_periods (academic_year, level_name, term_name, program_type, postgraduate_program)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE id = id
  `;

  db.query(
    sql,
    [year, level, term, programType, programType === "postgraduate" ? pgProgram : null],
    (err, result) => {
      if (err) {
        console.log("MYSQL ERROR (ensure academic_periods):", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ message: "ok" });
    }
  );
});


///////////الدرجات///////////
app.get("/api/grade-entry/students", async (req, res) => {
  const {
    course_id,
    academic_year,
    level_name,
    term_name,
    program_type,
    postgraduate_program = null
  } = req.query;

  if (!course_id || !academic_year || !level_name || !term_name || !program_type) {
    return res.status(400).json({ error: "البيانات ناقصة (course_id, academic_year, level_name, term_name, program_type مطلوبة)" });
  }

  try {
    // جيب بيانات المادة
    const [courseRows] = await dbp.query(
      `SELECT id, faculty_id, department_id, course_name, instructor, credit_hours, total_mark, coursework_max, final_exam_max
       FROM courses WHERE id = ? LIMIT 1`,
      [course_id]
    );

    if (courseRows.length === 0) return res.status(404).json({ error: "المادة غير موجودة" });

    const course = courseRows[0];

    // جيب الطلاب اللي سجّلوا المادة دي كإعادة في الفصل المختار
    const [repeatStudentsIds] = await dbp.query(
      `
      SELECT 
        s.id AS student_id,
        s.full_name,
        s.university_id,
        CASE WHEN FIND_IN_SET(?, sr.repeated_courses) > 0 THEN 1 ELSE 0 END AS is_repeat
      FROM students s
      INNER JOIN student_registrations sr ON sr.student_id = s.id
      WHERE sr.academic_year = ?
        AND sr.level_name = ?
        AND sr.term_name = ?
        AND sr.program_type = ?
        AND (sr.postgraduate_program <=> ?)
        AND FIND_IN_SET(?, sr.repeated_courses) > 0
      ORDER BY s.full_name
      `,
      [
        course_id,
        academic_year,
        level_name,
        term_name,
        program_type,
        postgraduate_program,
        course_id
      ]
    );

    let finalStudents = [];

    if (repeatStudentsIds.length > 0) {
      console.log(`مادة إعادة (ID=${course_id}) في فصل ${term_name} - رجّعنا ${repeatStudentsIds.length} طالب (إعادة)`);
      finalStudents = repeatStudentsIds;
    } else {
      // لو مش إعادة → كل الطلاب في الفصل المختار
      const [normalStudentsIds] = await dbp.query(
        `
        SELECT 
          s.id AS student_id,
          s.full_name,
          s.university_id,
          0 AS is_repeat
        FROM students s
        INNER JOIN student_registrations sr ON sr.student_id = s.id
        WHERE sr.academic_year = ?
          AND sr.level_name = ?
          AND sr.term_name = ?
          AND sr.program_type = ?
          AND (sr.postgraduate_program <=> ?)
          AND s.department_id = ?
        ORDER BY s.full_name
        `,
        [
          academic_year,
          level_name,
          term_name,
          program_type,
          postgraduate_program,
          course.department_id
        ]
      );

      console.log(`مادة عادية (ID=${course_id}) في فصل ${term_name} - رجّعنا ${normalStudentsIds.length} طالب`);
      finalStudents = normalStudentsIds;
    }

    //    آخر محاولة فقط من course_grades
    const studentsWithLastGrade = [];
    for (const student of finalStudents) {
      const [lastGradeRows] = await dbp.query(
        `
        SELECT 
          cg.coursework_mark,
          cg.final_exam_mark,
          cg.total_mark,
          cg.letter,
          cg.points,
          cg.attempt_number,
          cg.is_repeat,
          cg.created_at
        FROM course_grades cg
        WHERE cg.student_id = ? AND cg.course_id = ?
        ORDER BY cg.attempt_number DESC, cg.created_at DESC
        LIMIT 1
        `,
        [student.student_id, course_id]
      );

      const lastGrade = lastGradeRows[0] || {
        coursework_mark: null,
        final_exam_mark: null,
        total_mark: null,
        letter: null,
        points: null,
        attempt_number: 1,
        is_repeat: student.is_repeat,
        created_at: null
      };

      studentsWithLastGrade.push({
        student_id: student.student_id,
        full_name: student.full_name,
        university_id: student.university_id,
        is_repeat: student.is_repeat,
        ...lastGrade
      });
    }

    res.json({ course, students: studentsWithLastGrade });

  } catch (err) {
    console.error("GRADE ENTRY STUDENTS ERROR:", err);
    res.status(500).json({ error: "خطأ في جلب الطلاب" });
  }
});



function calcLetterAndPoints(total, gradeScale) {
  // gradeScale: [{letter,min,max,points}]
  const t = Number(total);
  if (!Number.isFinite(t)) return { letter: null, points: null };

  const row = gradeScale.find(r => t >= Number(r.min) && t <= Number(r.max));
  if (!row) return { letter: null, points: null };

  return { letter: row.letter, points: Number(row.points ?? 0) };
}
// POST: حفظ الدرجات لمادة معينة (مع تخزين letter و points دائماً)
app.post("/api/grade-entry/save", async (req, res) => {
  try {
    const { course_id, grades } = req.body;

    if (!course_id || !Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ error: "course_id و grades مطلوبين (array غير فارغ)" });
    }

    // 1) جلب faculty_id من الـ course
    const [courseRows] = await dbp.query(
      "SELECT faculty_id FROM courses WHERE id = ? LIMIT 1",
      [course_id]
    );
    if (courseRows.length === 0) {
      return res.status(404).json({ error: "المادة غير موجودة" });
    }
    const facultyId = courseRows[0].faculty_id;

    // 2) جلب قواعد التقدير ( min_value و max_value و label  )
    const [rules] = await dbp.query(
      "SELECT min_value, max_value, label AS letter, points FROM grading_rules WHERE faculty_id = ? ORDER BY min_value DESC",
      [facultyId]
    );

    // 3) معالجة درجات كل طالب
    const processedGrades = grades.map((g) => {

      const coursework_mark = g.coursework_mark;     
      const final_exam_mark  = g.final_exam_mark;

      // تحويل إلى number أو null
      const cw = (coursework_mark == null || coursework_mark === "") ? null : Number(coursework_mark);
      const fe = (final_exam_mark == null  || final_exam_mark  === "") ? null : Number(final_exam_mark);

      // حساب الإجمالي
      const total_mark = (cw == null || fe == null) ? null : cw + fe;

      let letter = null;
      let points = null;

      if (total_mark !== null) {
        const rule = rules.find(r => 
          total_mark >= (r.min_value || 0) && total_mark <= (r.max_value || 999)
        );

        if (rule) {
          letter = rule.letter;
          points = rule.points;
        } else {
          letter = "F";
          points = 0.0;
        }
      }

      return {
        student_id: g.student_id,
        course_id,
        coursework_mark: cw,         
        final_exam_mark: fe,        
        total_mark,
        letter,
        points,
      };
    });

    // 4) حفظ/تحديث في الجدول
    for (const grade of processedGrades) {
      await dbp.query(
        `
        INSERT INTO course_grades 
          (student_id, course_id, coursework_mark, final_exam_mark, total_mark, letter, points, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          coursework_mark  = VALUES(coursework_mark),
          final_exam_mark   = VALUES(final_exam_mark),
          total_mark        = VALUES(total_mark),
          letter            = VALUES(letter),
          points            = VALUES(points),
          updated_at        = NOW()
        `,
        [
          grade.student_id,
          grade.course_id,
          grade.coursework_mark,
          grade.final_exam_mark,
          grade.total_mark,
          grade.letter,
          grade.points,
        ]
      );
    }

    res.json({ message: "تم حفظ الدرجات بنجاح" });
  } catch (e) {
    console.error("GRADE ENTRY SAVE ERROR:", e);
    res.status(500).json({ error: "خطأ في حفظ الدرجات: " + (e.message || e.toString()) });
  }
});


//نورملايزر 
function normSqlField(fieldName) {

  return `REPLACE(REPLACE(${fieldName}, ' ', ''), 'ال', '')`;
}

async function getCourseById(courseId) {
  const [rows] = await dbp.query(
    `SELECT id, faculty_id, department_id, academic_year, level_name, term_name,
            program_type, postgraduate_program,
            total_mark, coursework_max, final_exam_max, credit_hours, instructor, course_name
     FROM courses
     WHERE id = ?
     LIMIT 1`,
    [courseId]
  );
  return rows[0] || null;
}

async function getFacultyRules(facultyId) {
  const [rows] = await dbp.query(
    `SELECT rule_type, program_mode, label, min_value, max_value, points,
            term_calc_mode, cumulative_calc_mode, gpa_max
     FROM grading_rules
     WHERE faculty_id = ?
     ORDER BY sort_order, id`,
    [facultyId]
  );

  const gradeScale = rows
    .filter(r => r.rule_type === "grade_scale")
    .map(r => ({
      letter: r.label,
      min: Number(r.min_value),
      max: Number(r.max_value),
      points: Number(r.points || 0),
    }));

  const settingsRow = rows.find(r => r.rule_type === "gpa_settings");
  let gpaSettings = {
    term_calc_mode: "courses",
    cumulative_calc_mode: "weighted_avg",
    gpa_max: 4.0,
    total_mark: 100,
    final_exam_max: 60,
    coursework_max: 40,
    rounding_decimals: 2,
  };

  if (settingsRow) {
    if (settingsRow.term_calc_mode) gpaSettings.term_calc_mode = settingsRow.term_calc_mode;
    if (settingsRow.cumulative_calc_mode) gpaSettings.cumulative_calc_mode = settingsRow.cumulative_calc_mode;
    if (settingsRow.gpa_max != null) gpaSettings.gpa_max = Number(settingsRow.gpa_max);

    if (settingsRow.label) {
      try {
        const parsed = JSON.parse(settingsRow.label);
        gpaSettings.total_mark = Number(parsed?.total_mark ?? gpaSettings.total_mark);
        gpaSettings.final_exam_max = Number(parsed?.final_exam_max ?? gpaSettings.final_exam_max);
        gpaSettings.coursework_max = Number(parsed?.coursework_max ?? gpaSettings.coursework_max);
        gpaSettings.rounding_decimals = Number(parsed?.rounding_decimals ?? gpaSettings.rounding_decimals);
      } catch {}
    }
  }

  return { gradeScale, gpaSettings };
}

function pickLetterAndPoints(percentage, gradeScale) {
  const p = Number(percentage);
  const row = gradeScale.find(r => p >= r.min && p <= r.max);
  if (!row) return { letter: null, points: null };
  return { letter: row.letter, points: row.points };
}

function roundTo(n, decimals) {
  const d = Number(decimals ?? 2);
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
}

/* -------------------------
   3) GET term status 
   ------------------------- */
app.get("/api/results/term-status", async (req, res) => {
  try {
    const facultyId = Number(req.query.faculty_id);
    const deptId = Number(req.query.department_id);
    const academicYear = (req.query.academic_year || "").trim();
    const levelName = (req.query.level_name || "").trim();
    const termName = (req.query.term_name || "").trim();

    const programType = (req.query.program_type || "undergraduate").trim();
    const pgProgramRaw = (req.query.postgraduate_program || "").trim();
    const pgProgram = programType === "postgraduate" ? (pgProgramRaw || null) : null;

    if (!facultyId || !deptId || !academicYear || !levelName || !termName) {
      return res.status(400).json({ error: "بيانات ناقصة" });
    }
    if (programType === "postgraduate" && !pgProgram) {
      return res.status(400).json({ error: "postgraduate_program مطلوب للدراسات العليا" });
    }

    // courses in term
    const [courses] = await dbp.query(
      `
      SELECT id, course_name, credit_hours
      FROM courses
      WHERE faculty_id = ?
        AND department_id = ?
        AND academic_year = ?
        AND level_name = ?
        AND term_name = ?
        AND program_type = ?
        AND (postgraduate_program <=> ?)
      ORDER BY course_name
      `,
      [facultyId, deptId, academicYear, levelName, termName, programType, pgProgram]
    );

    // students in term
    const [students] = await dbp.query(
      `
      SELECT DISTINCT s.id AS student_id, s.full_name
      FROM students s
      INNER JOIN student_registrations sr ON sr.student_id = s.id
      WHERE s.department_id = ?
        AND sr.academic_year = ?
        AND ${normSqlField("sr.level_name")} = ${normSqlField("?")}
        AND ${normSqlField("sr.term_name")}  = ${normSqlField("?")}
        AND sr.program_type = ?
        AND (sr.postgraduate_program <=> ?)
      `,
      [deptId, academicYear, levelName, termName, programType, pgProgram]
    );

    const totalStudents = students.length;

    // per course: how many completed grades?
    const status = [];
    for (const c of courses) {
      const [rows] = await dbp.query(
        `
        SELECT COUNT(*) AS done
        FROM course_grades
        WHERE course_id = ?
          AND total_mark IS NOT NULL
        `,
        [c.id]
      );
      const done = Number(rows?.[0]?.done || 0);
      const missing = Math.max(0, totalStudents - done);

      status.push({
        course_id: c.id,
        course_name: c.course_name,
        total_students: totalStudents,
        done,
        missing,
        completed: missing === 0 && totalStudents > 0,
      });
    }

    const allCompleted = status.length > 0 && status.every(x => x.completed);

    return res.json({ total_students: totalStudents, courses: status, allCompleted });
  } catch (e) {
    console.error("TERM STATUS ERROR:", e);
    return res.status(500).json({ error: "Database error" });
  }
});

/* -------------------------
   4) GET calculate results (Term GPA + Cumulative GPA)
   ------------------------- */
app.get("/api/results/calculate", async (req, res) => {
  try {
    const facultyId = Number(req.query.faculty_id);
    const deptId = Number(req.query.department_id);
    const academicYear = (req.query.academic_year || "").trim();
    const levelName = (req.query.level_name || "").trim();
    const termName = (req.query.term_name || "").trim();

    const programType = (req.query.program_type || "undergraduate").trim();
    const pgProgramRaw = (req.query.postgraduate_program || "").trim();
    const pgProgram = programType === "postgraduate" ? (pgProgramRaw || null) : null;

    if (!facultyId || !deptId || !academicYear || !levelName || !termName) {
      return res.status(400).json({ error: "بيانات ناقصة" });
    }
    if (programType === "postgraduate" && !pgProgram) {
      return res.status(400).json({ error: "postgraduate_program مطلوب للدراسات العليا" });
    }

    const { gpaSettings } = await getFacultyRules(facultyId);

    // courses in term
    const [courses] = await dbp.query(
      `
      SELECT id, course_name, credit_hours
      FROM courses
      WHERE faculty_id = ?
        AND department_id = ?
        AND academic_year = ?
        AND level_name = ?
        AND term_name = ?
        AND program_type = ?
        AND (postgraduate_program <=> ?)
      ORDER BY course_name
      `,
      [facultyId, deptId, academicYear, levelName, termName, programType, pgProgram]
    );

    // students in term
    const [students] = await dbp.query(
      `
      SELECT DISTINCT s.id AS student_id, s.full_name, s.university_id
      FROM students s
      INNER JOIN student_registrations sr ON sr.student_id = s.id
      WHERE s.department_id = ?
        AND sr.academic_year = ?
        AND ${normSqlField("sr.level_name")} = ${normSqlField("?")}
        AND ${normSqlField("sr.term_name")}  = ${normSqlField("?")}
        AND sr.program_type = ?
        AND (sr.postgraduate_program <=> ?)
      ORDER BY s.full_name
      `,
      [deptId, academicYear, levelName, termName, programType, pgProgram]
    );

    // build map: course credit hours
    const courseHours = new Map();
    courses.forEach(c => courseHours.set(c.id, Number(c.credit_hours || 0)));

    // term grades for all students (only this term courses)
    const [termGrades] = await dbp.query(
      `
      SELECT cg.student_id, cg.course_id, cg.points
      FROM course_grades cg
      INNER JOIN courses c ON c.id = cg.course_id
      WHERE c.faculty_id = ?
        AND c.department_id = ?
        AND c.academic_year = ?
        AND c.level_name = ?
        AND c.term_name = ?
        AND c.program_type = ?
        AND (c.postgraduate_program <=> ?)
      `,
      [facultyId, deptId, academicYear, levelName, termName, programType, pgProgram]
    );

    // cumulative grades for student (كل الفصول)
    const [allGrades] = await dbp.query(
      `
      SELECT cg.student_id, cg.course_id, cg.points, c.credit_hours
      FROM course_grades cg
      INNER JOIN courses c ON c.id = cg.course_id
      WHERE c.faculty_id = ?
        AND c.program_type = ?
        AND (c.postgraduate_program <=> ?)
        AND cg.points IS NOT NULL
      `,
      [facultyId, programType, pgProgram]
    );

    // group term grades by student
    const termByStudent = new Map();
    for (const g of termGrades) {
      if (!termByStudent.has(g.student_id)) termByStudent.set(g.student_id, []);
      termByStudent.get(g.student_id).push(g);
    }

    // group all grades by student
    const allByStudent = new Map();
    for (const g of allGrades) {
      if (!allByStudent.has(g.student_id)) allByStudent.set(g.student_id, []);
      allByStudent.get(g.student_id).push(g);
    }

    // helper compute GPA
    function computeGpaFromItems(items, mode, rounding) {
      if (!items || items.length === 0) return null;

      if (mode === "simple_avg") {
        const pts = items.map(x => Number(x.points)).filter(Number.isFinite);
        if (pts.length === 0) return null;
        const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
        return roundTo(avg, rounding);
      }

    
      let q = 0;
      let h = 0;
      for (const it of items) {
        const p = Number(it.points);
        const hours = Number(it.credit_hours ?? 0);
        if (!Number.isFinite(p) || !Number.isFinite(hours) || hours <= 0) continue;
        q += p * hours;
        h += hours;
      }
      if (h <= 0) return null;
      return roundTo(q / h, rounding);
    }

    const rounding = Number(gpaSettings.rounding_decimals ?? 2);

    const results = students.map(st => {
      const termItemsRaw = termByStudent.get(st.student_id) || [];

      // term items need credit_hours from course map
      const termItems = termItemsRaw.map(x => ({
        points: x.points,
        credit_hours: courseHours.get(x.course_id) || 0,
      }));

      const expectedCourses = courses.length;
      const completedCourses = termItemsRaw.filter(x => x.points != null).length;
      const termComplete = expectedCourses > 0 && completedCourses === expectedCourses;

      const termGpa = termComplete
        ? computeGpaFromItems(termItems, "weighted_avg", rounding)
        : null;

      const allItems = (allByStudent.get(st.student_id) || []).map(x => ({
        points: x.points,
        credit_hours: x.credit_hours,
      }));

      const cumulativeGpa = computeGpaFromItems(allItems, gpaSettings.cumulative_calc_mode, rounding);

      return {
        student_id: st.student_id,
        full_name: st.full_name,
        university_id: st.university_id,
        term_complete: termComplete,
        term_gpa: termGpa,
        cumulative_gpa: cumulativeGpa,
      };
    });

    return res.json({
      courses_count: courses.length,
      students_count: students.length,
      results,
      gpa_settings: gpaSettings,
    });
  } catch (e) {
    console.error("CALC RESULTS ERROR:", e);
    return res.status(500).json({ error: "Database error" });
  }
});


function normalizeTermNameVariants(termName) {
  const t0 = (termName || "").trim();
  if (!t0) return [];

  const variants = new Set();
  const add = (x) => { if (x && x.trim()) variants.add(x.trim()); };

  add(t0);

  // فصل/الفصل
  add(t0.replace("الفصل", "فصل"));
  add(t0.replace("فصل", "الفصل"));


  const swaps = [
    ["الأول", "أول"], ["أول", "الأول"],
    ["الاول", "أول"], 
    ["الثاني", "ثاني"], ["ثاني", "الثاني"],
    ["الثانى", "ثاني"],
    ["الثالث", "ثالث"], ["ثالث", "الثالث"],
    ["الرابع", "رابع"], ["رابع", "الرابع"],
    ["الخامس", "خامس"], ["خامس", "الخامس"],
    ["السادس", "سادس"], ["سادس", "السادس"],
  ];

  for (const [a, b] of swaps) {
    for (const v of Array.from(variants)) {
      if (v.includes(a)) add(v.replace(a, b));
    }
  }

  for (const v of Array.from(variants)) {
    if (!v.includes("فصل") && !v.includes("الفصل")) {
      add("فصل " + v);
      add("الفصل " + v);
    }
  }

  return Array.from(variants);
}


async function getFacultyRules(conn, facultyId) {
  const [settingsRows] = await conn.query(
    `SELECT label, term_calc_mode, gpa_max, cumulative_calc_mode
     FROM grading_rules
     WHERE faculty_id = ? AND rule_type = 'gpa_settings'
     ORDER BY id DESC
     LIMIT 1`,
    [facultyId]
  );

  let rounding_decimals = 2;
  let term_calc_mode = "courses";
  let cumulative_calc_mode = "weighted_avg";
  let gpa_max = 4.0;

  if (settingsRows.length) {
    term_calc_mode = settingsRows[0].term_calc_mode || term_calc_mode;
    cumulative_calc_mode = settingsRows[0].cumulative_calc_mode || cumulative_calc_mode;
    gpa_max = Number(settingsRows[0].gpa_max || gpa_max);

    try {
      const obj = JSON.parse(settingsRows[0].label || "{}");
      if (Number.isFinite(Number(obj.rounding_decimals))) rounding_decimals = Number(obj.rounding_decimals);
    } catch {}
  }

  const [classRows] = await conn.query(
    `SELECT program_mode, label, min_value, max_value, sort_order
     FROM grading_rules
     WHERE faculty_id = ? AND rule_type = 'gpa_classification'
     ORDER BY sort_order, id`,
    [facultyId]
  );

  return { rounding_decimals, term_calc_mode, cumulative_calc_mode, gpa_max, classifications: classRows };
}

function pickClassificationLabel(gpa, programMode, classRows) {
  const g = Number(gpa);
  if (!Number.isFinite(g)) return null;

  const rows = (classRows || []).filter(r => (r.program_mode || "") === programMode);
  const found = rows.find(r => g >= Number(r.min_value) && g <= Number(r.max_value));
  return found ? found.label : null;
}

async function inferProgramMode(conn, facultyId, programType) {
  if ((programType || "undergraduate").trim() === "postgraduate") return "general";

  const [rows] = await conn.query(
    `SELECT DISTINCT program_mode
     FROM grading_rules
     WHERE faculty_id = ?
       AND rule_type = 'gpa_classification'
       AND program_mode IS NOT NULL`,
    [facultyId]
  );

  const modes = rows.map(r => (r.program_mode || "").trim()).filter(Boolean);

  if (modes.length === 1) return modes[0];

  if (modes.includes("honors")) return "honors";
  if (modes.includes("general")) return "general";

  return "honors";
}



//  GET check/preview
app.get("/api/term-results/check", async (req, res) => {
  try {
    const facultyId = Number(req.query.faculty_id);
    const departmentId = Number(req.query.department_id);
    const academicYear = (req.query.academic_year || "").trim();
    const levelName = (req.query.level_name || "").trim();
    const termName = (req.query.term_name || "").trim();
    const programType = (req.query.program_type || "undergraduate").trim();
    const pgProgram = (req.query.postgraduate_program || "").trim() || null;

    if (!facultyId || !departmentId || !academicYear || !levelName || !termName) {
      return res.status(400).json({ error: "بيانات الفترة ناقصة" });
    }
    if (programType === "postgraduate" && !pgProgram) {
      return res.status(400).json({ error: "postgraduate_program مطلوب للدراسات العليا" });
    }

    const termVariants = normalizeTermNameVariants(termName);

    // 1) مواد الفصل
    const [courses] = await dbp.query(
      `
      SELECT id, course_name, credit_hours
      FROM courses
      WHERE faculty_id = ?
        AND department_id = ?
        AND academic_year = ?
        AND level_name = ?
        AND term_name IN (${termVariants.map(() => "?").join(",")})
        AND program_type = ?
        AND (postgraduate_program <=> ?)
      ORDER BY id
      `,
      [facultyId, departmentId, academicYear, levelName, ...termVariants, programType, pgProgram]
    );

    if (courses.length === 0) {
      return res.json({ courses: [], students: [], message: "لا توجد مواد لهذه الفترة" });
    }

    // 2) الطلاب المسجلين (آخر تسجيل لكل طالب)
    const [students] = await dbp.query(
      `
      SELECT
        s.id AS student_id,
        s.full_name,
        s.university_id
      FROM students s
      JOIN (
        SELECT sr.*
        FROM student_registrations sr
        JOIN (
          SELECT student_id, MAX(id) AS max_id
          FROM student_registrations
          WHERE academic_year = ?
            AND level_name = ?
            AND term_name IN (${termVariants.map(() => "?").join(",")})
            AND program_type = ?
            AND (postgraduate_program <=> ?)
            AND registration_status = 'مسجّل'
          GROUP BY student_id
        ) x ON x.max_id = sr.id
      ) r ON r.student_id = s.id
      WHERE s.department_id = ?
      ORDER BY s.full_name
      `,
      [academicYear, levelName, ...termVariants, programType, pgProgram, departmentId]
    );

    // 3) لكل طالب: هل عنده درجات لكل المواد؟
    const courseIds = courses.map(c => c.id);
    const results = [];

    for (const st of students) {
      const [grades] = await dbp.query(
        `
        SELECT course_id, total_mark, points
        FROM course_grades
        WHERE student_id = ?
          AND course_id IN (${courseIds.map(() => "?").join(",")})
        `,
        [st.student_id, ...courseIds]
      );

      const gradeMap = new Map(grades.map(g => [Number(g.course_id), g]));

      let completed = 0;
      let missing = 0;

      for (const c of courses) {
        const g = gradeMap.get(Number(c.id));
        // نعتبرها مكتملة إذا total_mark موجودة ( null)
        if (g && g.total_mark !== null && g.total_mark !== undefined) completed++;
        else missing++;
      }

      results.push({
        student_id: st.student_id,
        full_name: st.full_name,
        university_id: st.university_id,
        courses_count: courses.length,
        completed_courses: completed,
        missing_courses: missing,
      });
    }

    return res.json({ courses, students: results });
  } catch (e) {
    console.error("TERM RESULTS CHECK ERROR:", e);
    return res.status(500).json({ error: "Database error" });
  }
});

//  POST calculate + save into term_results
app.post("/api/term-results/calculate-save", async (req, res) => {
  const {
    faculty_id,
    department_id,
    academic_year,
    level_name,
    term_name,
    program_type,
    postgraduate_program
  } = req.body;

  const facultyId = Number(faculty_id);
  const departmentId = Number(department_id);
  const academicYear = (academic_year || "").trim();
  const levelName = (level_name || "").trim();
  const termName = (term_name || "").trim();
 const programType = (program_type || "undergraduate").trim();
const pgProgram =
  programType === "postgraduate"
    ? ((postgraduate_program || "").trim() || null)
    : null;


  if (!facultyId || !departmentId || !academicYear || !levelName || !termName) {
    return res.status(400).json({ error: "بيانات الفترة ناقصة" });
  }
  if (programType === "postgraduate" && !pgProgram) {
    return res.status(400).json({ error: "postgraduate_program مطلوب للدراسات العليا" });
  }

  const conn = await dbp.getConnection();
  try {
    await conn.beginTransaction();

    const termVariants = normalizeTermNameVariants(termName);

    //  rules ( classifications + rounding)
    const rules = await getFacultyRules(conn, facultyId);
    const roundN = Number.isFinite(Number(rules.rounding_decimals)) ? Number(rules.rounding_decimals) : 2;

    //  (honors/general)
    const programMode = await inferProgramMode(conn, facultyId, programType);

    // 1) مواد الفصل
    const [courses] = await conn.query(
      `
      SELECT id, course_name, credit_hours, term_name, level_name
      FROM courses
      WHERE faculty_id = ?
        AND department_id = ?
        AND academic_year = ?
        AND level_name = ?
        AND term_name IN (${termVariants.map(() => "?").join(",")})
        AND program_type = ?
        AND (postgraduate_program <=> ?)
      ORDER BY id
      `,
      [facultyId, departmentId, academicYear, levelName, ...termVariants, programType, pgProgram]
    );

    if (courses.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: "لا توجد مواد لهذه الفترة" });
    }

    //  canonical term/level من DB 
    const canonicalTermName = (courses[0].term_name || termName).trim();
    const canonicalLevelName = (courses[0].level_name || levelName).trim();

    const courseIds = courses.map(c => c.id);

    // 2) الطلاب المسجلين
    const [students] = await conn.query(
      `
      SELECT
        s.id AS student_id,
        s.full_name,
        s.university_id
      FROM students s
      JOIN (
        SELECT sr.*
        FROM student_registrations sr
        JOIN (
          SELECT student_id, MAX(id) AS max_id
          FROM student_registrations
          WHERE academic_year = ?
            AND level_name = ?
            AND term_name IN (${termVariants.map(() => "?").join(",")})
            AND program_type = ?
            AND (postgraduate_program <=> ?)
            AND registration_status = 'مسجّل'
          GROUP BY student_id
        ) x ON x.max_id = sr.id
      ) r ON r.student_id = s.id
      WHERE s.department_id = ?
      ORDER BY s.full_name
      `,
      [academicYear, canonicalLevelName, ...termVariants, programType, pgProgram, departmentId]
    );

    const saved = [];
    const skipped = [];


    async function calcCumulativeGpa(studentId) {
  try {
    // 1.  قائمة المواد المعادة في الفصل الحالي  student_registrations
    const [regRows] = await conn.query(
      `
      SELECT repeated_courses
      FROM student_registrations
      WHERE student_id = ?
        AND academic_year = ?
        AND level_name = ?
        AND term_name IN (${termVariants.map(() => "?").join(",")})
        AND program_type = ?
        AND (postgraduate_program <=> ?)
      LIMIT 1
      `,
      [studentId, academicYear, canonicalLevelName, ...termVariants, programType, pgProgram]
    );

    let repeatedIds = [];
    if (regRows.length > 0 && regRows[0].repeated_courses) {
      repeatedIds = regRows[0].repeated_courses
        .split(',')
        .map(id => Number(id.trim()))
        .filter(id => Number.isFinite(id));
    }

    // 2. جيب كل الدرجات      
    const [gradeRows] = await conn.query(
      `
      SELECT 
        cg.points,
        cg.total_mark,
        c.credit_hours,
        c.id AS course_id,
        c.academic_year,
        c.term_name
      FROM course_grades cg
      JOIN courses c ON c.id = cg.course_id
      WHERE cg.student_id = ?
        AND cg.points IS NOT NULL
        AND c.credit_hours IS NOT NULL
        AND c.faculty_id = ?
        AND c.department_id = ?
        AND c.program_type = ?
        AND (c.postgraduate_program <=> ?)
      ORDER BY 
        c.academic_year ASC,
        CASE 
          WHEN TRIM(c.term_name) IN ('فصل الأول', 'الفصل الأول') THEN 1
          WHEN TRIM(c.term_name) IN ('فصل الثاني', 'الفصل الثاني') THEN 2
          ELSE 0
        END ASC
      `,
      [studentId, facultyId, departmentId, programType, pgProgram]
    );

    // 3. تجميع الدرجات حسب course_id
    const gradesByCourse = new Map();
    for (const row of gradeRows) {
      const cid = row.course_id;
      if (!gradesByCourse.has(cid)) {
        gradesByCourse.set(cid, []);
      }
      gradesByCourse.get(cid).push(row);
    }

    let totalPointsHours = 0;   // sum (points * credit_hours)
    let totalHours = 0;         // sum (credit_hours)

    for (const [courseId, attempts] of gradesByCourse.entries()) {
      // إذا المادة غير معادة → نجمع كل المحاولات (واحدة)
      if (!repeatedIds.includes(courseId)) {
        for (const attempt of attempts) {
          const p = Number(attempt.points);
          const h = Number(attempt.credit_hours);
          if (Number.isFinite(p) && Number.isFinite(h) && h > 0) {
            totalPointsHours += p * h;
            totalHours += h;
          }
        }
        continue;
      }

      //  مادة معادة 
      // نرتب المحاولات حسب السنة ثم الفصل
      attempts.sort((a, b) => {
        if (a.academic_year !== b.academic_year) {
          return Number(a.academic_year) - Number(b.academic_year);
        }

        const termA = (a.term_name || '').trim();
        const termB = (b.term_name || '').trim();

        const orderA =
          termA === 'فصل الأول' || termA === 'الفصل الأول' ? 1 :
          termA === 'فصل الثاني' || termA === 'الفصل الثاني' ? 2 : 0;

        const orderB =
          termB === 'فصل الأول' || termB === 'الفصل الأول' ? 1 :
          termB === 'فصل الثاني' || termB === 'الفصل الثاني' ? 2 : 0;

        return orderA - orderB;
      });

      // آخر محاولة (الأحدث)
      const latestAttempt = attempts[attempts.length - 1];

      // لو نجح في آخر محاولة → نأخذها فقط (نستبعد الرسوب القديم)
      if (latestAttempt && Number(latestAttempt.total_mark) >= 50) {
        const p = Number(latestAttempt.points);
        const h = Number(latestAttempt.credit_hours);
        if (Number.isFinite(p) && Number.isFinite(h) && h > 0) {
          totalPointsHours += p * h;
          totalHours += h;
        }
      } else {
        // لو ما نجحش في آخر محاولة → نجمع كل المحاولات (كلها رسوب)
        for (const attempt of attempts) {
          const p = Number(attempt.points);
          const h = Number(attempt.credit_hours);
          if (Number.isFinite(p) && Number.isFinite(h) && h > 0) {
            totalPointsHours += p * h;
            totalHours += h;
          }
        }
      }
    }

    // 4. الحساب النهائي
    if (totalHours === 0) return null;

    const cumulativeGpa = totalPointsHours / totalHours;
    return Number(cumulativeGpa.toFixed(roundN || 2));
  } catch (err) {
    console.error("Error in calcCumulativeGpa:", err);
    return null;
  }
}
    
    for (const st of students) {
      const studentId = Number(st.student_id);

      const [grades] = await conn.query(
        `
        SELECT cg.course_id, cg.total_mark, cg.points, c.credit_hours
        FROM course_grades cg
        JOIN courses c ON c.id = cg.course_id
        WHERE cg.student_id = ?
          AND cg.course_id IN (${courseIds.map(() => "?").join(",")})
        `,
        [studentId, ...courseIds]
      );

      const gradeMap = new Map(grades.map(g => [Number(g.course_id), g]));

      let completed = 0;
      let missing = 0;
      let termSumPH = 0;
      let termSumH = 0;

      for (const c of courses) {
        const g = gradeMap.get(Number(c.id));
        if (!g || g.total_mark == null || g.points == null) {
          missing++;
          continue;
        }
        const p = Number(g.points);
        const h = Number(g.credit_hours ?? c.credit_hours);
        if (!Number.isFinite(p) || !Number.isFinite(h) || h <= 0) {
          missing++;
          continue;
        }
        completed++;
        termSumPH += p * h;
        termSumH += h;
      }

      const coursesCount = courses.length;

      if (missing > 0) {
        skipped.push({
          student_id: studentId,
          full_name: st.full_name,
          university_id: st.university_id,
          courses_count: coursesCount,
          completed_courses: completed,
          missing_courses: missing,
          reason: "درجات ناقصة لبعض المواد",
        });
        continue;
      }

      const termGpa = termSumH === 0 ? null : Number((termSumPH / termSumH).toFixed(roundN));
      let resultStatus = 0;  //  رسوب

if (termGpa !== null) {
    if (termGpa >= 2.0) {        
        resultStatus = 1;          // نجاح
    }
  }
  await conn.query(
    `
    UPDATE student_registrations
       SET result_status = ?
     WHERE student_id = ?
       AND academic_year = ?
       AND level_name    = ?
       AND term_name     = ?
       AND program_type  = ?
       AND (postgraduate_program <=> ?)
    `,
    [
        resultStatus,
        studentId,
        academicYear,
        canonicalLevelName,
        canonicalTermName,
        programType,
        pgProgram
    ]
);

  await conn.query(
    `
    UPDATE student_registrations
       SET result_status = ?
     WHERE student_id = ?
       AND academic_year = ?
       AND level_name    = ?
       AND term_name     = ?
       AND program_type  = ?
       AND (postgraduate_program <=> ?)
    `,
    [
        resultStatus,
        studentId,
        academicYear,
        canonicalLevelName,
        canonicalTermName,
        programType,
        pgProgram
    ]
);

      const cumulativeGpa = await calcCumulativeGpa(studentId);

      const classificationLabel = pickClassificationLabel(termGpa, programMode, rules.classifications);

const [existing] = await conn.query(
  `SELECT id FROM term_results 
   WHERE student_id = ? 
     AND academic_year = ? 
     AND level_name = ? 
     AND term_name = ? 
     AND program_type = ? 
     AND (postgraduate_program <=> ?)`,
  [studentId, academicYear, canonicalLevelName, canonicalTermName, programType, pgProgram]
);

if (existing.length > 0) {
  await conn.query(
    `UPDATE term_results SET 
       term_gpa = ?, cumulative_gpa = ?, 
       term_total_points = ?, term_total_hours = ?,
       classification_label = ?, 
       courses_count = ?, completed_courses = ?, missing_courses = ?,
       updated_at = NOW()
     WHERE id = ?`,
    [termGpa, cumulativeGpa, termSumPH, termSumH, classificationLabel,
     coursesCount, completed, missing, existing[0].id]
  );
} else {

      await conn.query(
        `
        INSERT INTO term_results
          (student_id, faculty_id, department_id,
           academic_year, level_name, term_name,
           program_type, postgraduate_program, program_mode,
           term_gpa, cumulative_gpa,
           term_total_points, term_total_hours,
           classification_label,
           courses_count, completed_courses, missing_courses)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
           term_gpa = VALUES(term_gpa),
           cumulative_gpa = VALUES(cumulative_gpa),
           term_total_points = VALUES(term_total_points),
           term_total_hours = VALUES(term_total_hours),
           classification_label = VALUES(classification_label),
           courses_count = VALUES(courses_count),
           completed_courses = VALUES(completed_courses),
           missing_courses = VALUES(missing_courses),
           program_mode = VALUES(program_mode),
           updated_at = NOW()
        `,
        [
          studentId, facultyId, departmentId,
          academicYear, canonicalLevelName, canonicalTermName,
          programType, pgProgram, programMode,
          termGpa, cumulativeGpa,
          termSumPH, termSumH,
          classificationLabel,
          coursesCount, completed, missing
        ]
      );
    }

      saved.push({
        student_id: studentId,
        full_name: st.full_name,
        university_id: st.university_id,
        term_gpa: termGpa,
        cumulative_gpa: cumulativeGpa,
        classification_label: classificationLabel,
        term_total_points: termSumPH,
        term_total_hours: termSumH,
      });

    }
    

    await conn.commit();
    return res.json({
      message: `تم حساب وحفظ النتائج: ${saved.length} طالب، تم تجاوز: ${skipped.length} طالب (درجات ناقصة)`,
      saved,
      skipped,
    });
  } catch (e) {
    await conn.rollback();
    console.error("TERM RESULTS CALC/SAVE ERROR:", e);
    return res.status(500).json({ error: "Database error" });
  } finally {
    conn.release();
  }
});



//  GET list saved term results (display)
app.get("/api/term-results/list", async (req, res) => {
  try {
    const facultyId = Number(req.query.faculty_id);
    const departmentId = Number(req.query.department_id);
    const academicYear = (req.query.academic_year || "").trim();
    const levelName = (req.query.level_name || "").trim();
    const termName = (req.query.term_name || "").trim();
    const programType = (req.query.program_type || "undergraduate").trim();
    const pgProgram = (req.query.postgraduate_program || "").trim() || null;

    if (!facultyId || !departmentId || !academicYear || !levelName || !termName) {
      return res.status(400).json({ error: "بيانات الفترة ناقصة" });
    }
    if (programType === "postgraduate" && !pgProgram) {
      return res.status(400).json({ error: "postgraduate_program مطلوب للدراسات العليا" });
    }

    const termVariants = normalizeTermNameVariants(termName);

    //  program_mode 
    const conn = await dbp.getConnection();
    const programMode = await inferProgramMode(conn, facultyId, programType);
    conn.release();

    const [rows] = await dbp.query(
      `
      SELECT
        tr.student_id,
        s.full_name,
        s.university_id,
        tr.term_gpa,
        tr.cumulative_gpa,
        tr.classification_label,
        tr.term_total_points,
        tr.term_total_hours,
        tr.courses_count,
        tr.completed_courses,
        tr.missing_courses
      FROM term_results tr
      JOIN students s ON s.id = tr.student_id
      WHERE tr.faculty_id = ?
        AND tr.department_id = ?
        AND tr.academic_year = ?
        AND tr.level_name = ?
        AND tr.term_name IN (${termVariants.map(() => "?").join(",")})
        AND tr.program_type = ?
        AND (tr.postgraduate_program <=> ?)
        AND tr.program_mode = ?
      ORDER BY s.full_name
      `,
      [facultyId, departmentId, academicYear, levelName, ...termVariants, programType, pgProgram, programMode]
    );

    return res.json(rows);
  } catch (e) {
    console.error("TERM RESULTS LIST ERROR:", e);
    return res.status(500).json({ error: "Database error" });
  }
});


app.get("/api/term-students", async (req, res) => {
  try {
    const deptId = Number(req.query.department_id);
    const academicYear = (req.query.academic_year || "").trim();
    const levelName = (req.query.level_name || "").trim();
    const termName = (req.query.term_name || "").trim();

    const programType = (req.query.program_type || "undergraduate").trim();
    const pgRaw = (req.query.postgraduate_program || "").trim();
    const pgProgram = programType === "postgraduate" ? (pgRaw || null) : null;

    if (!deptId || !academicYear || !levelName || !termName) {
      return res.status(400).json({ error: "بيانات ناقصة" });
    }
    if (programType === "postgraduate" && !pgProgram) {
      return res.status(400).json({ error: "postgraduate_program مطلوب للدراسات العليا" });
    }

    const [rows] = await dbp.query(
      `
      SELECT DISTINCT
        s.id AS student_id,
        s.full_name,
        s.university_id,
        sr.academic_status,
        sr.registration_status
      FROM students s
      INNER JOIN student_registrations sr ON sr.student_id = s.id
      WHERE s.department_id = ?
        AND sr.academic_year = ?
        AND ${normSqlField("sr.level_name")} = ${normSqlField("?")}
        AND ${normSqlField("sr.term_name")}  = ${normSqlField("?")}
        AND sr.program_type = ?
        AND (sr.postgraduate_program <=> ?)
      ORDER BY s.full_name
      `,
      [deptId, academicYear, levelName, termName, programType, pgProgram]
    );

    return res.json(rows);
  } catch (e) {
    console.error("TERM STUDENTS ERROR:", e);
    return res.status(500).json({ error: "Database error" });
  }
});


app.get("/api/courses/by-term", async (req, res) => {
  try {
    const departmentId = Number(req.query.department_id);
    const academicYear = (req.query.academic_year || "").trim();
    const levelName = (req.query.level_name || "").trim();
    const termName = (req.query.term_name || "").trim();
    const programType = (req.query.program_type || "undergraduate").trim();
    const pgProgramRaw = (req.query.postgraduate_program || "").trim();
    const pgProgram = programType === "postgraduate" ? (pgProgramRaw || null) : null;

    if (!departmentId || !academicYear || !levelName || !termName) {
      return res.status(400).json({ error: "بيانات ناقصة" });
    }

    const [rows] = await dbp.query(
      `
      SELECT
        c.id,
        c.course_name,
        c.credit_hours,
        c.total_mark,
        c.coursework_max,
        c.final_exam_max,
        c.instructor,
        c.instructor_id
      FROM courses c
      WHERE c.department_id = ?
        AND c.academic_year = ?
        AND TRIM(c.level_name) = TRIM(?)
        AND TRIM(c.term_name) = TRIM(?)
        AND c.program_type = ?
        AND (c.postgraduate_program <=> ?)
      ORDER BY c.id DESC
      `,
      [departmentId, academicYear, levelName, termName, programType, pgProgram]
    );

    res.json(rows);
  } catch (e) {
    console.error("COURSES BY TERM ERROR:", e);
    res.status(500).json({ error: "Database error" });
  }
});


app.put("/api/courses/:id/instructor", async (req, res) => {
  try {
    const courseId = Number(req.params.id);
    const staffId = req.body?.instructor_id ? Number(req.body.instructor_id) : null;

    if (!courseId) return res.status(400).json({ error: "Invalid course id" });

    if (!staffId) {
      await dbp.query(
        "UPDATE courses SET instructor_id = NULL, instructor = NULL, updated_at = NOW() WHERE id = ?",
        [courseId]
      );
      return res.json({ ok: true });
    }

    const [staffRows] = await dbp.query(
      "SELECT id, full_name FROM staff_members WHERE id = ?",
      [staffId]
    );
    if (staffRows.length === 0) return res.status(404).json({ error: "عضو هيئة التدريس غير موجود" });

    const fullName = staffRows[0].full_name;

    await dbp.query(
      "UPDATE courses SET instructor_id = ?, instructor = ?, updated_at = NOW() WHERE id = ?",
      [staffId, fullName, courseId]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("SET COURSE INSTRUCTOR ERROR:", e);
    res.status(500).json({ error: "Database error" });
  }
});

// ===============================
// STAFF MEMBERS (CRUD)
// ===============================

// GET: list + filters + search
app.get("/api/staff-members", async (req, res) => {
  try {
    const facultyId = req.query.faculty_id ? Number(req.query.faculty_id) : null;
    const departmentId = req.query.department_id ? Number(req.query.department_id) : null;
    const q = (req.query.q || "").trim();

    let where = "WHERE 1=1";
    const params = [];

    if (facultyId) {
      where += " AND sm.faculty_id = ?";
      params.push(facultyId);
    }
    if (departmentId) {
      where += " AND sm.department_id = ?";
      params.push(departmentId);
    }
    if (q) {
      where += " AND (sm.full_name LIKE ? OR sm.email LIKE ? OR sm.phone LIKE ? OR sm.academic_rank LIKE ? OR sm.specialization LIKE ?)";
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }

    const [rows] = await dbp.query(
      `
      SELECT sm.*
      FROM staff_members sm
      ${where}
      ORDER BY sm.id DESC
      `,
      params
    );

    res.json(rows);
  } catch (e) {
    console.error("GET STAFF MEMBERS ERROR:", e);
    res.status(500).json({ error: "Database error" });
  }
});

// POST: create
app.post("/api/staff-members", async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      faculty_id,
      department_id,
      academic_rank,
      specialization,
    } = req.body || {};

 if (!full_name || !faculty_id) {
  return res.status(400).json({ error: "full_name, faculty_id مطلوبة" });
}


    const [r] = await dbp.query(
      `
      INSERT INTO staff_members
        (full_name, email, phone,
         faculty_id, department_id,
         academic_rank, specialization,
         status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        String(full_name).trim(),
        email ? String(email).trim() : null,
        phone ? String(phone).trim() : null,
        Number(faculty_id),
        department_id ? Number(department_id) : null,
        academic_rank ? String(academic_rank).trim() : null,
        specialization ? String(specialization).trim() : null,
        "active",
      ]
    );

    res.json({ id: r.insertId });
  } catch (e) {
    console.error("CREATE STAFF MEMBER ERROR:", e);
    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "فيه تكرار في الإيميل" });
    }
    res.status(500).json({ error: "Database error" });
  }
});

// PUT: update
app.put("/api/staff-members/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    if (!id) return res.status(400).json({ error: "Invalid id" });

    const fields = [
      "full_name",
      "email",
      "phone",
      "faculty_id",
      "department_id",
      "academic_rank",
      "specialization",
    ];

    const sets = [];
    const params = [];

    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(body, f)) {
        sets.push(`${f} = ?`);
        const v = body[f];
        params.push(v === "" ? null : v);
      }
    }

    if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });

    params.push(id);

    await dbp.query(
      `UPDATE staff_members SET ${sets.join(", ")}, updated_at = NOW() WHERE id = ?`,
      params
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("UPDATE STAFF MEMBER ERROR:", e);
    if (e?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "فيه تكرار في الإيميل" });
    }
    res.status(500).json({ error: "Database error" });
  }
});

// DELETE: remove 
app.delete("/api/staff-members/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });

    await dbp.query("DELETE FROM staff_members WHERE id = ?", [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE STAFF MEMBER ERROR:", e);
    res.status(500).json({ error: "Database error" });
  }
});

// GET academic ranks (distinct)
app.get("/api/academic-ranks", async (req, res) => {
  try {
    const facultyId = req.query.faculty_id ? Number(req.query.faculty_id) : null;
    const departmentId = req.query.department_id ? Number(req.query.department_id) : null;

    let where = "WHERE academic_rank IS NOT NULL AND TRIM(academic_rank) <> ''";
    const params = [];

    if (facultyId) {
      where += " AND faculty_id = ?";
      params.push(facultyId);
    }
    if (departmentId) {
      where += " AND department_id = ?";
      params.push(departmentId);
    }

    const [rows] = await dbp.query(
      `
 SELECT DISTINCT TRIM(academic_rank) AS academic_rank
FROM staff_members
WHERE academic_rank IS NOT NULL AND TRIM(academic_rank) <> ''
ORDER BY academic_rank ASC;

      `,
      params
    );

    res.json(rows.map(r => r.academic_rank));
  } catch (e) {
    console.error("GET ACADEMIC RANKS ERROR:", e);
    res.status(500).json({ error: "Database error" });
  }
});


// ===============================
// Dashboard Summary
// ===============================
app.get("/api/dashboard/summary", async (req, res) => {
  try {
    const queries = await Promise.allSettled([
      dbp.query("SELECT COUNT(*) AS c FROM students"),
      dbp.query("SELECT COUNT(*) AS c FROM student_registrations"),
      dbp.query("SELECT COUNT(*) AS c FROM courses"),
      dbp.query("SELECT COUNT(*) AS c FROM term_results"),
      dbp.query("SELECT COUNT(*) AS c FROM books"),
      dbp.query("SELECT COUNT(*) AS c FROM staff_members"),
      dbp.query("SELECT COUNT(*) AS c FROM faculties"),
      dbp.query("SELECT COUNT(*) AS c FROM departments"),
    ]);

    const getCount = (i) => {
      const r = queries[i];
      if (r.status !== "fulfilled") return null;
      return r.value?.[0]?.[0]?.c ?? null;
    };

    res.json({
      students: getCount(0),
      registrations: getCount(1),
      courses: getCount(2),
      term_results: getCount(3),
      books: getCount(4),
      staff_members: getCount(5),
      faculties: getCount(6),
      departments: getCount(7),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("DASHBOARD SUMMARY ERROR:", e);
    res.status(500).json({ error: "Database error" });
  }
});


// آخر فترة/فصل مسجل فيها لقسم معيّن + برنامج
app.get("/api/registrations/last-period", (req, res) => {
  const departmentId = Number(req.query.department_id);
  const programType = (req.query.program_type || "undergraduate").trim();

  const pgProgram =
    programType === "postgraduate"
      ? (req.query.postgraduate_program || "").trim()
      : null;

  const academicYear = (req.query.academic_year || "").trim(); 
  const levelName = (req.query.level_name || "").trim();       

  if (!departmentId) {
    return res.status(400).json({ message: "department_id مطلوب" });
  }

  let sql = `
    SELECT r.academic_year, r.level_name, r.term_name, r.created_at
    FROM student_registrations r
    JOIN students s ON s.id = r.student_id
    WHERE s.department_id = ?
      AND r.program_type = ?
      AND (r.postgraduate_program <=> ?)
  `;
  const params = [departmentId, programType, pgProgram];

  if (academicYear) {
    sql += ` AND r.academic_year = ? `;
    params.push(academicYear);
  }
  if (levelName) {
    sql += ` AND r.level_name = ? `;
    params.push(levelName);
  }

  sql += `
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT 1
  `;

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!rows?.length) return res.json({ lastPeriod: null });
    return res.json({ lastPeriod: rows[0] });
  });
});

/* =========================
   Rooms
   ========================= */

// GET all rooms
app.get("/api/rooms", async (req, res) => {
  try {
    const [rows] = await dbp.query(
      `SELECT id, room_name FROM rooms ORDER BY room_name ASC`
    );
    res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    console.error("GET rooms error:", err);
    res.status(500).json({ error: "خطأ في السيرفر (rooms)" });
  }
});

// ADD room
app.post("/api/rooms", async (req, res) => {
  try {
    const name = String(req.body?.room_name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "اسم القاعة مطلوب" });
    }

    const [result] = await dbp.query(
      `INSERT INTO rooms (room_name) VALUES (?)`,
      [name]
    );

    res.json({ id: result.insertId, room_name: name });
  } catch (err) {
    console.error("POST rooms error:", err);

    // duplicate room name
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "اسم القاعة موجود مسبقاً" });
    }

    res.status(500).json({ error: "خطأ في السيرفر (add room)" });
  }
});

// UPDATE room
app.put("/api/rooms/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body?.room_name || "").trim();

    if (!id) return res.status(400).json({ error: "ID غير صحيح" });
    if (!name) return res.status(400).json({ error: "اسم القاعة مطلوب" });

    const [result] = await dbp.query(
      `UPDATE rooms SET room_name = ? WHERE id = ?`,
      [name, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "القاعة غير موجودة" });
    }

    res.json({ message: "تم تعديل القاعة" });
  } catch (err) {
    console.error("PUT rooms error:", err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "اسم القاعة موجود مسبقاً" });
    }

    res.status(500).json({ error: "خطأ في السيرفر (update room)" });
  }
});

// DELETE room
app.delete("/api/rooms/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "ID غير صحيح" });

    const [result] = await dbp.query(
      `DELETE FROM rooms WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "القاعة غير موجودة" });
    }

    res.json({ message: "تم حذف القاعة" });
  } catch (err) {
    console.error("DELETE rooms error:", err);
    res.status(500).json({ error: "خطأ في السيرفر (delete room)" });
  }
});

/* =========================================================
   Timetable Sessions (Strict Conflicts: Room + Instructor + Department)
   ========================================================= */

// helper: check conflicts
async function checkSessionConflicts({
  excludeId = null,
  facultyId,
  departmentId,
  academicYear,
  levelName,
  termName,
  programType,
  pgProg,
  dayOfWeek,
  startTime,
  endTime,
  roomId,
  instructorStaffId,
}) {
  // 1) ROOM conflict 
  {
    const sql = `
      SELECT id, room_id, day_of_week, start_time, end_time
      FROM timetable_sessions
      WHERE day_of_week = ?
        AND room_id = ?
        ${excludeId ? "AND id <> ?" : ""}
        AND NOT (end_time <= ? OR start_time >= ?)
      LIMIT 1
    `;
    const params = [
      dayOfWeek,
      roomId,
      ...(excludeId ? [excludeId] : []),
      startTime,
      endTime,
    ];
    const [hits] = await dbp.query(sql, params);
    if (hits.length) {
      return {
        ok: false,
        status: 409,
        type: "ROOM",
        error: `تضارب: القاعة مشغولة من ${hits[0].start_time} إلى ${hits[0].end_time} في يوم ${dayOfWeek}`,
        conflict: hits[0],
      };
    }
  }

  // 2) INSTRUCTOR conflict
  if (instructorStaffId) {
    const sql = `
      SELECT id, instructor_staff_id, day_of_week, start_time, end_time
      FROM timetable_sessions
      WHERE academic_year = ?
        AND term_name = ?
        AND day_of_week = ?
        AND instructor_staff_id = ?
        ${excludeId ? "AND id <> ?" : ""}
        AND NOT (end_time <= ? OR start_time >= ?)
      LIMIT 1
    `;
    const params = [
      academicYear,
      termName,
      dayOfWeek,
      instructorStaffId,
      ...(excludeId ? [excludeId] : []),
      startTime,
      endTime,
    ];
    const [hits] = await dbp.query(sql, params);
    if (hits.length) {
      return {
        ok: false,
        status: 409,
        type: "INSTRUCTOR",
        error: `تضارب: الأستاذ مشغول من ${hits[0].start_time} إلى ${hits[0].end_time}`,
        conflict: hits[0],
      };
    }
  }

  // 3) DEPARTMENT / GROUP conflict 
  {
    const sql = `
      SELECT id, course_id, day_of_week, start_time, end_time, room_id
      FROM timetable_sessions
      WHERE faculty_id = ?
        AND department_id = ?
        AND academic_year = ?
        AND level_name = ?
        AND term_name = ?
        AND program_type = ?
        AND (postgraduate_program <=> ?)
        AND day_of_week = ?
        ${excludeId ? "AND id <> ?" : ""}
        AND NOT (end_time <= ? OR start_time >= ?)
      LIMIT 1
    `;
    const params = [
      facultyId,
      departmentId,
      academicYear,
      levelName,
      termName,
      programType,
      pgProg,
      dayOfWeek,
      ...(excludeId ? [excludeId] : []),
      startTime,
      endTime,
    ];
    const [hits] = await dbp.query(sql, params);
    if (hits.length) {
      return {
        ok: false,
        status: 409,
        type: "DEPARTMENT",
        error: `تضارب في جدول القسم/المستوى: موجودة محاضرة أخرى من ${hits[0].start_time} إلى ${hits[0].end_time}`,
        conflict: hits[0],
      };
    }
  }

  return { ok: true };
}


/* =========================================================
   GET /api/timetable-sessions
   ========================================================= */
app.get("/api/timetable-sessions", async (req, res) => {
  try {
    const {
      faculty_id,
      department_id,
      academic_year,
      level_name,
      term_name,
      program_type,
      postgraduate_program,
    } = req.query;

    if (!faculty_id || !department_id || !academic_year || !level_name || !term_name || !program_type) {
      return res.status(400).json({ error: "Query ناقص لعرض الجدول" });
    }

    const pg =
      program_type === "postgraduate"
        ? String(postgraduate_program || "").trim()
        : null;

    const [rows] = await dbp.query(
      `
      SELECT ts.*, c.course_name, r.room_name
      FROM timetable_sessions ts
      LEFT JOIN courses c ON c.id = ts.course_id
      LEFT JOIN rooms r ON r.id = ts.room_id
      WHERE ts.faculty_id = ?
        AND ts.department_id = ?
        AND ts.academic_year = ?
        AND ts.level_name = ?
        AND ts.term_name = ?
        AND ts.program_type = ?
        AND (ts.postgraduate_program <=> ?)
      ORDER BY ts.day_of_week, ts.start_time
      `,
      [
        Number(faculty_id),
        Number(department_id),
        academic_year,
        level_name,
        term_name,
        program_type,
        pg,
      ]
    );

    res.json(rows);
  } catch (err) {
    console.error("GET timetable-sessions error:", err);
    res.status(500).json({ error: "خطأ في السيرفر" });
  }
});

/* =========================================================
   POST /api/timetable-sessions
   ========================================================= */
app.post("/api/timetable-sessions", async (req, res) => {
  try {
    const {
      faculty_id,
      department_id,
      academic_year,
      level_name,
      term_name,
      program_type,
      postgraduate_program,
      course_id,
      instructor_staff_id,
      instructor_name,
      room_id,
      day_of_week,
      start_time,
      end_time,
    } = req.body;

    if (
      !faculty_id || !department_id || !academic_year || !level_name || !term_name ||
      !program_type || !course_id || !room_id || !day_of_week || !start_time || !end_time
    ) {
      return res.status(400).json({ error: "البيانات ناقصة" });
    }

    if (start_time >= end_time) {
      return res.status(400).json({ error: "زمن البداية لازم يكون قبل النهاية" });
    }

    const pg = program_type === "postgraduate" ? (postgraduate_program || "").trim() : null;

  
    const conflict = await checkSessionConflicts({
      facultyId: faculty_id,
      departmentId: department_id,
      academicYear: academic_year,
      levelName: level_name,
      termName: term_name,
      programType: program_type,
      pgProg: pg,
      dayOfWeek: day_of_week,
      startTime: start_time,
      endTime: end_time,
      roomId: room_id,
      instructorStaffId: instructor_staff_id || null,
    });

    if (!conflict.ok) {
      return res.status(conflict.status).json({
        error: conflict.error,
        type: conflict.type,
        conflict: conflict.conflict,  
      });
    }

    try {
      const [result] = await dbp.query(
        `
        INSERT INTO timetable_sessions (
          faculty_id, department_id, academic_year, level_name, term_name,
          program_type, postgraduate_program,
          course_id, instructor_staff_id, instructor_name,
          room_id, day_of_week, start_time, end_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          faculty_id,
          department_id,
          academic_year,
          level_name,
          term_name,
          program_type,
          pg,
          course_id,
          instructor_staff_id || null,
          instructor_name || null,
          room_id,
          day_of_week,
          start_time,
          end_time,
        ]
      );

      res.json({ id: result.insertId, message: "تم حفظ المحاضرة" });
    } catch (err) {
      if (err.code === "ER_SIGNAL_EXCEPTION") {
        return res.status(409).json({ error: err.sqlMessage });
      }
      throw err; 
    }

  } catch (err) {
    console.error("POST timetable-sessions error:", err);
    res.status(500).json({ error: "خطأ في السيرفر" });
  }
});


/* =========================================================
   PUT /api/timetable-sessions/:id
   ========================================================= */
app.put("/api/timetable-sessions/:id", async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    if (!sessionId) return res.status(400).json({ error: "ID غير صحيح" });

    const {
      faculty_id,
      department_id,
      academic_year,
      level_name,
      term_name,
      program_type,
      postgraduate_program,
      course_id,
      instructor_staff_id,
      instructor_name,
      room_id,
      day_of_week,
      start_time,
      end_time,
    } = req.body;

    if (
      !faculty_id || !department_id || !academic_year || !level_name || !term_name ||
      !program_type || !course_id || !room_id || !day_of_week || !start_time || !end_time
    ) {
      return res.status(400).json({ error: "البيانات ناقصة" });
    }

    if (start_time >= end_time) {
      return res.status(400).json({ error: "زمن البداية لازم يكون قبل النهاية" });
    }

    const pg = program_type === "postgraduate" ? (postgraduate_program || "").trim() : null;

    const conflict = await checkSessionConflicts({
      excludeId: sessionId,
      facultyId: faculty_id,
      departmentId: department_id,
      academicYear: academic_year,
      levelName: level_name,
      termName: term_name,
      programType: program_type,
      pgProg: pg,
      dayOfWeek: day_of_week,
      startTime: start_time,
      endTime: end_time,
      roomId: room_id,
      instructorStaffId: instructor_staff_id || null,
    });

    if (!conflict.ok) {
      return res.status(conflict.status).json(conflict);
    }

    await dbp.query(
      `
      UPDATE timetable_sessions
      SET
        faculty_id = ?, department_id = ?, academic_year = ?, level_name = ?, term_name = ?,
        program_type = ?, postgraduate_program = ?,
        course_id = ?, instructor_staff_id = ?, instructor_name = ?,
        room_id = ?, day_of_week = ?, start_time = ?, end_time = ?
      WHERE id = ?
      `,
      [
        faculty_id,
        department_id,
        academic_year,
        level_name,
        term_name,
        program_type,
        pg,
        course_id,
        instructor_staff_id || null,
        instructor_name || null,
        room_id,
        day_of_week,
        start_time,
        end_time,
        sessionId,
      ]
    );

    res.json({ message: "تم تعديل المحاضرة" });
  } catch (err) {
  console.error("PUT timetable-sessions error:", err);

  if (err.code === "ER_SIGNAL_EXCEPTION") {
    return res.status(409).json({ error: err.sqlMessage });
  }

  res.status(500).json({ error: "خطأ في السيرفر" });
}

});

/* =========================================================
   DELETE /api/timetable-sessions/:id
   ========================================================= */
app.delete("/api/timetable-sessions/:id", async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    if (!sessionId) {
      return res.status(400).json({ error: "ID غير صحيح" });
    }

    const [result] = await dbp.query(
      "DELETE FROM timetable_sessions WHERE id = ?",
      [sessionId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "المحاضرة غير موجودة" });
    }

    res.json({ message: "تم حذف المحاضرة بنجاح" });
  } catch (err) {
    console.error("DELETE timetable-sessions error:", err);
    res.status(500).json({ error: "خطأ في السيرفر" });
  }
});

// GET: جلب البرامج المتاحة للدراسات العليا 
app.get("/api/postgraduate-programs", async (req, res) => {
  try {
    const [rows] = await dbp.query(
      `
      SELECT DISTINCT TRIM(postgraduate_program) AS program_name
      FROM academic_periods
      WHERE program_type = 'postgraduate'
        AND postgraduate_program IS NOT NULL
        AND TRIM(postgraduate_program) <> ''
      ORDER BY program_name ASC
      `
    );
    res.json(rows.map(r => r.program_name));
  } catch (e) {
    console.error("GET POSTGRAD PROGRAMS ERROR:", e);
    res.status(500).json({ error: "Database error" });
  }
});



// ---------------------
// GET /api/users
// ---------------------
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const [rows] = await dbp.query(`
      SELECT 
        id, 
        username, 
        full_name, 
        email, 
        role, 
        is_active, 
        allowed_pages,
        allowed_faculties
      FROM users
      ORDER BY username
    `);

    const users = rows.map(user => {
      let allowedPages = [];
      let allowedFaculties = [];

      try {
        if (user.allowed_pages) allowedPages = JSON.parse(user.allowed_pages);
      } catch (e) {
        console.warn(`Invalid allowed_pages JSON for user ${user.id}:`, e);
      }

      try {
        if (user.allowed_faculties) allowedFaculties = JSON.parse(user.allowed_faculties);
      } catch (e) {
        console.warn(`Invalid allowed_faculties JSON for user ${user.id}:`, e);
      }

      return {
        ...user,
        allowed_pages: allowedPages,
        allowed_faculties: allowedFaculties
      };
    });

    res.json(users);
  } catch (err) {
    console.error("GET /api/users error:", err);
    res.status(500).json({ error: 'خطأ في جلب المستخدمين' });
  }
});
// ---------------------
// PUT /api/users/:id    تعديل الصفحات المسموحة   
// ---------------------
app.put('/api/users/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { username, full_name, email, role, is_active, allowed_pages, allowed_faculties = [] } = req.body;

  try {
    const updates = [];
    const values = [];

    if (username !== undefined)     { updates.push('username = ?');     values.push(username); }
    if (full_name !== undefined)    { updates.push('full_name = ?');    values.push(full_name); }
    if (email !== undefined)        { updates.push('email = ?');        values.push(email); }
    if (role !== undefined)         { updates.push('role = ?');         values.push(role); }
    if (is_active !== undefined)    { updates.push('is_active = ?');    values.push(is_active ? 1 : 0); }
    if (allowed_pages !== undefined){ updates.push('allowed_pages = ?'); values.push(JSON.stringify(allowed_pages)); }
    if (allowed_faculties !== undefined){ updates.push('allowed_faculties = ?'); values.push(JSON.stringify(allowed_faculties)); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'لا توجد تغييرات' });
    }

    values.push(id);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    const [result] = await dbp.query(sql, values);  

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    res.json({ message: 'تم الحفظ' });
  } catch (err) {
    console.error("PUT /api/users/:id error:", err);
    res.status(500).json({ error: 'خطأ أثناء الحفظ' });
  }
});

// ---------------------
// POST /api/users       إضافة مستخدم جديد
// ---------------------
app.post('/api/users', authMiddleware, async (req, res) => {
  const { username, password, full_name, email, role = 'user', allowed_pages = [] , allowed_faculties = []} = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبين' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    const [result] = await dbp.query(   
      `INSERT INTO users (username, password_hash, full_name, email, role, allowed_pages, allowed_faculties)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, hash, full_name || null, email || null, role, JSON.stringify(allowed_pages), JSON.stringify(allowed_faculties)]
    );

    res.status(201).json({
      id: result.insertId,             
      username,
      full_name,
      email,
      role,
      allowed_pages,
      allowed_faculties
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'اسم المستخدم موجود مسبقًا' });
    }
    console.error("POST /api/users error:", err);
    res.status(500).json({ error: 'خطأ أثناء الإضافة' });
  }
});

// ---------------------
// DELETE /api/users/:id
// ---------------------
app.delete('/api/users/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await dbp.query(  
      'DELETE FROM users WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    res.json({ message: 'تم الحذف' });
  } catch (err) {
    console.error("DELETE /api/users/:id error:", err);
    res.status(500).json({ error: 'خطأ أثناء الحذف' });
  }
});


// تسجيل الدخول /api/login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبين" });
  }

  try {
    // جلب بيانات المستخدم
    const [rows] = await dbp.query(
      `SELECT id, username, full_name, email, role, password_hash, allowed_pages, allowed_faculties
       FROM users
       WHERE username = ?`,
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "اسم المستخدم غير موجود" });
    }

    const user = rows[0];

    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) {
      return res.status(401).json({ error: "كلمة المرور خاطئة" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    // تحويل allowed_pages من text إلى array
    let allowed_pages = [];
    try {
      allowed_pages = user.allowed_pages && user.allowed_pages.trim() !== ''
        ? JSON.parse(user.allowed_pages)
        : [];
    } catch (parseErr) {
      console.error("خطأ في تحليل allowed_pages:", parseErr);
    
    }

    // تحويل allowed_faculties من text إلى array
    let allowed_faculties = [];
    try {
      allowed_faculties = user.allowed_faculties && user.allowed_faculties.trim() !== ''
        ? JSON.parse(user.allowed_faculties)
        : [];
    } catch (parseErr) {
      console.error("خطأ في تحليل allowed_faculties:", parseErr);
    }


    //   ( allowed_pages)
    res.json({
      token,
      id: user.id,
      username: user.username,
      full_name: user.full_name || null,
      email: user.email || null,
      role: user.role,
      allowed_pages,
      allowed_faculties
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "خطأ في السيرفر أثناء تسجيل الدخول" });
  }
});



// تسجيل مستخدم جديد (Sign Up)
app.post("/api/register", async (req, res) => {
  const { username, password, full_name, email, role = 'user' } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبين" });
  }

  if (role === 'admin') {
    return res.status(403).json({ error: "لا يمكن اختيار دور الإداري هنا" });
  }

  try {
    // تحقق إذا اليوزر موجود بالفعل
    const [existing] = await dbp.query(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: "اسم المستخدم مستخدم بالفعل" });
    }

    const hash = await bcrypt.hash(password, 10);

    const defaultAllowedPages = JSON.stringify([]); 

    const [result] = await dbp.query(
      `INSERT INTO users 
       (username, password_hash, full_name, email, role, is_active, allowed_pages, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, NOW())`,
      [username, hash, full_name || null, email || null, role, defaultAllowedPages]
    );

    res.status(201).json({
      id: result.insertId,
      username,
      full_name: full_name || null,
      email: email || null,
      role,
      message: "تم إنشاء الحساب بنجاح، يمكنك تسجيل الدخول الآن"
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: "اسم المستخدم مستخدم بالفعل" });
    }
    res.status(500).json({ error: "خطأ في السيرفر أثناء التسجيل" });
  }
});


// بحث عن طالب
app.get("/api/student-search", async (req, res) => {
  const { query, faculty_id, department_id, program_type, postgraduate_program, academic_year } = req.query;

  try {
    const [rows] = await dbp.query(
      `SELECT * FROM students 
       WHERE (full_name LIKE ? OR university_id LIKE ?) 
       AND faculty_id = ? AND department_id = ? 
       AND program_type = ? AND postgraduate_program = ? 
       AND academic_year = ?`,
      [`%${query}%`, `%${query}%`, faculty_id, department_id, program_type, postgraduate_program || null, academic_year]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "خطأ في البحث عن الطالب" });
  }
});

// جلب السجل الدراسي للطالب
app.get("/api/student-history", async (req, res) => {
  const { student_id } = req.query;

  if (!student_id) {
    return res.status(400).json({ error: "student_id مطلوب" });
  }

  try {
    const [rows] = await dbp.query(
      `
      SELECT 
        sr.academic_year,
        sr.level_name,
        sr.term_name,
        sr.registration_status,   --  (مسجّل / غير مسجل)
        sr.result_status,         --  نجاح/رسوب
        CASE 
          WHEN sr.result_status = 1 THEN 'نجاح'
          WHEN sr.result_status = 0 THEN 'رسوب'
          WHEN sr.result_status IS NULL THEN 'غير محدد بعد'
          ELSE 'غير محدد'
        END AS status
      FROM student_registrations sr
      WHERE sr.student_id = ?
      ORDER BY 
        sr.academic_year DESC,
        FIELD(sr.level_name, 
          'المستوى العاشر','المستوى التاسع','المستوى الثامن','المستوى السابع',
          'المستوى السادس','المستوى الخامس','المستوى الرابع','المستوى الثالث',
          'المستوى الثاني','المستوى الأول'
        ) DESC,
        FIELD(sr.term_name, 
          'الفصل الثاني','فصل ثاني','الفصل الثانى',
          'الفصل الأول','فصل أول'
        ) DESC
      `,
      [student_id]
    );

    res.json(rows);
  } catch (err) {
    console.error("STUDENT HISTORY ERROR:", err);
    res.status(500).json({ 
      error: "خطأ في جلب السجل الدراسي", 
      details: err.message 
    });
  }
});


// دالة تحول رقم المستوى إلى النص    
function getLevelNameArabic(levelNumber) {
  const levelNames = [
    "",                   
    "المستوى الأول",
    "المستوى الثاني",
    "المستوى الثالث",
    "المستوى الرابع",
    "المستوى الخامس",
    "المستوى السادس",
    "المستوى السابع",
    "المستوى الثامن",
    "المستوى التاسع",
    "المستوى العاشر",
  ];

  if (levelNumber < 1 || levelNumber >= levelNames.length) {
    return null; 
  }

  return levelNames[levelNumber];
}

app.get("/api/graduating-students", async (req, res) => {
  const { faculty_id, department_id, program_type, postgraduate_program, academic_year } = req.query;

  try {
    // جلب عدد المستويات
    const [dept] = await dbp.query("SELECT levels_count FROM departments WHERE id = ?", [department_id]);
    if (!dept.length) {
      return res.status(400).json({ error: "القسم غير موجود" });
    }

    const levelsCount = dept[0].levels_count || 4;

    // تحويل الرقم إلى النص العربي الفعلي
    const lastLevelName = getLevelNameArabic(levelsCount);

    if (!lastLevelName) {
      return res.status(400).json({ error: `عدد المستويات (${levelsCount}) غير مدعوم` });
    }

    const [students] = await dbp.query(
      `SELECT 
         s.id, 
         s.full_name, 
         s.university_id, 
         MAX(ap.level_name) as max_level, 
         MAX(cg.status) as last_status,
         MAX(ap.term_name) as last_term_name
       FROM students s
       JOIN student_registrations sr ON sr.student_id = s.id
       JOIN academic_periods ap ON sr.period_id = ap.id
       JOIN course_grades cg ON cg.student_id = s.id AND cg.period_id = ap.id
       WHERE s.faculty_id = ? 
         AND s.department_id = ?
         AND s.program_type = ? 
         AND (s.postgraduate_program = ? OR (s.postgraduate_program IS NULL AND ? IS NULL))
         AND s.academic_year = ?
       GROUP BY s.id
       HAVING 
         max_level = ?
         AND last_status = 'نجاح'
         AND last_term_name IN ('فصل ثاني', 'الفصل الثاني')
         AND (
           SELECT COUNT(*) 
           FROM borrowed_books bb 
           WHERE bb.student_id = s.id 
           AND bb.returned_at IS NULL
         ) = 0`,
      [
        faculty_id,
        department_id,
        program_type,
        postgraduate_program || null,
        postgraduate_program || null,
        academic_year,
        lastLevelName
      ]
    );

    res.json(students);

  } catch (err) {
    console.error("خطأ في /graduating-students:", err);
    res.status(500).json({ error: "خطأ داخلي في السيرفر" });
  }
});


// جلب الكتب المستعارة غير المرجعة للطالب
app.get("/api/student-borrowed-books", async (req, res) => {
  const uni = (req.query.university_id || "").trim();
  if (!uni) return res.status(400).json({ error: "university_id مطلوب" });

  try {
    const [rows] = await dbp.query(
      `SELECT b.title, bb.borrowed_at
       FROM borrowed_books bb
       JOIN books b ON bb.book_id = b.id
       WHERE bb.student_id = ? AND bb.returned_at IS NULL`,
      [uni]
    );
    res.json(rows);
  } catch (e) {
    console.error("BORROWED BOOKS ERROR:", e);
    res.status(500).json({ error: "Database error" });
  }
});




// 
app.get("/api/student-basic", async (req, res) => {
  const { student_id } = req.query;
  if (!student_id) return res.status(400).json({ error: "student_id مطلوب" });

  try {
    const [rows] = await dbp.query(
      "SELECT id, full_name, university_id FROM students WHERE id = ? LIMIT 1",
      [student_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "الطالب غير موجود" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "خطأ في السيرفر" });
  }
});

// البحث الحي عن طلاب في المستوى الأخير فقط
app.get("/api/students-final-level-search", async (req, res) => {
  const {
    department_id,
    academic_year,
    level_name,           
    program_type,
    postgraduate_program,
    q                     
  } = req.query;

  console.log("--- students-final-level-search called ---");
  console.log("Query params:", { department_id, academic_year, level_name, program_type, q });

  if (!department_id || !academic_year || !level_name || !q?.trim()) {
    console.log("Missing required params → returning empty array");
    return res.json([]);
  }

  let normalizedLevel = (level_name || '').trim();

  const levelMap = {
    '1': 'المستوى الأول',
    '2': 'المستوى الثاني',
    '3': 'المستوى الثالث',
    '4': 'المستوى الرابع',
    '5': 'المستوى الخامس',
    '6': 'المستوى السادس',
    'المستوى 5': 'المستوى الخامس',
    'المستوى 6': 'المستوى السادس',
    'المستوي الخامس': 'المستوى الخامس',   
    'Level 5': 'المستوى الخامس',
  };

  if (levelMap[normalizedLevel]) {
    console.log(`Normalized level: ${normalizedLevel} → ${levelMap[normalizedLevel]}`);
    normalizedLevel = levelMap[normalizedLevel];
  } else {
    console.log(`No normalization applied for level: ${normalizedLevel}`);
  }

  try {
    const searchTerm = `%${(q || '').trim()}%`;
    console.log("Search term:", searchTerm);

    const [rows] = await dbp.query(
      `
      SELECT 
        s.id,
        s.full_name,
        s.university_id
      FROM students s
      JOIN student_registrations sr ON sr.student_id = s.id
      WHERE s.department_id = ?
        AND sr.academic_year = ?
        AND sr.level_name = ?
        AND sr.program_type = ?
        AND (sr.postgraduate_program <=> ?)
        AND (
          s.full_name LIKE ? 
          OR s.university_id LIKE ?
        )
      GROUP BY s.id
      ORDER BY s.full_name ASC
      LIMIT 15
      `,
      [
        department_id,
        academic_year,
        normalizedLevel,          
        program_type,
        postgraduate_program || null,
        searchTerm,
        searchTerm
      ]
    );

    console.log(`Found ${rows.length} students`);
    if (rows.length === 0) {
      console.log("No results → possible reasons: wrong level_name, no registration, or search term not matching");
    }

    res.json(rows);
  } catch (err) {
    console.error("FINAL LEVEL STUDENTS SEARCH ERROR:", err);
    res.status(500).json({ error: "خطأ في البحث عن الطلاب" });
  }
});

// (نجاح / دفع كل الأقساط في كل السنين / كتب مستعارة)
app.get("/api/student-certificate-status", async (req, res) => {
  const {
    student_id,
    department_id,
    academic_year,          
    program_type,
    postgraduate_program,
    final_level     
  } = req.query;

  if (!student_id || !final_level) {
    return res.status(400).json({ error: "بيانات ناقصة (student_id و final_level مطلوبين)" });
  }

  try {
    // ───────────────────────────────────────────────
    // 1. حالة النجاح في آخر مستوى (نحتفظ بيها للتوافق)
    // ───────────────────────────────────────────────
    const [regRows] = await dbp.query(
      `
      SELECT 
        sr.registration_status,
        sr.result_status,
        CASE 
          WHEN sr.result_status = 1 THEN 'نجاح'
          WHEN sr.result_status = 0 THEN 'رسوب'
          ELSE 'غير محدد'
        END AS status,
        sr.academic_year AS last_reg_year,
        sr.level_name AS last_reg_level,
        sr.repeated_courses
      FROM student_registrations sr
      WHERE sr.student_id = ?
        AND sr.level_name = ?
        AND sr.term_name IN ('فصل ثاني', 'الفصل الثاني', 'الفصل الثانى')
        AND sr.program_type = ?
        AND (sr.postgraduate_program <=> ?)
      ORDER BY sr.academic_year DESC, sr.created_at DESC
      LIMIT 1
      `,
      [student_id, final_level, program_type, postgraduate_program || null]
    );

    let is_passed_last_term = false;
    let last_reg_year = null;
    let last_reg_level = null;
    let repeated_courses_str = null;

    if (regRows.length > 0) {
      is_passed_last_term = regRows[0].status === 'نجاح';
      last_reg_year = regRows[0].last_reg_year;
      last_reg_level = regRows[0].last_reg_level;
      repeated_courses_str = regRows[0].repeated_courses;  // string زي "1,2,3"
    }

// ──────  repeated_courses ──────
// شيك كل المواد الراسبة في آخر محاولة
let has_failed_repeated_courses = false;
let failed_courses = [];

// أحدث سنة ومستوى كحل مؤقت
const [latestReg] = await dbp.query(
  `
  SELECT academic_year, level_name
  FROM student_registrations
  WHERE student_id = ?
  ORDER BY academic_year DESC, created_at DESC
  LIMIT 1
  `,
  [student_id]
);

const defaultYear = latestReg.length > 0 ? latestReg[0].academic_year : "غير محدد";
const defaultLevel = latestReg.length > 0 ? latestReg[0].level_name : "غير محدد";

const [gradesRows] = await dbp.query(
  `
  SELECT 
    cg.course_id,
    NULL AS course_code,
    c.course_name AS course_name,
    cg.total_mark,
    cg.letter,
    cg.attempt_number
  FROM course_grades cg
  LEFT JOIN courses c ON cg.course_id = c.id
  WHERE cg.student_id = ?
    AND cg.attempt_number = (
      SELECT MAX(cg2.attempt_number)
      FROM course_grades cg2
      WHERE cg2.student_id = cg.student_id
        AND cg2.course_id = cg.course_id
    )
    AND (cg.total_mark < 50 OR cg.letter = 'F')
  `,
  [student_id]
);

for (const g of gradesRows) {
  has_failed_repeated_courses = true;

failed_courses.push({
  academic_year: defaultYear,
  level_name: defaultLevel,
  term_name: "—",        
  course_name: g.course_name || "غير معروف",
  total_mark: Number(g.total_mark) || "—",
  letter: g.letter || "F",
  attempt_number: g.attempt_number || 1
});
}

    // ───────────────────────────────────────────────
    // 2. فحص حالة الدفع في **كل** السجلات في fees
    // ───────────────────────────────────────────────
    const [feeRows] = await dbp.query(
      `
      SELECT 
        id,
        academic_year,
        level_name,
        installment_1, installment_1_paid,
        installment_2, installment_2_paid,
        installment_3, installment_3_paid,
        installment_4, installment_4_paid,
        installment_5, installment_5_paid,
        installment_6, installment_6_paid
        -- لو فيه registration_fee_paid بعدين ممكن نضيفه هنا
      FROM fees
      WHERE student_id = ?
      ORDER BY 
        CAST(SUBSTRING_INDEX(academic_year, '/', 1) AS UNSIGNED) DESC,
        academic_year DESC,
        updated_at DESC
      `,
      [student_id]
    );

    const unpaid_years = [];

    feeRows.forEach(row => {
      const unpaid_inst = [];

      for (let i = 1; i <= 6; i++) {
        const amount = Number(row[`installment_${i}`] || 0);
        const is_paid = row[`installment_${i}_paid`] === 1;

        if (amount > 0 && !is_paid) {
          unpaid_inst.push(i);
        }
      }

      // اختياري: لو عندك registration_fee ومش مدفوع
      // if (Number(row.registration_fee || 0) > 0 && !row.registration_fee_paid) {
      //   unpaid_inst.push("رسوم التسجيل");
      // }

      if (unpaid_inst.length > 0) {
        unpaid_years.push({
          academic_year: row.academic_year,
          level_name: row.level_name,
          unpaid_installments: unpaid_inst
        });
      }
    });

    const is_all_fees_paid = feeRows.length > 0 && unpaid_years.length === 0;

    // ───────────────────────────────────────────────
    // 3. الكتب المستعارة غير المرجعة
    // ───────────────────────────────────────────────
    const [books] = await dbp.query(
      `
      SELECT 
        b.title,
        bb.borrowed_at
      FROM borrowed_books bb
      JOIN books b ON b.id = bb.book_id
      WHERE bb.student_id = ?
        AND bb.returned_at IS NULL
      ORDER BY bb.borrowed_at DESC
      `,
      [student_id]
    );

    // ───────────────────────────────────────────────
    // الرد النهائي
    // ───────────────────────────────────────────────
    res.json({
      is_registered_last_term: regRows.length > 0,
      is_passed_last_term: is_passed_last_term,

      has_failed_repeated_courses: has_failed_repeated_courses,
      failed_courses: failed_courses,

      is_all_fees_paid: is_all_fees_paid,
      total_fee_records: feeRows.length,
      unpaid_years: unpaid_years,

      last_registration: regRows.length > 0 ? regRows[0] : null,
      borrowed_books: books
    });

  } catch (err) {
    console.error("CERTIFICATE STATUS ERROR:", err);
    res.status(500).json({ 
      error: "خطأ في السيرفر", 
      details: err.message 
    });
  }
});

// جلب السنوات الأكاديمية المتاحة
app.get("/api/academic-years", async (req, res) => {
  const { program_type, postgraduate_program } = req.query;

  try {
    let query = "SELECT DISTINCT academic_year FROM academic_periods";
    let params = [];

    if (program_type) {
      query += " WHERE program_type = ?";
      params.push(program_type);

      if (program_type === "postgraduate" && postgraduate_program) {
        query += " AND (postgraduate_program = ? OR postgraduate_program IS NULL)";
        params.push(postgraduate_program);
      }
    }

    query += " ORDER BY academic_year DESC";

    const [rows] = await dbp.query(query, params);
    
    const years = [...new Set(rows.map(row => row.academic_year))];
    
    res.json(years);
  } catch (err) {
    console.error("ACADEMIC YEARS ERROR:", err);
    res.status(500).json({ error: "خطأ في جلب السنوات الأكاديمية" });
  }
});


// جلب درجات مواد طالب معين في فصل ومستوى وسنة محددة
app.get("/api/student-term-grades", async (req, res) => {
  try {
    const { 
      student_id, 
      academic_year, 
      level_name, 
      term_name, 
      program_type, 
      postgraduate_program 
    } = req.query;

    if (!student_id || !academic_year || !level_name || !term_name || !program_type) {
      return res.status(400).json({ 
        error: "البيانات ناقصة (student_id, academic_year, level_name, term_name, program_type مطلوبة)" 
      });
    }

    const pgProgram = program_type === "postgraduate" ? (postgraduate_program || null) : null;

    const [rows] = await dbp.query(
      `
      SELECT 
        c.course_name,
        cg.total_mark,
        cg.letter AS grade_letter,
        cg.points,
        CASE 
          WHEN cg.total_mark >= 50 OR cg.letter IN ('A','A-','B+','B','B-','C+','C','C-','D+','D') THEN 'نجاح'
          WHEN cg.total_mark < 50 OR cg.letter = 'F' THEN 'رسوب'
          ELSE 'غير محدد'
        END AS status
      FROM course_grades cg
      JOIN courses c ON c.id = cg.course_id
      WHERE cg.student_id = ?
        AND c.academic_year = ?
        AND c.level_name = ?
        AND c.term_name = ?
        AND c.program_type = ?
        AND (c.postgraduate_program <=> ?)
      ORDER BY c.course_name ASC
      `,
      [student_id, academic_year, level_name, term_name, program_type, pgProgram]
    );

    res.json(rows);
  } catch (e) {
    console.error("STUDENT TERM GRADES ERROR:", e);
    res.status(500).json({ error: "خطأ في السيرفر أو قاعدة البيانات" });
  }
});


// تسجيل المواد الرسوب
app.get("/api/student-failed-courses", async (req, res) => {
const { student_id } = req.query;
  if (!student_id) return res.status(400).json({ error: "student_id مطلوب" });

  try {
    const [rows] = await dbp.query(
      `SELECT 
         c.id AS course_id,
         c.course_name,
         cg.total_mark,
         cg.letter,
         c.academic_year,
         c.level_name,
         c.term_name
       FROM course_grades cg
       JOIN courses c ON cg.course_id = c.id
       WHERE cg.student_id = ?
         AND (cg.total_mark < 50 OR cg.letter = 'F')
         AND cg.attempt_number = (SELECT MAX(attempt_number) FROM course_grades cg2 WHERE cg2.student_id = cg.student_id AND cg2.course_id = cg.course_id)
         AND NOT EXISTS (
           SELECT 1 FROM course_grades cg3 
           WHERE cg3.student_id = cg.student_id 
             AND cg3.course_id = cg.course_id 
             AND (cg3.total_mark >= 50 OR cg3.letter != 'F')
         )
       ORDER BY c.academic_year DESC, c.level_name DESC, c.term_name DESC
      `,
      [student_id]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطأ في السيرفر" });
  }
});


// تسجيل مادة راسبة في فصل جديد  
app.post("/api/register-failed-course", async (req, res) => {
  try {
    const { 
      student_id, 
      course_id,
      academic_year, 
      level_name, 
      term_name, 
      program_type, 
      postgraduate_program = null,
      registration_status = "مسجل",
      notes = "إعادة مادة راسبة"
    } = req.body;

    const validProgramTypes = ['diploma', 'bachelor', 'postgraduate'];
    if (!program_type || !validProgramTypes.includes(program_type)) {
      return res.status(400).json({ 
        error: `نوع البرنامج غير صالح. القيم المسموح بها: ${validProgramTypes.join(', ')}` 
      });
    }

    if (!student_id || !course_id || !academic_year || !level_name || !term_name) {
      return res.status(400).json({ error: "البيانات ناقصة" });
    }

    const pgProgram = program_type === "postgraduate" ? postgraduate_program : null;

    // 1. الطالب لازم يكون مسجل في الفترة الحالية (مسجّل)
    const [regCheck] = await dbp.query(
      `
      SELECT id, repeated_courses, notes
      FROM student_registrations
      WHERE student_id = ?
        AND academic_year = ?
        AND level_name = ?
        AND term_name = ?
        AND program_type = ?
        AND (postgraduate_program <=> ?)
        AND registration_status = 'مسجّل'
      LIMIT 1
      `,
      [student_id, academic_year, level_name, term_name, program_type, pgProgram]
    );

    if (regCheck.length === 0) {
      return res.status(400).json({ 
        error: "الطالب غير مسجل في هذا الفصل. يجب تسجيله أولاً." 
      });
    }

    const registration = regCheck[0];
    const regId = registration.id;
    let repeatedCourses = registration.repeated_courses || '';
    let currentNotes = registration.notes || '';

    // 2. جلب الفترة الأصلية للمادة (من جدول courses)
    const [courseInfo] = await dbp.query(
      `
      SELECT academic_year AS orig_year,
             level_name   AS orig_level,
             term_name    AS orig_term
      FROM courses
      WHERE id = ?
      `,
      [course_id]
    );

    if (courseInfo.length === 0) {
      return res.status(404).json({ error: "المادة غير موجودة" });
    }

    const orig = courseInfo[0];

    // 3. مقارنة الفترة الحالية بالفترة الأصلية للمادة
    const current = { y: academic_year.trim(), l: level_name.trim(), t: term_name.trim() };
    const origin  = { y: orig.orig_year.trim(),  l: orig.orig_level.trim(),  t: orig.orig_term.trim() };

    if (current.y === origin.y && current.l === origin.l && current.t === origin.t) {
      return res.status(403).json({ 
        error: "ممنوع تسجيل إعادة المادة في نفس الفترة التي رسب فيها الطالب " 
      });
    }


    // 4. التحقق من عدم تكرار المادة في هذا التسجيل الحالي
    const normalize = v => String(v ?? '').trim();
    let courses = repeatedCourses
      .split(',')
      .map(normalize)
      .filter(Boolean);

    const incoming = normalize(course_id);

    if (courses.includes(incoming)) {
      return res.status(409).json({ 
        error: "المادة مسجلة بالفعل في هذه الفترة الدراسية" 
      });
    }

    // 5. إضافة المادة
    courses.push(incoming);
    const newRepeated = courses.join(',');

    let newNotes = currentNotes;
    if (notes?.trim()) {
      newNotes = newNotes ? `${newNotes}\n${notes}` : notes;
    }

    await dbp.query(
      `UPDATE student_registrations 
         SET repeated_courses = ?,
             notes = ?
       WHERE id = ?`,
      [newRepeated, newNotes, regId]
    );

    res.json({ 
      success: true,
      message: "تم إضافة المادة إلى مواد الإعادة",
      registration_id: regId,
      repeated_courses: newRepeated,
      notes: newNotes
    });

  } catch (e) {
    console.error("REGISTER FAILED COURSE ERROR:", e);
    res.status(500).json({ 
      error: "خطأ في تسجيل المادة: " + (e.message || String(e)) 
    });
  }
});

// التحقق إذا المادة مسجلة بالفعل في الفترة الأكاديمية 
app.get("/api/check-registered-course", async (req, res) => {
  try {
    const {
      student_id,
      course_id,
      academic_year,
      level_name,
      term_name,
      program_type,
      postgraduate_program
    } = req.query;

    if (!student_id || !course_id || !academic_year || !level_name || !term_name || !program_type) {
      return res.status(400).json({ error: "البيانات ناقصة" });
    }

    const pgProgram = program_type === "postgraduate" ? (postgraduate_program || null) : null;

    const [rows] = await dbp.query(
      `SELECT id, repeated_courses 
       FROM student_registrations 
       WHERE student_id = ? 
         AND academic_year = ? 
         AND level_name = ? 
         AND term_name = ? 
         AND program_type = ? 
         AND (postgraduate_program <=> ?)`,
      [student_id, academic_year, level_name, term_name, program_type, pgProgram]
    );

    if (rows.length === 0) {
      return res.json({ isRegistered: false });
    }

    const repeated = rows[0].repeated_courses || '';
    const coursesArray = repeated ? repeated.split(',').map(str => str.trim()) : [];

    const isRegistered = coursesArray.includes(course_id.toString());

    res.json({ isRegistered });
  } catch (e) {
    console.error("CHECK REGISTERED COURSE ERROR:", e);
    res.status(500).json({ error: "خطأ في التحقق" });
  }
});

// دالة تسجل الفترة في academic_periods
async function ensureAcademicPeriodExists(academic_year, level_name, term_name, program_type, postgraduate_program = null) {
  try {
    await dbp.query(`
      INSERT IGNORE INTO academic_periods 
      (academic_year, level_name, term_name, program_type, postgraduate_program)
      VALUES (?, ?, ?, ?, ?)
    `, [academic_year, level_name, term_name, program_type, postgraduate_program]);

    console.log(`تم التأكد/تسجيل الفترة: ${academic_year} | ${level_name} | ${term_name} (${program_type})`);
  } catch (err) {
    console.error('خطأ أثناء تسجيل الفترة في academic_periods:', err.message);
  }
}

//helper functions for academic status rules

// // 1. السنة النهائية
async function isStudentInFinalYear(studentId, levelName) {
  const [rows] = await dbp.query(`
    SELECT d.levels_count
    FROM students s
    JOIN departments d ON s.department_id = d.id
    WHERE s.id = ?
  `, [studentId]);
  if (rows.length === 0) {
    console.warn(`لم يتم العثور على قسم للطالب ${studentId}`);
    return false;
  }
  const maxLevels = rows[0].levels_count || 6;
  const normalizedLevel = (levelName || '').trim();
  return (
    normalizedLevel.includes(`المستوى ${maxLevels}`) ||
    normalizedLevel.includes(`السنة ${maxLevels}`) ||
    normalizedLevel.includes('السنة النهائية') ||
    normalizedLevel.includes('الرابع') ||
    normalizedLevel.includes('الخامس') ||
    normalizedLevel.includes('السادس')
  );
}

// 2. شرط المختبرات الطبية (انتقال من ثاني → أول)
async function checkMedicalLabTransitionRule(studentId, current_academic_year, current_level_name, current_term_name, new_term_name, facultyId) {
  const isMedicalLab = facultyId === 5;
  if (!isMedicalLab) return { allowed: true, reason: null };
  const isFromEvenToOdd =
    (current_term_name.includes('ثاني') || current_term_name.includes('الفصل الثاني')) &&
    (new_term_name.includes('أول') || new_term_name.includes('الفصل الأول'));
  if (!isFromEvenToOdd) return { allowed: true, reason: null };
  const [failRow] = await dbp.query(`
    SELECT COUNT(*) as fail_count
    FROM course_grades cg
    JOIN courses c ON cg.course_id = c.id
    WHERE cg.student_id = ?
      AND c.academic_year = ?
      AND c.level_name = ?
      AND (cg.total_mark < 50 OR cg.letter = 'F')
  `, [studentId, current_academic_year, current_level_name]);
  if (failRow[0].fail_count > 0) {
    return { allowed: false, reason: 'طالب مختبرات طبية - لم ينجح في جميع مواد الفصلين السابقين' };
  }
  return { allowed: true, reason: null };
}

// 3. تعليق > 15 ساعة رسوب (غير المختبرات)
async function checkSuspendMoreThan15Hours(studentId, current_academic_year, current_level_name, current_term_name, facultyId) {
  const isMedicalLab = facultyId === 5;
  if (isMedicalLab) return { suspend: false, reason: null };
  const [row] = await dbp.query(`
    SELECT SUM(c.credit_hours) as failed_hours
    FROM course_grades cg
    JOIN courses c ON cg.course_id = c.id
    WHERE cg.student_id = ?
      AND c.academic_year = ?
      AND c.level_name = ?
      AND c.term_name = ?
      AND (cg.total_mark < 50 OR cg.letter = 'F')
  `, [studentId, current_academic_year, current_level_name, current_term_name]);
  const failedHours = row[0]?.failed_hours || 0;
  
  console.log(`checkSuspendMoreThan15Hours - طالب ${studentId} | failed_hours في الفصل الحالي: ${failedHours}`);

  if (failedHours > 15) {
    return { suspend: true, reason: `رسوب في ${failedHours} ساعة (>15) - تعليق دراسة` };
  }
  return { suspend: false, reason: null };
}

// 4. شيك الرسوب في السنة (إعادة / فصل)
async function checkYearFailureRules(studentId, current_academic_year, current_level_name, program_type, postgraduate_program) {
  const [totalRow] = await dbp.query(`
    SELECT SUM(c.credit_hours) as total_hours
    FROM courses c
    WHERE c.academic_year = ?
      AND c.level_name = ?
      AND c.program_type = ?
      AND (c.postgraduate_program <=> ?)
  `, [current_academic_year, current_level_name, program_type, postgraduate_program]);
  const totalHours = totalRow[0]?.total_hours || 0;

  const [failRow] = await dbp.query(`
    SELECT
      SUM(c.credit_hours) as failed_hours,
      GROUP_CONCAT(c.id) as failed_course_ids
    FROM course_grades cg
    JOIN courses c ON cg.course_id = c.id
    WHERE cg.student_id = ?
      AND c.academic_year = ?
      AND c.level_name = ?
      AND c.program_type = ?
      AND (c.postgraduate_program <=> ?)
      AND (cg.total_mark < 50 OR cg.letter = 'F')
  `, [studentId, current_academic_year, current_level_name, program_type, postgraduate_program]);
  const failedHours = failRow[0]?.failed_hours || 0;
  const failedCoursesStr = failRow[0]?.failed_course_ids || '';

  const oneThird = totalHours / 3;
  const twoThirds = totalHours * 2 / 3;

  console.log(`checkYearFailureRules - طالب ${studentId} | failedHours: ${failedHours} | totalHours: ${totalHours} | oneThird: ${oneThird.toFixed(2)} | twoThirds: ${twoThirds.toFixed(2)}`);

  let decision;
  if (failedHours > twoThirds) {
    const isFinal = await isStudentInFinalYear(studentId, current_level_name);
    if (!isFinal) {
      decision = {
        action: 'dismiss',
        reason: `> ثلثي (${failedHours}/${totalHours}) - فصل`,
        failedCourses: failedCoursesStr
      };
    } else {
      decision = {
        action: 'repeat',
        reason: 'استثناء نهائية - إعادة مواد',
        failedCourses: failedCoursesStr
      };
    }
  } else if (failedHours > oneThird) {
    decision = {
      action: 'repeat',
      reason: `> ثلث (${failedHours}/${totalHours}) - إعادة`,
      failedCourses: failedCoursesStr
    };
  } else {
    decision = { action: 'promote', reason: 'نجاح', failedCourses: '' };
  }

  console.log(`checkYearFailureRules - طالب ${studentId} | yearDecision.action: ${decision.action} | reason: ${decision.reason}`);

  return decision;
}

// 5. إعادة للمره الثانية → فصل
async function checkSecondRepeatDismiss(studentId, current_level_name) {
  const [row] = await dbp.query(`
    SELECT MAX(repeat_count) as max_repeat
    FROM student_registrations
    WHERE student_id = ? AND level_name = ?
  `, [studentId, current_level_name]);
  const maxRepeat = row[0]?.max_repeat || 0;

  console.log(`checkSecondRepeatDismiss - طالب ${studentId} | max_repeat في المستوى ${current_level_name}: ${maxRepeat}`);

  if (maxRepeat >= 2) {
    return { dismiss: true, reason: 'إعادة للمرة الثانية - فصل' };
  }
  return { dismiss: false, reason: null };
}

function getNextAcademicYear(currentYear) {
  if (!currentYear || typeof currentYear !== 'string') {
    console.warn('getNextAcademicYear: currentYear غير صالح', currentYear);
    return currentYear;
  }

  let separator = currentYear.includes('/') ? '/' : '-';
  let parts = currentYear.split(separator);

  if (parts.length !== 2) {
    console.warn('getNextAcademicYear: تنسيق السنة غير متوقع', currentYear);
    return currentYear;
  }

  const start = Number(parts[0].trim());
  const end   = Number(parts[1].trim());

  if (isNaN(start) || isNaN(end)) {
    console.warn('getNextAcademicYear: أرقام غير صالحة', parts);
    return currentYear;
  }

  const nextStart = start + 1;
  const nextEnd   = end   + 1;

  const nextYearStr = `${nextStart}${separator}${nextEnd}`;

  console.log(`getNextAcademicYear: ${currentYear} → ${nextYearStr} (separator: ${separator})`);

  return nextYearStr;
}

// الترحيل الجماعي
app.post('/api/batch-promote-to-next-level',authMiddleware, async (req, res) => {
  const {
    current_academic_year,
    current_level_name,
    current_term_name,
    new_academic_year,
    new_level_name,
    new_term_name,
    program_type,
    postgraduate_program = null,
    department_id,
    student_ids
  } = req.body;

  if (!current_academic_year || !current_level_name || !current_term_name ||
      !new_academic_year || !new_level_name || !new_term_name ||
      !department_id || !Array.isArray(student_ids) || student_ids.length === 0) {
    return res.status(400).json({ error: 'بيانات ناقصة' });
  }

  try {
    const registrar = req.user?.username || DEFAULT_REGISTRAR;
    const results = {
      success: [],
      failed: [],
      required_repeat: [],
      already_promoted: [],
      suspended: []
    };

          // 1. جيب levels_count للقسم
      const [dept] = await dbp.query(
        'SELECT levels_count FROM departments WHERE id = ?',
        [department_id]
      );

      if (!dept.length) {
        return res.status(400).json({ error: 'القسم غير موجود' });
      }

      const maxLevels = dept[0].levels_count || 4;

      const getLevelNumber = (name) => {
        if (!name || typeof name !== 'string') return 0;

        const s = name.trim().toLowerCase();

        console.log(`getLevelNumber debug: raw="${name}" | lower="${s}"`);

        const m = s.match(/(\d+)/);
        if (m) {
          console.log(`getLevelNumber: found digit → ${m[1]}`);
          return Number(m[1]);
        }

        const map = {
          "الأول": 1, "اول": 1, "الاولى": 1, "الاول": 1,
          "الثاني": 2, "الثانيه": 2, "ثاني": 2,
          "الثالث": 3, "الثالثه": 3, "ثالث": 3,
          "الرابع": 4, "الرابعه": 4, "رابع": 4,
          "الخامس": 5, "الخامسه": 5, "خامس": 5,
          "السادس": 6, "سادس": 6,
        };

        for (const k of Object.keys(map)) {
          if (s.includes(k)) {
            console.log(`getLevelNumber: match="${k}" → ${map[k]}`);
            return map[k];
          }
        }

        console.log(`getLevelNumber: no match → 0`);
        return 0;
      };

      // 2. احسب رقم المستوى الجديد باستخدام الدالة المحلية
      const newLevelNum = getLevelNumber(new_level_name);

      console.log({
        current_level_name,
        new_level_name,
        currentLevelNum: getLevelNumber(current_level_name),
        newLevelNum,
        maxLevels,
        isAllowed: newLevelNum <= maxLevels && newLevelNum !== 0
      });

      if (newLevelNum === 0) {
        return res.status(400).json({
          error: `اسم المستوى الجديد غير صالح أو غير معروف: "${new_level_name}"`
        });
      }

      if (newLevelNum > maxLevels) {
        return res.status(400).json({
          error: `المستوى الجديد المختار ("${new_level_name}") يتجاوز عدد المستويات المسموح بها في القسم (${maxLevels} مستويات فقط).`
        });
      }

    const [registrations] = await dbp.query(`
      SELECT
        sr.id AS reg_id,
        sr.student_id,
        s.full_name,
        s.department_id,
        d.faculty_id,
        sr.repeat_count
      FROM student_registrations sr
      JOIN students s ON sr.student_id = s.id
      JOIN departments d ON s.department_id = d.id
      WHERE s.department_id = ?
        AND sr.academic_year = ?
        AND sr.level_name = ?
        AND sr.term_name = ?
        AND sr.program_type = ?
        AND (sr.postgraduate_program <=> ?)
        AND sr.registration_status = 'مسجّل'
        AND sr.student_id IN (?)
    `, [
      department_id, current_academic_year, current_level_name, current_term_name,
      program_type, postgraduate_program, student_ids
    ]);

    if (registrations.length === 0) {
      return res.json({ success: true, data: { ...results, message: 'لا طلاب مطابقين' } });
    }

    for (const reg of registrations) {
      const { student_id: studentId, full_name: fullName, faculty_id: facultyId, repeat_count: currentRepeat } = reg;

      // 1. موجود مسبقًا في الفترة الجديدة؟
      const [existing] = await dbp.query(`
        SELECT 1 FROM student_registrations
        WHERE student_id = ? AND academic_year = ? AND level_name = ? AND term_name = ?
          AND program_type = ? AND (postgraduate_program <=> ?)
      `, [studentId, new_academic_year, new_level_name, new_term_name, program_type, postgraduate_program]);

      if (existing.length > 0) {
        results.already_promoted.push({ student_id: studentId, full_name: fullName, reason: 'مسجل سابقًا' });
        continue;
      }

      const isSameLevel = current_level_name === new_level_name;

      // انتقال داخل نفس المستوى → ترحيل عادي
      if (isSameLevel) {
        await ensureAcademicPeriodExists(
    new_academic_year,
    new_level_name,
    new_term_name,
    program_type,
    postgraduate_program
  );
        await dbp.query(`
          INSERT INTO student_registrations
          (student_id, academic_year, level_name, term_name, program_type, postgraduate_program,
           registration_status, academic_status, repeat_count, registrar)
          VALUES (?, ?, ?, ?, ?, ?, 'مسجّل', 'منتظم', 0, ?)
          ON DUPLICATE KEY UPDATE registration_status = 'مسجّل', academic_status = 'منتظم', registrar = ?
        `, [studentId, new_academic_year, new_level_name, new_term_name, program_type, postgraduate_program, registrar, registrar]);
        results.success.push({ student_id: studentId, full_name: fullName });
        continue;
      }

      // ────── حالات الترحيل لمستوى أعلى ──────


      // 1. شرط المختبرات  (يمنع الانتقال كليًا)
      const medLab = await checkMedicalLabTransitionRule(studentId, current_academic_year, current_level_name, current_term_name, new_term_name, facultyId);
      if (!medLab.allowed) {
        results.failed.push({ student_id: studentId, full_name: fullName, reason: medLab.reason });
        continue;
      }

      // 2. شيك السنة كلها (إعادة / فصل) -
      const yearDecision = await checkYearFailureRules(studentId, current_academic_year, current_level_name, program_type, postgraduate_program);

      // 3. شيك الإعادة الثانية
      const secondRepeat = await checkSecondRepeatDismiss(studentId, current_level_name);

      // 4.  قرار السنة أو الإعادة الثانية
      if (yearDecision.action === 'dismiss' || secondRepeat.dismiss) {
        await dbp.query(`
          UPDATE student_registrations
          SET academic_status = 'مفصول', registrar = ?
          WHERE student_id = ? AND academic_year = ? AND level_name = ? AND term_name = ?
        `, [registrar, studentId, current_academic_year, current_level_name, current_term_name]);
        // await dbp.query(`UPDATE students SET status = 'مفصول' WHERE id = ?`, [studentId]);
        results.failed.push({
          student_id: studentId,
          full_name: fullName,
          reason: yearDecision.reason || secondRepeat.reason
        });
        continue;
      }

if (yearDecision.action === 'repeat') {
  const repeatedStr = yearDecision.failedCourses || '';

  const nextYear = getNextAcademicYear(current_academic_year);

  await ensureAcademicPeriodExists(
    nextYear,
    current_level_name,
    current_term_name,
    program_type,
    postgraduate_program
  );

  // جلب أعلى repeat_count سابق في نفس المستوى 
  const [repeatRow] = await dbp.query(`
    SELECT COALESCE(MAX(repeat_count), 0) as total_repeat
    FROM student_registrations
    WHERE student_id = ? 
      AND level_name = ?
  `, [studentId, current_level_name]);

  const totalRepeatSoFar = repeatRow[0]?.total_repeat || 0;
  const newRepeatCount = totalRepeatSoFar + 1;

  console.log(
    `إعادة للطالب ${studentId} | ` +
    `السنة الحالية: ${current_academic_year} → السنة الجديدة: ${nextYear} | ` +
    `المستوى: ${current_level_name} | الفصل: ${current_term_name} | ` +
    `إجمالي الإعادات السابقة في المستوى: ${totalRepeatSoFar} → الجديد: ${newRepeatCount} | ` +
    `المواد الراسبة: ${repeatedStr || 'لا يوجد'}`
  );

  await dbp.query(`
    INSERT INTO student_registrations 
    (
      student_id, 
      academic_year, 
      level_name, 
      term_name, 
      program_type, 
      postgraduate_program,
      registration_status, 
      academic_status, 
      repeated_courses, 
      repeat_count, 
      registrar,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'مسجّل', 'إعادة', ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      academic_year     = VALUES(academic_year),          --   نغير السنة
      academic_status   = 'إعادة',
      repeated_courses  = VALUES(repeated_courses),
      repeat_count      = VALUES(repeat_count),         
      registrar         = VALUES(registrar)
  `, [
    studentId,
    nextYear,
    current_level_name,
    current_term_name,
    program_type,
    postgraduate_program,
    repeatedStr,
    newRepeatCount,
    registrar
  ]);

  results.required_repeat.push({
    student_id: studentId,
    full_name: fullName,
    reason: `${yearDecision.reason} (إعادة رقم ${newRepeatCount} - ${nextYear} - ${current_level_name} - ${current_term_name})`
  });

  continue;
}

      // 5.   التعليق 
      const suspend = await checkSuspendMoreThan15Hours(studentId, current_academic_year, current_level_name, current_term_name, facultyId);
      if (suspend.suspend) {
        await dbp.query(`
          UPDATE student_registrations
          SET academic_status = 'معلق', registrar = ?
          WHERE student_id = ? AND academic_year = ? AND level_name = ? AND term_name = ?
        `, [registrar, studentId, current_academic_year, current_level_name, current_term_name]);
        results.suspended.push({ student_id: studentId, full_name: fullName, reason: suspend.reason });
        continue;
      }

      await ensureAcademicPeriodExists(
  new_academic_year,
  new_level_name,
  new_term_name,
  program_type,
  postgraduate_program
);
      // 6.   الترحيل العادي
      await dbp.query(`
        INSERT INTO student_registrations
        (student_id, academic_year, level_name, term_name, program_type, postgraduate_program,
         registration_status, academic_status, repeat_count, registrar)
        VALUES (?, ?, ?, ?, ?, ?, 'مسجّل', 'منتظم', 0, ?)
        ON DUPLICATE KEY UPDATE
          registration_status = 'مسجّل',
          academic_status = 'منتظم',
          registrar = ?
      `, [
        studentId, new_academic_year, new_level_name, new_term_name,
        program_type, postgraduate_program, registrar, registrar
      ]);

      results.success.push({ student_id: studentId, full_name: fullName });
    }

    res.json({ success: true, data: results });

  } catch (err) {
    console.error('Batch promote error:', err);
    res.status(500).json({ error: 'خطأ في الترحيل: ' + err.message });
  }
});

// جلب المواد لإدخال الدرجات (يشمل مواد الإعادة اللي اتسجلت في الفصل)
app.get("/api/grade-entry-courses", async (req, res) => {
  const {
    faculty_id,
    department_id,
    academic_year,
    level_name,
    term_name,
    program_type,
    postgraduate_program = null
  } = req.query;

  if (!faculty_id || !department_id || !academic_year || !level_name || !term_name || !program_type) {
    return res.status(400).json({ error: "البيانات ناقصة (faculty_id, department_id, academic_year, level_name, term_name, program_type مطلوبة)" });
  }

  try {
    const pgProgram = program_type === "postgraduate" ? (postgraduate_program || null) : null;

const [rows] = await dbp.query(
  `
  -- 1. المواد الأصلية للفصل الحالي
  SELECT 
    c.id, 
    c.course_name,
    COUNT(DISTINCT sr.student_id) AS registered_students_count,
    0 AS is_repeat_material
  FROM courses c
  INNER JOIN student_registrations sr 
    ON sr.academic_year = c.academic_year
   AND sr.level_name   = c.level_name
   AND sr.term_name    = c.term_name
   AND sr.program_type = c.program_type
   AND (sr.postgraduate_program <=> c.postgraduate_program)
  WHERE c.academic_year = ?
    AND c.level_name   = ?
    AND c.term_name    = ?
    AND c.program_type = ?
    AND (c.postgraduate_program <=> ?)
    AND c.faculty_id = ?
    AND c.department_id = ?
  GROUP BY c.id, c.course_name

  UNION DISTINCT

  -- 2. مواد الإعادة المخزنة في عمود repeated_courses في الفصل الحالي
  SELECT 
    c.id, 
    c.course_name,
    COUNT(DISTINCT sr.student_id) AS registered_students_count,
    1 AS is_repeat_material
  FROM courses c
  INNER JOIN student_registrations sr 
    ON 1=1  
  WHERE sr.academic_year = ?
    AND sr.level_name   = ?
    AND sr.term_name    = ?
    AND sr.program_type = ?
    AND (sr.postgraduate_program <=> ?)
    AND c.faculty_id = ?
    AND c.department_id = ?
    -- االمادة موجودة في عمود repeated_courses
    AND FIND_IN_SET(c.id, sr.repeated_courses) > 0
  GROUP BY c.id, c.course_name

  ORDER BY course_name ASC
  `,
  [
    academic_year, level_name, term_name, program_type, pgProgram, faculty_id, department_id,

    academic_year, level_name, term_name, program_type, pgProgram, faculty_id, department_id
  ]
);

    res.json(rows);
  } catch (err) {
    console.error("GRADE ENTRY COURSES ERROR:", err);
    res.status(500).json({ error: "خطأ في السيرفر أو قاعدة البيانات" });
  }
});


app.get("/api/student-repeated-courses", async (req, res) => {
  try {
    const { 
      student_id, 
      academic_year, 
      level_name, 
      term_name, 
      program_type, 
      postgraduate_program 
    } = req.query;

    // 1.  repeated_courses من التسجيل
    const [regRows] = await dbp.query(
      `SELECT repeated_courses 
       FROM student_registrations 
       WHERE student_id = ? 
         AND academic_year = ? 
         AND level_name = ? 
         AND term_name = ? 
         AND program_type = ? 
         AND (postgraduate_program <=> ?) 
       LIMIT 1`,
      [student_id, academic_year, level_name, term_name, program_type, postgraduate_program || null]
    );

    if (!regRows.length || !regRows[0].repeated_courses) {
      return res.json({ repeated: [] });
    }

    const repeatedIds = regRows[0].repeated_courses
      .split(',')
      .map(id => id.trim())
      .filter(id => id && !isNaN(Number(id)));

    if (repeatedIds.length === 0) {
      return res.json({ repeated: [] });
    }

    // 2. جيب آخر محاولة فقط لكل مادة معادة (أكبر attempt_number)
    const placeholders = repeatedIds.map(() => '?').join(',');
    const [rows] = await dbp.query(
      `SELECT 
         c.course_name,
         cg.letter AS grade_letter,
         cg.total_mark,
         cg.attempt_number
       FROM course_grades cg
       JOIN courses c ON cg.course_id = c.id
       WHERE cg.student_id = ?
         AND cg.course_id IN (${placeholders})
         AND cg.attempt_number = (
           SELECT MAX(cg2.attempt_number)
           FROM course_grades cg2
           WHERE cg2.student_id = cg.student_id
             AND cg2.course_id = cg.course_id
         )
      `,
      [student_id, ...repeatedIds]
    );

    // 3. توليد status بناءً على total_mark
    const repeated = rows.map(row => {
      const mark = Number(row.total_mark);
      const status = isNaN(mark) ? '—' : (mark >= 50 ? 'نجاح' : 'رسوب');

      return {
        course_name: row.course_name || `مادة غير معروفة`,
        grade_letter: row.grade_letter || '—',
        total_mark: row.total_mark || '—',
        status: status
      };
    });

    res.json({ repeated });
  } catch (err) {
    console.error("خطأ في /student-repeated-courses:", err);
    res.status(500).json({ error: "خطأ في جلب مواد الإعادة" });
  }
});
/////الرسوم

// GET /term-default-fees - جلب الرسوم الافتراضية لفترة معينة (بدون student_id)
app.get("/api/term-default-fees", async (req, res) => {
  const {
    academic_year,
    level_name,
    program_type,
    postgraduate_program = null,
  } = req.query;

  if (!academic_year || !level_name || !program_type) {
    return res.status(400).json({ error: "البيانات الأساسية للفترة ناقصة (academic_year, level_name, program_type)" });
  }

  try {
    const [rows] = await dbp.query(
      `SELECT 
         id, academic_year, level_name, program_type, postgraduate_program,
         registration_fee, tuition_fee, late_fee,
         scholarship_type, scholarship_percentage,   
         payment_start_date, payment_end_date,
         installment_1, installment_1_start, installment_1_end,
         installment_2, installment_2_start, installment_2_end,
         installment_3, installment_3_start, installment_3_end,
         installment_4, installment_4_start, installment_4_end,
         installment_5, installment_5_start, installment_5_end,
         installment_6, installment_6_start, installment_6_end,
         department_id, registrar, created_at, updated_at
       FROM fees 
       WHERE student_id IS NULL 
         AND TRIM(academic_year) = TRIM(?)
         AND TRIM(level_name) = TRIM(?)
         AND program_type = ?
         AND (postgraduate_program <=> ? OR (postgraduate_program IS NULL AND ? IS NULL))
       ORDER BY updated_at DESC LIMIT 1`,
      [academic_year.trim(), level_name.trim(), program_type, postgraduate_program, postgraduate_program]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "لا توجد رسوم افتراضية لهذه الفترة" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Get term default fees error:", err);
    res.status(500).json({ error: "خطأ في جلب الرسوم" });
  }
});


// POST /term-default-fees - Save default fees for a term/period (no student_id)
// POST /term-default-fees
app.post("/api/term-default-fees", async (req, res) => {
  const {
    academic_year,
    level_name,
    program_type,
    postgraduate_program = null,
    department_id = null,
    registration_fee = 0,
    tuition_fee = 0,
    late_fee = 0,
    scholarship_type = "لا منحة",
    scholarship_percentage = 0,
    payment_start_date,
    payment_end_date,
    installment_1 = null, installment_1_start = null, installment_1_end = null,
    installment_2 = null, installment_2_start = null, installment_2_end = null,
    installment_3 = null, installment_3_start = null, installment_3_end = null,
    installment_4 = null, installment_4_start = null, installment_4_end = null,
    installment_5 = null, installment_5_start = null, installment_5_end = null,
    installment_6 = null, installment_6_start = null, installment_6_end = null,
  } = req.body;

  if (!academic_year || !level_name || !program_type) {
    return res.status(400).json({ error: "البيانات الأساسية ناقصة (academic_year, level_name, program_type)" });
  }

  try {
    const registrar = req.user?.username || DEFAULT_REGISTRAR;

    const [existing] = await dbp.query(
      `SELECT id FROM fees
       WHERE academic_year = ? AND level_name = ?
         AND program_type = ? AND (postgraduate_program <=> ?)
         AND (department_id <=> ?) AND student_id IS NULL`,
      [academic_year, level_name, program_type, postgraduate_program, department_id]
    );

    let result;
    if (existing.length > 0) {
      // Update
      [result] = await dbp.query(
        `UPDATE fees SET
          registration_fee = ?, tuition_fee = ?, late_fee = ?,
          scholarship_type = ?, scholarship_percentage = ?,
          payment_start_date = ?, payment_end_date = ?,
          installment_1 = ?, installment_1_start = ?, installment_1_end = ?,
          installment_2 = ?, installment_2_start = ?, installment_2_end = ?,
          installment_3 = ?, installment_3_start = ?, installment_3_end = ?,
          installment_4 = ?, installment_4_start = ?, installment_4_end = ?,
          installment_5 = ?, installment_5_start = ?, installment_5_end = ?,
          installment_6 = ?, installment_6_start = ?, installment_6_end = ?,
          registrar = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          registration_fee, tuition_fee, late_fee,
          scholarship_type, scholarship_percentage,
          payment_start_date || null, payment_end_date || null,
          installment_1, installment_1_start, installment_1_end,
          installment_2, installment_2_start, installment_2_end,
          installment_3, installment_3_start, installment_3_end,
          installment_4, installment_4_start, installment_4_end,
          installment_5, installment_5_start, installment_5_end,
          installment_6, installment_6_start, installment_6_end,
          registrar, existing[0].id
        ]
      );
      return res.json({ success: true, message: "تم تحديث الرسوم المبدئية بنجاح" });
    }

    // Insert
    [result] = await dbp.query(
      `INSERT INTO fees (
        academic_year, level_name, program_type, postgraduate_program,
        department_id, student_id,
        registration_fee, tuition_fee, late_fee,
        scholarship_type, scholarship_percentage,
        payment_start_date, payment_end_date,
        installment_1, installment_1_start, installment_1_end,
        installment_2, installment_2_start, installment_2_end,
        installment_3, installment_3_start, installment_3_end,
        installment_4, installment_4_start, installment_4_end,
        installment_5, installment_5_start, installment_5_end,
        installment_6, installment_6_start, installment_6_end,
        registrar, created_at, updated_at
      ) VALUES (?,?,?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
      [
        academic_year, level_name, program_type, postgraduate_program,
        department_id,
        registration_fee, tuition_fee, late_fee,
        scholarship_type, scholarship_percentage,
        payment_start_date || null, payment_end_date || null,
        installment_1, installment_1_start, installment_1_end,
        installment_2, installment_2_start, installment_2_end,
        installment_3, installment_3_start, installment_3_end,
        installment_4, installment_4_start, installment_4_end,
        installment_5, installment_5_start, installment_5_end,
        installment_6, installment_6_start, installment_6_end,
        registrar
      ]
    );

    res.json({ success: true, message: "تم حفظ الرسوم المبدئية بنجاح" });
  } catch (err) {
    console.error("Term default fees save error:", err);
    res.status(500).json({ error: "خطأ في حفظ الرسوم: " + err.message });
  }
});

// POST /api/student-fees - Save/update fees for a specific student
app.post("/api/student-fees", async (req, res) => {
  const {
    student_id,
    academic_year,
    level_name,
    program_type,
    postgraduate_program = null,
    registration_fee = 0,
    tuition_fee = 0,
    late_fee = 0,
    freeze_fee = 0,
    unfreeze_fee = 0,
    repeat_discount = 50,
    scholarship_type = "لا منحة",
    scholarship_percentage = 0,
    payment_start_date,
    payment_end_date,
    installment_1 = null, installment_1_start = null, installment_1_end = null,
    installment_2 = null, installment_2_start = null, installment_2_end = null,
    installment_3 = null, installment_3_start = null, installment_3_end = null,
    installment_4 = null, installment_4_start = null, installment_4_end = null,
    installment_5 = null, installment_5_start = null, installment_5_end = null,
    installment_6 = null, installment_6_start = null, installment_6_end = null,
  } = req.body;

  if (!student_id || !academic_year || !level_name || !program_type) {
    return res.status(400).json({ error: "البيانات الأساسية ناقصة (student_id, academic_year, level_name, program_type)" });
  }

  try {
    const registrar = req.user?.username || DEFAULT_REGISTRAR;

    // تحقق التسجيل (بدون term_name)
    const [regCheck] = await dbp.query(
      `SELECT id FROM student_registrations 
       WHERE student_id = ?
         AND academic_year = ?
         AND level_name = ?
         AND program_type = ?
         AND (postgraduate_program <=> ?)`,
      [student_id, academic_year, level_name, program_type, postgraduate_program]
    );

    if (regCheck.length === 0) {
      return res.status(403).json({ 
        error: "الطالب غير مسجل في هذا المستوى لهذه السنة. يجب التسجيل أولاً." 
      });
    }

    // تحقق أنها الفترة الأحدث (بدون term_name)
    const [latestReg] = await dbp.query(
      `SELECT academic_year, level_name
       FROM student_registrations 
       WHERE student_id = ?
       ORDER BY 
         CAST(SUBSTRING_INDEX(academic_year, '/', 1) AS UNSIGNED) DESC
       LIMIT 1`,
      [student_id]
    );

    if (latestReg.length > 0) {
      const latest = latestReg[0];
      if (
        latest.academic_year !== academic_year ||
        latest.level_name !== level_name
      ) {
        return res.status(403).json({ 
          error: "لا يمكن تعديل رسوم مستوى سابق. يُسمح فقط بالمستوى الحالي أو الأحدث." 
        });
      }
    }

    const [existing] = await dbp.query(
      `SELECT id FROM fees
       WHERE student_id = ? 
         AND academic_year = ? 
         AND level_name = ?
         AND program_type = ? 
         AND (postgraduate_program <=> ?)`,
      [student_id, academic_year, level_name, program_type, postgraduate_program]
    );

    if (existing.length > 0) {
      await dbp.query(
        `UPDATE fees SET
          registration_fee = ?, tuition_fee = ?, late_fee = ?,
          freeze_fee = ?, unfreeze_fee = ?, repeat_discount = ?,
          scholarship_type = ?, scholarship_percentage = ?,
          payment_start_date = ?, payment_end_date = ?,
          installment_1 = ?, installment_1_start = ?, installment_1_end = ?,
          installment_2 = ?, installment_2_start = ?, installment_2_end = ?,
          installment_3 = ?, installment_3_start = ?, installment_3_end = ?,
          installment_4 = ?, installment_4_start = ?, installment_4_end = ?,
          installment_5 = ?, installment_5_start = ?, installment_5_end = ?,
          installment_6 = ?, installment_6_start = ?, installment_6_end = ?,
          registrar = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          registration_fee, tuition_fee, late_fee,
          freeze_fee, unfreeze_fee, repeat_discount,
          scholarship_type, scholarship_percentage,
          payment_start_date || null, payment_end_date || null,
          installment_1, installment_1_start, installment_1_end,
          installment_2, installment_2_start, installment_2_end,
          installment_3, installment_3_start, installment_3_end,
          installment_4, installment_4_start, installment_4_end,
          installment_5, installment_5_start, installment_5_end,
          installment_6, installment_6_start, installment_6_end,
          registrar, existing[0].id
        ]
      );
      return res.json({ success: true, message: "تم تحديث رسوم الطالب بنجاح" });
    }

    await dbp.query(
      `INSERT INTO fees (
        student_id, academic_year, level_name, program_type, postgraduate_program,
        registration_fee, tuition_fee, late_fee, freeze_fee, unfreeze_fee, repeat_discount,
        scholarship_type, scholarship_percentage,
        payment_start_date, payment_end_date,
        installment_1, installment_1_start, installment_1_end,
        installment_2, installment_2_start, installment_2_end,
        installment_3, installment_3_start, installment_3_end,
        installment_4, installment_4_start, installment_4_end,
        installment_5, installment_5_start, installment_5_end,
        installment_6, installment_6_start, installment_6_end,
        registrar, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
      [
        student_id, academic_year, level_name, program_type, postgraduate_program,
        registration_fee, tuition_fee, late_fee, freeze_fee, unfreeze_fee, repeat_discount,
        scholarship_type, scholarship_percentage,
        payment_start_date || null, payment_end_date || null,
        installment_1, installment_1_start, installment_1_end,
        installment_2, installment_2_start, installment_2_end,
        installment_3, installment_3_start, installment_3_end,
        installment_4, installment_4_start, installment_4_end,
        installment_5, installment_5_start, installment_5_end,
        installment_6, installment_6_start, installment_6_end,
        registrar
      ]
    );

    res.json({ success: true, message: "تم حفظ رسوم الطالب بنجاح" });
  } catch (err) {
    console.error("Student fees error:", err);
    res.status(500).json({ error: "خطأ في حفظ الرسوم: " + err.message });
  }
});

// GET /student-fees?student_id=ID - Get fees for a student (latest or for specific period if params provided)
app.get("/api/student-fees", async (req, res) => {
  const { student_id, academic_year, level_name, term_name } = req.query;

  if (!student_id) return res.status(400).json({ error: "student_id مطلوب" });

  try {
let sql = `
      SELECT 
        id, 
        student_id, 
        academic_year, 
        level_name, 
        term_name, 
        program_type, 
        postgraduate_program,
        registration_fee, 
        tuition_fee, 
        late_fee,
        freeze_fee,
        unfreeze_fee,
        repeat_discount,
        scholarship_type, 
        scholarship_percentage,
        payment_start_date, 
        payment_end_date,
        
       
        installment_1, 
        DATE_FORMAT(installment_1_start, '%Y-%m-%d') AS installment_1_start,
        DATE_FORMAT(installment_1_end,   '%Y-%m-%d') AS installment_1_end,
        
        installment_2, 
        DATE_FORMAT(installment_2_start, '%Y-%m-%d') AS installment_2_start,
        DATE_FORMAT(installment_2_end,   '%Y-%m-%d') AS installment_2_end,
        
        installment_3, 
        DATE_FORMAT(installment_3_start, '%Y-%m-%d') AS installment_3_start,
        DATE_FORMAT(installment_3_end,   '%Y-%m-%d') AS installment_3_end,
        
        installment_4, 
        DATE_FORMAT(installment_4_start, '%Y-%m-%d') AS installment_4_start,
        DATE_FORMAT(installment_4_end,   '%Y-%m-%d') AS installment_4_end,
        
        installment_5, 
        DATE_FORMAT(installment_5_start, '%Y-%m-%d') AS installment_5_start,
        DATE_FORMAT(installment_5_end,   '%Y-%m-%d') AS installment_5_end,
        
        installment_6, 
        DATE_FORMAT(installment_6_start, '%Y-%m-%d') AS installment_6_start,
        DATE_FORMAT(installment_6_end,   '%Y-%m-%d') AS installment_6_end,
        
        registrar, 
        created_at, 
        updated_at
      FROM fees 
      WHERE student_id = ?`;
    const params = [student_id];

    if (academic_year) {
      sql += ` AND academic_year = ?`;
      params.push(academic_year);
    }
    if (level_name) {
      sql += ` AND level_name = ?`;
      params.push(level_name);
    }
    if (term_name) {
      sql += ` AND term_name = ?`;
      params.push(term_name);
    }

    sql += ` ORDER BY updated_at DESC LIMIT 1`;

    const [rows] = await dbp.query(sql, params);

    if (rows.length === 0) {
      return res.status(404).json({ error: "لا توجد رسوم لهذا الطالب" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Get student fees error:", err);
    res.status(500).json({ error: "خطأ في جلب الرسوم: " + err.message });
  }
});


// GET /api/student-fees-calculated?student_id=...&academic_year=...&level_name=...&term_name=...
app.get("/api/student-fees-calculated", async (req, res) => {
  const { student_id, academic_year, level_name, term_name } = req.query;
  const currentDeptId = stud.department_id || null;
  const currentProgramType = stud.program_type || program_type;
  const currentPostgrad = stud.postgraduate_program || null;

  if (!student_id || !academic_year) {
    return res.status(400).json({ error: "student_id و academic_year مطلوبان" });
  }

  try {
    // 1. جلب سنة الدخول الأولى وآخر سنة نشطة
    const [regRows] = await dbp.query(
      `SELECT 
         MIN(academic_year) AS first_enrollment_year,
         MAX(academic_year) AS last_active_year
       FROM student_registrations 
       WHERE student_id = ?
         AND registration_status = 'مسجّل'`,
      [student_id]
    );

    const firstYear = regRows[0]?.first_enrollment_year || null;
    const lastActiveYear = regRows[0]?.last_active_year || null;

    // 2. حساب عدد سنوات الغياب
    let yearsAbsent = 0;
    if (firstYear && lastActiveYear) {
      const currentYearNum = parseInt(academic_year.split('/')[0]) || 0;
      const lastActiveNum = parseInt(lastActiveYear.split('/')[0]) || 0;
      yearsAbsent = currentYearNum - lastActiveNum;
    }

    // 3. جلب بيانات الطالب + الموقف الأكاديمي + نوع الكلية
    const [studentRows] = await dbp.query(
      `SELECT 
         s.*,
         sr.academic_status,
         sr.level_name AS current_level,
         sr.term_name AS current_term,
         f.faculty_type
       FROM students s
       LEFT JOIN student_registrations sr 
         ON sr.student_id = s.id 
         AND sr.academic_year = ?
         AND (sr.level_name = ? OR ? IS NULL)
         AND (sr.term_name = ? OR ? IS NULL)
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN faculties f ON d.faculty_id = f.id
       WHERE s.id = ?
       ORDER BY sr.id DESC
       LIMIT 1`,
      [academic_year, level_name || null, level_name, term_name || null, term_name, student_id]
    );

    if (studentRows.length === 0) {
      return res.status(404).json({ error: "الطالب غير موجود" });
    }

    const stud = studentRows[0];
    const status = stud.academic_status || "نظامي";
    const facultyType = stud.faculty_type || "غير محدد";

    // 4. جلب الرسوم الأساسية (خاصة أو عامة)
    let sqlFees = `
      SELECT * FROM fees 
      WHERE academic_year = ? 
        AND (level_name = ? OR ? IS NULL)
        AND (term_name = ? OR ? IS NULL)
        AND (student_id = ? OR student_id IS NULL)
      ORDER BY student_id DESC, id DESC
      LIMIT 1
    `;

    const [feesRows] = await dbp.query(sqlFees, [
      academic_year,
      level_name || null,
      level_name,
      term_name || null,
      term_name,
      student_id
    ]);

    if (feesRows.length === 0) {
      return res.status(404).json({ error: "لا توجد رسوم متاحة لهذه الفترة" });
    }

    let fees = { ...feesRows[0] };
    let notes = [];

    // 5. مصدر رسوم الدراسة
    let tuitionSource = "السنة الحالية";
    if (yearsAbsent <= 2 && firstYear) {
const [enrollFees] = await dbp.query(
    `SELECT f.tuition_fee 
     FROM fees f
     WHERE f.academic_year = ?
       AND (f.student_id = ? OR f.student_id IS NULL)
       AND f.department_id = ?                  -- ← شرط القسم (مهم جدًا)
       AND f.program_type = ?                   -- ← شرط نوع البرنامج
       AND (f.postgraduate_program <=> ?)       -- ← شرط البرنامج العالي لو موجود
     ORDER BY f.student_id DESC, f.updated_at DESC
     LIMIT 1`,
    [firstYear, student_id, currentDeptId, currentProgramType, currentPostgrad]
  );

      if (enrollFees.length > 0 && enrollFees[0].tuition_fee) {
        fees.tuition_fee = enrollFees[0].tuition_fee;
        tuitionSource = `سنة الدخول الأولى (${firstYear})`;
      }
    } else if (yearsAbsent > 2) {
      notes.push(`غياب أكثر من سنتين (${yearsAbsent} سنة): استخدام رسوم السنة الحالية`);
    }

    // 6. تعديل الرسوم حسب الموقف الأكاديمي
    if (status === "مجمّد") {
      const [prevReg] = await dbp.query(
        `SELECT registration_fee FROM fees 
         WHERE academic_year = ? 
           AND (student_id = ? OR student_id IS NULL)
         LIMIT 1`,
        [lastActiveYear || firstYear, student_id]
      );

      const regDiff = (fees.registration_fee || 0) - (prevReg[0]?.registration_fee || 0);
      const extra = regDiff + (fees.freeze_fee || 0) + (fees.unfreeze_fee || 0);

      fees.total_extra = extra;
      notes.push(`مجمد: فرق تسجيل (${regDiff}) + تجميد (${fees.freeze_fee || 0}) + فك تجميد (${fees.unfreeze_fee || 0})`);
    } 
    else if (status === "إعاده") {
      const discount = (fees.repeat_discount || 50) / 100;
      fees.tuition_fee = (fees.tuition_fee || 0) * (1 - discount);
      notes.push(`إعادة: خصم ${(discount * 100)}% على الرسوم الدراسية + تسجيل كامل`);
    } 
    else if (status === "فصل") {
      if (facultyType === "theoretical") {
        fees.tuition_fee = 0;
        notes.push("فصل بسبب غياب - نظري: رسوم تسجيل فقط");
      } else {
        const discount = (fees.repeat_discount || 50) / 100;
        fees.tuition_fee = (fees.tuition_fee || 0) * (1 - discount);
        notes.push("فصل بسبب غياب - عملي: نفس معاملة الإعادة (خصم 50%)");
      }
    }

    // 7. الإجمالي النهائي
    fees.total = 
      (fees.registration_fee || 0) +
      (fees.tuition_fee || 0) +
      (fees.late_fee || 0) +
      (fees.total_extra || 0);

    // 8. البيانات الإضافية
    fees.first_enrollment_year = firstYear;
    fees.last_active_year = lastActiveYear;
    fees.years_absent = yearsAbsent;
    fees.tuition_source = tuitionSource;
    fees.academic_status = status;
    fees.faculty_type = facultyType;
    fees.notes = notes.length > 0 ? notes.join(" | ") : "لا ملاحظات خاصة";

    res.json(fees);
  } catch (err) {
    console.error("Calculated fees error:", err);
    res.status(500).json({ error: "خطأ في حساب الرسوم: " + err.message });
  }
});

// GET /api/student-installments-status
app.get("/api/student-installments-status", async (req, res) => {
  const { student_id, academic_year, level_name } = req.query;

  if (!student_id || !academic_year || !level_name) {
    return res.status(400).json({ error: "مطلوب student_id و academic_year و level_name" });
  }
  try {
    const [rows] = await dbp.query(`
      SELECT 
        installment_1, 
        installment_1_paid, 
        DATE_FORMAT(installment_1_paid_at, '%Y-%m-%d') AS installment_1_paid_at,
        
        installment_2, 
        installment_2_paid, 
        DATE_FORMAT(installment_2_paid_at, '%Y-%m-%d') AS installment_2_paid_at,
        
        installment_3, 
        installment_3_paid, 
        DATE_FORMAT(installment_3_paid_at, '%Y-%m-%d') AS installment_3_paid_at,
        
        installment_4, 
        installment_4_paid, 
        DATE_FORMAT(installment_4_paid_at, '%Y-%m-%d') AS installment_4_paid_at,
        
        installment_5, 
        installment_5_paid, 
        DATE_FORMAT(installment_5_paid_at, '%Y-%m-%d') AS installment_5_paid_at,
        
        installment_6, 
        installment_6_paid, 
        DATE_FORMAT(installment_6_paid_at, '%Y-%m-%d') AS installment_6_paid_at,
        
        registration_fee, 
        tuition_fee, 
        late_fee, 
        freeze_fee, 
        unfreeze_fee
      FROM fees
      WHERE student_id = ?
        AND academic_year = ?
        AND level_name = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `, [student_id, academic_year, level_name]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "لا توجد بيانات رسوم" });
    }

    const result = rows[0];



    res.json(result);
  } catch (err) {
    console.error("خطأ في جلب حالة الأقساط:", err);
    res.status(500).json({ error: "خطأ في السيرفر", details: err.message });
  }
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
