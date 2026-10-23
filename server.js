const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, "school.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: "school.sid",
  secret: process.env.SESSION_SECRET || "local-development-secret-change-before-deployment",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, "public")));

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','principal','teacher','accountant','examofficer','parent','student')),
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admission_no TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'Not specified',
  class_name TEXT NOT NULL,
  arm TEXT NOT NULL DEFAULT 'A',
  guardian_name TEXT DEFAULT '',
  guardian_phone TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  attendance_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('Present','Absent','Late','Excused')),
  recorded_by INTEGER REFERENCES users(id),
  UNIQUE(student_id, attendance_date)
);
CREATE TABLE IF NOT EXISTS marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  subject TEXT NOT NULL,
  session TEXT NOT NULL,
  term TEXT NOT NULL,
  ca_score REAL NOT NULL,
  exam_score REAL NOT NULL,
  total REAL NOT NULL,
  grade TEXT NOT NULL,
  entered_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, subject, session, term)
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  amount REAL NOT NULL CHECK(amount > 0),
  method TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  note TEXT DEFAULT '',
  received_by INTEGER REFERENCES users(id),
  paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

function seed() {
  const count = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (!count) {
    const ins = db.prepare("INSERT INTO users (username,password_hash,full_name,role) VALUES (?,?,?,?)");
    const pw = bcrypt.hashSync("School@123", 10);
    const users = [
      ["admin", pw, "School Administrator", "admin"],
      ["principal", pw, "Principal", "principal"],
      ["teacher", pw, "Sample Teacher", "teacher"],
      ["accountant", pw, "School Bursar", "accountant"],
      ["examofficer", pw, "Examination Officer", "examofficer"],
      ["parent", pw, "Sample Parent", "parent"],
      ["student", pw, "Sample Student", "student"]
    ];
    const tx = db.transaction(() => users.forEach(u => ins.run(...u)));
    tx();
  }
  const studentsCount = db.prepare("SELECT COUNT(*) AS n FROM students").get().n;
  if (!studentsCount) {
    const add = db.prepare(`INSERT INTO students
      (admission_no,first_name,last_name,gender,class_name,arm,guardian_name,guardian_phone)
      VALUES (?,?,?,?,?,?,?,?)`);
    add.run("NSS/2026/001", "Ada", "Okafor", "Female", "JSS 1", "A", "Mrs. Okafor", "08030000001");
    add.run("NSS/2026/002", "Chinedu", "Eze", "Male", "SS 1", "Science", "Mr. Eze", "08030000002");
    add.run("NSS/2026/003", "Zainab", "Bello", "Female", "JSS 2", "B", "Mrs. Bello", "08030000003");
  }
}
seed();

