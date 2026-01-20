// FILE: script.js
import { rtdb } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

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
  if (cached) renderCourses(cached);

  await loadCourses();

  document.getElementById("searchBtn")?.addEventListener("click", handleSearch);
  document.getElementById("searchInput")?.addEventListener("keyup", (e) => e.key === "Enter" && handleSearch());

  const navToggle = document.getElementById("navToggle");
  const navMenu = document.querySelector(".nav-menu");
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => navMenu.classList.toggle("open"));
    navMenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => navMenu.classList.remove("open")));
  }
});

async function loadCourses() {
  try {
    let snap = await get(ref(rtdb, "coursesIndex"));
    let coursesData = {};
    
    if (snap.exists()) {
      coursesData = snap.val();
    } else {
      snap = await get(ref(rtdb, "courses"));
      if (snap.exists()) {
        coursesData = snap.val();
      }
    }
    
    cacheSet("coursesIndex", coursesData);
    renderCourses(coursesData);
    
  } catch (err) {
    console.error("Error loading courses:", err);
  }
}

/* =========================
   Render
========================= */
function renderCourses(coursesObj) {
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

  const arr = Object.values(coursesObj || {});
  if (!arr.length) return;

  arr.forEach((course) => {
    const card = createCourseCard(course);
    
    if (course.category === "general" && generalGrid) generalGrid.appendChild(card);
    else if (course.category === "cs" && csGrid) csGrid.appendChild(card);
    else if (course.category === "is" && isGrid) isGrid.appendChild(card);
    else if (course.category === "islamic" && islamicGrid) islamicGrid.appendChild(card);
    else if (course.category === "management" && managementGrid) managementGrid.appendChild(card);
    else if (generalGrid) generalGrid.appendChild(card);
  });
}

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

function handleSearch() {
  const query = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();
  const allCards = Array.from(document.querySelectorAll(".course-card"));
  allCards.forEach((c) => c.classList.remove("search-hit"));

  if (!query) {
    allCards.forEach((c) => (c.style.display = ""));
    return;
  }

  const matches = [];
  allCards.forEach((card) => {
    const name = (card.querySelector(".course-name")?.textContent || "").toLowerCase();
    const code = (card.querySelector(".course-code")?.textContent || "").toLowerCase();
    const isMatch = name.includes(query) || code.includes(query);
    card.style.display = isMatch ? "" : "none";
    if (isMatch) matches.push(card);
  });

  if (!matches.length) return;

  const first = matches[0];
  first.classList.add("search-hit");
  const y = first.getBoundingClientRect().top + window.pageYOffset;
  window.scrollTo({ top: y - 120, behavior: "smooth" });
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