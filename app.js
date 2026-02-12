console.log("app.js loaded ✅ (fixed)");

// ===== إعدادات =====
const DEFAULT_API_URL =
  "https://script.google.com/macros/s/AKfycbymGWtNJh4i4-Y4FugOqu_X3cpwOWPdodE7U-On7KK7hyGda7s9Nr1xkWb-TaM9tqk5mA/exec";

const PERIODS = [1,2,3,4,5,6,7,8];

const DEPARTMENTS = [
  "المعارف العامة","اللغة الانجليزية","اللغات","الفنون","الفلسفة وعلم النفس",
  "العلوم التطبيقية","العلوم البحته","العلوم الاجتماعية","الديانات",
  "الجغرافيا والتاريخ","الاداب","قسم12","قسم13","قسم14"
];

const DEPT_FILES = {
  "المعارف العامة": "data/المعارف العامة.xlsx",
"اللغة الانجليزية": "data/اللغة الانجليزية.xlsx",
"اللغات": "data/اللغات.xlsx",
"الفنون": "data/الفنون.xlsx",
"الفلسفة وعلم النفس": "data/الفلسفة وعلم النفس.xlsx",
"العلوم التطبيقية": "data/العلوم التطبيقية.xlsx",
"العلوم البحته": "data/العلوم البحته.xlsx",
"العلوم الاجتماعية": "data/العلوم الاجتماعية.xlsx",
"الديانات": "data/الديانات.xlsx",
"الجغرافيا والتاريخ": "data/الجغرافيا والتاريخ.xlsx",
"الاداب": "data/الاداب.xlsx",
  "قسم12": "data/قسم12.xlsx",
  "قسم13": "data/قسم13.xlsx",
  "قسم14": "data/قسم14.xlsx"
};

const State = { bookings: [], feedback: [] };

const $ = (id)=>document.getElementById(id);

function on(id, event, handler){
  const el = $(id);
  if(!el) return;
  el.addEventListener(event, handler);
}

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;");
}

