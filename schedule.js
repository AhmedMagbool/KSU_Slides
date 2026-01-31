// FILE: schedule.js
import { rtdb } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

/* =========================
   STATE
========================= */
let selectedMajor = null;
let selectedCourses = [];
let generatedSchedules = [];
let currentScheduleIndex = 0;





/* =========================
   Firebase read
========================= */
async function fetchTrackSections(trackKey) {
  const snap = await get(ref(rtdb, `schedules/${trackKey}`));
  const data = snap.val();
  const rows = Array.isArray(data) ? data : Object.values(data || {});
  return rows;
}

/* =========================
   In-memory caches
========================= */
let scheduleData = { courses: {} };
const SECTIONS_BY_COURSE = {};

// DEBUG: expose internal state to DevTools (module-safe)
window.__sched = {
  get selectedMajor() { return selectedMajor; },
  get selectedCourses() { return selectedCourses; },
  get generatedSchedules() { return generatedSchedules; },
  get currentScheduleIndex() { return currentScheduleIndex; },
  get SECTIONS_BY_COURSE() { return SECTIONS_BY_COURSE; },
  get scheduleData() { return scheduleData; },
};


/* =========================
   DOM
========================= */
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const coursesGrid = document.getElementById("coursesGrid");
const selectedSummary = document.getElementById("selectedSummary");
const selectedCount = document.getElementById("selectedCount");
const selectedCoursesList = document.getElementById("selectedCoursesList");
const courseSearch = document.getElementById("courseSearch");
const generateBtn = document.getElementById("generateBtn");
const resultsSection = document.getElementById("resultsSection");
const noResults = document.getElementById("noResults");

/* =========================
   Init
========================= */
document.addEventListener("DOMContentLoaded", () => {
  setupMajorButtons();
  setupNavigation();
  setupGenerateButton();
  setupExportButtons();
  setupSearch();
  const openOnlyToggle = document.getElementById("openOnlyToggle");
if (openOnlyToggle) {
  showOpenOnly = openOnlyToggle.checked;
  openOnlyToggle.addEventListener("change", (e) => {
    showOpenOnly = !!e.target.checked;
  });
}

});
function setupOpenOnlyToggle() {
  const toggle = document.getElementById("openOnlyToggle");
  const badge = document.getElementById("openOnlyStatus");

  if (!toggle || !badge) return;

  const paint = () => {
    const on = toggle.checked;
    badge.textContent = on ? "مفعل" : "غير مفعل";
    badge.classList.toggle("on", on);
    badge.classList.toggle("off", !on);
  };

  toggle.addEventListener("change", paint);
  paint(); // initial
}

document.addEventListener("DOMContentLoaded", () => {
  setupMajorButtons();
  setupNavigation();
  setupGenerateButton();
  setupExportButtons();
  setupSearch();

  setupOpenOnlyToggle(); // ✅ أضفها هنا
});

/* =========================
   Helpers (Course Key)
========================= */
function toCourseKey(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";

  if (/^\d+\s*-\s*.+$/.test(s)) return s.replace(/\s+/g, "");

  const m1 = s.match(/^(\d+)\s+(.+)$/);
  if (m1) return `${m1[1]}-${m1[2].trim()}`.replace(/\s+/g, "");

  const m2 = s.match(/^(.+?)\s+(\d+)$/);
  if (m2) return `${m2[2]}-${m2[1].trim()}`.replace(/\s+/g, "");

  return s.replace(/\s+/g, "");
}

function toCourseKeyFromCourseCode(courseCode) {
  return toCourseKey(courseCode);
}

function displayCourseCodeFromKey(courseKey) {
  const m = String(courseKey || "").match(/^(\d+)-(.+)$/);
  if (!m) return courseKey;
  return `${m[2]} ${m[1]}`;
}



function resolveCourseKey(input) {
  const raw = String(input || "").trim();

  // 1) جرّب المفتاح كما هو
  if (SECTIONS_BY_COURSE[raw]) return raw;
  if (scheduleData.courses?.[raw]) return raw;

  // 2) لو فيه رقم (105) خذه
  const m = raw.match(/\b\d+\b/);
  if (m) {
    const code = m[0];
    if (SECTIONS_BY_COURSE[code]) return code;
    if (scheduleData.courses?.[code]) return code;
  }

  // 3) fallback: استخدم toCourseKey القديم (لو عندك حالات ثانية)
  const k = toCourseKey(raw);
  if (SECTIONS_BY_COURSE[k]) return k;
  if (scheduleData.courses?.[k]) return k;

  return raw;
}



