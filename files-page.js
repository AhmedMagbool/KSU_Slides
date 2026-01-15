// FILE: files-page.js (FASTER: chunked render + per-folder "show more")
import { rtdb } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

/* =========================
   Tiny Cache
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
   Render tuning
========================= */
const PAGE_SIZE = 30;      // how many files to show initially per folder
const CHUNK_SIZE = 20;     // how many DOM items per frame (smooth UI)

/* =========================
   Init
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const code = (params.get("code") || "").toUpperCase().trim();

  if (!code) {
    window.location.href = "index.html";
    return;
  }

  // fast cached header (if exists)
  const cached = cacheGet(`courseIndex:${code}`, 10 * 60 * 1000);
  if (cached) applyCourseHeader(cached);

  // load lightweight index
  const idxSnap = await get(ref(rtdb, `coursesIndex/${code}`));
  if (idxSnap.exists()) {
    const courseIndex = idxSnap.val();
    cacheSet(`courseIndex:${code}`, courseIndex);

    applyCourseHeader(courseIndex);
    renderFilesByFolders(code, courseIndex.files || {});
  } else {
    // fallback (slow)
    const courseSnap = await get(ref(rtdb, `courses/${code}`));
    if (!courseSnap.exists()) {
      document.getElementById("filesList").innerHTML = "<p style='color:#fff'>المادة غير موجودة</p>";
      return;
    }

    const course = courseSnap.val();
    applyCourseHeader(course);

    const meta = stripData(course.files || {});
    renderFilesByFolders(code, meta);
  }

  // nav
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.querySelector(".nav-menu");
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => navMenu.classList.toggle("open"));
    navMenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => navMenu.classList.remove("open")));
  }
});

function applyCourseHeader(course) {
  document.getElementById("courseCode").textContent = course.code || "";
  document.getElementById("courseName").textContent = course.name || "";
  document.getElementById("courseDescription").textContent = course.description || "";
}

// convert old structure to meta-only
function stripData(filesObj) {
  const out = {};
  for (const [folderKey, folderFilesObj] of Object.entries(filesObj || {})) {
    out[folderKey] = {};
    for (const [fileId, f] of Object.entries(folderFilesObj || {})) {
      out[folderKey][fileId] = {
        id: f.id || fileId,
        name: f.name || "",
        size: f.size || "",
        type: f.type || "file",
        uploadedAt: f.uploadedAt || 0,
      };
    }
  }
  return out;
}

function renderFilesByFolders(courseCode, filesObj) {
  const filesList = document.getElementById("filesList");
  filesList.innerHTML = "";

  const folderNames = {
    lectures: "المحاضرات",
    exams: "الاختبارات",
    assignments: "الواجبات",
    notes: "الملخصات",
    other: "أخرى",
  };

  const folderKeys = Object.keys(folderNames);
  let hasAnyFiles = false;

  folderKeys.forEach((folderKey) => {
    const folder = filesObj[folderKey] || null;
    const folderEntries = folder ? Object.entries(folder) : [];
    if (!folderEntries.length) return;

    hasAnyFiles = true;

    // Sort once
    const list = folderEntries
      .map(([fileId, file]) => ({ fileId, ...file }))
      .sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));

    const section = document.createElement("div");
    section.className = "folder-section";
    section.style.marginBottom = "2rem";

    section.innerHTML = `
      <div class="folder-header" style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;padding-bottom:.75rem;border-bottom:2px solid var(--border);">
        <h3 style="font-size:1.25rem;font-weight:600;color:var(--text-primary);margin:0;">
          ${folderNames[folderKey]} <span style="color:var(--text-secondary);font-size:.9rem;">(${list.length})</span>
        </h3>
      </div>

      <div class="files-grid" style="display:grid;gap:.75rem;"></div>

      ${
        list.length > PAGE_SIZE
          ? `<button class="show-more-btn" data-folder="${escapeHTML(folderKey)}" style="
                margin-top:.75rem;
                background:transparent;
                border:1px solid var(--border);
                color:var(--text-secondary);
                padding:.6rem 1rem;
                border-radius:.75rem;
                cursor:pointer;
                font-family:inherit;
                font-weight:700;
              ">عرض المزيد</button>`
          : ""
      }
    `;

    const grid = section.querySelector(".files-grid");
    filesList.appendChild(section);

    // Render first page chunked (fast + smooth)
    const first = list.slice(0, PAGE_SIZE);
    renderChunked(grid, first, (file) => createFileItem(courseCode, folderKey, file.fileId, file));

    // Wire "show more"
    const btn = section.querySelector(".show-more-btn");
    if (btn) {
      let offset = PAGE_SIZE;
      btn.addEventListener("click", () => {
        const next = list.slice(offset, offset + PAGE_SIZE);
        offset += PAGE_SIZE;

        renderChunked(grid, next, (file) => createFileItem(courseCode, folderKey, file.fileId, file));

        if (offset >= list.length) btn.remove();
      });
    }
  });

  if (!hasAnyFiles) {
    filesList.innerHTML = `
      <div style="text-align:center;padding:3rem;color:var(--text-secondary);">
        <p style="font-size:1.1rem;">لا توجد ملفات متاحة حالياً</p>
        <p style="font-size:0.9rem;margin-top:.5rem;">يمكنك إضافة ملفات من لوحة الإدارة</p>
      </div>
    `;
  }
}

// Render many items without freezing the page
function renderChunked(container, items, renderItem) {
  let i = 0;

  function step() {
    const frag = document.createDocumentFragment();
    const end = Math.min(i + CHUNK_SIZE, items.length);

    for (; i < end; i++) {
      frag.appendChild(renderItem(items[i]));
    }

    container.appendChild(frag);

    if (i < items.length) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

function createFileItem(courseCode, folderKey, fileId, file) {
  const item = document.createElement("div");
  item.className = "file-item";

  const name = escapeHTML(file.name || "ملف");
  const size = escapeHTML(file.size || "");
  const type = String(file.type || "file").toUpperCase();

  item.innerHTML = `
    <div class="file-info">
      <div class="file-details">
        <div class="file-name">${name}</div>
        <div class="file-meta">
          <span>${size}</span>
          <span>•</span>
          <span>${escapeHTML(type)}</span>
        </div>
      </div>
    </div>

    <div class="file-actions">
      <button class="btn-icon" title="معاينة" onclick="previewFile('${escapeQuotes(courseCode)}','${escapeQuotes(folderKey)}','${escapeQuotes(fileId)}','${escapeQuotes(file.name || "")}')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </button>

      <button class="btn-icon btn-download" title="تحميل" onclick="downloadFile('${escapeQuotes(courseCode)}','${escapeQuotes(folderKey)}','${escapeQuotes(fileId)}','${escapeQuotes(file.name || "")}')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </button>
    </div>
  `;

  return item;
}

// Fetch only the file data when needed
async function fetchFileData(courseCode, folderKey, fileId) {
  const snap = await get(ref(rtdb, `courses/${courseCode}/files/${folderKey}/${fileId}/data`));
  return snap.exists() ? snap.val() : null;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isPhoneLike() {
  // تقريب: شاشة صغيرة = جوال
  return Math.min(window.innerWidth, window.innerHeight) <= 768;
}

function dataUrlByteSize(dataUrl) {
  // حساب تقريبي لحجم base64
  if (!dataUrl || !dataUrl.includes(",")) return 0;
  const b64 = dataUrl.split(",")[1] || "";
  const padding = (b64.match(/=*$/) || [""])[0].length;
  return Math.floor((b64.length * 3) / 4) - padding;
}

function mimeFromDataUrl(dataUrl) {
  const s = String(dataUrl || "");
  const i = s.indexOf(";");
  if (!s.startsWith("data:") || i === -1) return "";
  return s.slice(5, i);
}

async function shareOrSaveIOS(dataUrl, name) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const fileName = name || "file";
  const file = new File([blob], fileName, { type: blob.type });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: fileName });
    return true;
  }
  return false;
}

// ====== PREVIEW ======
window.previewFile = async function previewFile(dataUrl, name) {
  if (!dataUrl) return alert(`الملف غير متوفر: ${name}`);

  const mime = mimeFromDataUrl(dataUrl);
  const sizeBytes = dataUrlByteSize(dataUrl);

  // نعرض فقط PDF/Images. غيرها تحميل
  const canPreview = mime.includes("pdf") || mime.startsWith("image/");

  // Threshold للجوال (عدّلها لو تبغى)
  const HEAVY_PHONE_MB = 4.5; // فوق 4.5MB على الجوال: لا نعاين، نخليه تحميل
  const isHeavyForPhone = isPhoneLike() && (sizeBytes / (1024 * 1024)) >= HEAVY_PHONE_MB;

  // 1) iPad: عاين دائمًا (قدر الإمكان) بدون popup
  // 2) جوال + ثقيل: تحويل لتحميل/مشاركة
  if (!canPreview || isHeavyForPhone) {
    return window.downloadFile(dataUrl, name);
  }

  // فتح بنفس التبويب (بدون window.open) -> ما يطلب تفعيل popups
  window.location.href = dataUrl;
};

// ====== DOWNLOAD ======
window.downloadFile = async function downloadFile(dataUrl, name) {
  if (!dataUrl) return alert(`الملف غير متوفر: ${name}`);

  // iOS: الأفضل "Share" عشان يحفظ في Files
  if (isIOS()) {
    try {
      const ok = await shareOrSaveIOS(dataUrl, name);
      if (ok) return;
    } catch (e) {
      console.error(e);
    }
  }

  // fallback: افتح في نفس التبويب وخله ينزل من الـ viewer
  window.location.href = dataUrl;
};



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
