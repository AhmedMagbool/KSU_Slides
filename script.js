// FILE: script.js
import { rtdb } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

let ALL_COURSES = [];
let CURRENT_CATEGORY = "all";

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

/* =========================
   DOM Ready
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  const cached = cacheGet("coursesIndex", 10 * 60 * 1000);
  if (cached) {
    ALL_COURSES = Object.values(cached || {});
    applyFiltersAndRender();
  }

  await loadCourses();

  document.getElementById("searchBtn")?.addEventListener("click", handleSearch);
  document.getElementById("searchInput")?.addEventListener("input", handleSearch);
  document.getElementById("searchInput")?.addEventListener("keyup", (e) => e.key === "Enter" && handleSearch());

  const navToggle = document.getElementById("navToggle");
  const navMenu = document.querySelector(".nav-menu");
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => navMenu.classList.toggle("open"));
    navMenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => navMenu.classList.remove("open")));
  }

  initCategoryFilter();
});

async function loadCourses() {
  try {
    let snap = await get(ref(rtdb, "coursesIndex"));
    let coursesData = {};

    if (snap.exists()) {
      coursesData = snap.val();
    } else {
      snap = await get(ref(rtdb, "courses"));
      if (snap.exists()) coursesData = snap.val();
    }

    cacheSet("coursesIndex", coursesData);

    ALL_COURSES = Object.values(coursesData || {});
    applyFiltersAndRender();
  } catch (err) {
    console.error("Error loading courses:", err);
  }
}

/* =========================
   Core: Apply filter + search then render
========================= */
function applyFiltersAndRender() {
  const q = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();

  // 1) category filter
  let filtered = ALL_COURSES.filter((c) => {
    const cat = (c.category || "general").trim();
    return CURRENT_CATEGORY === "all" ? true : cat === CURRENT_CATEGORY;
  });

  // 2) search filter
  if (q) {
    filtered = filtered.filter((c) => {
      const name = String(c.name || "").toLowerCase();
      const code = String(c.code || "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }

  // Render
  renderCoursesIntoGrids(filtered);

  // Header (title/subtitle)
  updateMainHeader(CURRENT_CATEGORY);

  // Count (always from visible in selected category after search)
  updateCoursesCount(filtered.length);

  // Show/Hide sections (only for all vs single category)
  toggleSectionsVisibility(CURRENT_CATEGORY);
}

/* =========================
   Render into grids
========================= */
function renderCoursesIntoGrids(list) {
  const generalGrid = document.getElementById("generalCoursesGrid");
  const csGrid = document.getElementById("csCoursesGrid");
  const isGrid = document.getElementById("isCoursesGrid");
  const islamicGrid = document.getElementById("islamicCoursesGrid");
  const managementGrid = document.getElementById("MangamentCoursesGrid");

  if (generalGrid) generalGrid.innerHTML = "";
  if (csGrid) csGrid.innerHTML = "";
  if (isGrid) isGrid.innerHTML = "";
  if (islamicGrid) islamicGrid.innerHTML = "";
  if (managementGrid) managementGrid.innerHTML = "";

  list.forEach((course) => {
    const card = createCourseCard(course);
    const cat = (course.category || "general").trim();

    if (cat === "general" && generalGrid) generalGrid.appendChild(card);
    else if (cat === "cs" && csGrid) csGrid.appendChild(card);
    else if (cat === "is" && isGrid) isGrid.appendChild(card);
    else if (cat === "islamic" && islamicGrid) islamicGrid.appendChild(card);
    else if (cat === "management" && managementGrid) managementGrid.appendChild(card);
    else if (generalGrid) generalGrid.appendChild(card);
  });
}

/* =========================
   Count
========================= */
function updateCoursesCount(n) {
  const el = document.getElementById("coursesCount");
  if (!el) return;
  el.textContent = `${Math.max(0, Number(n) || 0)} مادة`;
}

/* =========================
   Header text
   - IMPORTANT: "all" should NOT show "جميع المواد" as title.
   - It should go back to default (general) like your first design.
========================= */
function updateMainHeader(category) {
  const title = document.getElementById("currentSectionTitle");
  const sub = document.getElementById("currentSectionSubtitle");
  if (!title || !sub) return;

  const MAP = {
    // all -> default first section header
    all: { t: "مواد الإعداد العام", s: "المواد الأساسية والمتطلبات العامة" },
    general: { t: "مواد الإعداد العام", s: "المواد الأساسية والمتطلبات العامة" },
    cs: { t: "مواد علوم الحاسب", s: "المواد التخصصية في علوم الحاسب" },
    is: { t: "مواد نظم المعلومات", s: "المواد التخصصية في نظم المعلومات" },
    islamic: { t: "مواد السلم", s: "المواد الأساسية في السلم" },
    management: { t: "مواد الإدارة", s: "المواد المطلوبة في الإدارة" },
  };

  const v = MAP[category] || MAP.all;
  title.textContent = v.t;
  sub.textContent = v.s;
}

/* =========================
   Show/Hide sections
   - when all: show all section headers + grids
   - when specific: hide all headers except main header, show only its grid
========================= */
function toggleSectionsVisibility(category) {
  const generalSection = document.getElementById("generalSection");
  const generalGrid = document.getElementById("generalCoursesGrid");

  const csSection = document.getElementById("csSection");
  const csGrid = document.getElementById("csCoursesGrid");

  const isSection = document.getElementById("isSection");
  const isGrid = document.getElementById("isCoursesGrid");

  const islamicSection = document.getElementById("islamicSection");
  const islamicGrid = document.getElementById("islamicCoursesGrid");

  const managementSection = document.getElementById("managementSection");
  const managementGrid = document.getElementById("MangamentCoursesGrid");

  const show = (el) => { if (el) el.style.display = ""; };
  const hide = (el) => { if (el) el.style.display = "none"; };

  const allBlocks = [
    generalSection, generalGrid,
    csSection, csGrid,
    isSection, isGrid,
    islamicSection, islamicGrid,
    managementSection, managementGrid
  ];

  if (category === "all") {
    allBlocks.forEach(show);
    return;
  }

  // Hide everything
  allBlocks.forEach(hide);

  // Always show main header section (generalSection holds it in your HTML)
  show(generalSection);

  // Show only selected grid (no extra headers under)
  if (category === "general") show(generalGrid);
  if (category === "cs") show(csGrid);
  if (category === "is") show(isGrid);
  if (category === "islamic") show(islamicGrid);
  if (category === "management") show(managementGrid);
}

/* =========================
   Course Card
========================= */
function countFiles(filesObj) {
  let count = 0;
  for (const folder of Object.values(filesObj || {})) {
    count += Object.keys(folder || {}).length;
  }
  return count;
}

function createCourseCard(course) {
  const card = document.createElement("div");
  card.className = "course-card";

  const code = String(course.code || "").trim().toUpperCase();
  const name = String(course.name || "").trim();
  const desc = String(course.description || "").trim();
  const filesCount = countFiles(course.files);

  card.innerHTML = `
    <div class="course-header">
      <div class="course-icon">${escapeHTML(code.replace(/\D/g, "") || code)}</div>
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
        </svg>
        <span>${filesCount} ملف</span>
      </div>
    </div>

    <div class="course-actions">
      <button class="browse-btn" onclick="openCourse('${escapeQuotes(code)}')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
        تصفح الملفات
      </button>
    </div>
  `;

  return card;
}

window.openCourse = function (code) {
  window.location.href = `course-files.html?code=${encodeURIComponent(code)}`;
};

/* =========================
   Search
========================= */
function handleSearch() {
  applyFiltersAndRender();
}

/* =========================
   Category Filter (Dropdown)
========================= */
function initCategoryFilter() {
  const categoryBtn = document.getElementById("categoryDropdownBtn");
  const categoryMenu = document.getElementById("categoryDropdownMenu");
  const categoryText = document.getElementById("selectedCategoryText");
  const filterOptions = document.querySelectorAll(".filter-option");

  if (!categoryBtn || !categoryMenu) return;

  categoryBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    categoryBtn.classList.toggle("open");
    categoryMenu.classList.toggle("show");
  });

  document.addEventListener("click", () => {
    categoryBtn.classList.remove("open");
    categoryMenu.classList.remove("show");
  });

  filterOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const category = option.dataset.category;

      CURRENT_CATEGORY = category || "all";

      // button text
      if (categoryText) categoryText.textContent = option.textContent;

      // active state
      filterOptions.forEach((opt) => opt.classList.remove("active"));
      option.classList.add("active");

      // close dropdown
      categoryBtn.classList.remove("open");
      categoryMenu.classList.remove("show");

      applyFiltersAndRender();
    });
  });
}

/* =========================
   Utils
========================= */
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
