console.log("app.js loaded ✅");

const DEFAULT_API_URL =
  "https://script.google.com/macros/s/AKfycbymGWtNJh4i4-Y4FugOqu_X3cpwOWPdodE7U-On7KK7hyGda7s9Nr1xkWb-TaM9tqk5mA/exec";

const PERIODS = [1,2,3,4,5,6,7,8];
const State = { bookings: [] };

const $ = (id)=>document.getElementById(id);

function toast(msg, type="success"){
  alert(msg); // مؤقت للتأكد أن لا يوجد خطأ نحوي
}

function normalizeDate(v){
  if(!v) return "";
  const s = String(v);
  if(s.includes("T")) return s.slice(0,10);
  return s;
}

const UI = {

  api(){
    return DEFAULT_API_URL;
  },

  showTab(name){
    ["booking","schedule"].forEach(id=>{
      const el = $("tab-"+id);
      if(el) el.hidden = (id !== name);
    });
  },

  toSunday(date){
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
  },

  init(){

    const periodSel = $("b_period");
    if(periodSel){
      periodSel.innerHTML =
        `<option value="">— اختر —</option>` +
        PERIODS.map(p=>`<option value="${p}">${p}</option>`).join("");
    }

    const today = new Date();
    if($("b_date")) $("b_date").value = today.toISOString().slice(0,10);
    if($("weekStart")) $("weekStart").value = this.toSunday(today).toISOString().slice(0,10);

    if($("btnBooking")) $("btnBooking").onclick = ()=>this.showTab("booking");
    if($("btnSchedule")) $("btnSchedule").onclick = ()=>this.showTab("schedule");

    if($("btnSubmitBooking")) $("btnSubmitBooking").onclick = App.submitBooking;
    if($("btnRefreshBookings")) $("btnRefreshBookings").onclick = App.refreshBookings;

    this.showTab("booking");
    App.refreshBookings();
  },

  renderWeek(){

    const ws = $("weekStart");
    if(!ws) return;

    let start = new Date(ws.value);
    start = this.toSunday(start);

    const map = {};
    for(const b of State.bookings){
      const bd = normalizeDate(b["تاريخ الحجز"]);
      const bp = String(b["الحصة"]);
      const key = `${bd}_${bp}`;
      if(!map[key]) map[key] = [];
      map[key].push(b);
    }

    const body = $("weekBody");
    if(!body) return;
    body.innerHTML = "";

    for(let i=0;i<5;i++){
      const d = new Date(start);
      d.setDate(start.getDate()+i);
      const dateStr = d.toISOString().slice(0,10);

      let row = `<tr><td>${dateStr}</td>`;

      for(let p=1;p<=8;p++){
        const key = `${dateStr}_${p}`;
        if(map[key]){
          row += `<td>محجوز</td>`;
        }else{
          row += `<td>—</td>`;
        }
      }

      row += "</tr>";
      body.innerHTML += row;
    }
  }

};

const App = {

  async refreshBookings(){
    try{
      const res = await fetch(`${DEFAULT_API_URL}?action=listBookings`, {cache:"no-store"});
      const txt = await res.text();
      let data;
      try{ data = JSON.parse(txt); }catch(_){ data = null; }
      State.bookings = Array.isArray(data) ? data : [];
      UI.renderWeek();
    }catch(e){
      console.error(e);
      toast("تعذر تحميل الحجوزات", "error");
    }
  },

  async submitBooking(){
    try{
      const name = ($("b_name")?.value || "").trim();
      const subject = ($("b_subject")?.value || "").trim();
      const grade = ($("b_grade")?.value || "").trim();
      const lessonTitle = ($("b_lessonTitle")?.value || "").trim();
      const purpose = ($("b_purpose")?.value || "").trim();
      const bookingDateRaw = $("b_date")?.value || "";
      const bookingDate = normalizeDate(bookingDateRaw);

      // الحصة
      const periodEl = $("b_period");
      let periodStr = (periodEl?.value || "").trim();
      if(!periodStr && periodEl?.selectedIndex >= 0){
        const optText = (periodEl.options[periodEl.selectedIndex]?.text || "").trim();
        const m = optText.match(/\d+/);
        if(m) periodStr = m[0];
      }
      const period = parseInt(periodStr || "0", 10);

      const notes = ($("b_notes")?.value || "").trim();

      const missing = [];
      if(!name) missing.push("الاسم");
      if(!subject) missing.push("المادة");
      if(!grade) missing.push("الصف");
      if(!lessonTitle) missing.push("عنوان الدرس");
      if(!purpose) missing.push("الهدف من الحجز");
      if(!bookingDate) missing.push("تاريخ الحجز");
      if(!(period>=1 && period<=8)) missing.push("الحصة");

      if(missing.length){
        toast("الرجاء تعبئة/اختيار: " + missing.join("، "), "error");
        console.log("DEBUG submitBooking:", {name,subject,grade,lessonTitle,purpose,bookingDateRaw,bookingDate,periodStr,period,notes});
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

      // ✅ إرسال بصيغة form-urlencoded (الأكثر توافقًا مع Apps Script)
      const params = new URLSearchParams();
      params.set("action", "addBooking");
      params.set("payload", JSON.stringify(payload));

      const res = await fetch(DEFAULT_API_URL, {
        method: "POST",
        headers: { "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8" },
        body: params.toString()
      });

      const text = await res.text();
      let obj = null;
      try{ obj = JSON.parse(text); }catch(_){}

      if(!res.ok){
        toast("فشل الإرسال (HTTP " + res.status + ")", "error");
        console.log("POST response:", res.status, text);
        return;
      }

      if(obj && obj.ok === false){
        toast(obj.error || "فشل الإرسال", "error");
        console.log("POST JSON:", obj);
        return;
      }

      toast("تم الحجز بنجاح ✅", "success");

      // تفريغ
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
      toast("تعذر إرسال الحجز", "error");
    }
  }

};

window.addEventListener("load", ()=>UI.init());