const ROLE_LABELS = {
  admin: "School Administrator",
  principal: "Principal / Vice Principal",
  teacher: "Teacher",
  accountant: "Accountant / Bursar",
  examofficer: "Examination Officer",
  parent: "Parent / Guardian",
  student: "Student"
};

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Please log in first." });
  next();
}
function allow(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: "Please log in first." });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ error: "Your account does not have permission for this action." });
    next();
  };
}
function safeUser(u) {
  return { id: u.id, username: u.username, fullName: u.full_name, role: u.role, roleLabel: ROLE_LABELS[u.role] };
}
function gradeFor(total) {
  if (total >= 75) return "A1";
  if (total >= 70) return "B2";
  if (total >= 65) return "B3";
  if (total >= 60) return "C4";
  if (total >= 55) return "C5";
  if (total >= 50) return "C6";
  if (total >= 45) return "D7";
  if (total >= 40) return "E8";
  return "F9";
}
function makeReference() {
  return "PAY-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

app.post("/api/login", (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE username=? AND active=1").get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "Could not start session." });
    req.session.user = safeUser(user);
    res.json({ user: req.session.user });
  });
});
app.post("/api/logout", requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
app.get("/api/me", (req, res) => res.json({ user: req.session.user || null }));

app.get("/api/dashboard", requireAuth, (req, res) => {
  const role = req.session.user.role;
  const studentCount = db.prepare("SELECT COUNT(*) n FROM students WHERE status='Active'").get().n;
  const paymentTotal = db.prepare("SELECT COALESCE(SUM(amount),0) n FROM payments").get().n;
  const markCount = db.prepare("SELECT COUNT(*) n FROM marks").get().n;
  const today = new Date().toISOString().slice(0, 10);
  const presentToday = db.prepare("SELECT COUNT(*) n FROM attendance WHERE attendance_date=? AND status='Present'").get(today).n;
  res.json({
    stats: [
      { label: "Active students", value: studentCount, icon: "students" },
      { label: "Marks recorded", value: markCount, icon: "results" },
      { label: "Payments recorded", value: "₦" + Number(paymentTotal).toLocaleString("en-NG"), icon: "fees" },
      { label: "Present today", value: presentToday, icon: "attendance" }
    ],
    role,
    quickActions: role === "teacher" ? ["attendance","results"] :
      role === "accountant" ? ["fees"] :
      role === "parent" || role === "student" ? ["results","attendance"] :
      ["students","attendance","results","fees"]
  });
});

app.get("/api/students", requireAuth, (req, res) => {
  // Parent/student demo accounts see sample linked records only; full guardian linking is planned.
  let rows = db.prepare("SELECT * FROM students ORDER BY class_name, last_name").all();
  if (req.session.user.role === "student") rows = rows.filter(s => s.admission_no === "NSS/2026/001");
  if (req.session.user.role === "parent") rows = rows.filter(s => s.admission_no === "NSS/2026/001");
  res.json({ students: rows });
});
app.post("/api/students", allow("admin"), (req, res) => {
  const first = String(req.body.firstName || "").trim();
  const last = String(req.body.lastName || "").trim();
  const admission = String(req.body.admissionNo || "").trim();
  const className = String(req.body.className || "").trim();
  const arm = String(req.body.arm || "A").trim();
  if (!first || !last || !admission || !className) return res.status(400).json({ error: "First name, last name, admission number and class are required." });
  try {
    const result = db.prepare(`INSERT INTO students
      (admission_no,first_name,last_name,gender,class_name,arm,guardian_name,guardian_phone)
      VALUES (?,?,?,?,?,?,?,?)`).run(
      admission, first, last, String(req.body.gender || "Not specified"),
      className, arm, String(req.body.guardianName || "").trim(), String(req.body.guardianPhone || "").trim()
    );
    res.status(201).json({ student: db.prepare("SELECT * FROM students WHERE id=?").get(result.lastInsertRowid) });
  } catch (e) {
    if (String(e.message).includes("UNIQUE")) return res.status(409).json({ error: "That admission number already exists." });
    res.status(500).json({ error: "Could not save student." });
  }
});

app.get("/api/attendance", requireAuth, (req, res) => {
  let rows = db.prepare(`SELECT a.*, s.admission_no, s.first_name, s.last_name, s.class_name, s.arm
    FROM attendance a JOIN students s ON s.id=a.student_id ORDER BY attendance_date DESC, s.last_name LIMIT 100`).all();
  if (req.session.user.role === "student" || req.session.user.role === "parent") {
    rows = rows.filter(r => r.admission_no === "NSS/2026/001");
  }
  res.json({ attendance: rows });
});
app.post("/api/attendance", allow("admin","principal","teacher","examofficer"), (req, res) => {
  const studentId = Number(req.body.studentId);
  const date = String(req.body.date || "").trim();
  const status = String(req.body.status || "");
  if (!studentId || !date || !["Present","Absent","Late","Excused"].includes(status)) {
    return res.status(400).json({ error: "Choose a student, date and valid attendance status." });
  }
  try {
    db.prepare(`INSERT INTO attendance(student_id,attendance_date,status,recorded_by)
      VALUES(?,?,?,?) ON CONFLICT(student_id,attendance_date) DO UPDATE SET status=excluded.status, recorded_by=excluded.recorded_by`)
      .run(studentId, date, status, req.session.user.id);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Could not record attendance. Check the selected student." });
  }
});

app.get("/api/marks", requireAuth, (req, res) => {
  let rows = db.prepare(`SELECT m.*, s.admission_no, s.first_name, s.last_name, s.class_name
    FROM marks m JOIN students s ON s.id=m.student_id ORDER BY m.created_at DESC`).all();
  if (req.session.user.role === "student" || req.session.user.role === "parent") {
    rows = rows.filter(m => m.admission_no === "NSS/2026/001");
  }
  res.json({ marks: rows });
});
app.post("/api/marks", allow("admin","principal","teacher","examofficer"), (req, res) => {
  const studentId = Number(req.body.studentId);
  const subject = String(req.body.subject || "").trim();
  const sessionName = String(req.body.session || "2026/2027").trim();
  const term = String(req.body.term || "First Term").trim();
  const ca = Number(req.body.caScore);
  const exam = Number(req.body.examScore);
  if (!studentId || !subject || !Number.isFinite(ca) || !Number.isFinite(exam) || ca < 0 || ca > 20 || exam < 0 || exam > 80) {
    return res.status(400).json({ error: "Select a student and subject. CA must be 0–20 and exam must be 0–80." });
  }
  if (!db.prepare("SELECT id FROM students WHERE id=?").get(studentId)) return res.status(400).json({ error: "Student not found." });
  const total = ca + exam;
  try {
    db.prepare(`INSERT INTO marks(student_id,subject,session,term,ca_score,exam_score,total,grade,entered_by)
      VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(student_id,subject,session,term) DO UPDATE SET
      ca_score=excluded.ca_score, exam_score=excluded.exam_score, total=excluded.total,
      grade=excluded.grade, entered_by=excluded.entered_by`)
      .run(studentId, subject, sessionName, term, ca, exam, total, gradeFor(total), req.session.user.id);
    res.json({ ok: true, total, grade: gradeFor(total) });
  } catch {
    res.status(500).json({ error: "Could not save mark." });
  }
});

app.get("/api/payments", requireAuth, (req, res) => {
  let rows = db.prepare(`SELECT p.*, s.admission_no, s.first_name, s.last_name
    FROM payments p JOIN students s ON s.id=p.student_id ORDER BY paid_at DESC LIMIT 100`).all();
  if (req.session.user.role === "parent") {
    rows = rows.filter(p => p.admission_no === "NSS/2026/001");
  }
  if (req.session.user.role === "student") rows = [];
  res.json({ payments: rows });
});
app.post("/api/payments", allow("admin","accountant"), (req, res) => {
  const studentId = Number(req.body.studentId);
  const amount = Number(req.body.amount);
  const method = String(req.body.method || "Bank transfer");
  const note = String(req.body.note || "").trim();
  if (!studentId || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Select a student and enter a payment amount greater than zero." });
  if (!db.prepare("SELECT id FROM students WHERE id=?").get(studentId)) return res.status(400).json({ error: "Student not found." });
  const reference = makeReference();
  db.prepare("INSERT INTO payments(student_id,amount,method,reference,note,received_by) VALUES(?,?,?,?,?,?)")
    .run(studentId, amount, method, reference, note, req.session.user.id);
  res.status(201).json({ ok: true, reference });
});

app.get("/api/users/summary", allow("admin"), (req, res) => {
  res.json({ users: db.prepare("SELECT id,username,full_name,role,active FROM users ORDER BY role").all() });
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`School Management System running at http://localhost:${PORT}`);
  console.log("Demo password for all sample accounts: School@123");
});