/* =========================
   Major Buttons
========================= */
function setupMajorButtons() {
  document.querySelectorAll(".major-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".major-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");

      selectedMajor = btn.dataset.major;
      selectedCourses = [];
      generatedSchedules = [];
      currentScheduleIndex = 0;
      updateSelectedSummary();

      step2.classList.remove("disabled");
      step2.classList.add("active");
      step3.classList.add("disabled");
      step3.classList.remove("active");

      resultsSection.style.display = "none";
      noResults.style.display = "none";

      await loadCourses(selectedMajor);
    });
  });
}

/* =========================
   Load Courses from Firebase
========================= */
async function loadCourses(majorCategory) {
  coursesGrid.innerHTML = '<div class="loading-placeholder">جاري تحميل المواد...</div>';

  try {
    const rawRows = await fetchTrackSections(majorCategory);

    const coursesMap = {};
    Object.keys(SECTIONS_BY_COURSE).forEach((k) => delete SECTIONS_BY_COURSE[k]);

    for (const row of (rawRows || [])) {
      const sectionStr = String(row?.section ?? "").trim();
      const courseCodeStr = String(row?.courseCode ?? "").trim();

      // تجاهل الصفوف الوهمية
      if (!/^\d+$/.test(sectionStr)) continue;
      if (!/^\d+/.test(courseCodeStr)) continue;
      if (courseCodeStr.includes("الإختبار النهائي") || courseCodeStr === "---") continue;

      const courseKey = toCourseKeyFromCourseCode(courseCodeStr);
      if (!courseKey) continue;

      if (!coursesMap[courseKey]) {
        coursesMap[courseKey] = {
          key: courseKey,
          code: displayCourseCodeFromKey(courseKey),
          name: String(row?.courseName || "").trim(),
          category: majorCategory,
        };
      }

      if (!SECTIONS_BY_COURSE[courseKey]) SECTIONS_BY_COURSE[courseKey] = [];
      SECTIONS_BY_COURSE[courseKey].push({
        ...row,
        sectionNumber: sectionStr,
      });
    }

    scheduleData = { courses: coursesMap };
    renderCourses(scheduleData.courses);
  } catch (e) {
    console.error("Error loading courses:", e);
    coursesGrid.innerHTML = '<div class="loading-placeholder">حدث خطأ في تحميل البيانات</div>';
    scheduleData = { courses: {} };
  }
}

/* =========================
   Render Courses
========================= */
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function renderCourses(coursesObj) {
  const keys = Object.keys(coursesObj || {});
  if (!keys.length) {
    coursesGrid.innerHTML = '<div class="loading-placeholder">لا توجد مواد لهذا التخصص</div>';
    return;
  }

  const sortedKeys = keys.sort((a, b) => {
    const na = parseInt(String(a).split("-")[0], 10) || 0;
    const nb = parseInt(String(b).split("-")[0], 10) || 0;
    return na - nb;
  });

  coursesGrid.innerHTML = sortedKeys.map((courseKey) => {
    const course = coursesObj[courseKey];
    const sectionsCount = SECTIONS_BY_COURSE[courseKey]?.length || 0;
    return `
      <label class="course-select-item" data-key="${escapeHtml(courseKey)}">
        <input type="checkbox" value="${escapeHtml(courseKey)}">
        <span class="course-checkbox">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </span>
        <span class="course-select-info">
          <span class="course-select-code">${escapeHtml(course.code || courseKey)}</span>
          <span class="course-select-name">${escapeHtml(course.name || "")}</span>
          <span class="course-sections-count">${sectionsCount} شعبة</span>
        </span>
      </label>
    `;
  }).join("");

  coursesGrid.querySelectorAll(".course-select-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      toggleCourse(item.dataset.key);
    });
  });
}

/* =========================
   Selection
========================= */
function toggleCourse(courseKey) {
  const key = resolveCourseKey(courseKey);
  const item = coursesGrid.querySelector(`[data-key="${CSS.escape(key)}"]`);

  if (selectedCourses.includes(key)) {
    selectedCourses = selectedCourses.filter((k) => k !== key);
    item?.classList.remove("selected");
  } else {
    selectedCourses.push(key);
    item?.classList.add("selected");
  }

  updateSelectedSummary();
  updateStep3State();
}


function updateSelectedSummary() {
  if (!selectedCourses.length) {
    selectedSummary.style.display = "none";
    return;
  }

  selectedSummary.style.display = "block";
  selectedCount.textContent = selectedCourses.length;

  selectedCoursesList.innerHTML = selectedCourses.map((key) => {
    const k = resolveCourseKey(key);
    const course = scheduleData.courses?.[k];

    const label = course
      ? `${course.name || ""} ${course.code || k}`.trim()
      : (displayCourseCodeFromKey(k) || k);

    return `
      <span class="course-chip">
        ${escapeHtml(label)}
        <button onclick="window.removeCourse('${escapeHtml(k)}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </span>
    `;
  }).join("");
}


