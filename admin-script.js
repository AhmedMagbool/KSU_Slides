// FILE: admin-script.js
import { rtdb, storage } from "./firebase-config.js";
import { ref, get, set, push } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const ADMIN_PASSWORD = "445170340";

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
  sessionStorage.removeItem("adminLoggedIn");
  localStorage.removeItem("adminLoggedIn");
}

window.addEventListener("pagehide", forceLogout);

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
    initAdmin();
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
        storagePath: f.storagePath || "",
        downloadURL: f.downloadURL || "",
        urlDownload: f.urlDownload || "",
        urlView: f.urlView || "",
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
========================= */
let COURSES_INDEX = {};

async function ensureCoursesIndex() {
  const idxSnap = await get(ref(rtdb, "coursesIndex"));
  if (idxSnap.exists()) {
    COURSES_INDEX = idxSnap.val() || {};
    return;
  }

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

  showAlert("تم بناء فهرس المواد (coursesIndex) بنجاح", "success");
}

/* =========================
   COURSES (ADMIN UI)
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
              <span>${escapeHtml(categoryNames[course.category] || course.category)}</span>
              <span>-</span>
              <span>${filesCount} ملف</span>
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
              <button class="btn-icon" onclick="adminPreviewFile('${code}','${folderKey}','${f.fileId}')" title="تصفح">
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

              <button class="btn-icon delete" onclick="deleteCourseFile('${code}','${folderKey}','${f.fileId}','${escapeHtml(f.storagePath || "")}')" title="حذف الملف">
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
            ${escapeHtml(folderTitle(folderKey))}
          </div>
          <div style="display:grid; gap:.5rem;">
            ${rows}
          </div>
        </div>
      `;
    })
    .join("");
}

function getFileDownloadURL(code, folderKey, fileId) {
  const file = COURSES_INDEX?.[code]?.files?.[folderKey]?.[fileId];
  return file?.downloadURL || file?.urlDownload || null;
}

window.adminPreviewFile = async function adminPreviewFile(code, folderKey, fileId) {
  const file = COURSES_INDEX?.[code]?.files?.[folderKey]?.[fileId];
  const url = file?.urlView || file?.downloadURL || file?.urlDownload;
  if (!url) return alert("الملف غير متوفر حالياً");

  window.open(url, "_blank");
};

window.adminDownloadFile = async function adminDownloadFile(code, folderKey, fileId, name) {
  const url = getFileDownloadURL(code, folderKey, fileId);
  if (!url) return alert("الملف غير متوفر حالياً");

  const link = document.createElement("a");
  link.href = url;
  link.download = name || "file";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.deleteCourseFile = async function deleteCourseFile(code, folderKey, fileId, storagePath) {
  if (!confirm("متأكد تبغى تحذف هذا الملف؟")) return;

  try {
    if (storagePath) {
      try {
        const fileRef = storageRef(storage, storagePath);
        await deleteObject(fileRef);
      } catch (storageErr) {
        console.warn("Storage delete warning:", storageErr);
      }
    }

    await set(ref(rtdb, `courses/${code}/files/${folderKey}/${fileId}`), null);
    await set(ref(rtdb, `coursesIndex/${code}/files/${folderKey}/${fileId}`), null);

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
  if (!confirm(`هل أنت متأكد من حذف المادة ${code}؟ سيتم حذف كل الملفات أيضاً.`)) return;

  try {
    const course = COURSES_INDEX?.[code];
    if (course?.files) {
      for (const [folderKey, folderFiles] of Object.entries(course.files)) {
        for (const [fileId, file] of Object.entries(folderFiles || {})) {
          if (file.storagePath) {
            try {
              const fileRef = storageRef(storage, file.storagePath);
              await deleteObject(fileRef);
            } catch (e) {
              console.warn("Storage delete warning:", e);
            }
          }
        }
      }
    }

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

/* =========================
   رفع الملفات إلى Firebase Storage
========================= */
document.getElementById("addFilesForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const courseCode = document.getElementById("selectCourse").value;
  const folder = document.getElementById("fileFolder").value;
  const fileInput = document.getElementById("fileUpload");
  const files = Array.from(fileInput.files || []);

  if (!courseCode) return showAlert("يرجى اختيار المادة!", "error");
  if (!folder) return showAlert("يرجى اختيار القسم!", "error");
  if (!files.length) return showAlert("يرجى اختيار ملف/ملفات!", "error");

  const tooBig = files.filter((f) => f.size > 50 * 1024 * 1024);
  if (tooBig.length) {
    showAlert(`فيه ملفات أكبر من 50MB وما راح تنرفع: ${tooBig.map((f) => f.name).join("، ")}`, "error");
    return;
  }

  const total = files.length;
  showAlert(`بدأ رفع ${total} ملف... لا تقفل الصفحة`, "success");

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
      else if (["xls", "xlsx"].includes(ext)) fileType = "xls";
      else if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) fileType = "img";
      else if (["zip", "rar", "7z"].includes(ext)) fileType = "zip";

      const folderRef = ref(rtdb, `courses/${courseCode}/files/${folder}`);
      const newFileRef = push(folderRef);
      const fileId = newFileRef.key;

      const storagePath = `courses/${courseCode}/${folder}/${fileId}_${fileName}`;
      const fileStorageRef = storageRef(storage, storagePath);

      const uploadResult = await uploadBytes(fileStorageRef, file);
      const downloadURL = await getDownloadURL(uploadResult.ref);

      const full = {
        id: fileId,
        name: fileName,
        size: fileSize,
        type: fileType,
        storagePath: storagePath,
        downloadURL: downloadURL,
        uploadedAt: Date.now(),
      };

      await set(newFileRef, full);

      const meta = {
        id: full.id,
        name: full.name,
        size: full.size,
        type: full.type,
        storagePath: full.storagePath,
        downloadURL: full.downloadURL,
        uploadedAt: full.uploadedAt,
      };
      await set(ref(rtdb, `coursesIndex/${courseCode}/files/${folder}/${fileId}`), meta);

      uploaded++;
      document.getElementById("fileUploadText").textContent = `تم رفع ${uploaded}/${total}...`;
      await new Promise((r) => setTimeout(r, 0));
    }

    showAlert(`تم رفع ${uploaded} ملف بنجاح`, "success");

    document.getElementById("addFilesForm").reset();
    document.getElementById("fileUploadText").textContent = "اختر ملف/ملفات للرفع";
    document.querySelector(".file-upload-label")?.classList.remove("has-file");

    await loadCourses();
  } catch (err) {
    console.error(err);
    showAlert("فشل رفع بعض الملفات. حاول مرة ثانية.", "error");
  }
});

