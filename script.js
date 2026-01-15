// FILE: script.js
import { rtdb } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";

/* =========================
   Tiny Cache (localStorage)
========================= */
const CACHE_PREFIX = "ucache:";
function cacheGet(key, maxAgeMs) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    if (Date.now() - (obj.t || 0) > maxAgeMs) return null;
    return obj.v ?? null;
  } catch {
    return null;
  }
}
function cacheSet(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {}
}

document.addEventListener("DOMContentLoaded", async () => {
  // 1) Render cached fast
  const cached = cacheGet("coursesIndex", 5 * 60 * 1000); // 5 min
  if (cached) renderCourses(cached);

  // 2) Fetch fresh
  await loadCourses();

  document.getElementById("searchBtn")?.addEventListener("click", handleSearch);
  document.getElementById("searchInput")?.addEventListener("keyup", (e) => e.key === "Enter" && handleSearch());

  // nav
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.querySelector(".nav-menu");
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => navMenu.classList.toggle("open"));
    navMenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => navMenu.classList.remove("open")));
  }
});

async function loadCourses() {
  try {
    // IMPORTANT: read from lightweight index (no base64)
    const snap = await get(ref(rtdb, "coursesIndex"));
    const coursesIndex = snap.exists() ? snap.val() : null;

    if (coursesIndex) {
      cacheSet("coursesIndex", coursesIndex);
      renderCourses(coursesIndex);
      return;
    }

    // Fallback (slow) if index not built yet
    console.warn("coursesIndex not found. Falling back to courses (SLOW). Build index from admin.");
    const slowSnap = await get(ref(rtdb, "courses"));
    const slow = slowSnap.exists() ? slowSnap.val() : {};
    renderCourses(slow);
  } catch (error) {
    console.error("Error loading courses:", error);
  }
}

function renderCourses(coursesObj) {
  const generalGrid = document.getElementById("generalCoursesGrid");
  const csGrid = document.getElementById("csCoursesGrid");
  const isGrid = document.getElementById("isCoursesGrid");
  const islamicGrid = document.getElementById("islamicCoursesGrid");
  const managementGrid = document.getElementById("managementCoursesGrid");

  if (!generalGrid || !csGrid || !isGrid || !islamicGrid || !managementGrid) return;

  generalGrid.innerHTML = "";
  csGrid.innerHTML = "";
  isGrid.innerHTML = "";
  islamicGrid.innerHTML = "";
  managementGrid.innerHTML = "";

  Object.values(coursesObj || {}).forEach((course) => {
    const card = createCourseCard(course);

    if (course.category === "general") generalGrid.appendChild(card);
    else if (course.category === "cs") csGrid.appendChild(card);
    else if (course.category === "is") isGrid.appendChild(card);
    else if (course.category === "islamic") islamicGrid.appendChild(card);
    else if (course.category === "management") managementGrid.appendChild(card);
  });
}

function createCourseCard(course) {
  // works with both:
  // - old structure: course.files[folder][fileId] = {data,...}
  // - new index: course.files[folder][fileId] = {name,size,type,uploadedAt} (no data)
  const totalFiles = Object.values(course.files || {}).reduce((t, folderObj) => t + Object.keys(folderObj || {}).length, 0);

  const card = document.createElement("div");
  card.className = "course-card";

  const code = String(course.code || "").trim();
  const name = String(course.name || "").trim();
  const desc = String(course.description || "").trim();

  card.innerHTML = `
    <div class="course-header">
      <div class="course-icon">${code.replace(/\D/g, "") || code}</div>
      <div class="course-info">
        <div class="course-code">${escapeHTML(code)}</div>
        <div class="course-name">${escapeHTML(name)}</div>
      </div>
    </div>

    <div class="course-stats">
      <div class="stat-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <span>${desc ? escapeHTML(desc) : "لا يوجد وصف"}</span>
      </div>

      <div class="stat-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
        </svg>
        <span>${totalFiles} ملف</span>
      </div>
    </div>

    <div class="course-actions">
      <button class="browse-btn" onclick="openCourse('${escapeQuotes(code)}')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
        تصفح الملفات
      </button>

      <button class="download-btn" onclick="downloadAllFiles('${escapeQuotes(code)}')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        تحميل
      </button>
    </div>
  `;

  card.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", (e) => e.stopPropagation()));
  return card;
}

