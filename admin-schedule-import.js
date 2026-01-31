import { rtdb } from "./firebase-config.js";
import { ref, update } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const fileInput = document.getElementById("scheduleJsonFile");
const btn = document.getElementById("btnImportSchedule");
const log = document.getElementById("scheduleImportLog");

const norm = (s) => (s ?? "").toString().trim().replace(/\s+/g, " ");
const safeKey = (s) => norm(s).replace(/[.#$[\]/]/g, "_").replace(/\s+/g, "-");

btn?.addEventListener("click", async () => {
  try {
    const file = fileInput?.files?.[0];
    if (!file) {
      log.textContent = "اختر ملف JSON أولاً.";
      return;
    }

    const rows = JSON.parse(await file.text());
    if (!Array.isArray(rows) || rows.length === 0) {
      log.textContent = "الملف فاضي أو مو Array.";
      return;
    }

    log.textContent = `قرأت ${rows.length} عنصر... تجهيز للرفع`;

    const updates = {};
    const seenCourses = new Set();

    let pushed = 0;

    for (const r of rows) {
      const courseCode = norm(r.courseCode);
      const courseName = norm(r.courseName);
      const section = norm(r.section);
      const activity = norm(r.activity);
      const meetings = Array.isArray(r.meetings) ? r.meetings : [];

      // لازم يكون عندنا أوقات فعلاً
      if (!courseCode || !section || !activity || meetings.length === 0) continue;

      const courseId = safeKey(courseCode);     // مثال: "151-ريض"
      const sectionId = safeKey(section);       // مثال: "370"
      const actKey = safeKey(activity);         // مثال: "محاضرة"

      // (1) coursesSchedule: للجدول فقط (لا نلمس coursesIndex حق موقع المواد)
      if (!seenCourses.has(courseId)) {
        seenCourses.add(courseId);
        updates[`/coursesSchedule/${courseId}`] = {
          code: courseCode,
          name: courseName || courseCode
        };
      }

      // (2) sectionsByCourse: تخزين الشعب + الأنشطة + meetings
      updates[`/sectionsByCourse/${courseId}/${sectionId}/sectionId`] = section;

      updates[`/sectionsByCourse/${courseId}/${sectionId}/activities/${actKey}`] = {
        type: activity,
        meetings: meetings
          .map((m) => ({
            day: norm(m.day),
            start: norm(m.start),
            end: norm(m.end),
            room: norm(m.room)
          }))
          .filter((m) => m.day && m.start && m.end)
      };

      pushed++;
    }

    await update(ref(rtdb, "/"), updates);

    log.textContent =
      `✅ تم الاستيراد بنجاح\n- عناصر مقروءة: ${rows.length}\n- عناصر محفوظة: ${pushed}\n- مسارات الحفظ:\n  /coursesSchedule\n  /sectionsByCourse`;
  } catch (e) {
    console.error(e);
    log.textContent = "❌ خطأ أثناء الاستيراد. افتح Console وشوف السبب.";
  }
});

/* =========================
   SECTIONS/SCHEDULES IMPORT
   كل تخصص ينحفظ في مساره الخاص
   schedules/{major} => [...sections]
========================= */

// معالجة اختيار الملف
document.getElementById("sectionsFile")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    const label = document.getElementById("sectionsFileLabel");
    if (label) {
        label.textContent = file ? `ارفع ملف: ${file.name}` : "اختر ملف JSON";
    }
});

// استيراد الجداول إلى Firebase
document.getElementById("importSectionsBtn")?.addEventListener("click", async () => {
    const fileInput = document.getElementById("sectionsFile");
    const majorSelect = document.getElementById("sectionsMajor");
    
    const file = fileInput?.files?.[0];
    const major = majorSelect?.value;
    
    if (!file) {
        showAlert("يرجى اختيار ملف JSON!", "error");
        return;
    }
    
    if (!major) {
        showAlert("يرجى اختيار التخصص!", "error");
        return;
    }
    
    try {
        const text = await file.text();
        const sections = JSON.parse(text);
        
        if (!Array.isArray(sections)) {
            showAlert("الملف يجب أن يحتوي على مصفوفة من الشعب!", "error");
            return;
        }
        
        // حفظ في مسار التخصص
        // schedules/general, schedules/cs, schedules/is
        await set(ref(rtdb, `schedules/${major}`), sections);
        
        showAlert(`تم استيراد ${sections.length} شعبة لتخصص ${getMajorName(major)} بنجاح!`, "success");
        
        // Reset
        fileInput.value = "";
        document.getElementById("sectionsFileLabel").textContent = "اختر ملف JSON";
        
    } catch (err) {
        console.error(err);
        showAlert("فشل قراءة أو استيراد الملف!", "error");
    }
});

// تحميل جداول تخصص معين
async function loadSchedulesByMajor(major) {
    const snap = await get(ref(rtdb, `schedules/${major}`));
    return snap.exists() ? snap.val() : [];
}

// تحميل كل الجداول
async function loadAllSchedules() {
    const snap = await get(ref(rtdb, "schedules"));
    return snap.exists() ? snap.val() : {};
}

// أسماء التخصصات
function getMajorName(key) {
    const names = {
        general: "الإعداد العام",
        cs: "علوم الحاسب",
        is: "نظم المعلومات"
    };
    return names[key] || key;
}

// تصدير جداول تخصص معين
window.exportSchedules = async function exportSchedules(major) {
    const data = await loadSchedulesByMajor(major);
    
    if (!data.length) {
        showAlert(`لا توجد جداول لتخصص ${getMajorName(major)}!`, "error");
        return;
    }
    
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `schedules-${major}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showAlert(`تم تصدير جداول ${getMajorName(major)} بنجاح!`);
};

// حذف جداول تخصص معين
window.deleteSchedules = async function deleteSchedules(major) {
    if (!confirm(`هل تريد حذف كل جداول ${getMajorName(major)}؟`)) return;
    
    try {
        await set(ref(rtdb, `schedules/${major}`), null);
        showAlert(`تم حذف جداول ${getMajorName(major)} بنجاح!`);
    } catch (err) {
        console.error(err);
        showAlert("فشل الحذف!", "error");
    }
};