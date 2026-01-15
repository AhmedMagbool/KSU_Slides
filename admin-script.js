// FILE: admin-script.js
import { rtdb } from "./firebase-config.js";
import { ref, get, set, push } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

const ADMIN_PASSWORD = "445170340@1141064681";

/* =========================
   AUTH
========================= */
function checkAuth() {
  const isLoggedIn = sessionStorage.getItem("adminLoggedIn");
  if (isLoggedIn === "true") {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("adminPanel").style.display = "block";
  }
}
function forceLogout() {
  sessionStorage.removeItem("adminLoggedIn"); // إذا تستخدم sessionStorage
  localStorage.removeItem("adminLoggedIn");   // لو كنت تستخدم localStorage بالغلط
}

// أهم حدث: يشتغل عند مغادرة الصفحة حتى مع bfcache
window.addEventListener("pagehide", forceLogout);

// احتياط إضافي: لو المستخدم بدّل تبويب/طلع من الصفحة
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") forceLogout();
});


document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const password = document.getElementById("adminPassword").value;

  if (password === ADMIN_PASSWORD) {
    sessionStorage.setItem("adminLoggedIn", "true");
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("adminPanel").style.display = "block";
    initAdmin(); // init after login
  } else {
    alert("كلمة المرور غير صحيحة!");
    document.getElementById("adminPassword").value = "";
  }
});

window.logout = function logout() {
  sessionStorage.removeItem("adminLoggedIn");
  window.location.reload();
};

checkAuth();
if (sessionStorage.getItem("adminLoggedIn") === "true") initAdmin();

/* =========================
   UI HELPERS
========================= */
function showAlert(message, type = "success") {
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;

  const form = document.getElementById("addCourseForm");
  form.parentElement.insertBefore(alertDiv, form);

  setTimeout(() => alertDiv.remove(), 3000);
}

function formatFileSize(bytes) {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function countFiles(filesObj) {
  return Object.values(filesObj || {}).reduce((t, folderObj) => t + Object.keys(folderObj || {}).length, 0);
}

function folderTitle(key) {
  const map = {
    lectures: "المحاضرات",
    exams: "الاختبارات",
    assignments: "الواجبات",
    notes: "الملخصات",
    other: "أخرى",
  };
  return map[key] || key;
}

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

/* =========================
   FILE INPUT UI
========================= */
document.getElementById("fileUpload").addEventListener("change", (e) => {
  const files = Array.from(e.target.files || []);
  const text = files.length ? `تم اختيار ${files.length} ملف` : "اختر ملف/ملفات للرفع";
  document.getElementById("fileUploadText").textContent = text;

  const label = document.querySelector(".file-upload-label");
  if (files.length) label.classList.add("has-file");
  else label.classList.remove("has-file");
});


/* =========================
   COURSES INDEX (FAST)
   coursesIndex/{code} => {code,name,description,category,files:{folder:{fileId:{meta...}}}}
========================= */
let COURSES_INDEX = {};

async function ensureCoursesIndex() {
  const idxSnap = await get(ref(rtdb, "coursesIndex"));
  if (idxSnap.exists()) {
    COURSES_INDEX = idxSnap.val() || {};
    return;
  }

  // Build from old "courses" once (admin only)
  const slowSnap = await get(ref(rtdb, "courses"));
  const courses = slowSnap.exists() ? slowSnap.val() : {};

  const built = {};
  for (const [code, c] of Object.entries(courses || {})) {
    built[code] = {
      code: c.code || code,
      name: c.name || "",
      description: c.description || "",
      category: c.category || "",
      files: stripData(c.files || {}),
    };
  }

  await set(ref(rtdb, "coursesIndex"), built);
  COURSES_INDEX = built;

  showAlert("تم بناء فهرس المواد (coursesIndex) بنجاح ✅", "success");
}

/* =========================
   COURSES (ADMIN UI) - uses coursesIndex (fast)
========================= */
async function loadCourses() {
  const snap = await get(ref(rtdb, "coursesIndex"));
  COURSES_INDEX = snap.exists() ? snap.val() : {};

  const select = document.getElementById("selectCourse");
  select.innerHTML = '<option value="">اختر المادة</option>';

  Object.values(COURSES_INDEX).forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.code;
    opt.textContent = `${c.code} - ${c.name}`;
    select.appendChild(opt);
  });

  displayCourses(COURSES_INDEX);
}