function normalizeDate(v){
  if(!v) return "";
  const s = String(v).trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if(/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0,10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  const d = new Date(s);
  if(!isNaN(d)) return d.toISOString().slice(0,10);
  return s;
}


// قراءة آمنة للحقول حتى لو كان عنوان العمود فيه مسافات/اختلاف بسيط
function _normKey(k){
  return String(k||"").toLowerCase().replace(/[\s_\-]+/g,"").replace(/[^\u0600-\u06FFa-z0-9]/g,"");
}
function getField(obj, keys, fallback=""){
  if(!obj) return fallback;
  for(const k of keys){
    if(k in obj && obj[k]!=="" && obj[k]!==null && obj[k]!==undefined) return obj[k];
    const kt = String(k).trim();
    if(kt in obj && obj[kt]!=="" && obj[kt]!==null && obj[kt]!==undefined) return obj[kt];
  }
  const map = {};
  for(const [k,v] of Object.entries(obj)){
    map[_normKey(k)] = v;
  }
  for(const k of keys){
    const v = map[_normKey(k)];
    if(v!=="" && v!==null && v!==undefined) return v;
  }
  return fallback;
}

function toast(msg, type="success"){
  let box = document.getElementById("toastBox");
  if(!box){
    box = document.createElement("div");
    box.id = "toastBox";
    box.style.position = "fixed";
    box.style.bottom = "18px";
    box.style.left = "18px";
    box.style.zIndex = "9999";
    box.style.display = "grid";
    box.style.gap = "8px";
    document.body.appendChild(box);
  }
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.padding = "10px 12px";
  t.style.borderRadius = "12px";
  t.style.fontWeight = "900";
  t.style.boxShadow = "0 6px 20px rgba(0,0,0,.08)";
  t.style.border = "1px solid #e5e7eb";
  t.style.background = type==="success" ? "#ecfdf5" : type==="warn" ? "#fffbeb" : "#fef2f2";
  t.style.color = type==="success" ? "#065f46" : type==="warn" ? "#92400e" : "#991b1b";
  box.appendChild(t);
  setTimeout(()=>{ t.style.opacity="0"; t.style.transition="opacity .3s"; }, 2500);
  setTimeout(()=>{ t.remove(); }, 2900);
}


// ===== JSONP (حل مشكلة CORS مع Google Apps Script) =====
function jsonp(url, timeoutMs=15000){
  return new Promise((resolve, reject)=>{
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const sep = url.includes("?") ? "&" : "?";
    script.src = url + sep + "callback=" + cb;
    script.async = true;

    const timer = setTimeout(()=>{
      cleanup();
      reject(new Error("انتهت مهلة الاتصال"));
    }, timeoutMs);

    function cleanup(){
      clearTimeout(timer);
      script.remove();
      try{ delete window[cb]; }catch(_){}
    }

    window[cb] = (data)=>{
      cleanup();
      resolve(data);
    };

    script.onerror = ()=>{
      cleanup();
      reject(new Error("فشل الاتصال (تحقق من رابط السكربت ونشره)"));
    };

    document.head.appendChild(script);
  });
}

// ===== UI =====
const UI = {
  api: function(){
    const saved = (localStorage.getItem("rc_api")||"").trim();
    return saved || DEFAULT_API_URL;
  },

  setStatus: function(t){
    if($("statusText")) $("statusText").textContent = t;
  },

  openSettings: function(){ $("settingsDlg")?.showModal?.(); },
  closeSettings: function(){ $("settingsDlg")?.close?.(); },

  showTab: function(name){
    ["booking","schedule","custody","feedback","report"].forEach(id=>{
      const el = $("tab-"+id);
      if(el) el.hidden = (id !== name);
    });
    if(name==="schedule") UI.renderWeek();
    if(name==="report") UI.renderReport();
  },

  toSunday: function(date){
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
  },

  shiftWeek: function(days){
    const ws = $("weekStart");
    if(!ws) return;
    const d = new Date(ws.value);
    d.setDate(d.getDate()+days);
    ws.value = UI.toSunday(d).toISOString().slice(0,10);
    UI.renderWeek();
  },

  init: function(){

    // ✅ منع أي إرسال تلقائي للنماذج (حتى لا تظهر رسالة المتصفح "أكمل هذا الحقل")
    document.querySelectorAll("form").forEach(f=>{
      f.addEventListener("submit", (e)=>{ e.preventDefault(); e.stopPropagation(); }, true);
    });

    // ✅ تعطيل تحقق المتصفح (required) والاعتماد على تحقق الجافاسكربت
    document.querySelectorAll("form").forEach(f=>{
      f.noValidate = true;
      f.setAttribute("novalidate","novalidate");
      f.addEventListener("submit", (e)=>{ e.preventDefault(); e.stopPropagation(); }, true);
    });

    // ✅ تحويل الأزرار إلى type=button لمنع submit
    ["btnSubmitBooking","btnRefreshBookings","btnPrevWeek","btnNextWeek","btnRefreshWeek",
     "btnSaveSettings","btnCloseSettings","btnBooking","btnSchedule","btnCustody",
     "btnFeedback","btnReport","btnSettings","btnReloadCustody","btnSubmitFeedback"
    ].forEach(id=>{
      const b = document.getElementById(id);
      if(b) b.setAttribute("type","button");
    });

    // ✅ إزالة required من حقول الحجز (إن وُجد) حتى لا يظهر "أكمل هذا الحقل"
    ["b_name","b_subject","b_grade","b_lessonTitle","b_purpose","b_date","b_period","b_notes"]
      .forEach(id=>{
        const el = document.getElementById(id);
        if(el) el.removeAttribute("required");
      });
    if($("b_period")){
      $("b_period").innerHTML =
        `<option value="">— اختر —</option>` + PERIODS.map(p=>`<option value="${p}">${p}</option>`).join("");
    }

    const today = new Date();
    if($("b_date")) $("b_date").value = today.toISOString().slice(0,10);
    if($("weekStart")) $("weekStart").value = UI.toSunday(today).toISOString().slice(0,10);

    if($("apiUrl")) $("apiUrl").value = (localStorage.getItem("rc_api")||"").trim();

    on("btnBooking","click", ()=>UI.showTab("booking"));
    on("btnSchedule","click", ()=>UI.showTab("schedule"));
    on("btnCustody","click", ()=>UI.showTab("custody"));
    on("btnFeedback","click", ()=>UI.showTab("feedback"));
    on("btnReport","click", ()=>UI.showTab("report"));

    on("btnSettings","click", UI.openSettings);
    on("btnCloseSettings","click", UI.closeSettings);
    on("btnSaveSettings","click", ()=>{
      localStorage.setItem("rc_api", ($("apiUrl")?.value || "").trim());
      UI.closeSettings();
      toast("تم حفظ الإعدادات", "success");
      App.refreshBookings();
    });

    on("btnSubmitBooking","click", ()=>App.submitBooking());
    on("btnRefreshBookings","click", ()=>App.refreshBookings());

    on("btnPrevWeek","click", ()=>UI.shiftWeek(-7));
    on("btnNextWeek","click", ()=>UI.shiftWeek(7));
    on("btnRefreshWeek","click", ()=>UI.renderWeek());
    on("weekStart","change", ()=>UI.renderWeek());

    on("btnSubmitFeedback","click", ()=>App.submitFeedback());

    Custody.init();
    on("btnReloadCustody","click", ()=>Custody.reloadActive());
    $("c_q")?.addEventListener?.("input", ()=>Custody.render());

    UI.setStatus("جاهز");
    UI.showTab("booking");
    App.refreshBookings();
  },

  renderWeek: function(){
    const ws = $("weekStart");
    if(!ws) return;

    let start = new Date(ws.value);
    if(isNaN(start)) return;

    start = UI.toSunday(start);
    ws.value = start.toISOString().slice(0,10);

    const days = [];
    for(let i=0;i<5;i++){
      const d = new Date(start);
      d.setDate(start.getDate()+i);
      days.push(d);
    }

    if($("weekHead")){
      $("weekHead").innerHTML = `
        <tr>
          <th class="dayCol">اليوم</th>
          ${PERIODS.map(p=>`<th>الحصة ${p}</th>`).join("")}
        </tr>`;
    }

    const arDays = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

    const map = {};
    for(const b of State.bookings){
      const bd = normalizeDate(getField(b, ["تاريخ الحجز","bookingDate","date"], ""));
      const bp = String(getField(b, ["الحصة","period"], ""));
      const key = `${bd}__${bp}`;
      if(!map[key]) map[key] = [];
      map[key].push(b);
    }

    const body = $("weekBody");
    if(!body) return;
    body.innerHTML = "";

    for(const d of days){
      const dateStr = d.toISOString().slice(0,10);
      const dayName = arDays[d.getDay()];

      const cells = PERIODS.map(p=>{
        const key = `${dateStr}__${p}`;
        const items = map[key] || [];
        if(items.length===0) return `<td>—</td>`;

        if(items.length>1){
          const names = items.map(x=> getField(x, ["الاسم","name"], "")).filter(Boolean).join(" ، ");
          return `<td class="cellConflict"><span class="pill warn">تعارض</span><span class="small">${esc(names)}</span></td>`;
        }

        const one = items[0];
        const name = getField(one, ["الاسم","name"], "");
        const subject = getField(one, ["المادة","subject"], "");
        const grade = getField(one, ["الصف","grade","class"], "");
        const lesson = getField(one, ["عنوان الدرس","lessonTitle","lesson"], "");
        return `<td class="cellBooked"><span class="pill ok">محجوز</span><span class="small">${esc(name)} • ${esc(subject)} • ${esc(grade)}<br>${esc(lesson)}</span></td>`;
      }).join("");

      body.insertAdjacentHTML("beforeend", `
        <tr>
          <td class="dayCol">${dayName}<br><span style="font-weight:600;color:#6b7280">${dateStr}</span></td>
          ${cells}
        </tr>`);
    }
  },

  renderReport: function(){ /* اختياري */ }
};

// ===== العهدة =====
const Custody = {
  activeDept: "",
  rows: [],

  init: function(){
    const chips = $("custodyChips");
    if(!chips) return;

    chips.innerHTML = DEPARTMENTS.map(d=>`<button type="button" data-dept="${d}">📚 ${d}</button>`).join("");
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

  loadActive: async function(){
    const path = DEPT_FILES[Custody.activeDept];
    if(!path) return toast("ملف القسم غير معرف", "error");

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
      toast(err.message, "error");
    }
  },

  reloadActive: async function(){
    if(!Custody.activeDept) return toast("اختر قسم أولاً", "warn");
    await Custody.loadActive();
    Custody.render();
  },

  render: function(){
    const body = $("custodyBody");
    if(!body) return;

    const q = ($("c_q")?.value || "").trim().toLowerCase();
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
        </tr>`);
    }
  }
};

// ===== التطبيق =====
const App = {
  refreshBookings: async function(){
    // ✅ جلب الحجوزات (أساسي) + جلب الآراء (اختياري)
    const base = UI.api();
    UI.setStatus("تحميل الحجوزات...");

    // 1) الحجوزات (لازم)
    try{
      const bookings = await jsonp(`${base}?action=listBookings`);
      State.bookings = Array.isArray(bookings) ? bookings : [];
      UI.setStatus("متصل ✅");
    }catch(e){
      UI.setStatus("غير متصل");
      toast("تعذر تحميل الحجوزات من السكربت. تأكد من النشر Anyone ورابط /exec.", "error");
      return; // لا نكمل
    }

    // 2) الآراء (اختياري — لا يوقف الموقع إذا غير متوفر)
    try{
      const feedback = await jsonp(`${base}?action=listFeedback`);
      State.feedback = Array.isArray(feedback) ? feedback : [];
    }catch(e){
      State.feedback = [];
      // لا نعرض خطأ، فقط نتجاهل
      console.warn("listFeedback غير متوفر أو فشل:", e);
    }

    UI.renderWeek();
    UI.renderReport();
  },

  submitBooking: async function(){
    try{
      const name = ($("b_name")?.value || "").trim();
      const subject = ($("b_subject")?.value || "").trim();
      const grade = ($("b_grade")?.value || "").trim();
      const lessonTitle = ($("b_lessonTitle")?.value || "").trim();
      const purpose = ($("b_purpose")?.value || "").trim();

      const bookingDateRaw = $("b_date")?.value || "";
      const bookingDate = normalizeDate(bookingDateRaw);

      const periodEl = $("b_period");
      let periodStr = (periodEl?.value || "").trim();
      if(!periodStr && periodEl?.selectedIndex >= 0){
        const optText = (periodEl.options[periodEl.selectedIndex]?.text || "").trim();
        const m = optText.match(/\d+/);
        if(m) periodStr = m[0];
      }
      const period = parseInt(periodStr, 10);

      const notes = ($("b_notes")?.value || "").trim();

      const missing = [];
      if(!name) missing.push("الاسم");
      if(!subject) missing.push("المادة");
      if(!grade) missing.push("الصف");
      if(!lessonTitle) missing.push("عنوان الدرس");
      if(!purpose) missing.push("الهدف من الحجز");
      if(!bookingDate) missing.push("تاريخ الحجز");
      if(!(period >= 1 && period <= 8)) missing.push("الحصة");

      if(missing.length){
        toast("الرجاء تعبئة/اختيار: " + missing.join("، "), "error");
        console.log("DEBUG:", {name,subject,grade,lessonTitle,purpose,bookingDateRaw,bookingDate,periodStr,period,notes});
        return;
      }

      const payload = {
        "تاريخ الإنشاء": new Date().toISOString(),
        "الاسم": name,
        "المادة": subject,
        "الصف": grade,
        "عنوان الدرس": lessonTitle,
        "الهدف من الحجز": purpose,
        "تاريخ الحجز": bookingDate,
        "الحصة": period,
        "ملاحظات": notes
      };

      const d = bookingDate;
      const p = String(period);
      const conflicts = State.bookings.filter(b=>{
        const bd = normalizeDate(getField(b, ["تاريخ الحجز","bookingDate","date"], ""));
        const bp = String(getField(b, ["الحصة","period"], ""));
        return bd===d && bp===p;
      });

      if(conflicts.length >= 1){
        const names = conflicts.map(x=> getField(x, ["الاسم","name"], "")).filter(Boolean).join(" ، ");
        const ok = confirm(`⚠️ هذه الحصة محجوزة بالفعل.\nالمحجوز: ${names}\n\nهل تريد تسجيل الحجز كتعارض؟`);
        if(!ok){
          toast("تم إلغاء الحجز", "warn");
          return;
        }
      }

      const res = await jsonp(`${UI.api()}?action=addBooking&payload=${encodeURIComponent(JSON.stringify(payload))}`);

      if(!res.ok){
        toast(res.error || "فشل إرسال الحجز", "error");
        return;
      }

      toast("تم الحجز بنجاح ✅", "success");

      // عرض الأسبوع الذي يحتوي تاريخ هذا الحجز
      if($("weekStart")){
        const d2 = new Date(bookingDate);
        $("weekStart").value = UI.toSunday(d2).toISOString().slice(0,10);
      }
      // يمكنك فتح جدول الحجز مباشرة إذا رغبت
      // UI.showTab("schedule");


      if($("b_name")) $("b_name").value = "";
      if($("b_subject")) $("b_subject").value = "";
      if($("b_grade")) $("b_grade").value = "";
      if($("b_lessonTitle")) $("b_lessonTitle").value = "";
      if($("b_purpose")) $("b_purpose").value = "";
      if($("b_notes")) $("b_notes").value = "";
      if($("b_period")) $("b_period").value = "";
      if($("b_date")) $("b_date").value = new Date().toISOString().slice(0,10);

      await App.refreshBookings();
    }catch(e){
      console.error(e);
      toast("خطأ غير متوقع أثناء الحجز", "error");
    }
  },

  submitFeedback: async function(){
    try{
      const text = ($("f_text")?.value || "").trim();
      if(!text) return toast("اكتب الرأي/الملاحظة", "warn");

      const payload = {
        "تاريخ الإنشاء": new Date().toISOString(),
        "التاريخ": new Date().toISOString().slice(0,10),
        "الفئة": $("f_type")?.value || "أخرى",
        "التقييم": $("f_rate")?.value || "5",
        "الاسم": ($("f_name")?.value || "").trim(),
        "النص": text
      };

      const res = await jsonp(`${UI.api()}?action=addFeedback&payload=${encodeURIComponent(JSON.stringify(payload))}`);

      if(!res.ok) return toast(res.error || "فشل إرسال الرأي", "error");

      if($("f_text")) $("f_text").value = "";
      if($("f_name")) $("f_name").value = "";
      toast("تم إرسال الرأي ✅", "success");
      await App.refreshBookings();
    }catch(e){
      toast("تعذر إرسال الرأي", "error");
    }
  }
};

// ✅ تشغيل قسري للتنقل إذا تعطل أي ربط
(function forceNav(){
  const go = (tab)=>{
    ["booking","schedule","custody","feedback","report"].forEach(id=>{
      const el = document.getElementById("tab-"+id);
      if(el) el.hidden = (id !== tab);
    });
  };

  document.addEventListener("click", (e)=>{
    const id = e.target?.id;
    if(id === "btnBooking") go("booking");
    if(id === "btnSchedule") go("schedule");
    if(id === "btnCustody") go("custody");
    if(id === "btnFeedback") go("feedback");
    if(id === "btnReport") go("report");
    if(id === "btnSettings") document.getElementById("settingsDlg")?.showModal?.();
    if(id === "btnCloseSettings") document.getElementById("settingsDlg")?.close?.();
  });
})();

window.addEventListener("load", UI.init);
