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
      const res = await fetch(`${DEFAULT_API_URL}?action=listBookings`);
      const data = await res.json();
      State.bookings = Array.isArray(data) ? data : [];
      UI.renderWeek();
    }catch(e){
      console.log("خطأ تحميل");
    }
  },

  async submitBooking(){

    const name = ($("b_name")?.value || "").trim();
    const subject = ($("b_subject")?.value || "").trim();
    const grade = ($("b_grade")?.value || "").trim();
    const lessonTitle = ($("b_lessonTitle")?.value || "").trim();
    const purpose = ($("b_purpose")?.value || "").trim();
    const bookingDate = $("b_date")?.value || "";
    const period = parseInt($("b_period")?.value || "0",10);

    if(!name || !subject || !grade || !lessonTitle || !purpose || !bookingDate || !(period>=1)){
      alert("الرجاء تعبئة جميع الحقول");
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
      "ملاحظات": $("b_notes")?.value || ""
    };

    await fetch(DEFAULT_API_URL,{
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify({ action:"addBooking", payload })
    });

    alert("تم الحجز");
    App.refreshBookings();
  }

};

window.addEventListener("load", ()=>UI.init());
