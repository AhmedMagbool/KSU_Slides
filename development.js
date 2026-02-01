import { rtdb } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

let currentTrack = "general";

// Track tabs handling
document.querySelectorAll(".track-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".track-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".track-content").forEach(c => c.classList.remove("active"));
    
    tab.classList.add("active");
    currentTrack = tab.dataset.track;
    document.getElementById(`track-${currentTrack}`).classList.add("active");
  });
});

document.querySelectorAll(".track-tab").forEach(t => t.classList.remove("active"));
document.querySelectorAll(".track-content").forEach(c => c.classList.remove("active"));

document.querySelector('.track-tab[data-track="general"]')?.classList.add("active");
document.getElementById("track-general")?.classList.add("active");


async function loadCourses() {
  try {
    const tracks = ["cs", "is", "general","cyber","AI"];
    
    for (const track of tracks) {
      const trackRef = ref(rtdb, `developmentCourses/${track}`);
      const snapshot = await get(trackRef);
      const data = snapshot.val();
      
      const container = document.getElementById(`track-${track}`);
      
      if (!data) {
        container.innerHTML = `
          <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p>لا توجد دورات متاحة لهذا التخصص حالياً</p>
          </div>
        `;
        continue;
      }
      
      // بداية من المستوى الثالث (3-8)
      
      
   
let html = "";

// ✅ مسارات بدون مستويات (cyber/AI)
if (track === "cyber" || track === "AI") {
  const coursesArray = data.all; // هنا التخزين الجديد

  if (Array.isArray(coursesArray) && coursesArray.length) {
    html = `
      <div class="level-section">
        <div class="level-header">
          <h2>الدورات المقترحة</h2>
          <span class="level-badge">${coursesArray.length} ${coursesArray.length === 1 ? "دورة" : "دورات"}</span>
        </div>
        <div class="courses-grid">
          ${coursesArray.map(course => renderCourseCard(course)).join("")}
        </div>
      </div>
    `;
  }

  container.innerHTML = html || `
    <div class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <p>لا توجد دورات متاحة لهذا التخصص حالياً</p>
    </div>
  `;
  continue; // مهم عشان ما يكمل على مستويات 3..8
}

// ✅ باقي التخصصات بمستويات 3..8
const levels = [3, 4, 5, 6, 7, 8];

for (const level of levels) {
  const coursesArray = data[level];
  if (!coursesArray || !Array.isArray(coursesArray) || coursesArray.length === 0) continue;

  html += `
    <div class="level-section">
      <div class="level-header">
        <h2>المستوى ${getLevelName(level)}</h2>
        <span class="level-badge">${coursesArray.length} ${coursesArray.length === 1 ? 'دورة' : 'دورات'}</span>
      </div>
      <div class="courses-grid">
        ${coursesArray.map(course => renderCourseCard(course)).join("")}
      </div>
    </div>
  `;
}

container.innerHTML = html || `
  <div class="empty-state">
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
    <p>لا توجد دورات متاحة لهذا التخصص حالياً</p>
  </div>
`;


    }
  } catch (error) {
    console.error("Error loading courses:", error);
  }
}

function getLevelName(level) {
  const levelNames = {
    3: "الثالث",
    4: "الرابع", 
    5: "الخامس",
    6: "السادس",
    7: "السابع",
    8: "الثامن"
  };
  return levelNames[level] || level;
}

function renderCourseCard(course) {
  const relatedCourses = course.relatedCourses 
    ? course.relatedCourses.split(',').map(c => c.trim()).filter(Boolean)
    : [];
  
  return `
    <div class="course-card">
      <div class="course-header">
        <h3>${escapeHtml(course.title || "دورة تدريبية")}</h3>
        ${course.platform ? `<span class="course-platform">${escapeHtml(course.platform)}</span>` : ''}
      </div>
      ${course.description ? `<p class="course-description">${escapeHtml(course.description)}</p>` : ''}
      ${relatedCourses.length ? `
        <div class="course-related">
          <span class="related-label">مفيدة في:</span>
          <div class="related-tags">
            ${relatedCourses.map(c => `<span class="tag">${escapeHtml(c)}</span>`).join("")}
          </div>
        </div>
      ` : ""}
      ${course.url ? `
        <a href="${escapeHtml(course.url)}" target="_blank" rel="noopener noreferrer" class="course-link">
          <span>عرض الدورة</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      ` : ""}
    </div>
  `;
}

function convertToArabicNumber(num) {
  const arabicNumbers = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(num).split("").map(d => arabicNumbers[parseInt(d)] || d).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

loadCourses();

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
