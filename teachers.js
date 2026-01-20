// FILE: teachers.js
import { rtdb } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const elGrid = document.getElementById("teachersGrid");
const elEmpty = document.getElementById("teachersEmpty");
const elCount = document.getElementById("teachersCount");
const elSearch = document.getElementById("teacherSearch");
const elDept = document.getElementById("deptFilter");

let ALL = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadTeachers();

  elSearch?.addEventListener("input", render);
  elDept?.addEventListener("change", render);

  // nav
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.querySelector(".nav-menu");
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => navMenu.classList.toggle("open"));
    navMenu.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => navMenu.classList.remove("open"))
    );
  }
});

async function loadTeachers() {
  try {
    const snap = await get(ref(rtdb, "teachers"));
    const obj = snap.exists() ? snap.val() : {};
    ALL = Object.entries(obj).map(([id, t]) => ({ id, ...(t || {}) }));

    buildDeptFilter(ALL);
    render();
  } catch (e) {
    console.error("loadTeachers error:", e);
  }
}

function buildDeptFilter(list) {
  const depts = Array.from(
    new Set(list.map((t) => (t.dept || "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "ar"));

  elDept.innerHTML =
    `<option value="">كل الأقسام</option>` +
    depts.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
}

function render() {
  const q = (elSearch.value || "").trim().toLowerCase();
  const dept = (elDept.value || "").trim();

  const filtered = ALL.filter((t) => {
    if (dept && (t.dept || "").trim() !== dept) return false;

    const hay = [t.name, t.dept, t.email, t.office, t.phone, t.officeHours]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return !q || hay.includes(q);
  });

  const withRate = filtered.filter((t) => Number(t.ratingPercent || 0) > 0).length;
  elCount.textContent = `${filtered.length} أستاذ `;

  if (!filtered.length) {
    elGrid.innerHTML = "";
    elEmpty.style.display = "block";
    return;
  }

  elEmpty.style.display = "none";
  elGrid.innerHTML = filtered.map(cardHtml).join("");
}

/* =========================
   Card
========================= */
function cardHtml(t) {
  const initials = getInitials(t.name || "دكتور");
  const photo = (t.photo || "").trim();

  const email = (t.email || "").trim();
  const dept = (t.dept || "—").trim();
  const office = (t.office || "—").trim();
  const phone = (t.phone || "—").trim();
  const officeHours = (t.officeHours || "").trim();

  const p = Number(t.ratingPercent || 0);
  const count = Number(t.ratingCount || 0);

  const rateBadge =
    p > 0
      ? `<span class="rate-badge">${Math.round(clamp(p, 0, 100))}%${count > 0 ? ` (${Math.max(0, Math.floor(count))})` : ""}</span>`
      : `<span class="rate-badge empty">—</span>`;

  // تصميم محسن للساعات المكتبية
  const officeHoursHtml = officeHours
    ? `<div class="office-hours-box">
        <div class="office-hours-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>الساعات المكتبية</span>
        </div>
        <div class="office-hours-content">${escapeHtml(officeHours).replace(/,/g, "<br>").replace(/\n/g, "<br>")}</div>
      </div>`
    : `<div class="office-hours-box empty">
        <div class="office-hours-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>الساعات المكتبية</span>
        </div>
        <div class="office-hours-content">غير مضافة</div>
      </div>`;

  return `
    <div class="teacher-card">
      <div class="teacher-head">
        <div class="teacher-avatar">
          ${
            photo
              ? `<img src="${escapeAttr(photo)}" alt="${escapeAttr(t.name || "")}"/>`
              : `<span>${escapeHtml(initials)}</span>`
          }
        </div>

        <div style="width:100%;">
          <div class="teacher-name-row">
            <p class="teacher-name">${escapeHtml(t.name || "—")}</p>
            ${rateBadge}
          </div>
          <div class="teacher-dept">${escapeHtml(dept)}</div>
        </div>
      </div>

      <div class="teacher-meta">
        <div class="meta-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span>${escapeHtml(email || "—")}</span>
        </div>
        <div class="meta-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>مكتب: ${escapeHtml(office)}</span>
        </div>
        <div class="meta-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          <span>رقم: ${escapeHtml(phone)}</span>
        </div>
      </div>

      ${officeHoursHtml}

      <div class="teacher-actions">
        ${
          email
            ? `<a class="btn-email" href="mailto:${escapeAttr(email)}">إرسال بريد</a>`
            : `<a class="btn-email" href="#" onclick="return false;" style="opacity:.6; cursor:not-allowed;">إرسال بريد</a>`
        }
        <button class="btn-copy" onclick="copyEmail('${escapeAttr(email)}')">نسخ البريد</button>
      </div>
    </div>
  `;
}

window.copyEmail = async function copyEmail(email) {
  if (!email) return;
  try {
    await navigator.clipboard.writeText(email);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = email;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getInitials(name) {
  const s = (name || "").trim();
  if (!s) return "د";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}