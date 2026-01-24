// FILE: teachers.js
import { rtdb } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const elGrid = document.getElementById("teachersGrid");
const elEmpty = document.getElementById("teachersEmpty");
const elCount = document.getElementById("teachersCount");
const elSearch = document.getElementById("teacherSearch");

let ALL = [];
let currentDept = "";

document.addEventListener("DOMContentLoaded", async () => {
    await loadTeachers();

    elSearch?.addEventListener("input", render);

    // Nav toggle
    const navToggle = document.getElementById("navToggle");
    const navMenu = document.querySelector(".nav-menu");
    if (navToggle && navMenu) {
        navToggle.addEventListener("click", () => navMenu.classList.toggle("open"));
        navMenu.querySelectorAll("a").forEach((a) =>
            a.addEventListener("click", () => navMenu.classList.remove("open"))
        );
    }

    // Initialize dropdown
    initDeptDropdown();
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
    const deptMenu = document.getElementById("deptDropdownMenu");
    if (!deptMenu) return;

    const depts = Array.from(
        new Set(list.map((t) => (t.dept || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "ar"));

    // Build dropdown menu
    deptMenu.innerHTML = `<button class="filter-option active" data-dept="">كل الأقسام</button>` +
        depts.map((d) => `<button class="filter-option" data-dept="${escapeHtml(d)}">${escapeHtml(d)}</button>`).join("");

    // Add click handlers
    deptMenu.querySelectorAll(".filter-option").forEach(option => {
        option.addEventListener("click", () => {
            const dept = option.dataset.dept;
            currentDept = dept;

            // Update button text
            const deptText = document.getElementById("selectedDeptText");
            if (deptText) deptText.textContent = option.textContent;

            // Update active state
            deptMenu.querySelectorAll(".filter-option").forEach(opt => opt.classList.remove("active"));
            option.classList.add("active");

            // Update section title
            const sectionTitle = document.getElementById("currentDeptTitle");
            const sectionSubtitle = document.getElementById("currentDeptSubtitle");
            
            if (dept) {
                if (sectionTitle) sectionTitle.textContent = dept;
                if (sectionSubtitle) sectionSubtitle.textContent = `أعضاء هيئة التدريس في ${dept}`;
            } else {
                if (sectionTitle) sectionTitle.textContent = "جميع الأساتذة";
                if (sectionSubtitle) sectionSubtitle.textContent = "أعضاء هيئة التدريس في الكلية";
            }

            // Close dropdown
            const deptBtn = document.getElementById("deptDropdownBtn");
            deptBtn?.classList.remove("open");
            deptMenu.classList.remove("show");

            // Re-render
            render();
        });
    });
}

function initDeptDropdown() {
    const deptBtn = document.getElementById("deptDropdownBtn");
    const deptMenu = document.getElementById("deptDropdownMenu");

    if (!deptBtn || !deptMenu) return;

    // Toggle dropdown
    deptBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deptBtn.classList.toggle("open");
        deptMenu.classList.toggle("show");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", () => {
        deptBtn.classList.remove("open");
        deptMenu.classList.remove("show");
    });

    // Prevent menu clicks from closing
    deptMenu.addEventListener("click", (e) => {
        e.stopPropagation();
    });
}

function render() {
    const q = (elSearch?.value || "").trim().toLowerCase();

    const filtered = ALL.filter((t) => {
        if (currentDept && (t.dept || "").trim() !== currentDept) return false;

        const hay = [t.name, t.dept, t.email, t.office, t.phone, t.officeHours]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return !q || hay.includes(q);
    });

    if (elCount) elCount.textContent = `${filtered.length} أستاذ`;

    if (!filtered.length) {
        if (elGrid) elGrid.innerHTML = "";
        if (elEmpty) elEmpty.style.display = "block";
        return;
    }

    if (elEmpty) elEmpty.style.display = "none";
    if (elGrid) elGrid.innerHTML = filtered.map(cardHtml).join("");
}

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

    const officeHoursHtml = officeHours
        ? `<div class="meta-row"><span class="meta-icon">🕒</span> <b>الساعات المكتبية:</b> ${escapeHtml(officeHours).replace(/\n/g, "<br>")}</div>`
        : `<div class="meta-row" style="opacity:.75;"><span class="meta-icon">🕒</span> <b>الساعات المكتبية:</b> غير مضافة</div>`;

    return `
        <div class="teacher-card">
            <div class="teacher-head">
                <div class="teacher-avatar">
                    ${photo
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
                <div class="meta-row"><span class="meta-icon">📧</span> <b>${escapeHtml(email || "—")}</b></div>
                <div class="meta-row"><span class="meta-icon">🏢</span> <b>مكتب:</b> ${escapeHtml(office)}</div>
                <div class="meta-row"><span class="meta-icon">📞</span> <b>رقم:</b> ${escapeHtml(phone)}</div>
                ${officeHoursHtml}
            </div>

            <div class="teacher-actions">
                ${email
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