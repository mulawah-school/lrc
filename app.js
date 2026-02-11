const DEPARTMENTS = [
  "المعارف العامة","اللغة الانجليزية","اللغات","الفنون","الفلسفة وعلم النفس",
  "العلوم التطبيقية","العلوم البحته","العلوم الاجتماعية","الديانات",
  "الجغرافيا والتاريخ","الاداب",
  "قسم12","قسم13","قسم14"
];

// 14 ملف Excel (عدّل أسماء الملفات هنا حسب ما سترفعه في مجلد data/)
const DEPT_FILES = {
  "المعارف العامة": "data/المعارف_العامة.xlsx",
  "اللغة الانجليزية": "data/اللغة_الانجليزية.xlsx",
  "اللغات": "data/اللغات.xlsx",
  "الفنون": "data/الفنون.xlsx",
  "الفلسفة وعلم النفس": "data/الفلسفة_وعلم_النفس.xlsx",
  "العلوم التطبيقية": "data/العلوم_التطبيقية.xlsx",
  "العلوم البحته": "data/العلوم_البحته.xlsx",
  "العلوم الاجتماعية": "data/العلوم_الاجتماعية.xlsx",
  "الديانات": "data/الديانات.xlsx",
  "الجغرافيا والتاريخ": "data/الجغرافيا_والتاريخ.xlsx",
  "الاداب": "data/الاداب.xlsx",
  "قسم12": "data/قسم12.xlsx",
  "قسم13": "data/قسم13.xlsx",
  "قسم14": "data/قسم14.xlsx"
};

const PERIODS = [1,2,3,4,5,6,7,8];
const State = { bookings: [], feedback: [] };

const $ = (id)=>document.getElementById(id);

const UI = {
  init(){
    // periods
    $("b_period").innerHTML = `<option value="">— اختر —</option>` + PERIODS.map(p=>`<option value="${p}">${p}</option>`).join("");
    $("s_period").innerHTML += PERIODS.map(p=>`<option value="${p}">${p}</option>`).join("");

    // dates
    const today = new Date().toISOString().slice(0,10);
    $("b_date").value = today;
    $("s_date").value = today;

    // settings
    $("apiUrl").value = localStorage.getItem("rc_api") || "";

    // render custody chips
    Custody.init();

    // listeners
    $("s_date").addEventListener("change", UI.renderSchedule);
    $("s_period").addEventListener("change", UI.renderSchedule);

    UI.showTab("booking");
  },

  showTab(name){
    for(const id of ["booking","schedule","custody","feedback","report"]){
      const el = $("tab-"+id);
      el.hidden = (id !== name);
    }
    if(name === "report") UI.renderReport();
  },

  setStatus(text){ $("statusText").textContent = text; },

  openSettings(){ $("settingsDlg").showModal(); },
  closeSettings(){ $("settingsDlg").close(); },
  saveSettings(){
    localStorage.setItem("rc_api", $("apiUrl").value.trim());
    UI.closeSettings();
    App.refreshBookings();
  },

  renderSchedule(){
    const d = $("s_date").value;
    const p = $("s_period").value;
    const q = ($("s_q").value || "").trim().toLowerCase();

    const keyCount = {};
    for(const b of State.bookings){
      const key = `${b.bookingDate}__${b.period}`;
      keyCount[key] = (keyCount[key]||0)+1;
    }

    const rows = State.bookings
      .filter(b => !d || String(b.bookingDate) === String(d))
      .filter(b => !p || String(b.period) === String(p))
      .filter(b => !q || [b.name,b.subject,b.grade,b.lessonTitle].some(x => (x||"").toLowerCase().includes(q)))
      .sort((a,b)=>Number(a.period)-Number(b.period));

    const body = $("scheduleBody");
    body.innerHTML = rows.length ? "" : `<tr><td colspan="7" style="text-align:center;color:#6b7280">لا توجد حجوزات</td></tr>`;

    for(const b of rows){
      const key = `${b.bookingDate}__${b.period}`;
      const conflict = (keyCount[key]||0) > 1;
      body.insertAdjacentHTML("beforeend", `
        <tr>
          <td>${esc(b.period)}</td>
          <td>${esc(b.name)}</td>
          <td>${esc(b.subject)}</td>
          <td>${esc(b.grade)}</td>
          <td>${esc(b.lessonTitle)}</td>
          <td>${esc(b.purpose)}</td>
          <td>${conflict ? `<span class="pill warn">تعارض</span>` : `<span class="pill ok">محجوز</span>`}</td>
        </tr>
      `);
    }
  },

  renderReport(){
    const today = new Date().toISOString().slice(0,10);
    $("r_totalBookings").textContent = State.bookings.length;
    $("r_todayBookings").textContent = State.bookings.filter(b => String(b.bookingDate)===today).length;

    $("r_totalFeedback").textContent = State.feedback.length;
    const avg = State.feedback.length ? (State.feedback.reduce((s,f)=>s+(Number(f.rate)||0),0)/State.feedback.length) : 0;
    $("r_avgRate").textContent = avg.toFixed(1);
  }
};