window.removeCourse = function (key) {
  toggleCourse(key);
};

function updateStep3State() {
  if (selectedCourses.length > 0) {
    step3.classList.remove("disabled");
    step3.classList.add("active");
  } else {
    step3.classList.add("disabled");
    step3.classList.remove("active");
  }
}

/* =========================
   Search
========================= */
function setupSearch() {
  courseSearch?.addEventListener("input", (e) => {
    const query = String(e.target.value || "").toLowerCase();

    coursesGrid.querySelectorAll(".course-select-item").forEach((item) => {
      const key = String(item.dataset.key || "");
      const code = displayCourseCodeFromKey(key).toLowerCase();
      const name = item.querySelector(".course-select-name")?.textContent.toLowerCase() || "";

      if (key.toLowerCase().includes(query) || code.includes(query) || name.includes(query)) {
        item.style.display = "flex";
      } else {
        item.style.display = "none";
      }
    });
  });
}

/* =========================
   Generate Button
========================= */
function setupGenerateButton() {
  generateBtn?.addEventListener("click", generateSchedules);
}

/* =========================
   Normalize + filters
========================= */
// function isOpenSection(section) {
//   const s = String(section?.status || "").trim().toLowerCase();
//   if (!s) return true;

//   // استبعد فقط الحالات الواضحة للإغلاق
//   const closedWords = ["مغل", "مقفل", "closed", "not available", "غير متاح", "غير متاحة"];
//   if (closedWords.some(w => s.includes(w))) return false;

//   // غير كذا اعتبرها متاحة (لأن بوابة الجامعة أحيانًا تكتب حالات مختلفة)
//   return true;
// }

function normalizeSectionTimes(section) {
  const meetings = Array.isArray(section?.meetings) ? section.meetings : [];
  const out = [];

  // يدعم "1" و "1 3 5" و "1-3-5" و "1,3,5"
  const extractDays = (rawDay) => {
    const s = String(rawDay || "").trim();
    if (!s) return [];
    const nums = s.match(/[1-5]/g);
    if (nums?.length) return [...new Set(nums.map(n => parseInt(n, 10)))];
    return [];
  };

  // يلقط أي قيمة فيها وقتين HH:MM - HH:MM بغض النظر عن اسم الحقل
  const extractTimeRangeFromAnyField = (obj) => {
    for (const [k, v] of Object.entries(obj || {})) {
      const str = String(v || "").replace(/\s+/g, " ").trim();
      if (!str) continue;

      // ignore: تواريخ اختبار نهائي أو أشياء ما فيها "-"
      const m = str.match(/(\d{1,2}\s*:\s*\d{2}).*?[-–]\s*(\d{1,2}\s*:\s*\d{2})/);
      if (!m) continue;

      return {
        start: m[1].replace(/\s/g, ""),
        end: m[2].replace(/\s/g, ""),
        full: str,
        field: k,
      };
    }
    return null;
  };

  for (const m of meetings) {
    if (!m || typeof m !== "object") continue;

    // الأيام
    const days = extractDays(m.day);
    if (!days.length) continue;

    // الوقت
    const tr = extractTimeRangeFromAnyField(m);
    if (!tr) continue;

    const sMin = parseTime(tr.start, tr.full);
    const eMin = parseTime(tr.end, tr.full);
    if (!sMin || !eMin || eMin <= sMin) continue;

    // الغرفة (خذ أول شيء معقول)
    let roomRaw = "";
    for (const field of ["room", "location", "place", "classRoom", "hall", "building"]) {
      const r = String(m[field] || "").trim();
      if (r) { roomRaw = r; break; }
    }

    for (const dayNum of days) {
      out.push({
        dayNum,
        start: tr.start,
        end: tr.end,
        startMin: sMin,
        endMin: eMin,
        room: roomRaw,
      });
    }
  }

  return out;
}



async function getSectionsForCourse(courseKey) {
  const key = resolveCourseKey(courseKey);
  return SECTIONS_BY_COURSE[key] || [];
}


/* =========================
   Lecture/Lab/Tutorial bundling\
========================= */
function activityGroup(activityRaw) {
  const a = String(activityRaw || "").trim().toLowerCase();

  if (a.includes("عملي") || a.includes("تطبيقي") || a.includes("معمل") || a.includes("مختبر") || a.includes("lab")) return "lab";
  if (a.includes("تمارين") || a.includes("tutorial") || a.includes("discussion") || a.includes("recitation")) return "tut";

  return "lec";
}

function groupLabel(g) {
  if (g === "lab") return "عملي";
  if (g === "tut") return "تمارين";
  return "نظري";
}