window.openCourse = function (code) {
  window.location.href = `course-files.html?code=${encodeURIComponent(code)}`;
};

window.downloadAllFiles = async function downloadAllFiles(code) {
  const btn = event?.currentTarget;
  const oldText = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = "0.7";
    btn.textContent = "جاري تجهيز ZIP...";
  }

  try {
    // جيب المادة كاملة (فيها files + data)
    const snap = await get(ref(rtdb, `courses/${code}`));
    if (!snap.exists()) throw new Error("المادة غير موجودة");

    const course = snap.val();
    const filesObj = course.files || {};

    const folderNames = {
      lectures: "المحاضرات",
      exams: "الاختبارات",
      assignments: "الواجبات",
      notes: "الملخصات",
      other: "أخرى",
    };

    const zip = new JSZip();

    // اجمع كل الملفات
    let total = 0;
    for (const folderKey of Object.keys(folderNames)) {
      const folder = filesObj[folderKey];
      if (!folder) continue;
      total += Object.keys(folder).length;
    }

    if (!total) {
      alert("لا توجد ملفات لهذه المادة.");
      return;
    }

    let done = 0;

    for (const folderKey of Object.keys(folderNames)) {
      const folder = filesObj[folderKey];
      if (!folder) continue;

      const folderTitle = folderNames[folderKey] || folderKey;
      const filesArr = Object.values(folder);

      for (const f of filesArr) {
        const name = sanitizeFileName(f.name || "file");
        const dataUrl = f.data;

        if (!dataUrl) continue;

        // dataURL -> ArrayBuffer
        const ab = await (await fetch(dataUrl)).arrayBuffer();

        zip.file(`${folderTitle}/${name}`, ab);
        done++;

        if (btn) btn.textContent = `تجهيز ZIP... (${done}/${total})`;
      }
    }

    // توليد الملف المضغوط
    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // تنزيل
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFileName(code)}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("صار خطأ أثناء تجهيز الملف المضغوط.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = "";
      btn.textContent = oldText || "تحميل";
    }
  }
};

function sanitizeFileName(name) {
  return String(name)
    .replace(/[\\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}


function handleSearch() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const allCards = Array.from(document.querySelectorAll(".course-card"));

  // reset highlight
  allCards.forEach((c) => c.classList.remove("search-hit"));

  // إذا فاضي: رجع كل شيء
  if (!query) {
    allCards.forEach((c) => (c.style.display = ""));
    return;
  }

  // طلّع النتائج وخفّ الباقي
  const matches = [];

  allCards.forEach((card) => {
    const name = (card.querySelector(".course-name")?.textContent || "").toLowerCase();
    const code = (card.querySelector(".course-code")?.textContent || "").toLowerCase();

    const isMatch = name.includes(query) || code.includes(query);

    card.style.display = isMatch ? "" : "none";
    if (isMatch) matches.push(card);
  });

  if (!matches.length) return;

  // نزّل لأول نتيجة وميّزها
  const first = matches[0];
  first.classList.add("search-hit");
const y = first.getBoundingClientRect().top + window.pageYOffset;
const offset = 120; // عدّلها لو عندك هيدر أعلى
window.scrollTo({ top: y - offset, behavior: "smooth" });

  setTimeout(() => first.classList.remove("search-hit"), 2000);
}


function escapeQuotes(str) {
  return (str || "").replace(/'/g, "\\'").replace(/"/g, '\\"');
}
function escapeHTML(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