/* =========================
   استيراد JSON
========================= */
window.importCoursesFromJSON = async function importCoursesFromJSON() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      showAlert("جاري قراءة الملف...", "success");

      const text = await file.text();
      const data = JSON.parse(text);

      const coursesCodes = Object.keys(data);
      const total = coursesCodes.length;

      if (!total) {
        showAlert("الملف فارغ!", "error");
        return;
      }

      if (!confirm(`سيتم استيراد ${total} مادة. متأكد؟`)) return;

      showAlert(`جاري استيراد ${total} مادة... لا تقفل الصفحة`, "success");

      let imported = 0;

      for (const [code, course] of Object.entries(data)) {
        const cleanedFiles = {};

        if (course.files) {
          for (const [folderKey, folderFiles] of Object.entries(course.files)) {
            cleanedFiles[folderKey] = {};

            for (const [fileId, file] of Object.entries(folderFiles || {})) {
              if (file.urlDownload || file.downloadURL) {
                cleanedFiles[folderKey][fileId] = {
                  id: file.id || fileId,
                  name: file.name || "",
                  size: file.size || "",
                  type: file.type || "file",
                  mimeType: file.mimeType || "",
                  uploadedAt: file.uploadedAt || Date.now(),
                  urlDownload: file.urlDownload || "",
                  urlView: file.urlView || "",
                  downloadURL: file.downloadURL || "",
                };
              }
            }

            if (Object.keys(cleanedFiles[folderKey]).length === 0) {
              delete cleanedFiles[folderKey];
            }
          }
        }

        const courseData = {
          code: course.code || code,
          name: course.name || "",
          description: course.description || "",
          category: course.category || "general",
          files: cleanedFiles,
        };

        await set(ref(rtdb, `courses/${code}`), courseData);
        await set(ref(rtdb, `coursesIndex/${code}`), courseData);

        imported++;
      }

      showAlert(`تم استيراد ${imported} مادة بنجاح!`, "success");
      await loadCourses();
    } catch (err) {
      console.error("Import error:", err);
      showAlert(`فشل الاستيراد: ${err.message}`, "error");
    }
  };

  input.click();
};

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
   TEACHERS