function getTimeSlots(time) {
  const slots = [];
  const day = parseInt(time.dayNum || 0, 10);
  const startMinutes = time.startMin || parseTime(time.start);
  const endMinutes = time.endMin || parseTime(time.end);

  if (!(day >= 1 && day <= 5)) return slots;
  if (!startMinutes || !endMinutes || endMinutes <= startMinutes) return slots;

  for (let m = startMinutes; m < endMinutes; m += 15) {
    slots.push(`${day}-${m}`);
  }
  return slots;
}

function buildCourseBundles(normalizedSections) {
  // 1) Dedup sections داخل كل مادة حسب بصمة الوقت (اليوم + startMin + endMin)
  // الهدف: لو عندك 5 شعب نفس وقتها، تعتبرها خيار واحد مثل Scoop.me

  const makeTimesSig = (times) => {
    const arr = (times || [])
      .map(t => ({
        d: parseInt(t.dayNum, 10),
        s: t.startMin || parseTime(t.start),
        e: t.endMin || parseTime(t.end),
      }))
      .filter(x => x.d >= 1 && x.d <= 5 && x.s && x.e && x.e > x.s)
      .sort((a, b) => (a.d - b.d) || (a.s - b.s) || (a.e - b.e));

    return arr.map(x => `${x.d}-${x.s}-${x.e}`).join("|");
  };

  const uniqByTime = (sections) => {
    const seen = new Set();
    const out = [];
    for (const s of sections) {
      const sig = makeTimesSig(s.times);
      if (!sig) continue;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(s);
    }
    return out;
  };

  const groups = { lec: [], lab: [], tut: [] };

  for (const sec of normalizedSections) {
    const g = activityGroup(sec.activity);
    groups[g].push(sec);
  }

  // Dedup داخل كل مجموعة
  groups.lec = uniqByTime(groups.lec);
  groups.lab = uniqByTime(groups.lab);
  groups.tut = uniqByTime(groups.tut);

  // fallback لو ما قدر يميز
  if (!groups.lec.length && (groups.lab.length || groups.tut.length)) {
    groups.lec = uniqByTime([...groups.lab, ...groups.tut]);
    groups.lab = [];
    groups.tut = [];
  }

  // لو كل الشعب نظري فقط
  if (!groups.lec.length) {
    groups.lec = uniqByTime(normalizedSections);
  }

  const needLab = groups.lab.length > 0;
  const needTut = groups.tut.length > 0;

  const labs = needLab ? groups.lab : [null];
  const tuts = needTut ? groups.tut : [null];

  const conflictTimes = (aTimes, bTimes) => {
    if (!aTimes?.length || !bTimes?.length) return false;
    const occ = new Set();
    for (const t of aTimes) for (const s of getTimeSlots(t)) occ.add(s);
    for (const t of bTimes) for (const s of getTimeSlots(t)) if (occ.has(s)) return true;
    return false;
  };

  const bundles = [];
  const MAX_BUNDLES_PER_COURSE = 120; // بعد الـ dedup ما نحتاج رقم كبير

  for (const lec of groups.lec) {
    if (!lec.times?.length) continue;

    for (const lab of labs) {
      if (lab && (!lab.times?.length || conflictTimes(lec.times, lab.times))) continue;

      for (const tut of tuts) {
        if (tut) {
          if (!tut.times?.length) continue;
          if (conflictTimes(lec.times, tut.times)) continue;
          if (lab && conflictTimes(lab.times, tut.times)) continue;
        }

        const parts = [lec, lab, tut].filter(Boolean);
        const times = parts.flatMap(p => p.times || []);
        if (!times.length) continue;

        const hasClosed = parts.some(p => !isOpenSection(p));
bundles.push({ parts, times, hasClosed });


        bundles.push({ parts, times });

        if (bundles.length >= MAX_BUNDLES_PER_COURSE) return bundles;
      }
    }
  }

  return bundles;
}


/* =========================
   Generate schedules
========================= */

function isOpenSection(section) {
  const s = String(section?.status || "").trim().toLowerCase();
  if (!s) return true; // لو ما فيه status اعتبره مفتوح

  // كلمات الإغلاق الشائعة
  const closedWords = [
    "مغلق", "مغلقة", "مقفل", "مقفلة", "مقفول",
    "closed", "not available", "غير متاح", "غير متاحة",
    "مكتمل", "مكتملة", "full", "capacity"
  ];

  return !closedWords.some(w => s.includes(w));
}

let showOpenOnly = false;

