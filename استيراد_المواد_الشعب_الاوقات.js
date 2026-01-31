(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // 1) هذي روابط "التفاصيل" داخل جدول النتائج — عدّل السيليكتور حسب الصفحة
  const detailLinks = [...document.querySelectorAll('a')].filter(a => a.innerText.trim() === 'التفاصيل');
  console.log("details:", detailLinks.length);

  const out = [];

  for (let i = 0; i < detailLinks.length; i++) {
    detailLinks[i].click();

    // 2) انتظر المودال/منطقة التفاصيل تظهر
    await sleep(600);

    // 3) اقرأ بيانات الصف الأساسي (من نفس صف الجدول)
    const tr = detailLinks[i].closest("tr");
    const tds = [...tr.querySelectorAll("td")].map(td => td.innerText.trim());

    // عدّل ترتيب الأعمدة لو لازم
    const courseCode = tds[0];
    const courseName = tds[1];
    const section    = tds[2];
    const activity   = tds[3];

    // 4) اقرأ جدول الأوقات داخل المودال (عدّل السيليكتور)
    // مثال: جدول فيه اليوم/من/إلى/قاعة
    const modal = document.querySelector(".ui-dialog, .modal, [role='dialog']") || document;
    const timeRows = [...modal.querySelectorAll("table tbody tr")];

    const meetings = timeRows.map(r => {
      const c = [...r.querySelectorAll("td")].map(x => x.innerText.trim());
      return {
        day: c[0] || "",
        start: c[1] || "",
        end: c[2] || "",
        room: c[3] || ""
      };
    }).filter(m => m.day && m.start && m.end);

    out.push({ courseCode, courseName, section, activity, meetings });

    // 5) اغلق المودال (عدّل زر الإغلاق)
    const closeBtn = modal.querySelector("a[aria-label='Close'], button.close, .ui-dialog-titlebar-close");
    if (closeBtn) closeBtn.click();
    await sleep(300);
  }

  console.log("DONE:", out.length);
  const blob = new Blob([JSON.stringify(out, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ksu_sections_with_times.json";
  a.click();
})();



// 2
(async () => {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const isHijriDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(norm(s));

  function findOfferedTable() {
    const tables = [...document.querySelectorAll("table")];
    const must = ["رمز المقرر", "اسم المقرر", "الشعبة", "النشاط", "الحالة"];
    for (const t of tables) {
      const headerRow = t.querySelector("thead tr") || t.querySelector("tr");
      if (!headerRow) continue;
      const headers = [...headerRow.querySelectorAll("th,td")].map(x => norm(x.innerText));
      const hit = must.filter(m => headers.some(h => h.includes(m))).length;
      if (hit >= 3) return { table: t, headers };
    }
    return null;
  }

  function colIndex(headers, key) {
    return headers.findIndex((h) => h.includes(key));
  }

  const found = findOfferedTable();
  if (!found) {
    console.error("ما لقيت جدول المقررات المطروحة. تأكد إن النتائج ظاهرة.");
    return;
  }

  const { table, headers } = found;
  const idxCourse = colIndex(headers, "رمز المقرر");
  const idxName = colIndex(headers, "اسم المقرر");
  const idxSection = colIndex(headers, "الشعبة");
  const idxActivity = colIndex(headers, "النشاط");
  const idxStatus = colIndex(headers, "الحالة");
  const idxHours = colIndex(headers, "الساعات");
  const idxGender = colIndex(headers, "الجنس");

  const bodyRows = [...table.querySelectorAll("tbody tr")];
  if (!bodyRows.length) {
    console.error("ما لقيت صفوف داخل tbody. لازم تكون نتائج البحث ظاهرة.");
    return;
  }

  const data = [];

  for (let i = 0; i < bodyRows.length; i++) {
    const tr = bodyRows[i];
    const tds = [...tr.querySelectorAll("td")];
    if (!tds.length) continue;

    const row = {
      courseCode: idxCourse >= 0 ? norm(tds[idxCourse]?.innerText) : "",
      courseName: idxName >= 0 ? norm(tds[idxName]?.innerText) : "",
      section: idxSection >= 0 ? norm(tds[idxSection]?.innerText) : "",
      activity: idxActivity >= 0 ? norm(tds[idxActivity]?.innerText) : "",
      status: idxStatus >= 0 ? norm(tds[idxStatus]?.innerText) : "",
      hours: idxHours >= 0 ? norm(tds[idxHours]?.innerText) : "",
      gender: idxGender >= 0 ? norm(tds[idxGender]?.innerText) : "",
      meetings: [],
      finalExam: null,
    };

    if (!row.courseCode || row.courseCode.includes("رمز")) continue;

    const detailsBtn = [...tr.querySelectorAll("a,button")]
      .find((x) => norm(x.innerText).includes("التفاصيل"));

    if (!detailsBtn) {
      data.push(row);
      continue;
    }

    detailsBtn.click();
    await sleep(700);

    // مودال/نافذة التفاصيل
    const modal =
      document.querySelector(".ui-dialog") ||
      document.querySelector(".modal") ||
      document.querySelector("div[style*='z-index']");

    if (modal) {
      const rows2 = [...modal.querySelectorAll("table tr")];

      for (const r of rows2) {
        const cols = [...r.querySelectorAll("td")].map((x) => norm(x.innerText));
        if (cols.length < 3) continue;

        const c0 = cols[0];
        const c1 = cols[1];
        const c2 = cols[2];

        // ✅ اجتماع أسبوعي: day رقم + time فيه "-"
        // لكن إذا c2 تاريخ هجري => هذا اختبار نهائي
        if (/^\d+$/.test(c0) && c1.includes("-")) {
          if (isHijriDate(c2)) {
            row.finalExam = { day: Number(c0), time: c1, dateHijri: c2 };
          } else {
            row.meetings.push({ day: Number(c0), time: c1, room: c2 });
          }
        }
      }

      // اغلاق
      const close =
        modal.querySelector(".ui-dialog-titlebar-close") ||
        [...modal.querySelectorAll("button,a,span")].find((x) =>
          /×|اغلاق|إغلاق|close/i.test(norm(x.innerText))
        );
      close?.click();
      await sleep(250);
    }

    data.push(row);
    console.log(`✔️ ${i + 1}/${bodyRows.length}`, row.courseCode, row.section, row.meetings.length, row.finalExam ? "FINAL✅" : "");
    await sleep(120);
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ksu_track_full_CLEAN.json";
  a.click();
  URL.revokeObjectURL(a.href);

  console.log("✅ Saved: ksu_track_full_CLEAN.json", data.length);
})();