function displayCourses(coursesObj) {
  const coursesList = document.getElementById("coursesList");
  const arr = Object.values(coursesObj || {});

  if (!arr.length) {
    coursesList.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">لا توجد مواد. قم بإضافة مادة جديدة!</p>';
    return;
  }

  const categoryNames = {
    general: "مواد الإعداد العام",
    cs: "مواد علوم الحاسب",
    is: "مواد نظم المعلومات",
    islamic: "مواد السلم",
    management: "مواد الادارة",

  };

  coursesList.innerHTML = arr
    .map((course) => {
      const filesCount = countFiles(course.files);

      return `
        <div class="course-item">
          <div class="course-item-info">
            <h3>${escapeHtml(course.code)} - ${escapeHtml(course.name)}</h3>
            <p>${escapeHtml(course.description || "لا يوجد وصف")}</p>

            <div class="course-item-meta">
              <span>📂 ${escapeHtml(categoryNames[course.category] || course.category)}</span>
              <span>•</span>
              <span>📄 ${filesCount} ملف</span>
            </div>

            <div id="filesPanel-${escapeHtml(course.code)}" class="files-section" style="display:none; margin-top: 1rem;">
              <h4 style="margin-bottom:.75rem;">ملفات المادة</h4>
              <div id="filesList-${escapeHtml(course.code)}"></div>
            </div>
          </div>

          <div class="course-item-actions">
            <button class="btn-icon" onclick="viewCourse('${escapeHtml(course.code)}')" title="عرض الملفات (صفحة)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>

            <button class="btn-icon" onclick="toggleCourseFiles('${escapeHtml(course.code)}')" title="إدارة الملفات">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"></path>
                <path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>

            <button class="btn-icon delete" onclick="deleteCourse('${escapeHtml(course.code)}')" title="حذف المادة">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6"></path>
                <path d="M14 11v6"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

window.toggleCourseFiles = function toggleCourseFiles(code) {
  const panel = document.getElementById(`filesPanel-${code}`);
  if (!panel) return;

  const isOpen = panel.style.display !== "none";
  panel.style.display = isOpen ? "none" : "block";

  if (!isOpen) renderCourseFilesInAdmin(code);
};

function renderCourseFilesInAdmin(code) {
  const course = COURSES_INDEX?.[code];
  const container = document.getElementById(`filesList-${code}`);
  if (!container) return;

  const filesObj = course?.files || {};
  const folders = Object.entries(filesObj);

  if (!folders.length || countFiles(filesObj) === 0) {
    container.innerHTML = `<p style="color:var(--text-secondary); padding:.5rem 0;">لا يوجد ملفات لهذه المادة.</p>`;
    return;
  }

  container.innerHTML = folders
    .map(([folderKey, folderFilesObj]) => {
      const filesArr = Object.entries(folderFilesObj || {}).map(([fileId, f]) => ({ fileId, ...f }));
      if (!filesArr.length) return "";

      const rows = filesArr
        .sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0))
        .map(
          (f) => `
          <div class="file-item">
            <div class="file-item-info">
              <div class="file-icon">${escapeHtml((f.type || "file").toUpperCase())}</div>
              <div>
                <div class="file-name">${escapeHtml(f.name || "ملف")}</div>
                <div class="file-size">${escapeHtml(f.size || "")}</div>
              </div>
            </div>

            <div class="course-item-actions" style="gap:.35rem;">
              <button class="btn-icon" onclick="adminPreviewFile('${code}','${folderKey}','${f.fileId}','${escapeHtml(f.name || "")}')" title="تصفح">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>

              <button class="btn-icon" onclick="adminDownloadFile('${code}','${folderKey}','${f.fileId}','${escapeHtml(f.name || "")}')" title="تحميل">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>

              <button class="btn-icon delete" onclick="deleteCourseFile('${code}','${folderKey}','${f.fileId}')" title="حذف الملف">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                  <path d="M10 11v6"></path>
                  <path d="M14 11v6"></path>
                </svg>
              </button>
            </div>
          </div>
        `
        )
        .join("");

      return `
        <div style="margin-bottom: 1rem;">
          <div style="color: var(--text-secondary); font-weight:700; margin-bottom:.5rem;">
            📁 ${escapeHtml(folderTitle(folderKey))}
          </div>
          <div style="display:grid; gap:.5rem;">
            ${rows}
          </div>
        </div>
      `;
    })
    .join("");
}

// data is fetched only when preview/download
async function fetchFileData(code, folderKey, fileId) {
  const snap = await get(ref(rtdb, `courses/${code}/files/${folderKey}/${fileId}/data`));
  return snap.exists() ? snap.val() : null;
}

window.adminPreviewFile = async function adminPreviewFile(code, folderKey, fileId, name) {
  const data = await fetchFileData(code, folderKey, fileId);
  if (!data) return alert("الملف غير متوفر حالياً");

  const w = window.open();
  w.document.write(`<iframe src="${data}" style="width:100%;height:100%;border:none;" title="${escapeHtml(name || "")}"></iframe>`);
};

window.adminDownloadFile = async function adminDownloadFile(code, folderKey, fileId, name) {
  const data = await fetchFileData(code, folderKey, fileId);
  if (!data) return alert("الملف غير متوفر حالياً");

  const link = document.createElement("a");
  link.href = data;
  link.download = name || "file";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.deleteCourseFile = async function deleteCourseFile(code, folderKey, fileId) {
  if (!confirm("متأكد تبغى تحذف هذا الملف؟")) return;

  try {
    // delete from real store
    await set(ref(rtdb, `courses/${code}/files/${folderKey}/${fileId}`), null);
    // delete from index
    await set(ref(rtdb, `coursesIndex/${code}/files/${folderKey}/${fileId}`), null);

    // update local
    if (COURSES_INDEX?.[code]?.files?.[folderKey]?.[fileId]) {
      delete COURSES_INDEX[code].files[folderKey][fileId];
    }

    showAlert("تم حذف الملف بنجاح!");
    renderCourseFilesInAdmin(code);
    displayCourses(COURSES_INDEX);
  } catch (err) {
    console.error(err);
    showAlert("فشل حذف الملف!", "error");
  }
};

window.deleteCourse = async function deleteCourse(code) {
  if (!confirm(`هل أنت متأكد من حذف المادة ${code}؟ سيتم حذف كل الملفات أيضًا.`)) return;

  try {
    await set(ref(rtdb, `courses/${code}`), null);
    await set(ref(rtdb, `coursesIndex/${code}`), null);

    showAlert(`تم حذف المادة ${code} بنجاح!`, "success");
    await loadCourses();
  } catch (err) {
    console.error(err);
    showAlert("حدث خطأ أثناء الحذف!", "error");
  }
};

window.viewCourse = function viewCourse(code) {
  window.location.href = `course-files.html?code=${encodeURIComponent(code)}`;
};

document.getElementById("addCourseForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const code = document.getElementById("courseCode").value.trim().toUpperCase();
  const name = document.getElementById("courseName").value.trim();
  const description = document.getElementById("courseDescription").value.trim();
  const category = document.getElementById("courseCategory").value;

  if (!code || !name || !category) {
    showAlert("أكمل البيانات المطلوبة.", "error");
    return;
  }

  try {
    const courseRef = ref(rtdb, `courses/${code}`);
    const snap = await get(courseRef);

    if (snap.exists()) {
      showAlert("المادة موجودة بالفعل!", "error");
      return;
    }

    const payload = { code, name, description, category };

    await set(courseRef, payload);
    await set(ref(rtdb, `coursesIndex/${code}`), { ...payload, files: {} });

    showAlert("تم إضافة المادة بنجاح!");
    e.target.reset();
    await loadCourses();
  } catch (err) {
    console.error(err);
    showAlert("فشل إضافة المادة!", "error");
  }
});

document.getElementById("addFilesForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const courseCode = document.getElementById("selectCourse").value;
  const folder = document.getElementById("fileFolder").value;
  const fileInput = document.getElementById("fileUpload");
  const files = Array.from(fileInput.files || []);

  if (!courseCode) return showAlert("يرجى اختيار المادة!", "error");
  if (!folder) return showAlert("يرجى اختيار القسم!", "error");
  if (!files.length) return showAlert("يرجى اختيار ملف/ملفات!", "error");

  // فلترة الملفات الكبيرة (كل ملف لحاله)
  const tooBig = files.filter(f => f.size > 5 * 1024 * 1024);
  if (tooBig.length) {
    showAlert(`فيه ملفات أكبر من 5MB وما راح تنرفع: ${tooBig.map(f => f.name).join("، ")}`, "error");
    return;
  }

  // UI
  const total = files.length;
  showAlert(`بدأ رفع ${total} ملف... لا تقفل الصفحة`, "success");

  // ارفع بالتسلسل عشان ما يعلق
  let uploaded = 0;

  try {
    for (const file of files) {
      const fileName = file.name;
      const fileSize = formatFileSize(file.size);
      const ext = fileName.split(".").pop().toLowerCase();

      let fileType = "file";
      if (ext === "pdf") fileType = "pdf";
      else if (["ppt", "pptx"].includes(ext)) fileType = "ppt";
      else if (["doc", "docx"].includes(ext)) fileType = "doc";

      const dataUrl = await readFileAsDataURL(file);

      const folderRef = ref(rtdb, `courses/${courseCode}/files/${folder}`);
      const newFileRef = push(folderRef);

      const full = {
        id: newFileRef.key,
        name: fileName,
        size: fileSize,
        type: fileType,
        data: dataUrl,
        uploadedAt: Date.now(),
      };

      // تخزين ثقيل
      await set(newFileRef, full);

      // تخزين خفيف في coursesIndex (بدون data)
      const meta = { id: full.id, name: full.name, size: full.size, type: full.type, uploadedAt: full.uploadedAt };
      await set(ref(rtdb, `coursesIndex/${courseCode}/files/${folder}/${full.id}`), meta);

      uploaded++;
      // تحديث نص صغير بدل spam alerts
      document.getElementById("fileUploadText").textContent = `تم رفع ${uploaded}/${total}...`;
      await new Promise(r => setTimeout(r, 0)); // يعطي المتصفح فرصة يتنفس
    }

    showAlert(`تم رفع ${uploaded} ملف بنجاح ✅`, "success");

    // reset
    document.getElementById("addFilesForm").reset();
    document.getElementById("fileUploadText").textContent = "اختر ملف/ملفات للرفع";
    document.querySelector(".file-upload-label")?.classList.remove("has-file");

    await loadCourses();
  } catch (err) {
    console.error(err);
    showAlert("فشل رفع بعض الملفات. حاول مرة ثانية.", "error");
  }
});


function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* =========================
   EXPORT COURSES (INDEX)
========================= */
window.exportData = async function exportData() {
  const snap = await get(ref(rtdb, "coursesIndex"));
  const data = snap.exists() ? snap.val() : {};
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "courses-index.json";
  link.click();

  URL.revokeObjectURL(url);
  showAlert("تم تصدير فهرس المواد بنجاح!");
};

/* =========================
   TEACHERS (unchanged logic)
========================= */
const teacherForm = document.getElementById("teacherForm");
const teacherId = document.getElementById("teacherId");
const teacherName = document.getElementById("teacherName");
const teacherDept = document.getElementById("teacherDept");
const teacherEmail = document.getElementById("teacherEmail");
const teacherOffice = document.getElementById("teacherOffice");
const teacherPhone = document.getElementById("teacherPhone");
const teacherPhotoUrl = document.getElementById("teacherPhotoUrl");
const teacherSubmitBtn = document.getElementById("teacherSubmitBtn");
const teacherCancelEdit = document.getElementById("teacherCancelEdit");
const teachersList = document.getElementById("teachersList");

const teacherPhotoFile = document.getElementById("teacherPhotoFile");
const teacherPhotoText = document.getElementById("teacherPhotoText");

let TEACHERS_CACHE = {};

teacherPhotoFile?.addEventListener("change", (e) => {
  teacherPhotoText.textContent = e.target.files[0]?.name || "اختر صورة للرفع";
});

async function loadTeachers() {
  const snap = await get(ref(rtdb, "teachers"));
  TEACHERS_CACHE = snap.exists() ? snap.val() : {};
  renderTeachersList(TEACHERS_CACHE);
}

function renderTeachersList(obj) {
  const arr = Object.entries(obj || {}).map(([id, t]) => ({ id, ...t }));

  if (!arr.length) {
    teachersList.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:1rem;">لا يوجد أساتذة حتى الآن.</p>';
    return;
  }

  teachersList.innerHTML = arr
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .map(
      (t) => `
      <div class="course-item">
        <div class="course-item-info">
          <h3>${escapeHtml(t.name || "—")}</h3>
          <p>${escapeHtml(t.dept || "—")}</p>
          <div class="course-item-meta">
            <span>📧 ${escapeHtml(t.email || "—")}</span>
            <span>•</span>
            <span>🏢 ${escapeHtml(t.office || "—")}</span>
          </div>
        </div>

        <div class="course-item-actions">
          <button class="btn-icon" onclick="editTeacher('${t.id}')" title="تعديل">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
            </svg>
          </button>

          <button class="btn-icon delete" onclick="deleteTeacher('${t.id}')" title="حذف">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
            </svg>
          </button>
        </div>
      </div>
    `
    )
    .join("");
}

window.editTeacher = function editTeacher(id) {
  const t = TEACHERS_CACHE?.[id];
  if (!t) return;

  teacherId.value = id;
  teacherName.value = t.name || "";
  teacherDept.value = t.dept || "";
  teacherEmail.value = t.email || "";
  teacherOffice.value = t.office || "";
  teacherPhone.value = t.phone || "";
  teacherPhotoUrl.value = t.photo || "";

  teacherSubmitBtn.textContent = "تحديث بيانات الدكتور";
  teacherCancelEdit.style.display = "inline-flex";
};

teacherCancelEdit.addEventListener("click", () => resetTeacherForm());

function resetTeacherForm() {
  teacherId.value = "";
  teacherForm.reset();
  if (teacherPhotoText) teacherPhotoText.textContent = "اختر صورة للرفع";
  teacherSubmitBtn.textContent = "إضافة الدكتور";
  teacherCancelEdit.style.display = "none";
}

window.deleteTeacher = async function deleteTeacher(id) {
  if (!confirm("هل أنت متأكد من حذف هذا الأستاذ؟")) return;

  try {
    await set(ref(rtdb, `teachers/${id}`), null);
    showAlert("تم حذف الأستاذ بنجاح!", "success");
    resetTeacherForm();
    loadTeachers();
  } catch (err) {
    console.error(err);
    showAlert("فشل حذف الأستاذ!", "error");
  }
};

teacherForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = teacherId.value.trim();
  const payload = {
    name: teacherName.value.trim(),
    dept: teacherDept.value.trim(),
    email: teacherEmail.value.trim(),
    office: teacherOffice.value.trim(),
    phone: teacherPhone.value.trim(),
    photo: teacherPhotoUrl.value.trim(),
  };

  if (!payload.name || !payload.dept || !payload.email || !payload.office || !payload.phone) {
    showAlert("أكمل بيانات الأستاذ المطلوبة.", "error");
    return;
  }

  const file = teacherPhotoFile?.files?.[0];
  if (file) {
    if (file.size > 300 * 1024) {
      showAlert("الصورة كبيرة. خلك تحت 300KB (بدون Storage).", "error");
      return;
    }
    payload.photo = await readFileAsDataURL(file);
  }

  try {
    if (id) {
      await set(ref(rtdb, `teachers/${id}`), { ...payload, updatedAt: Date.now(), createdAt: TEACHERS_CACHE?.[id]?.createdAt || Date.now() });
      showAlert("تم تحديث بيانات الأستاذ بنجاح!");
    } else {
      const newRef = push(ref(rtdb, "teachers"));
      await set(newRef, { ...payload, createdAt: Date.now(), updatedAt: Date.now() });
      showAlert("تم إضافة الأستاذ بنجاح!");
    }

    resetTeacherForm();
    loadTeachers();
  } catch (err) {
    console.error(err);
    showAlert("فشل حفظ بيانات الأستاذ!", "error");
  }
});

/* =========================
   INIT
========================= */
async function initAdmin() {
  await ensureCoursesIndex();
  await loadCourses();
  await loadTeachers();

  const navToggle = document.getElementById("navToggle");
  const navMenu = document.querySelector(".nav-menu");
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => navMenu.classList.toggle("open"));
    navMenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => navMenu.classList.remove("open")));
  }
}