async function generateSchedules() {
  if (!selectedCourses.length) return;

  const missing = [];
  const courseSections = [];

  for (const courseKeyRaw of selectedCourses) {
    const courseKey = toCourseKey(courseKeyRaw); // ✅ توحيد المفتاح

    const course = scheduleData.courses?.[courseKey] || {
      key: courseKey,
      code: displayCourseCodeFromKey(courseKey),
      name: "",
    };

    // ✅ لا تستخدم SECTIONS_BY_COURSE[courseKeyRaw]
const resolvedKey = resolveCourseKey(courseKey);
const rawSections = await getSectionsForCourse(resolvedKey);

    if (!rawSections.length) {
      missing.push(course.code || courseKey);
      continue;
    }

    const normalized = rawSections
      .map((sec) => {
        const times = normalizeSectionTimes(sec);
        return {
          ...sec,
          times,
          sectionNumber: sec.sectionNumber || sec.section || sec.shoba || sec.id || "",
        };
      })


      
      .filter((sec) => !showOpenOnly || isOpenSection(sec))
.filter((sec) => sec.times && sec.times.length);


      if (courseKey.includes("105") || courseKey.includes("210")) {
  console.log("DEBUG", courseKey, {
    raw: rawSections.length,
    normalized: normalized.length,
    firstNorm: normalized[0]
  });
}

    let bundles = buildCourseBundles(normalized);

    if (!bundles.length) {
      missing.push(course.code || courseKey);
    } else {
      courseSections.push({
        key: course.key,
        code: course.code || displayCourseCodeFromKey(courseKey),
        name: course.name || "",
        sections: bundles,
      });
    }
  }

  if (missing.length) {
    alert(`لا توجد شعب/حزم متاحة للمواد التالية:\n${missing.join("\n")}`);
    return;
  }

  const timePreference = document.getElementById("timePreference")?.value || "any";
  const daysOff = Array.from(document.querySelectorAll(".days-checkboxes input:checked"))
    .map((cb) => parseInt(cb.value, 10))
    .filter((n) => n >= 1 && n <= 5);

  generatedSchedules = generateCombinations(courseSections, timePreference, daysOff);
  currentScheduleIndex = 0;

  if (generatedSchedules.length > 0) {
    resultsSection.style.display = "block";
    noResults.style.display = "none";
    document.getElementById("schedulesCount").textContent = generatedSchedules.length;
    document.getElementById("totalSchedules").textContent = generatedSchedules.length;
    displaySchedule(0);
    resultsSection.scrollIntoView({ behavior: "smooth" });
  } else {
    resultsSection.style.display = "none";
    noResults.style.display = "block";
  }
}


/* =========================
   Beam Search + scoring
========================= */
function generateCombinations(courseSections, timePreference, daysOff) {
  const MAX_RESULTS = 12;
  const BEAM_WIDTH = 1200;

  const courses = [...courseSections].sort((a, b) => (a.sections?.length || 0) - (b.sections?.length || 0));

  let beam = [{
    schedule: [],
    occupied: new Set(),
    score: 0
  }];

  for (const course of courses) {
    const nextBeam = [];

    for (const state of beam) {
      for (const bundle of course.sections) {
        // فلترة أيام الراحة + تفضيل الوقت على مستوى الـ bundle
        if (daysOff?.length) {
          let bad = false;
          for (const t of bundle.times || []) {
            const d = parseInt(t.dayNum, 10);
            if (daysOff.includes(d)) { bad = true; break; }
          }
          if (bad) continue;
        }

        if (timePreference && timePreference !== "any") {
          let bad = false;
          for (const t of bundle.times || []) {
            const sMin = t.startMin || parseTime(t.start);
            if (!sMin) { bad = true; break; }
            if (timePreference === "morning" && sMin >= 12 * 60) { bad = true; break; }
            if (timePreference === "afternoon" && sMin < 12 * 60) { bad = true; break; }
          }
          if (bad) continue;
        }

        let conflict = false;
        const slotsToAdd = [];

        for (const t of bundle.times || []) {
          const slots = getTimeSlots(t);
          for (const s of slots) {
            if (state.occupied.has(s)) { conflict = true; break; }
            slotsToAdd.push(s);
          }
          if (conflict) break;
        }
        if (conflict) continue;

        const newOccupied = new Set(state.occupied);
        slotsToAdd.forEach(s => newOccupied.add(s));

        const newSchedule = state.schedule.concat([{
          key: course.key,
          code: course.code,
          name: course.name,
          bundle
        }]);

        nextBeam.push({
          schedule: newSchedule,
          occupied: newOccupied,
          score: scoreSchedule(newSchedule, timePreference, daysOff) // score داخلي للـ beam فقط
        });
      }
    }

    nextBeam.sort((a, b) => b.score - a.score);
    beam = nextBeam.slice(0, BEAM_WIDTH);
    if (!beam.length) return [];
  }

  // Dedup ثم ترتيب نهائي مثل Scoop
  const seen = new Set();
  let results = [];

  for (const st of beam) {
    const sig = scheduleSignatureExact(st.schedule);
    if (seen.has(sig)) continue;
    seen.add(sig);
    results.push(st.schedule);
  }

  // ✅ هنا السر: ترتيب نهائي يشبه المواقع
  results.sort(compareLikeScoop);

  return results.slice(0, MAX_RESULTS);
}


