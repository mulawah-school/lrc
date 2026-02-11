const DEFAULT_API_URL =
  "https://script.google.com/macros/s/AKfycbymGWtNJh4i4-Y4FugOqu_X3cpwOWPdodE7U-On7KK7hyGda7s9Nr1xkWb-TaM9tqk5mA/exec";

const DEPARTMENTS = [
  "المعارف العامة","اللغة الانجليزية","اللغات","الفنون","الفلسفة وعلم النفس",
  "العلوم التطبيقية","العلوم البحته","العلوم الاجتماعية","الديانات",
  "الجغرافيا والتاريخ","الاداب",
  "قسم12","قسم13","قسم14"
];

const DEPT_FILES = {
  "المعارف العامة": "data/المعارف_العامة.xlsx",
  "اللغة الانجليزية": "data/اللغة_الانجليزية.xlsx",
  "اللغات": "data/اللغات.xlsx",
  "الفنون": "data/الفنون.xlsx",
  0:0,
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

// حذف المفتاح الغريب إن وُجد (احتياط)
delete DEPT_FILES[0];

const PERIODS = [1,2,3,4,5,6,7,8];
const State = { bookings: [], feedback: [] };
const $ = (id)=>document.getElementById(id);

const UI = {
  init(){
    $("b_period").innerHTML =
      `<option value="">— اختر —</option>` + PERIODS.map(p=>`<option value="${p}">${p}</option>`).join("");

    const today = new Date();
    $("b_date").value = today.toISOString().slice(0,10);

    // بداية الأسبوع = أقرب أحد
    const day = today.getDay(); // 0 الأحد
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - day);
    $("weekStart").value = sunday.toISOString().slice(0,10);

    const savedApi = (localStorage.getItem("rc_api")||"").trim();
    $("apiUrl").value = savedApi || "";

    // تبويبات
    $("btnBooking").addEventListener("click", ()=>UI.showTab("booking"));
    $("btnSchedule").addEventListener("click", ()=>UI.showTab("schedule"));
    $("btnCustody").addEventListener("click", ()=>UI.showTab("custody"));
    $("btnFeedback").addEventListener("click", ()=>UI.showTab("feedback"));
    $("btnReport").addEventListener("click", ()=>UI.showTab("report"));
    $("btnSettings").addEventListener("click", UI.openSettings);

    // إعدادات
    $("btnSaveSettings").addEventListener("click", UI.saveSettings);
    $("btnCloseSettings").addEventListener("click", UI.closeSettings);

    // الحجز والآراء
    $("btnSubmitBooking").addEventListener("click", App.submitBooking);
    $("btnRefreshBookings").addEventListener("click", App.refreshBookings);
    $("btnSubmitFeedback").addEventListener("click", App.submitFeedback);

    // جدول أسبوعي
    $("btnPrevWeek").addEventListener("click", ()=>UI.shiftWeek(-7));
    $("btnNextWeek").addEventListener("click", ()=>UI.shiftWeek(7));
    $("btnRefreshWeek").addEventListener("click", UI.renderWeek);
    $("weekStart").addEventListener("change", UI.renderWeek);

    // العهدة
    Custody.init();
    $("c_q").addEventListener("input", Custody.render);
    $("btnReloadCustody").addEventListener("click", Custody.reloadActive);

    UI.showTab("booking");
    UI.setStatus("جاهز");

    App.refreshBookings();
  },

  showTab(name){
    for(const id of ["booking","schedule","custody","feedback","report"]){
      const el = $("tab-"+id);
      el.hidden = (id !== name);
    }
    if(name === "schedule") UI.renderWeek();
    if(name === "report") UI.renderReport();
  },

  setStatus(text){ $("statusText").textContent = text; },

  openSettings(){ $("settingsDlg").showModal(); },
  closeSettings(){ $("settingsDlg").close(); },

  saveSettings(){
    const v = ($("apiUrl").value||"").trim();
    localStorage.setItem("rc_api", v);
    UI.closeSettings();
    App.refreshBookings();
  },

  api(){
    const saved = (localStorage.getItem("rc_api")||"").trim();
    return saved || DEFAULT_API_URL;
  },

  shiftWeek(days){
    const d = new Date($("weekStart").value);
    d.setDate(d.getDate() + days);
    $("weekStart").value = d.toISOString().slice(0,10);
    UI.renderWeek();
  },

  // جدول أسبوعي مثل الصورة: الأحد→الخميس × 8 حصص
  renderWeek(){
    const start = new Date($("weekStart").value);
    if (isNaN(start)) return;

    const days = [];
    for(let i=0;i<5;i++){
      const d = new Date(start);
      d.setDate(start.getDate()+i);
      days.push(d.toISOString().slice(0,10));
    }

    $("weekHead").innerHTML = `
      <tr>
        <th class="dayCol">اليوم</th>
        ${PERIODS.map(p=>`<th>الحصة ${p}</th>`).join("")}
      </tr>
    `;

    const dayNames = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس"];

    const map = {};
    for(const b of State.bookings){
      const bd = String(b["تاريخ_الحجز"] ?? b.bookingDate ?? "");
      const bp = String(b["الحصة"] ?? b.period ?? "");
      const key = `${bd}__${bp}`;
      if(!map[key]) map[key]=[];
      map[key].push(b);
    }

    const body = $("weekBody");
    body.innerHTML = "";

    days.forEach((dateStr, idx)=>{
      const cells = PERIODS.map(p=>{
        const key = `${dateStr}__${p}`;
        const items = map[key] || [];
        if(items.length === 0) return `<td>—</td>`;

        if(items.length > 1){
          const names = items.map(x=> (x["الاسم"] ?? x.name ?? "")).filter(Boolean).join(" ، ");
          return `<td class="cellConflict"><span class="pill warn">تعارض</span><span class="small">${esc(names)}</span></td>`;
        }

        const one = items[0];
        const name = one["الاسم"] ?? one.name ?? "";
        const subject = one["المادة"] ?? one.subject ?? "";
        const grade = one["الصف"] ?? one.grade ?? "";
        return `<td class="cellBooked"><span class="pill ok">محجوز</span><span class="small">${esc(name)} • ${esc(subject)} • ${esc(grade)}</span></td>`;
      }).join("");

      body.insertAdjacentHTML("beforeend", `
        <tr>
          <td class="dayCol">${dayNames[idx]}<br><span style="font-weight:600;color:#6b7280">${dateStr}</span></td>
          ${cells}
        </tr>
      `);
    });
  },

  renderReport(){
    const today = new Date().toISOString().slice(0,10);
    const keyCount = {};
    for(const b of State.bookings){
      const bd = String(b["تاريخ_الحجز"] ?? b.bookingDate ?? "");
      const bp = String(b["الحصة"] ?? b.period ?? "");
      keyCount[`${bd}__${bp}`] = (keyCount[`${bd}__${bp}`]||0)+1;
    }
    const conflicts = Object.values(keyCount).filter(v=>v>1).length;

    $("r_totalBookings").textContent = State.bookings.length;
    $("r_todayBookings").textContent = State.bookings.filter(b => String(b["تاريخ_الحجز"] ?? b.bookingDate ?? "") === today).length;
    $("r_conflicts").textContent = conflicts;

    $("r_totalFeedback").textContent = State.feedback.length;
    const avg = State.feedback.length
      ? (State.feedback.reduce((s,f)=>s+(Number(f["التقييم"] ?? f.rate)||0),0)/State.feedback.length)
      : 0;
    $("r_avgRate").textContent = avg.toFixed(1);
  }
};

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
  },

  async loadActive(){
    const path = DEPT_FILES[Custody.activeDept];
    if(!path) return alert("ملف القسم غير معرف في DEPT_FILES");

    try{
      UI.setStatus("تحميل ملف القسم...");
      const resp = await fetch(path, {cache:"no-store"});
      if(!resp.ok) throw new Error(`لم يتم العثور على الملف: ${path}`);
      const buf = await resp.arrayBuffer();
      const wb = XLSX.read(buf, {type:"array"});
      const ws = wb.Sheets[wb.SheetNames[0]];
      Custody.rows = XLSX.utils.sheet_to_json(ws, {defval:""});
      UI.setStatus(`تم تحميل ${Custody.activeDept} ✅`);
    }catch(err){
      Custody.rows = [];
      UI.setStatus("فشل التحميل");
      alert(err.message);
    }
  },

  async reloadActive(){
    if(!Custody.activeDept) return alert("اختر قسم أولاً");
    await Custody.loadActive();
    Custody.render();
  },

  render(){
    const q = ($("c_q").value||"").trim().toLowerCase();
    const body = $("custodyBody");
    body.innerHTML = "";

    if(!Custody.activeDept){
      body.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#6b7280">اختر قسم لعرض الكتب</td></tr>`;
      return;
    }
    if(!Custody.rows.length){
      body.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#6b7280">لا توجد بيانات في ملف هذا القسم</td></tr>`;
      return;
    }

    const rows = Custody.rows.filter(r=>{
      const title = String(r["العنوان"] ?? "").toLowerCase();
      const authors = String(r["المؤلفون"] ?? "").toLowerCase();
      const topics = String(r["المواضيع"] ?? "").toLowerCase();
      const generalNo = String(r["الرقم العام"] ?? "").toLowerCase();
      const reqNo = String(r["رقم الطلب"] ?? "").toLowerCase();
      return !q || title.includes(q) || authors.includes(q) || topics.includes(q) || generalNo.includes(q) || reqNo.includes(q);
    });

    if(!rows.length){
      body.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#6b7280">لا توجد نتائج</td></tr>`;
      return;
    }

    for(const r of rows){
      body.insertAdjacentHTML("beforeend", `
        <tr>
          <td>${esc(r["الرقم العام"] ?? "")}</td>
          <td>${esc(r["رقم التصنيف"] ?? "")}</td>
          <td>${esc(r["رقم الطلب"] ?? "")}</td>
          <td style="white-space:normal;min-width:260px">${esc(r["العنوان"] ?? "")}</td>
          <td style="white-space:normal;min-width:220px">${esc(r["المواضيع"] ?? "")}</td>
          <td style="white-space:normal;min-width:220px">${esc(r["المؤلفون"] ?? "")}</td>
          <td>${esc(r["سنة النشر"] ?? "")}</td>
          <td style="white-space:normal;min-width:180px">${esc(r["الناشر"] ?? "")}</td>
          <td>${esc(r["يعار / لا يعار"] ?? "")}</td>
          <td>${esc(r["عام / مرجع"] ?? "")}</td>
        </tr>
      `);
    }
  }
};

