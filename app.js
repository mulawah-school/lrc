async submitBooking(){
  try{
    // قراءة القيم مباشرة
    const name = ($("b_name").value || "").trim();
    const subject = ($("b_subject").value || "").trim();
    const grade = ($("b_grade").value || "").trim();
    const lessonTitle = ($("b_lessonTitle").value || "").trim();
    const purpose = ($("b_purpose").value || "").trim();
    const bookingDate = $("b_date").value; // yyyy-mm-dd
    const periodStr = $("b_period").value; // "1".."8" أو ""
    const notes = ($("b_notes").value || "").trim();

    // ✅ تحقق واضح مع رسالة دقيقة
    if(!name) return toast("الرجاء كتابة الاسم", "error");
    if(!subject) return toast("الرجاء كتابة المادة", "error");
    if(!grade) return toast("الرجاء كتابة الصف", "error");
    if(!lessonTitle) return toast("الرجاء كتابة عنوان الدرس", "error");
    if(!purpose) return toast("الرجاء كتابة الهدف من الحجز", "error");
    if(!bookingDate) return toast("الرجاء اختيار تاريخ الحجز", "error");

    const period = parseInt(periodStr, 10);
    if(!(period >= 1 && period <= 8)) return toast("الرجاء اختيار الحصة (1 إلى 8)", "error");

    // أسماء الأعمدة العربية (مطابقة للشيت)
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

    // ✅ فحص التعارض قبل الإرسال
    const d = normalizeDate(payload["تاريخ الحجز"]);
    const p = String(payload["الحصة"]);

    const conflicts = State.bookings.filter(b=>{
      const bd = normalizeDate(b["تاريخ الحجز"] ?? b.bookingDate ?? "");
      const bp = String(b["الحصة"] ?? b.period ?? "");
      return bd === d && bp === p;
    });

    if(conflicts.length >= 1){
      const names = conflicts.map(x=> (x["الاسم"] ?? x.name ?? "")).filter(Boolean).join(" ، ");
      const ok = confirm(`⚠️ هذه الحصة محجوزة بالفعل لنفس التاريخ.\nالمحجوز: ${names}\n\nهل تريد تسجيل الحجز كتعارض؟`);
      if(!ok){
        toast("تم إلغاء الحجز", "warn");
        return;
      }
    }

    // ✅ إرسال (text/plain لتجنب مشاكل GitHub Pages)
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

    // ✅ تفريغ الخانات بعد الإرسال
    $("b_name").value = "";
    $("b_subject").value = "";
    $("b_grade").value = "";
    $("b_lessonTitle").value = "";
    $("b_purpose").value = "";
    $("b_notes").value = "";
    $("b_period").value = "";
    $("b_date").value = new Date().toISOString().slice(0,10);

    await App.refreshBookings();

  }catch(e){
    toast("خطأ غير متوقع أثناء الحجز", "error");
  }
}