// بصمة دقيقة: كل (day,start,end) لكل مادة في الجدول
function scheduleSignatureExact(schedule) {
  const items = [];

  for (const item of schedule) {
    const times = (item.bundle?.times || [])
      .map(t => {
        const d = parseInt(t.dayNum, 10);
        const s = t.startMin || parseTime(t.start);
        const e = t.endMin || parseTime(t.end);
        return (d && s && e) ? `${d}-${s}-${e}` : "";
      })
      .filter(Boolean)
      .sort();

    // نضم توقيتات المادة مع كودها
    items.push(`${item.code}:${times.join(",")}`);
  }

  return items.sort().join("||");
}


function scoreSchedule(schedule, timePreference, daysOff) {
  const byDay = { 1: [], 2: [], 3: [], 4: [], 5: [] };

  for (const item of schedule) {
    for (const t of item.bundle.times || []) {
      const day = parseInt(t.dayNum, 10);
      const s = t.startMin || parseTime(t.start);
      const e = t.endMin || parseTime(t.end);
      if (!day || !s || !e) continue;
      byDay[day].push([s, e]);
    }
  }

  let daysUsed = 0;
  let totalGaps = 0;
  let gapBlocks = 0;
  let earliest = 24 * 60;
  let latest = 0;
  let daysOffViolations = 0;

  for (const day of [1, 2, 3, 4, 5]) {
    const arr = byDay[day];
    if (!arr.length) continue;

    daysUsed++;
    
    // Check days off violations
    if (daysOff.includes(day)) {
      daysOffViolations++;
    }

    arr.sort((a, b) => a[0] - b[0]);

    earliest = Math.min(earliest, arr[0][0]);
    latest = Math.max(latest, arr[arr.length - 1][1]);

    for (let i = 1; i < arr.length; i++) {
      const gap = arr[i][0] - arr[i - 1][1];
      if (gap > 0) {
        totalGaps += gap;
        gapBlocks++;
      }
    }
  }

  let score = 0;
  score += (6 - daysUsed) * 220;
  score -= totalGaps * 1.2;
  score -= gapBlocks * 70;
  score -= daysOffViolations * 150;

  if (earliest < 8 * 60) score -= (8 * 60 - earliest) * 2;
  if (latest > 17 * 60) score -= (latest - 17 * 60) * 1.5;

  if (gapBlocks === 0) score += 150;

  // Time preference scoring
  if (timePreference === "morning") {
    if (earliest >= 12 * 60) score -= 80;
    if (earliest < 10 * 60) score += 50;
  } else if (timePreference === "afternoon") {
    if (earliest < 12 * 60) score -= 80;
    if (earliest >= 12 * 60) score += 50;
  }

  return score;
}

function analyzeSchedule(schedule) {
  const byDay = { 1: [], 2: [], 3: [], 4: [], 5: [] };

  for (const item of schedule) {
    for (const t of item.bundle.times || []) {
      const day = parseInt(t.dayNum, 10);
      const s = t.startMin || parseTime(t.start);
      const e = t.endMin || parseTime(t.end);
      if (!day || !s || !e || e <= s) continue;
      byDay[day].push([s, e]);
    }
  }

  let daysUsed = 0;
  let totalGaps = 0;
  let gapBlocks = 0;
  let earliest = 24 * 60;
  let latest = 0;

  for (const day of [1, 2, 3, 4, 5]) {
    const arr = byDay[day];
    if (!arr.length) continue;

    daysUsed++;
    arr.sort((a, b) => a[0] - b[0]);

    earliest = Math.min(earliest, arr[0][0]);
    latest = Math.max(latest, arr[arr.length - 1][1]);

    for (let i = 1; i < arr.length; i++) {
      const gap = arr[i][0] - arr[i - 1][1];
      if (gap > 0) {
        totalGaps += gap;
        gapBlocks++;
      }
    }
  }

  return { daysUsed, totalGaps, gapBlocks, earliest, latest };
}