// ====== العهدة: قراءة 14 ملف Excel حسب القسم ======
const Custody = {
  activeDept: "",
  rows: [],

  init(){
    const chips = $("custodyChips");
    chips.innerHTML = DEPARTMENTS.map(d => `<button data-dept="${d}">📚 ${d}</button>`).join("");

    chips.addEventListener("click", async (e)=>{
      const btn = e.target.closest("button[data-dept]");
      if(!btn) return;
      Custody.activeDept = btn.dataset.dept;

      for(const b of chips.querySelectorAll("button")){
        b.classList.toggle("active", b.dataset.dept === Custody.activeDept);
      }
      await Custody.loadActive();
      Custody.render();
    });

    // افتح أول قسم تلقائياً (اختياري)
    // Custody.activeDept = "الاداب";
    // chips.querySelector(`button[data-dept="${Custody.activeDept}"]`)?.click();
  },

  async loadActive(){
    const dept = Custody.activeDept;
    const path = DEPT_FILES[dept];
    if(!path) { alert("لا يوجد ملف مرتبط بهذا القسم. عدّل DEPT_FILES"); return; }

    try{
      UI.setStatus("تحميل ملف القسم...");
      const resp = await fetch(path);
      if(!resp.ok) throw new Error(`لم يتم العثور على الملف: ${path}`);
      const buf = await resp.arrayBuffer();
      const wb = XLSX.read(buf, {type:"array"});

      // أول ورقة في الملف
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, {defval:""});
      Custody.rows = json;

      UI.setStatus(`تم تحميل ${dept} ✅`);
    }catch(err){
      Custody.rows = [];
      UI.setStatus("فشل التحميل");
      alert(err.message);
    }
  },

  async reloadActive(){
    if(!Custody.activeDept) { alert("اختر قسم أولاً"); return; }
    await Custody.loadActive();
    Custody.render();
  },

  // هذه الدالة تلتقط أعمدة الملف حتى لو اختلفت التسمية قليلاً
  getCol(row, names){
    for(const n of names){
      if(row[n] !== undefined) return row[n];
    }
    return "";
  },

  render(){
    const q = ($("c_q").value || "").trim().toLowerCase();
    const body = $("custodyBody");
    body.innerHTML = "";

    if(!Custody.activeDept){
      body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6b7280">اختر قسم لعرض الكتب</td></tr>`;
      return;
    }
    if(!Custody.rows.length){
      body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6b7280">لا توجد بيانات في ملف هذا القسم</td></tr>`;
      return;
    }

    // أعمدة متوقعة (سنضبطها بدقة بعد ما ترسل أول ملف)
    const rows = Custody.rows.filter(r=>{
      const barcode = String(Custody.getCol(r, ["رقم/باركود","باركود","Barcode"])).toLowerCase();
      const title   = String(Custody.getCol(r, ["عنوان الكتاب","العنوان","Title"])).toLowerCase();
      const author  = String(Custody.getCol(r, ["المؤلف","Author"])).toLowerCase();
      return !q || barcode.includes(q) || title.includes(q) || author.includes(q);
    });

    if(rows.length === 0){
      body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6b7280">لا توجد نتائج</td></tr>`;
      return;
    }

    for(const r of rows){
      const barcode = Custody.getCol(r, ["رقم/باركود","باركود","Barcode"]);
      const title   = Custody.getCol(r, ["عنوان الكتاب","العنوان","Title"]);
      const author  = Custody.getCol(r, ["المؤلف","Author"]);
      const notes   = Custody.getCol(r, ["ملاحظات","Notes"]);

      body.insertAdjacentHTML("beforeend", `
        <tr>
          <td>${esc(barcode)}</td>
          <td>${esc(title)}</td>
          <td>${esc(author)}</td>
          <td>${esc(Custody.activeDept)}</td>
          <td>${esc(notes)}</td>
        </tr>
      `);
    }
  }
};