========================= */
const teacherForm = document.getElementById("teacherForm");
const teacherId = document.getElementById("teacherId");
const teacherName = document.getElementById("teacherName");
const teacherDept = document.getElementById("teacherDept");
const teacherRating = document.getElementById("teacherRating");
const teacherEmail = document.getElementById("teacherEmail");
const teacherOffice = document.getElementById("teacherOffice");
const teacherPhone = document.getElementById("teacherPhone");
const teacherOfficeHours = document.getElementById("teacherOfficeHours");
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
            <span>${escapeHtml(t.email || "—")}</span>
            <span>-</span>
            <span>${escapeHtml(t.office || "—")}</span>
            <span>-</span>
            <span>التقييم: ${t.ratingPercent ? t.ratingPercent + "%" : "غير محدد"}</span>
            <span>-</span>
            <span>الساعات: ${escapeHtml(t.officeHours || "غير محددة")}</span>
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
  teacherRating.value = t.ratingPercent || "";
  teacherEmail.value = t.email || "";
  teacherOffice.value = t.office || "";
  teacherPhone.value = t.phone || "";
  teacherOfficeHours.value = t.officeHours || "";
  teacherPhotoUrl.value = t.photo || "";

  teacherSubmitBtn.textContent = "تحديث بيانات الدكتور";
  teacherCancelEdit.style.display = "inline-flex";
};

teacherCancelEdit.addEventListener("click", () => resetTeacherForm());

function resetTeacherForm() {
  teacherId.value = "";
  teacherForm.reset();
  if (teacherPhotoText) teacherPhotoText.textContent = "اختر صورة للرفع";
  if (teacherOfficeHours) teacherOfficeHours.value = "";
  if (teacherRating) teacherRating.value = "";
  teacherSubmitBtn.textContent = "إضافة الدكتور";
  teacherCancelEdit.style.display = "none";
}

window.deleteTeacher = async function deleteTeacher(id) {
  if (!confirm("هل أنت متأكد من حذف هذا الأستاذ؟")) return;

  try {
    const teacher = TEACHERS_CACHE?.[id];
    if (teacher?.photoStoragePath) {
      try {
        const photoRef = storageRef(storage, teacher.photoStoragePath);
        await deleteObject(photoRef);
      } catch (e) {
        console.warn("Photo delete warning:", e);
      }
    }

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
  const ratingValue = parseInt(teacherRating.value.trim()) || 0;
  
  const payload = {
    name: teacherName.value.trim(),
    dept: teacherDept.value.trim(),
    email: teacherEmail.value.trim(),
    office: teacherOffice.value.trim(),
    phone: teacherPhone.value.trim(),
    officeHours: teacherOfficeHours.value.trim(),
    ratingPercent: Math.min(100, Math.max(0, ratingValue)),
    photo: teacherPhotoUrl.value.trim(),
  };

  if (!payload.name || !payload.dept || !payload.email || !payload.office || !payload.phone) {
    showAlert("أكمل بيانات الأستاذ المطلوبة.", "error");
    return;
  }

  const file = teacherPhotoFile?.files?.[0];
  if (file) {
    if (file.size > 2 * 1024 * 1024) {
      showAlert("الصورة كبيرة. خلك تحت 2MB.", "error");
      return;
    }

    try {
      const photoId = id || push(ref(rtdb, "teachers")).key;
      const photoPath = `teachers/${photoId}_${file.name}`;
      const photoStorageRef = storageRef(storage, photoPath);

      const uploadResult = await uploadBytes(photoStorageRef, file);
      payload.photo = await getDownloadURL(uploadResult.ref);
      payload.photoStoragePath = photoPath;
    } catch (uploadErr) {
      console.error(uploadErr);
      showAlert("فشل رفع الصورة!", "error");
      return;
    }
  }

  try {
    if (id) {
      await set(ref(rtdb, `teachers/${id}`), {
        ...payload,
        updatedAt: Date.now(),
        createdAt: TEACHERS_CACHE?.[id]?.createdAt || Date.now(),
        photoStoragePath: payload.photoStoragePath || TEACHERS_CACHE?.[id]?.photoStoragePath || "",
      });
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