function compareLikeScoop(aSchedule, bSchedule) {
  const a = analyzeSchedule(aSchedule);
  const b = analyzeSchedule(bSchedule);

  // ترتيب يشبه اللي تسويه المواقع غالبًا:
  // 1) أقل أيام حضور
  if (a.daysUsed !== b.daysUsed) return a.daysUsed - b.daysUsed;

  // 2) أقل فراغات إجمالي
  if (a.totalGaps !== b.totalGaps) return a.totalGaps - b.totalGaps;

  // 3) أقل عدد فواصل (جلسات الفراغ)
  if (a.gapBlocks !== b.gapBlocks) return a.gapBlocks - b.gapBlocks;

  // 4) يبدأ أبكر (قريب من 8) — لو يهمهم
  if (a.earliest !== b.earliest) return a.earliest - b.earliest;

  // 5) ينتهي أبكر
  if (a.latest !== b.latest) return a.latest - b.latest;

  // fallback ثابت
  return scheduleSignatureExact(aSchedule).localeCompare(scheduleSignatureExact(bSchedule));
}


function scheduleSignature(schedule) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const item of schedule) {
    for (const t of item.bundle.times || []) {
      const d = parseInt(t.dayNum, 10);
      if (d >= 1 && d <= 5) counts[d]++;
    }
  }

  return `d:${Object.values(counts).join("-")}`;
}

/* =========================
   Time parsing
========================= */
function parseTime(timeStr, fullTimeStr = "") {
  if (!timeStr) return 0;
  const s = String(timeStr).trim();
  const full = String(fullTimeStr || timeStr).trim();

  const isPM = full.includes("م") || full.toLowerCase().includes("pm");
  const isAM = full.includes("ص") || full.toLowerCase().includes("am");

  const m = s.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!m) return 0;

  let hours = parseInt(m[1], 10) || 0;
  const minutes = parseInt(m[2], 10) || 0;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  // Handle ambiguous times (no AM/PM indicator)
  // Assume times 1-7 are PM if no indicator
  if (!isPM && !isAM && hours >= 1 && hours <= 7) {
    hours += 12;
  }

  return hours * 60 + minutes;
}

