// برنامج مركز المصادر (واجهة GitHub Pages)
// ✅ العهدة: 14 ملف Excel داخل data/
// ✅ الحجز + آراء: تخزين مشترك عبر Google Sheets + Apps Script Web App
// ✅ حل Failed to fetch: POST باستخدام text/plain لتجنب CORS preflight

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
    $("b_period").innerHTML = `<option value="">— اختر —</option>` + PERIODS.map(p=>`<option value="${p}">${p}</option>`).join("");
    $("s_period").innerHTML += PERIODS.map(p=>`<option value="${p}">${p}</option>`).join("");

    const today = new Date().toISOString().slice(0,10);
    $("b_date").value = today;
    $("s_date").value = today;

    // ضع الرابط الافتراضي داخل الإعدادات تلقائياً (مع السماح بالتعديل)
    const saved = localStorage.getItem("rc_api");
    $("apiUrl").value = (saved && saved.trim()) ? saved.trim() : DEFAULT_API_URL;

    Custody.init();

    $("s_date").addEventListener("change", UI.renderSchedule);
    $("s_period").addEventListener("change", UI.renderSchedule);

    UI.showTab("booking");
    UI.setStatus("جاهز");
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
      const key = `${b["تاريخ_الحجز"] ?? b.bookingDate}__${b["الحصة"] ?? b.period}`;
      keyCount[key] = (keyCount[key]||0)+1;
    }

    const rows = State.bookings
      .filter(b => {
        const bd = String(b["تاريخ_الحجز"] ?? b.bookingDate ?? "");
        return !d || bd === String(d);
      })
      .filter(b => {
        const bp = String(b["الحصة"] ?? b.period ?? "");
        return !p || bp === String(p);
      })
      .filter(b => {
        if(!q) return true;
        const name = String(b["الاسم"] ?? b.name ?? "").toLowerCase();
        const subj = String(b["المادة"] ?? b.subject ?? "").toLowerCase();
        const grade= String(b["الصف"] ?? b.grade ?? "").toLowerCase();
        const lesson=String(b["عنوان_الدرس"] ?? b.lessonTitle ?? "").toLowerCase();
        return name.includes(q) || subj.includes(q) || grade.includes(q) || lesson.includes(q);
      })
      .sort((a,b)=>Number(a["الحصة"] ?? a.period)-Nu
