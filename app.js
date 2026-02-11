const DEFAULT_API_URL =
  "https://script.google.com/macros/s/AKfycbymGWtNJh4i4-Y4FugOqu_X3cpwOWPdodE7U-On7KK7hyGda7s9Nr1xkWb-TaM9tqk5mA/exec";

const PERIODS = [1,2,3,4,5,6,7,8];
const State = { bookings: [], feedback: [] };
const $ = (id)=>document.getElementById(id);

const UI = {
  init(){

    $("b_period").innerHTML =
      `<option value="">— اختر —</option>` +
      PERIODS.map(p=>`<option value="${p}">${p}</option>`).join("");

    const today = new Date();
    $("b_date").value = today.toISOString().slice(0,10);

    // ضبط بداية الأسبوع إلى الأحد
    const day = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - day);
    $("weekStart").value = sunday.toISOString().slice(0,10);

    $("btnBooking").onclick = ()=>UI.showTab("booking");
    $("btnSchedule").onclick = ()=>UI.showTab("schedule");
    $("btnReport").onclick = ()=>UI.showTab("report");

    $("btnSubmitBooking").onclick = App.submitBooking;
    $("btnRefreshBookings").onclick = App.refreshBookings;

    $("btnPrevWeek").onclick = ()=>UI.shiftWeek(-7);
    $("btnNextWeek").onclick = ()=>UI.shiftWeek(7);
    $("btnRefreshWeek").onclick = UI.renderWeek;
    $("weekStart").onchange = UI.renderWeek;

    UI.showTab("booking");
    App.refreshBookings();
  },

  showTab(name){
    ["booking","schedule","custody","feedback","report"].forEach(id=>{
      const el = $("tab-"+id);
      if(el) el.hidden = (id !== name);
    });
    if(name==="schedule") UI.renderWeek();
  },

  shiftWeek(days){
    const d = new Date($("weekStart").value);
    d.setDate(d.getDate() + days);
    $("weekStart").value = d.toISOString().slice(0,10);
    UI.renderWeek();
  },

  renderWeek(){
    let start = new Date($("weekStart").value);
    if (isNaN(start)) return;

    // اجعل البداية دائمًا أحد
    const dow = start.getDay();
    const sunday = new Date(start);
    sunday.setDate(start.getDate() - dow);
    $("weekStart").value = sunday.toISOString().slice(0,10);

    const arDays = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

    const days = [];
    for(let i=0;i<5;i++){
      const d = new Date(sunday);
      d.setDate(sunday.getDate()+i);
      days.push(d);
    }

    $("weekHead").innerHTML = `
      <tr>
        <th class="dayCol">اليوم</th>
        ${PERIODS.map(p=>`<th>الحصة ${p}</th>`).join("")}
      </tr>
    `;

    const map = {};
    for(const b of State.bookings){
      const bd = normalizeDate(b.bookingDate || b["تاريخ_الحجز"]);
      const bp = String(b.period || b["الحصة"]);
      const key = `${bd}__${bp}`;
      if(!map[key]) map[key]=[];
      map[key].push(b);
    }

    const body = $("weekBody");
    body.innerHTML = "";

    for(const d of days){
      const dateStr = d.toISOString().slice(0,10);
      const dayName = arDays[d.getDay()];

      const cells = PERIODS.map(p=>{
        const key = `${dateStr}__${p}`;
        const items = map[key] || [];

        if(items.length===0) return `<td>—</td>`;

        if(items.length>1){
          return `<td class="cellConflict">تعارض</td>`;
        }

        const one = items[0];
        return `<td class="cellBooked">محجوز<br>${esc(one.name || one["الاسم"])}</td>`;
      }).join("");

      body.insertAdjacentHTML("beforeend",`
        <tr>
          <td class="dayCol">${dayName}<br>${dateStr}</td>
          ${cells}
        </tr>
      `);
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
      alert("تعذر تحميل الحجوزات");
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

      const res = await fetch(DEFAULT_API_URL,{
        method:"POST",
        headers:{ "Content-Type":"text/plain;charset=utf-8" },
        body: JSON.stringify({action:"addBooking", payload})
      });

      const result = await res.json();
      if(!result.ok) throw new Error();

      alert("تم الحجز بنجاح");
      App.refreshBookings();
    }catch(e){
      alert("فشل إرسال الحجز");
    }
  }
};

function normalizeDate(v){
  if(!v) return "";
  const s = String(v).trim();

  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m){
    return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  }

  const d = new Date(s);
  if(!isNaN(d)) return d.toISOString().slice(0,10);

  return s;
}

function esc(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

window.addEventListener("load", UI.init);