/* =========================
   Display Schedule
========================= */
function displaySchedule(index) {
  if (index < 0 || index >= generatedSchedules.length) return;

  currentScheduleIndex = index;
  const schedule = generatedSchedules[index];

  document.getElementById("currentScheduleNum").textContent = index + 1;
  document.getElementById("prevSchedule").disabled = index === 0;
  document.getElementById("nextSchedule").disabled = index === generatedSchedules.length - 1;

  const timeSlots = [];
  for (let h = 8; h <= 20; h++) timeSlots.push(`${h}:00`);

  const tbody = document.getElementById("scheduleBody");
  tbody.innerHTML = "";

  const courseColors = {};
  let colorIndex = 1;
  schedule.forEach((item) => {
    if (!courseColors[item.code]) courseColors[item.code] = colorIndex++;
  });

  const cellsMap = {};

  schedule.forEach((item) => {
    const times = item.bundle.times || [];
    times.forEach((time) => {
      const dayIndex = parseInt(time.dayNum, 10) - 1;
      if (dayIndex < 0 || dayIndex >= 5) return;

      const startMinutes = time.startMin || parseTime(time.start);
      const endMinutes = time.endMin || parseTime(time.end);

      const startHour = Math.floor(startMinutes / 60);
      const duration = Math.max(1, Math.ceil((endMinutes - startMinutes) / 60));

      const key = `${startHour}-${dayIndex}`;
      cellsMap[key] = { item, time, rowspan: duration, color: courseColors[item.code] };

      for (let h = 1; h < duration; h++) {
        cellsMap[`${startHour + h}-${dayIndex}`] = "spanned";
      }
    });
  });

  timeSlots.forEach((slot) => {
    const hour = parseInt(slot.split(":")[0], 10);
    const tr = document.createElement("tr");

    const timeCell = document.createElement("td");
    timeCell.className = "time-cell";
    timeCell.textContent = formatHour(hour);
    tr.appendChild(timeCell);

    for (let d = 0; d < 5; d++) {
      const key = `${hour}-${d}`;
      const cellData = cellsMap[key];

      if (cellData === "spanned") continue;

      const td = document.createElement("td");

      if (cellData) {
        td.rowSpan = cellData.rowspan;

        const secLabel = (cellData.item.bundle.parts || [])
          .map(p => `${groupLabel(activityGroup(p.activity))} ${String(p.sectionNumber || "").trim()}`)
          .join(" / ");

        const isClosed = !!cellData.item.bundle.hasClosed;

const parts = (cellData.item.bundle.parts || []);
const ct = cellData.time;

// اختَر الـ part اللي نفس وقت البلوك
const matchPart = parts.find(p => {
  const times = p.times || [];
  return times.some(t =>
    Number(t.dayNum) === Number(ct.dayNum) &&
    Number(t.startMin || parseTime(t.start)) === Number(ct.startMin || parseTime(ct.start)) &&
    Number(t.endMin || parseTime(t.end)) === Number(ct.endMin || parseTime(ct.end))
  );
}) || parts[0] || null;

const instructor =
  String(matchPart?.instructor || cellData.item?.bundle?.instructor || cellData.item?.instructor || "").trim();

const sectionNum = String(matchPart?.sectionNumber || "").trim();
const typeLabel = groupLabel(activityGroup(matchPart?.activity));

const startTxt = String(ct.start || "").trim();
const endTxt   = String(ct.end || "").trim();
const timeTxt  = (startTxt && endTxt) ? `${startTxt} - ${endTxt}` : "";

td.innerHTML = `
  <div class="schedule-block color-${cellData.color}">
    ${instructor ? `<div class="sb-teacher">📌 ${escapeHtml(instructor)}</div>` : ""}
    <div class="sb-code">${escapeHtml(cellData.item.code)}</div>
    <div class="sb-sub">${escapeHtml(typeLabel)} ${escapeHtml(sectionNum)}</div>
    ${timeTxt ? `<div class="sb-time">${escapeHtml(timeTxt)}</div>` : ""}
  </div>
`;


      }

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  });

  displaySectionDetails(schedule);
}

function formatHour(hour) {
  if (hour === 0 || hour === 12) return "12:00";
  if (hour < 12) return `${hour}:00 ص`;
  return `${hour - 12}:00 م`;
}

function displaySectionDetails(schedule) {
  const container = document.getElementById("sectionsDetails");

  container.innerHTML = schedule.map((item) => {
    const parts = item.bundle.parts || [];
    const partsHtml = parts.map((p) => {
      const g = activityGroup(p.activity);
      const label = groupLabel(g);
      return `
        <div style="margin-top:8px;">
          <strong>${escapeHtml(label)}:</strong>
          شعبة ${escapeHtml(p.sectionNumber || "")}
          ${p.instructor ? ` - ${escapeHtml(p.instructor)}` : ""}
        </div>
      `;
    }).join("");

    return `
      <div class="section-detail-card">
        <h4>${escapeHtml(item.code)} - ${escapeHtml(item.name || "")}</h4>
        ${partsHtml}
        <p style="margin-top:10px;"><strong>الأوقات:</strong> ${escapeHtml(formatTimes(item.bundle.times))}</p>
      </div>
    `;
  }).join("");
}

function formatTimes(times) {
  if (!times || !times.length) return "غير محدد";
  const NUM_TO_DAY = { 1: "الأحد", 2: "الاثنين", 3: "الثلاثاء", 4: "الأربعاء", 5: "الخميس" };

  return times.map((t) => `${NUM_TO_DAY[t.dayNum] || t.dayNum || ""} ${t.start || ""} - ${t.end || ""}`).join("، ");
}

/* =========================
   Navigation
========================= */
function setupNavigation() {
  document.getElementById("prevSchedule")?.addEventListener("click", () => {
    displaySchedule(currentScheduleIndex - 1);
  });

  document.getElementById("nextSchedule")?.addEventListener("click", () => {
    displaySchedule(currentScheduleIndex + 1);
  });

  const navToggle = document.getElementById("navToggle");
  const navMenu = document.querySelector(".nav-menu");
  navToggle?.addEventListener("click", () => {
    navMenu?.classList.toggle("open");
  });
}

/* =========================
   Export Buttons
========================= */
function setupExportButtons() {
  document.getElementById("exportImage")?.addEventListener("click", exportAsImage);
  document.getElementById("exportPDF")?.addEventListener("click", exportAsPDF);
}

async function exportAsImage() {
  const table = document.querySelector(".schedule-table-wrapper");
  if (!table) return;

  try {
    const html2canvas = (await import("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.esm.js")).default;

    const canvas = await html2canvas(table, {
      backgroundColor: "#1a1a2e",
      scale: 2,
    });

    const link = document.createElement("a");
    link.download = `schedule-${currentScheduleIndex + 1}.png`;
    link.href = canvas.toDataURL();
    link.click();
  } catch (error) {
    console.error("Export error:", error);
    alert("حدث خطأ في التصدير");
  }
}

function exportAsPDF() {
  window.print();
}


  // hamburger
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.querySelector(".nav-menu");
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => navMenu.classList.toggle("open"));
    navMenu.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => navMenu.classList.remove("open"))
    );
  }

  // Track switching
  const trackTabs = document.querySelectorAll('.track-tab');
  const trackContents = document.querySelectorAll('.track-content');

  trackTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const track = tab.dataset.track;

      trackTabs.forEach(t => t.classList.remove('active'));
      trackContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(`track-${track}`).classList.add('active');
    });
  });
