// FILE: teachers.js
import { rtdb } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const elGrid = document.getElementById("teachersGrid");
const elEmpty = document.getElementById("teachersEmpty");
const elCount = document.getElementById("teachersCount");
const elSearch = document.getElementById("teacherSearch");
const elDept = document.getElementById("deptFilter");

let ALL = [];

/* Cache */
const CACHE_PREFIX = "ucache:";
function cacheGet(key, maxAgeMs) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
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
  const cached = cacheGet("teachers", 30 * 60 * 1000); // 30 min
  if (cached) {
    ALL = cached;
    buildDeptFilter(ALL);
    render();
  }

  await loadTeachers();

  elSearch?.addEventListener("input", render);
  elDept?.addEventListener("change", render);

  // nav
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.querySelector(".nav-menu");
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => navMenu.classList.toggle("open"));
    navMenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => navMenu.classList.remove("open")));
  }
});

async function loadTeachers() {
  try {
    const snap = await get(ref(rtdb, "teachers"));
    const obj = snap.exists() ? snap.val() : {};
    ALL = Object.entries(obj).map(([id, t]) => ({ id, ...t }));
    cacheSet("teachers", ALL);

    buildDeptFilter(ALL);
    render();
  } catch (e) {
    console.error("loadTeachers error:", e);
  }
}

function buildDeptFilter(list) {
  const depts = Array.from(new Set(list.map((t) => (t.dept || "").trim()).filter(Boolean))).sort();
  elDept.innerHTML = `<option value="">كل الأقسام</option>` + depts.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
}

function render() {
  const q = (elSearch.value || "").trim().toLowerCase();
  const dept = (elDept.value || "").trim();

  const filtered = ALL.filter((t) => {
    if (dept && (t.dept || "").trim() !== dept) return false;

    const hay = [t.name, t.dept, t.email, t.office, t.phone].filter(Boolean).join(" ").toLowerCase();
    return !q || hay.includes(q);
  });

  elCount.textContent = `${filtered.length} أستاذ`;

  if (!filtered.length) {
    elGrid.innerHTML = "";
    elEmpty.style.display = "block";
    return;
  }

  elEmpty.style.display = "none";
  elGrid.innerHTML = filtered.map(cardHtml).join("");
}

function cardHtml(t) {
  const initials = getInitials(t.name || "دكتور");
  const photo = (t.photo || "").trim();

  const email = (t.email || "").trim();
  const dept = (t.dept || "—").trim();
  const office = (t.office || "—").trim();
  const phone = (t.phone || "—").trim();

  return `
    <div class="teacher-card">
      <div class="teacher-head">
        <div class="teacher-avatar">
          ${photo ? `<img src="${escapeAttr(photo)}" alt="${escapeAttr(t.name || "")}"/>` : `<span>${escapeHtml(initials)}</span>`}
        </div>

        <div>
          <p class="teacher-name">${escapeHtml(t.name || "—")}</p>
          <div class="teacher-dept">${escapeHtml(dept)}</div>
        </div>
      </div>

      <div class="teacher-meta">
        <div class="meta-row">📧 <b>${escapeHtml(email || "—")}</b></div>
        <div class="meta-row">🏢 <b>مكتب:</b> ${escapeHtml(office)}</div>
        <div class="meta-row">📞 <b>رقم:</b> ${escapeHtml(phone)}</div>
      </div>

      <div class="teacher-actions">
        ${email ? `<a class="btn-email" href="mailto:${escapeAttr(email)}">إرسال بريد</a>` : `<a class="btn-email" href="#" onclick="return false;" style="opacity:.6; cursor:not-allowed;">إرسال بريد</a>`}
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

function getInitials(name) {
  const s = (name || "").trim();
  if (!s) return "د";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