const App = {
  async refreshBookings(){
    try{
      UI.setStatus("تحميل الحجوزات...");
      const base = UI.api();

      const bookings = await fetch(`${base}?action=listBookings`, {cache:"no-store"}).then(r=>r.json());
      const feedback = await fetch(`${base}?action=listFeedback`, {cache:"no-store"}).then(r=>r.json());

      State.bookings = Array.isArray(bookings) ? bookings : [];
      State.feedback = Array.isArray(feedback) ? feedback : [];

      UI.setStatus("متصل ✅");
      UI.renderWeek();
      UI.renderReport();
    }catch(e){
      UI.setStatus("غير متصل");
      alert("تعذر الاتصال بالسكربت. تأكد من النشر Anyone ورابط /exec.\n\n" + e.message);
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

      // ✅ text/plain يحل Failed to fetch على GitHub Pages
      const res = await fetch(UI.api(), {
        method:"POST",
        headers:{ "Content-Type":"text/plain;charset=utf-8" },
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

      const res = await fetch(UI.api(), {
        method:"POST",
        headers:{ "Content-Type":"text/plain;charset=utf-8" },
        body: JSON.stringify({ action:"addFeedback", payload })
      }).then(r=>r.json());

      if(!res.ok) throw new Error(res.error || "فشل إرسال الرأي");

      $("f_text").value = "";
      $("f_name").value = "";
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

window.addEventListener("load", UI.init);
