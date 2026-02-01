import { rtdb } from "./firebase-config.js";
import { ref, get, set, push, remove } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

let DEVELOPMENT_COURSES = {};

async function loadDevelopmentCourses() {
  const snap = await get(ref(rtdb, "developmentCourses"));
  DEVELOPMENT_COURSES = snap.exists() ? snap.val() : {};
  displayDevelopmentCourses();
}

function displayDevelopmentCourses() {
  const container = document.getElementById("developmentCoursesList");
  if (!container) return;

  const courses = [];
  for (const [major, levels] of Object.entries(DEVELOPMENT_COURSES)) {
    for (const [level, coursesArray] of Object.entries(levels || {})) {
      (coursesArray || []).forEach((course, index) => {
        courses.push({ ...course, major, level, index });
      });
    }
  }

  if (!courses.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">لا توجد دورات. قم بإضافة دورة جديدة!</p>';
    return;
  }

  const majorNames = {
    general: "إعداد عام",
    cs: "علوم الحاسب",
    is: "نظم المعلومات",
    cyber:"مسار أساسيات الأمن السيبراني",
    AI:"مسار علم البيانات والذكاء الاصطناعي"
  };

  container.innerHTML = courses
    .map((course) => `
      <div class="course-item">
        <div class="course-item-info">
          <h3>${course.title}</h3>
          <p>${course.description || "لا يوجد وصف"}</p>
          <div class="course-item-meta">
            <span>${majorNames[course.major] || course.major}</span>
            <span>-</span>
            <span>المستوى ${course.level}</span>
            <span>-</span>
            <span>${course.platform || "منصة غير محددة"}</span>
          </div>
          ${course.relatedCourses ? `<div style="margin-top:0.5rem;"><small>المواد: ${course.relatedCourses}</small></div>` : ''}
        </div>
        <div class="course-item-actions">
          <button class="btn-icon" onclick="window.open('${course.url}', '_blank')" title="فتح الدورة">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
          <button class="btn-icon delete" onclick="deleteDevelopmentCourse('${course.major}', '${course.level}', ${course.index})" title="حذف الدورة">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
            </svg>
          </button>
        </div>
      </div>
    `)
    .join("");
}

document.getElementById("addDevelopmentCourseForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const major = document.getElementById("devCourseMajor").value;
  const level = document.getElementById("devCourseLevel").value;
  const title = document.getElementById("devCourseName").value.trim();
  const description = document.getElementById("devCourseDescription").value.trim();
  const url = document.getElementById("devCourseUrl").value.trim();
  const relatedCourses = document.getElementById("devCourseRelatedCourses").value.trim();
  const platform = document.getElementById("devCoursePlatform").value.trim();

  const isTrack = (major === "cyber" || major === "AI");

  if (!major || !title || !url) {
    alert("يرجى ملء جميع الحقول المطلوبة!");
    return;
  }

  if (!isTrack && !level) {
    alert("يرجى اختيار المستوى!");
    return;
  }

  try {
    const courseData = {
      title,
      description,
      url,
      relatedCourses: isTrack ? "" : relatedCourses, // اختياري: تفريغها للمسارات
      platform,
      addedAt: Date.now()
    };

    const bucket = isTrack ? "all" : level; 
    const levelRef = ref(rtdb, `developmentCourses/${major}/${bucket}`);

    const snap = await get(levelRef);
    const existingCourses = snap.exists() ? snap.val() : [];

    existingCourses.push(courseData);
    await set(levelRef, existingCourses);

    alert("تم إضافة الدورة بنجاح!");
    e.target.reset();
    await loadDevelopmentCourses();
  } catch (err) {
    console.error(err);
    alert("فشل إضافة الدورة!");
  }
});


window.deleteDevelopmentCourse = async function(major, level, index) {
  if (!confirm("هل أنت متأكد من حذف هذه الدورة؟")) return;

  try {
    const levelRef = ref(rtdb, `developmentCourses/${major}/${level}`);
    const snap = await get(levelRef);
    const courses = snap.exists() ? snap.val() : [];

    // احذف الدورة من المصفوفة
    courses.splice(index, 1);

    // احفظ المصفوفة المحدثة
    await set(levelRef, courses);

    alert("تم حذف الدورة بنجاح!");
    await loadDevelopmentCourses();
  } catch (err) {
    console.error(err);
    alert("فشل حذف الدورة!");
  }
};

window.deleteAllDevelopmentCourses = async function() {
  if (!confirm("هل أنت متأكد من حذف جميع الدورات؟ هذا الإجراء لا يمكن التراجع عنه!")) return;
  if (!confirm("تأكيد نهائي: سيتم حذف جميع الدورات من جميع التخصصات والمستويات!")) return;

  try {
    const coursesRef = ref(rtdb, "developmentCourses");
    await remove(coursesRef);

    alert("تم حذف جميع الدورات بنجاح!");
    DEVELOPMENT_COURSES = {};
    displayDevelopmentCourses();
  } catch (err) {
    console.error(err);
    alert("فشل حذف الدورات!");
  }
};

// تحميل الدورات عند تسجيل الدخول
if (sessionStorage.getItem("adminLoggedIn") === "true") {
  loadDevelopmentCourses();
}

function syncDevCourseFieldsByMajor() {
  const majorEl = document.getElementById("devCourseMajor");
  const levelEl = document.getElementById("devCourseLevel");
  const relatedEl = document.getElementById("devCourseRelatedCourses");
  const levelGroup = document.getElementById("devLevelGroup");
  const relatedGroup = document.getElementById("devRelatedGroup");
  if (!majorEl || !levelEl || !relatedEl || !levelGroup || !relatedGroup) return;

  const major = majorEl.value;
  const isGeneralTrack = (major === "cyber" || major === "AI");

  levelGroup.style.display = isGeneralTrack ? "none" : "";
  relatedGroup.style.display = isGeneralTrack ? "none" : "";

  levelEl.required = !isGeneralTrack;

  if (isGeneralTrack) {
    levelEl.value = "";
    relatedEl.value = "";
  }
}

syncDevCourseFieldsByMajor();
document.getElementById("devCourseMajor")?.addEventListener("change", syncDevCourseFieldsByMajor);

const majorSelect = document.getElementById("devCourseMajor");
const levelSelect = document.getElementById("devCourseLevel");
const relatedInput = document.getElementById("devCourseRelatedCourses");

// هذا هو الديف اللي لفّيت فيه حقول المستوى + المواد المرتبطة (الخيار 1)
const academicFieldsWrap = document.getElementById("devAcademicFields");

function toggleAcademicFields() {
  const major = majorSelect.value;
  const isTrack = (major === "cyber" || major === "AI");

  if (isTrack) {
    // اخفاء + تعطيل + إزالة required
    academicFieldsWrap.style.display = "none";

    levelSelect.required = false;
    levelSelect.disabled = true;
    levelSelect.value = "";

    relatedInput.disabled = true;
    relatedInput.value = "";
  } else {
    // إظهار + تفعيل + إعادة required
    academicFieldsWrap.style.display = "";

    levelSelect.disabled = false;
    levelSelect.required = true;

    relatedInput.disabled = false;
  }
}

majorSelect.addEventListener("change", toggleAcademicFields);
toggleAcademicFields(); // تشغيلها أول ما تفتح الصفحة