// ====== الحجوزات والآراء (Google Sheets عبر Apps Script) ======
const App = {
  api(){
    const url = (localStorage.getItem("rc_api")||"").trim();
    if(!url) throw new Error("ضع رابط Apps Script في الإعدادات");
    return url;
  },

  async refreshBookings(){
    try{
      UI.setStatus("تحميل الحجوزات...");
      const base = App.api();
      State.bookings = await fetch(`${base}?action=listBookings`).then(r=>r.json());
      State.feedback = await fetch(`${base}?action=listFeedback`).then(r=>r.json());
      if(!Array.isArray(State.bookings)) State.bookings = [];
      if(!Array.isArray(State.feedback)) State.feedback = [];
      UI.setStatus("متصل ✅");
      UI.renderSchedule();
      UI.renderReport();
    }catch(e){
      UI.setStatus("غير متصل");
      State.bookings = []; State.feedback = [];
      UI.renderSchedule(); UI.renderReport();
      alert(e.message);
    }
  },

  async submitBooking(){
    try{
      const payload = {
        createdAt: new Date().toISOString(),
        name: $("b_name").value.trim(),
        subject: $("b_subject").value.trim(),
        grade: $("b_grade").value.trim(),
        lessonTitle: $("b_lessonTitle").value.trim(),
        purpose: $("b_purpose").value.trim(),
        bookingDate: $("b_date").value,
        period: $("b_period").value,
        notes: $("b_notes").value.trim()
      };
      const required = ["name","subject","grade","lessonTitle","purpose","bookingDate","period"];
      for(const k of required) if(!payload[k]) throw new Error("الرجاء تعبئة جميع الحقول");

      const res = await fetch(App.api(), {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ action:"addBooking", payload })
      }).then(r=>r.json());

      if(!res.ok) throw new Error(res.error || "فشل إرسال الحجز");
      alert("تم إرسال الحجز ✅");
      await App.refreshBookings();
    }catch(e){ alert(e.message); }
  },

  async submitFeedback(){
    try{
      const payload = {
        createdAt: new Date().toISOString(),
        date: new Date().toISOString().slice(0,10),
        type: $("f_type").value,
        rate: $("f_rate").value,
        name: $("f_name").value.trim(),
        text: $("f_text").value.trim()
      };
      if(!payload.text) throw new Error("اكتب الرأي/الملاحظة");

      const res = await fetch(App.api(), {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ action:"addFeedback", payload })
      }).then(r=>r.json());

      if(!res.ok) throw new Error(res.error || "فشل إرسال الرأي");
      $("f_text").value = ""; $("f_name").value = "";
      alert("تم إرسال الرأي ✅");
      await App.refreshBookings();
    }catch(e){ alert(e.message); }
  }
};

function esc(s){
  return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}

window.UI = UI;
window.App = App;
window.Custody = Custody;

window.addEventListener("load", ()=>{
  UI.init();
  // لو عندك Apps Script اضبطه ثم:
  // App.refreshBookings();
});
