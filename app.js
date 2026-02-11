console.log("app.js loaded ✅");

// ========= إعدادات =========
const DEFAULT_API_URL =
  "https://script.google.com/macros/s/AKfycbymGWtNJh4i4-Y4FugOqu_X3cpwOWPdodE7U-On7KK7hyGda7s9Nr1xkWb-TaM9tqk5mA/exec";

const PERIODS = [1,2,3,4,5,6,7,8];
const State = { bookings: [], feedback: [] };

const $ = (id)=>document.getElementById(id);

// ✅ ربط آمن: لا يسبب توقف إذا العنصر غير موجود
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

// يدعم yyyy-mm-dd و dd/mm/yyyy و ISO
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

// ✅ إشعار بدل alert
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

const UI = {
  api(){
    const saved = (localStorage.getItem("rc_api")||"").trim();
    return saved || DEFAULT_API_URL;
  },

  setStatus(t){
    if($("statusText")) $("statusText").textContent = t;
  },

  showTab(name){
    ["booking","schedule","custody","feedback","report"].forEach(id=>{
      const el = $("tab-"+id);
      if(el) el.hidden = (id !== name);
    });
    if(name==="schedule") UI.renderWeek();
    if(name==="report") UI.renderReport();
  },

  toSunday(date){
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay()); // الأحد
    return d;
  },

  openSettings(){
    $("settingsDlg")?.showModal?.();
  },
  closeSettings(){
    $("settingsDlg")?.close?.();
  },

  init(){
    // periods
    const periodSel = $("b_period");
    if(periodSel){
      periodSel.innerHTML = `<option value="">— اختر —</option>` +
        PERIODS.map(p=>`<option value="${p}">${p}</option>`).join("");
    }

    // dates
    const today = new Date();
    if($("b_date")) $("b_date").value = today.toISOString().slice(0,10);
    if($("weekStart")) $("weekStart").value = UI.toSunday(today).toISOString().slice(0,10);

    // settings input
    if($("apiUrl")) $("apiUrl").value = (localStorage.getItem("rc_api")||"").trim();

    // nav buttons (آمن)
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

    // booking
    on("btnSubmitBooking","click", App.submitBooking);
    on("btnRefreshBookings","click", App.refreshBookings);

    // week
    on("btnPrevWeek","click", ()=>UI.shiftWeek(-7));
    on("btnNextWeek","click", ()=>UI.shiftWeek(7));
    on("btnRefreshWeek","click", UI.renderWeek);
    on("weekStart","change", UI.renderWeek);

    UI.setStatus("جاهز");
    UI.showTab("booking");
    App.refreshBookings();
  },

  shiftWeek(days){
    const ws = $("weekStart");
    if(!ws) return;
    const d = new Date(ws.value);
    d.setDate(d.getDate()+days);
    ws.value = UI.toSunday(d).toISOString().slice(0,10);
    UI.renderWeek();
  },

  // ✅ جدول أسبوعي يقرأ أعمدة الشيت العربية
  renderWeek(){
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
        </tr>
      `;
    }

    const arDays = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

    const map = {};
    for(const b of State.bookings){
      const bd = normalizeDate(b["تاريخ الحجز"] ?? b.bookingDate ?? "");
      const bp = String(b["الحصة"] ?? b.period ?? "");
      const key = `${bd}__${bp}`;
      if(!map[key]) map[key]=[];
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
          const names = items.map(x=> (x["الاسم"] ?? x.name ?? "")).filter(Boolean).join(" ، ");
          return `<td class="cellConflict"><span class="pill warn">تعارض</span><span class="small">${esc(names)}</span></td>`;
        }

        const one = items[0];
        const name = one["الاسم"] ?? one.name ?? "";
        const subject = one["المادة"] ?? one.subject ?? "";
        const grade = one["الصف"] ?? one.grade ?? "";
        const lesson = one["عنوان الدرس"] ?? one.lessonTitle ?? "";
        return `<td class="cellBooked">
          <span class="pill ok">محجوز</span>
          <span class="small">${esc(name)} • ${esc(subject)} • ${esc(grade)}<br>${esc(lesson)}</span>
        </td>`;
      }).join("");

      body.insertAdjacentHTML("beforeend", `
        <tr>
          <td class="dayCol">${dayName}<br><span style="font-weight:600;color:#6b7280">${dateStr}</span></td>
          ${cells}
        </tr>
      `);
    }
  },

  renderReport(){
    // إذا عندك عناصر التقرير موجودة في HTML، نقدر نفعله لاحقاً.
  }
};

const App = {
  async refreshBookings(){
    try{
      UI.setStatus("تحميل الحجوزات...");
      const base = UI.api();
      const bookings = await fetch(`${base}?action=listBookings`, {cache:"no-store"}).then(r=>r.json());
      State.bookings = Array.isArray(bookings) ? bookings : [];
      UI.setStatus("متصل ✅");
      UI.renderWeek();
    }catch(e){
      UI.setStatus("غير متصل");
      toast("تعذر الاتصال بالسكربت", "error");
    }
  },

  // ✅ تحقق صحيح + تعارض + تفريغ + Toast
  async submitBooking(){
  try{
    // ✅ يقرأ من عدة IDs محتملة (حسب اختلاف صفحة HTML عندك)
    const getVal = (...ids) => {
      for (const id of ids){
        const el = document.getElementById(id);
        if(el){
          const v = (el.value ?? "").toString();
          return v.trim();
        }
      }
      return "";
    };

    const name       = getVal("b_name","name","teacherName","اسم","الاسم");
    const subject    = getVal("b_subject","subject","المادة");
    const grade      = getVal("b_grade","grade","class","الصف");
    const lessonTitle= getVal("b_lessonTitle","lessonTitle","lesson","عنوان_الدرس","عنوان الدرس");
    const purpose    = getVal("b_purpose","purpose","goal","الهدف","الهدف من الحجز");
    const bookingDate= getVal("b_date","bookingDate","date","تاريخ_الحجز","تاريخ الحجز");
    const periodStr  = getVal("b_period","period","الحصة");
    const notes      = getVal("b_notes","notes","ملاحظات");

    // ✅ تشخيص واضح: يحدد الحقل الناقص
    const missing = [];
    if(!name) missing.push("الاسم");
    if(!subject) missing.push("المادة");
    if(!grade) missing.push("الصف");
    if(!lessonTitle) missing.push("عنوان الدرس");
    if(!purpose) missing.push("الهدف من الحجز");
    if(!bookingDate) missing.push("تاريخ الحجز");

    const period = parseInt(periodStr, 10);
    if(!(period >= 1 && period <= 8)) missing.push("الحصة");

    if(missing.length){
      toast("الرجاء تعبئة/اختيار: " + missing.join("، "), "error");
      // 👇 يساعدنا في معرفة أي ID فعلياً يُستخدم عندك
      console.log("DEBUG values:", {name,subject,grade,lessonTitle,purpose,bookingDate,periodStr,notes});
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

    // ✅ فحص التعارض
    const d = normalizeDate(payload["تاريخ الحجز"]);
    const p = String(payload["الحصة"]);

    const conflicts = State.bookings.filter(b=>{
      const bd = normalizeDate(b["تاريخ الحجز"] ?? b.bookingDate ?? "");
      const bp = String(b["الحصة"] ?? b.period ?? "");
      return bd === d && bp === p;
    });

    if(conflicts.length >= 1){
      const names = conflicts.map(x=> (x["الاسم"] ?? x.name ?? "")).filter(Boolean).join(" ، ");
      const ok = confirm(`⚠️ هذه الحصة محجوزة بالفعل.\nالمحجوز: ${names}\n\nهل تريد تسجيل الحجز كتعارض؟`);
      if(!ok){
        toast("تم إلغاء الحجز", "warn");
        return;
      }
    }

    const res = await fetch(UI.api(), {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify({ action:"addBooking", payload })
    }).then(r=>r.json());

    if(!res.ok){
      toast(res.error || "فشل إرسال الحجز", "error");
      return;
    }

    toast("تم الحجز بنجاح ✅", "success");

    // ✅ تفريغ الحقول (حسب IDs الشائعة)
    const clear = (...ids)=>ids.forEach(id=>{ const el=document.getElementById(id); if(el) el.value=""; });
    clear("b_name","name","teacherName","b_subject","subject","b_grade","grade","b_lessonTitle","lessonTitle","b_purpose","purpose","b_notes","notes","b_period","period");

    const dateEl = document.getElementById("b_date") || document.getElementById("bookingDate") || document.getElementById("date");
    if(dateEl) dateEl.value = new Date().toISOString().slice(0,10);

    await App.refreshBookings();

  }catch(e){
    toast("خطأ غير متوقع أثناء الحجز", "error");
    console.error(e);
  }
}


window.addEventListener("load", UI.init);

// ✅ تشغيل قسري للأيقونات حتى لو حصل خطأ في init
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

  go("booking");
})();
