const $ = (sel) => document.querySelector(sel);
let currentUser = null;
let cachedStudents = [];
const roleNames = {
  admin: "School Administrator", principal: "Principal / Vice Principal",
  teacher: "Teacher", accountant: "Accountant / Bursar",
  examofficer: "Examination Officer", parent: "Parent / Guardian", student: "Student"
};
const titles = {dashboard:"Dashboard",students:"Students",attendance:"Attendance",results:"Results & Marks",fees:"Fees & Payments",users:"User Accounts"};
const money = n => "₦" + Number(n || 0).toLocaleString("en-NG", {maximumFractionDigits:2});
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateToday = () => new Date().toISOString().slice(0,10);
async function api(url, options={}) {
  const res = await fetch(url, {credentials:"same-origin", headers:{"Content-Type":"application/json", ...(options.headers||{})}, ...options});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function notice(message, bad=false) {
  const el=$("#notice"); el.textContent=message; el.classList.remove("hidden","bad");
  if(bad) el.classList.add("bad");
  window.scrollTo({top:0,behavior:"smooth"});
  setTimeout(()=>el.classList.add("hidden"),5000);
}
function can(...roles){return roles.includes(currentUser?.role);}
function setScreen(loggedIn) {
  $("#login-screen").classList.toggle("hidden",loggedIn);
  $("#app-screen").classList.toggle("hidden",!loggedIn);
}
function setupUser(user) {
  currentUser=user;
  $("#user-name").textContent=user.fullName;
  $("#user-role").textContent=user.roleLabel;
  $("#avatar").textContent=user.fullName.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase();
  document.querySelectorAll(".admin-only").forEach(el=>el.classList.toggle("hidden",!can("admin")));
  document.querySelectorAll(".nav-item").forEach(el=>{
    const page=el.dataset.page;
    const allowed = {
      dashboard:["admin","principal","teacher","accountant","examofficer","parent","student"],
      students:["admin","principal","teacher","examofficer","parent","student"],
      attendance:["admin","principal","teacher","examofficer","parent","student"],
      results:["admin","principal","teacher","examofficer","parent","student"],
      fees:["admin","accountant","parent"],
      users:["admin"]
    };
    el.classList.toggle("hidden",!(allowed[page]||[]).includes(user.role));
  });
}
function initials(s){return (s.first_name?.[0]||"")+(s.last_name?.[0]||"");}
function studentName(s){return `${s.first_name} ${s.last_name}`;}
function studentOptionList(){return cachedStudents.map(s=>`<option value="${s.id}">${escapeHtml(s.admission_no)} — ${escapeHtml(studentName(s))} (${escapeHtml(s.class_name)} ${escapeHtml(s.arm)})</option>`).join("");}
async function loadStudents(){cachedStudents=(await api("/api/students")).students;return cachedStudents;}
function heading(title, desc, action=""){return `<div class="page-heading"><div><h3>${title}</h3><p>${desc}</p></div>${action}</div>`;}
function table(headers, rows, empty="No records yet.") {
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.join(""):`<tr><td colspan="${headers.length}" class="empty">${empty}</td></tr>`}</tbody></table></div>`;
}
function studentCell(s){return `<div class="student-cell"><span class="student-avatar">${escapeHtml(initials(s).toUpperCase())}</span><span><strong>${escapeHtml(studentName(s))}</strong><small>${escapeHtml(s.admission_no)}</small></span></div>`;}
async function render(page="dashboard") {
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $("#page-title").textContent=titles[page]||"Dashboard";
  $("#today-label").textContent=new Date().toLocaleDateString("en-NG",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase();
  const target=$("#page-content"); target.innerHTML='<div class="panel empty">Loading…</div>';
  try {
    if(page==="dashboard") await renderDashboard(target);
    else if(page==="students") await renderStudents(target);
    else if(page==="attendance") await renderAttendance(target);
    else if(page==="results") await renderResults(target);
    else if(page==="fees") await renderFees(target);
    else if(page==="users") await renderUsers(target);
  } catch(e){target.innerHTML=`<div class="panel empty">${escapeHtml(e.message)}</div>`;}
}
async function renderDashboard(target){
  const data=await api("/api/dashboard");
  const icons={students:"♙",results:"▤",fees:"₦",attendance:"✓"};
  const stats=data.stats.map(s=>`<article class="stat-card"><div class="stat-top"><span>${escapeHtml(s.label)}</span><span class="stat-icon">${icons[s.icon]||"•"}</span></div><div class="stat-value">${escapeHtml(s.value)}</div><div class="stat-foot">Current local demo data</div></article>`).join("");
  const actions = [
    ...(can("admin","principal","teacher","examofficer")?[["attendance","✓","Take attendance"],["results","▤","Enter marks"]]:[]),
    ...(can("admin")?[["students","♙","Add a student"]]:[]),
    ...(can("admin","accountant")?[["fees","₦","Record payment"]]:[]),
    ...(can("parent","student")?[["results","▤","View results"],["attendance","✓","View attendance"]]:[])
  ];
  target.innerHTML=`
    ${heading(`Welcome back, ${escapeHtml(currentUser.fullName.split(" ")[0])}`,`Here is your school workspace overview. <span class="role-chip">${escapeHtml(roleNames[currentUser.role])}</span>`)}
    <div class="stats-grid">${stats}</div>
    <div class="two-col">
      <section class="panel"><div class="panel-head"><div><h3>School workspace</h3><p>Quick overview of the local demo</p></div><span class="pill">Active</span></div>
        <div class="activity"><span class="activity-dot"></span><div><strong>Academic session: 2026/2027</strong><small>Example session shown for testing; session settings are not yet editable.</small></div></div>
        <div class="activity"><span class="activity-dot"></span><div><strong>Assessment format: CA + examination</strong><small>CA is out of 20 and examination is out of 80 in this MVP.</small></div></div>
        <div class="activity"><span class="activity-dot"></span><div><strong>Local database enabled</strong><small>Records are saved to the school.db file on this computer.</small></div></div>
      </section>
      <section class="panel"><div class="panel-head"><div><h3>Quick actions</h3><p>Go directly to a task</p></div></div>
        <div class="quick-grid">${actions.map(a=>`<button class="quick-btn" data-go="${a[0]}"><span>${a[1]}</span>${a[2]}</button>`).join("")||'<p class="muted">No quick actions available for this role.</p>'}</div>
      </section>
    </div>
    <section class="panel"><div class="panel-head"><div><h3>About this version</h3><p>Features included and planned</p></div></div>
      <p class="muted">This first runnable version includes student records, attendance, marks and manually recorded payments. CBT, WAEC/NECO practice, library loans, online payment integration, report-card PDFs and full account administration are planned next.</p>
    </section>`;
  target.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>render(b.dataset.go)));
}
async function renderStudents(target){
  await loadStudents();
  const addButton=can("admin")?'<button class="primary" id="show-add-student">+ Add student</button>':"";
  target.innerHTML=heading("Student directory","Student records and class placement.",addButton)+`
    <section id="student-form-panel" class="panel hidden">
      <div class="panel-head"><div><h3>Register a student</h3><p>Use a unique admission number.</p></div></div>
      <form id="student-form"><div class="form-grid">
        <label class="field">Admission number<input name="admissionNo" required placeholder="e.g. NSS/2026/004"></label>
        <label class="field">Class<select name="className"><option>JSS 1</option><option>JSS 2</option><option>JSS 3</option><option>SS 1</option><option>SS 2</option><option>SS 3</option></select></label>
        <label class="field">First name<input name="firstName" required></label><label class="field">Last name<input name="lastName" required></label>
        <label class="field">Gender<select name="gender"><option>Female</option><option>Male</option><option>Not specified</option></select></label>
        <label class="field">Class arm<input name="arm" value="A" required></label>
        <label class="field">Parent / guardian name<input name="guardianName"></label><label class="field">Guardian phone<input name="guardianPhone" placeholder="080…"></label>
      </div><div class="form-actions"><button type="button" class="secondary-btn" id="cancel-student">Cancel</button><button class="primary">Save student</button></div></form>
    </section>
    <section class="panel"><div class="toolbar"><input id="student-search" class="search-input" placeholder="Search name, admission no. or class"><span class="pill blue">${cachedStudents.length} records</span></div><div id="students-table"></div></section>`;
  const formPanel=$("#student-form-panel");
  $("#show-add-student")?.addEventListener("click",()=>formPanel.classList.toggle("hidden"));
  $("#cancel-student")?.addEventListener("click",()=>formPanel.classList.add("hidden"));
  const draw=()=>{
    const q=$("#student-search").value.toLowerCase();
    const list=cachedStudents.filter(s=>[s.admission_no,s.first_name,s.last_name,s.class_name,s.arm].join(" ").toLowerCase().includes(q));
    $("#students-table").innerHTML=table(["Student","Class","Gender","Guardian","Status"],list.map(s=>`<tr><td>${studentCell(s)}</td><td>${escapeHtml(s.class_name)} ${escapeHtml(s.arm)}</td><td>${escapeHtml(s.gender)}</td><td>${escapeHtml(s.guardian_name||"—")}<br><small class="muted">${escapeHtml(s.guardian_phone||"")}</small></td><td><span class="pill">${escapeHtml(s.status)}</span></td></tr>`));
  };
  $("#student-search").addEventListener("input",draw);draw();
  $("#student-form")?.addEventListener("submit",async e=>{
    e.preventDefault();const body=Object.fromEntries(new FormData(e.target).entries());
    try{await api("/api/students",{method:"POST",body:JSON.stringify(body)});notice("Student registered successfully.");await render("students");}
    catch(err){notice(err.message,true);}
  });
}
async function renderAttendance(target){
  await loadStudents();const canRecord=can("admin","principal","teacher","examofficer");
  const records=(await api("/api/attendance")).attendance;
  target.innerHTML=heading("Attendance register","Record daily attendance and review recent entries.",canRecord?'<button class="primary" id="show-attendance-form">+ Record attendance</button>':"")+
    `<section id="attendance-form-panel" class="panel ${canRecord?"hidden":"hidden"}"><div class="panel-head"><div><h3>Record attendance</h3><p>One attendance status per student per date.</p></div></div>
    <form id="attendance-form"><div class="form-grid"><label class="field">Student<select name="studentId" required>${studentOptionList()}</select></label><label class="field">Date<input name="date" type="date" value="${dateToday()}" required></label><label class="field">Status<select name="status"><option>Present</option><option>Absent</option><option>Late</option><option>Excused</option></select></label></div><div class="form-actions"><button type="button" class="secondary-btn" id="cancel-attendance">Cancel</button><button class="primary">Save attendance</button></div></form></section>
    <section class="panel"><div class="panel-head"><div><h3>Recent attendance</h3><p>Latest 100 entries</p></div></div>${table(["Date","Student","Class","Status"],records.map(r=>`<tr><td>${escapeHtml(r.attendance_date)}</td><td>${escapeHtml(r.first_name+" "+r.last_name)}<br><small class="muted">${escapeHtml(r.admission_no)}</small></td><td>${escapeHtml(r.class_name)} ${escapeHtml(r.arm)}</td><td><span class="pill ${r.status==="Absent"?"red":r.status==="Late"?"orange":""}">${escapeHtml(r.status)}</span></td></tr>`))}</section>`;
  $("#show-attendance-form")?.addEventListener("click",()=>$("#attendance-form-panel").classList.toggle("hidden"));
  $("#cancel-attendance")?.addEventListener("click",()=>$("#attendance-form-panel").classList.add("hidden"));
  $("#attendance-form")?.addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/attendance",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target).entries()))});notice("Attendance saved.");await render("attendance");}catch(err){notice(err.message,true);}});
}
async function renderResults(target){
  await loadStudents();const marks=(await api("/api/marks")).marks;
  const canEnter=can("admin","principal","teacher","examofficer");
  target.innerHTML=heading("Results & marks","Traditional assessment: CA / 20 + examination / 80.",canEnter?'<button class="primary" id="show-mark-form">+ Enter marks</button>':"")+
    `<section id="mark-form-panel" class="panel hidden"><div class="panel-head"><div><h3>Enter or update marks</h3><p>Saving the same student, subject, session and term updates the existing record.</p></div></div>
    <form id="mark-form"><div class="form-grid"><label class="field">Student<select name="studentId" required>${studentOptionList()}</select></label><label class="field">Subject<input name="subject" required placeholder="e.g. Mathematics"></label>
    <label class="field">Academic session<input name="session" value="2026/2027" required></label><label class="field">Term<select name="term"><option>First Term</option><option>Second Term</option><option>Third Term</option></select></label>
    <label class="field">CA score (0–20)<input name="caScore" type="number" min="0" max="20" step="0.5" required></label><label class="field">Exam score (0–80)<input name="examScore" type="number" min="0" max="80" step="0.5" required></label></div><p class="help-text">Demo grading scale: A1 75–100, B2 70–74, B3 65–69, C4 60–64, C5 55–59, C6 50–54, D7 45–49, E8 40–44, F9 below 40. Confirm your school's official grading rules before real use.</p><div class="form-actions"><button type="button" class="secondary-btn" id="cancel-mark">Cancel</button><button class="primary">Save marks</button></div></form></section>
    <section class="panel"><div class="toolbar"><input id="mark-search" class="search-input" placeholder="Search student or subject"><span class="pill blue">${marks.length} records</span></div><div id="marks-table"></div></section>`;
  $("#show-mark-form")?.addEventListener("click",()=>$("#mark-form-panel").classList.toggle("hidden"));
  $("#cancel-mark")?.addEventListener("click",()=>$("#mark-form-panel").classList.add("hidden"));
  const draw=()=>{const q=$("#mark-search").value.toLowerCase();const list=marks.filter(m=>[m.first_name,m.last_name,m.subject,m.admission_no,m.class_name].join(" ").toLowerCase().includes(q));$("#marks-table").innerHTML=table(["Student","Class","Subject","CA / 20","Exam / 80","Total","Grade","Term"],list.map(m=>`<tr><td>${escapeHtml(m.first_name+" "+m.last_name)}<br><small class="muted">${escapeHtml(m.admission_no)}</small></td><td>${escapeHtml(m.class_name)}</td><td>${escapeHtml(m.subject)}</td><td>${m.ca_score}</td><td>${m.exam_score}</td><td><strong>${m.total}</strong></td><td><span class="pill ${m.grade==="F9"?"red":"blue"}">${escapeHtml(m.grade)}</span></td><td>${escapeHtml(m.term)}<br><small class="muted">${escapeHtml(m.session)}</small></td></tr>`));};
  $("#mark-search").addEventListener("input",draw);draw();
  $("#mark-form")?.addEventListener("submit",async e=>{e.preventDefault();try{const r=await api("/api/marks",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target).entries()))});notice(`Marks saved. Total: ${r.total}/100, grade: ${r.grade}.`);await render("results");}catch(err){notice(err.message,true);}});
}
async function renderFees(target){
  await loadStudents();const payments=(await api("/api/payments")).payments;
  const canRecord=can("admin","accountant");
  const total=payments.reduce((a,p)=>a+Number(p.amount),0);
  target.innerHTML=heading("Fees & payments","Record payments and review payment history.",canRecord?'<button class="primary" id="show-payment-form">+ Record payment</button>':"")+
    `<div class="stats-grid"><article class="stat-card"><div class="stat-top"><span>Payments recorded</span><span class="stat-icon">₦</span></div><div class="stat-value">${money(total)}</div><div class="stat-foot">Total recorded in local demo</div></article><article class="stat-card"><div class="stat-top"><span>Transactions</span><span class="stat-icon">▤</span></div><div class="stat-value">${payments.length}</div><div class="stat-foot">Payment entries</div></article></div>
    <section id="payment-form-panel" class="panel hidden"><div class="panel-head"><div><h3>Record a payment</h3><p>For cash, transfer or POS payments already received.</p></div></div>
    <form id="payment-form"><div class="form-grid"><label class="field">Student<select name="studentId" required>${studentOptionList()}</select></label><label class="field">Amount (₦)<input name="amount" type="number" min="1" step="0.01" required placeholder="e.g. 50000"></label><label class="field">Payment method<select name="method"><option>Bank transfer</option><option>Cash</option><option>POS</option><option>Other</option></select></label><label class="field">Note / purpose<input name="note" placeholder="e.g. First term school fees"></label></div><div class="form-actions"><button type="button" class="secondary-btn" id="cancel-payment">Cancel</button><button class="primary">Save payment</button></div></form></section>
    <section class="panel"><div class="panel-head"><div><h3>Payment history</h3><p>Latest 100 transactions</p></div></div>${table(["Reference","Student","Date","Method","Note","Amount"],payments.map(p=>`<tr><td><code>${escapeHtml(p.reference)}</code></td><td>${escapeHtml(p.first_name+" "+p.last_name)}<br><small class="muted">${escapeHtml(p.admission_no)}</small></td><td>${escapeHtml(p.paid_at)}</td><td>${escapeHtml(p.method)}</td><td>${escapeHtml(p.note||"—")}</td><td><strong>${money(p.amount)}</strong></td></tr>`))}<p class="help-text">This MVP records payments; it does not yet create invoices, calculate outstanding fee balances or connect to Paystack/Flutterwave.</p></section>`;
  $("#show-payment-form")?.addEventListener("click",()=>$("#payment-form-panel").classList.toggle("hidden"));
  $("#cancel-payment")?.addEventListener("click",()=>$("#payment-form-panel").classList.add("hidden"));
  $("#payment-form")?.addEventListener("submit",async e=>{e.preventDefault();try{const r=await api("/api/payments",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target).entries()))});notice("Payment recorded. Reference: "+r.reference);await render("fees");}catch(err){notice(err.message,true);}});
}
async function renderUsers(target){
  const data=await api("/api/users/summary");
  target.innerHTML=heading("User accounts","Demo accounts available for local testing.")+
    `<section class="panel"><div class="panel-head"><div><h3>Accounts</h3><p>All sample users share the demo password. Do not use these credentials in production.</p></div></div>${table(["Name","Username","Role","Status"],data.users.map(u=>`<tr><td><strong>${escapeHtml(u.full_name)}</strong></td><td><code>${escapeHtml(u.username)}</code></td><td>${escapeHtml(roleNames[u.role]||u.role)}</td><td><span class="pill">${u.active?"Active":"Disabled"}</span></td></tr>`))}</section>`;
}
$("#login-form").addEventListener("submit",async e=>{
  e.preventDefault();$("#login-error").textContent="";
  try{const result=await api("/api/login",{method:"POST",body:JSON.stringify({username:$("#username").value,password:$("#password").value})});setupUser(result.user);setScreen(true);await render("dashboard");}
  catch(err){$("#login-error").textContent=err.message;}
});
$("#logout-btn").addEventListener("click",async()=>{try{await api("/api/logout",{method:"POST"});}catch{}currentUser=null;setScreen(false);$("#password").value="";});
$("#navigation").addEventListener("click",e=>{const btn=e.target.closest("[data-page]");if(btn&&!btn.classList.contains("hidden"))render(btn.dataset.page);});
(async()=>{
  try{const data=await api("/api/me");if(data.user){setupUser(data.user);setScreen(true);await render("dashboard");}}
  catch{setScreen(false);}
})();
