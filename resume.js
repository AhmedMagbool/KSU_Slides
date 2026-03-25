// ===== Translations =====
const translations = {
  ar: {
    personal: 'المعلومات الشخصية',
    name: 'الاسم الكامل',
    'job-title': 'المسمى الوظيفي',
    phone: 'رقم الجوال',
    email: 'البريد الإلكتروني',
    location: 'المدينة، الدولة',
    linkedin: 'رابط LinkedIn',
    summary: 'الملخص المهني',
    'summary-placeholder': 'اكتب ملخصاً موجزاً عن خبراتك ومهاراتك وأهدافك المهنية...',
    education: 'التعليم',
    experience: 'الخبرات العملية',
    skills: 'المهارات',
    'skills-placeholder': 'المهارات التقنية: Excel, PowerPoint, Word\nالمهارات الشخصية: القيادة، التواصل، العمل الجماعي',
    'skills-hint': 'أدخل كل فئة مهارات في سطر منفصل',
    languages: 'اللغات',
    certifications: 'الشهادات والإنجازات',
    download: 'تحميل PDF',
    // CV Preview (Arabic titles for Arabic CV)
    'cv-profile': 'الملخص المهني',
    'cv-education': 'التعليم',
    'cv-experience': 'الخبرات العملية',
    'cv-skills': 'المهارات',
    'cv-languages': 'اللغات',
    'cv-certifications': 'الشهادات',
    // Form placeholders
    'edu-degree': 'الدرجة العلمية (مثال: بكالوريوس)',
    'edu-field': 'التخصص (مثال: علوم الحاسب)',
    'edu-university': 'اسم الجامعة',
    'edu-year': 'سنة التخرج',
    'exp-title': 'المسمى الوظيفي (مثال: مدير تسويق)',
    'exp-company': 'اسم الشركة',
    'exp-date': 'فترة العمل (مثال: 01/2022 - 12/2024)',
    'exp-desc': 'الإنجازات والمسؤوليات (كل واحد في سطر جديد، استخدم أفعال قوية)\n- زيادة المبيعات بنسبة 25% من خلال...\n- إدارة فريق من 5 أشخاص...\n- تطوير استراتيجيات التسويق التي...',
    'lang-name': 'اللغة',
    'lang-level': 'المستوى',
    'cert-name': 'اسم الشهادة - الجهة المانحة',
    // Language levels
    'level-native': 'لغة أم (C2)',
    'level-advanced': 'متقدم جداً (C1)',
    'level-proficient': 'متقدم (B2)',
    'level-intermediate': 'متوسط (B1)',
    'level-elementary': 'مبتدئ متقدم (A2)',
    'level-beginner': 'مبتدئ (A1)',
    // Preview defaults
    'your-name': 'اسمك الكامل',
    'your-title': 'المسمى الوظيفي',
    'add-contact': 'معلومات التواصل',
    'preview-title': 'معاينة السيرة الذاتية'
  },
  en: {
    personal: 'Personal Information',
    name: 'Full Name',
    'job-title': 'Job Title',
    phone: 'Phone Number',
    email: 'Email Address',
    location: 'City, Country',
    linkedin: 'LinkedIn URL',
    summary: 'Professional Summary',
    'summary-placeholder': 'Write a compelling summary about your experience, skills, and career objectives...',
    education: 'Education',
    experience: 'Work Experience',
    skills: 'Skills',
    'skills-placeholder': 'Technical Skills: Excel, PowerPoint, Word\nSoft Skills: Leadership, Communication, Teamwork',
    'skills-hint': 'Enter each skill category on a separate line',
    languages: 'Languages',
    certifications: 'Certifications & Achievements',
    download: 'Download PDF',
    // CV Preview (English titles)
    'cv-profile': 'PROFESSIONAL SUMMARY',
    'cv-education': 'EDUCATION',
    'cv-experience': 'WORK EXPERIENCE',
    'cv-skills': 'SKILLS',
    'cv-languages': 'LANGUAGES',
    'cv-certifications': 'CERTIFICATIONS',
    // Form placeholders
    'edu-degree': 'Degree (e.g., Bachelor of Science)',
    'edu-field': 'Field of Study',
    'edu-university': 'University Name',
    'edu-year': 'Graduation Year',
    'exp-title': 'Job Title',
    'exp-company': 'Company Name',
    'exp-date': 'Period (e.g., 01/2022 - 12/2024)',
    'exp-desc': 'Achievements and responsibilities (each on new line)',
    'lang-name': 'Language',
    'lang-level': 'Level',
    'cert-name': 'Certificate Name - Issuer',
    // Language levels
    'level-native': 'Native (C2)',
    'level-advanced': 'Advanced (C1)',
    'level-proficient': 'Proficient (B2)',
    'level-intermediate': 'Intermediate (B1)',
    'level-elementary': 'Elementary (A2)',
    'level-beginner': 'Beginner (A1)',
    // Preview defaults
    'your-name': 'YOUR NAME',
    'your-title': 'PROFESSIONAL TITLE',
    'add-contact': 'Add your contact information',
    'preview-title': 'Resume Preview'
  }
};

let currentLang = 'ar';

// ===== Language Functions =====
function setLanguage(lang) {
  currentLang = lang;
  const t = translations[lang];
  
  // Update buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  
  // Update document direction for preview
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  
  // Update all translated elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) {
      el.textContent = t[key];
    }
  });
  
  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key]) {
      el.placeholder = t[key];
    }
  });
  
  // Update dynamic education fields
  document.querySelectorAll('.edu-input[data-field]').forEach(el => {
    const key = el.getAttribute('data-field');
    if (t[key]) {
      el.placeholder = t[key];
    }
  });
  
  // Update dynamic experience fields
  document.querySelectorAll('.exp-input[data-field]').forEach(el => {
    const key = el.getAttribute('data-field');
    if (t[key]) {
      el.placeholder = t[key];
    }
  });
  
  // Update dynamic language fields
  document.querySelectorAll('.lang-input[data-field]').forEach(el => {
    const key = el.getAttribute('data-field');
    if (t[key]) {
      el.placeholder = t[key];
    }
  });
  
  // Update language level dropdowns
  document.querySelectorAll('.lang-select').forEach(select => {
    const currentValue = select.value;
    select.innerHTML = `
      <option value="">-- ${t['lang-level']} --</option>
      <option value="native">${t['level-native']}</option>
      <option value="advanced">${t['level-advanced']}</option>
      <option value="proficient">${t['level-proficient']}</option>
      <option value="intermediate">${t['level-intermediate']}</option>
      <option value="elementary">${t['level-elementary']}</option>
      <option value="beginner">${t['level-beginner']}</option>
    `;
    select.value = currentValue;
  });
  
  // Update dynamic certification fields
  document.querySelectorAll('.cert-input[data-field]').forEach(el => {
    const key = el.getAttribute('data-field');
    if (t[key]) {
      el.placeholder = t[key];
    }
  });
  
  localStorage.setItem('resumeLang', lang);
  
  // Update preview RTL/LTR
  const preview = document.getElementById('resumePreview');
  if (preview) {
    preview.classList.toggle('rtl', lang === 'ar');
  }
  
  updatePreview();
}

// ===== Education Functions =====
function addEducation() {
  const list = document.getElementById('educationList');
  const id = Date.now();
  const t = translations[currentLang];
  
  const html = `
    <div class="dynamic-item" id="edu-${id}">
      <div class="dynamic-item-row">
        <input type="text" class="form-input edu-input" data-edu="degree-${id}" data-field="edu-degree" placeholder="${t['edu-degree']}" oninput="updatePreview()">
        <button type="button" class="btn-remove" onclick="removeItem('edu-${id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <input type="text" class="form-input edu-input" data-edu="field-${id}" data-field="edu-field" placeholder="${t['edu-field']}" oninput="updatePreview()" style="margin-top: 0.75rem;">
      <input type="text" class="form-input edu-input" data-edu="university-${id}" data-field="edu-university" placeholder="${t['edu-university']}" oninput="updatePreview()" style="margin-top: 0.75rem;">
      <input type="text" class="form-input edu-input" data-edu="year-${id}" data-field="edu-year" placeholder="${t['edu-year']}" oninput="updatePreview()" style="margin-top: 0.75rem;">
    </div>
  `;
  
  list.insertAdjacentHTML('beforeend', html);
  updatePreview();
}

// ===== Experience Functions =====
function addExperience() {
  const list = document.getElementById('experienceList');
  const id = Date.now();
  const t = translations[currentLang];
  
  const html = `
    <div class="dynamic-item" id="exp-${id}">
      <div class="dynamic-item-row">
        <input type="text" class="form-input exp-input" data-exp="title-${id}" data-field="exp-title" placeholder="${t['exp-title']}" oninput="updatePreview()">
        <button type="button" class="btn-remove" onclick="removeItem('exp-${id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <input type="text" class="form-input exp-input" data-exp="company-${id}" data-field="exp-company" placeholder="${t['exp-company']}" oninput="updatePreview()" style="margin-top: 0.75rem;">
      <input type="text" class="form-input exp-input" data-exp="date-${id}" data-field="exp-date" placeholder="${t['exp-date']}" oninput="updatePreview()" style="margin-top: 0.75rem;">
      <textarea class="form-input form-textarea exp-input" data-exp="desc-${id}" data-field="exp-desc" placeholder="${t['exp-desc']}" oninput="updatePreview()" rows="4" style="margin-top: 0.75rem;"></textarea>
    </div>
  `;
  
  list.insertAdjacentHTML('beforeend', html);
  updatePreview();
}

// ===== Language Functions =====
function addLanguage() {
  const list = document.getElementById('languagesList');
  const id = Date.now();
  const t = translations[currentLang];
  
  const html = `
    <div class="dynamic-item" id="lang-${id}">
      <div class="dynamic-item-row">
        <input type="text" class="form-input lang-input" data-lang="name-${id}" data-field="lang-name" placeholder="${t['lang-name']}" oninput="updatePreview()">
        <select class="form-input lang-select" data-lang="level-${id}" onchange="updatePreview()">
          <option value="">-- ${t['lang-level']} --</option>
          <option value="native">${t['level-native']}</option>
          <option value="advanced">${t['level-advanced']}</option>
          <option value="proficient">${t['level-proficient']}</option>
          <option value="intermediate">${t['level-intermediate']}</option>
          <option value="elementary">${t['level-elementary']}</option>
          <option value="beginner">${t['level-beginner']}</option>
        </select>
        <button type="button" class="btn-remove" onclick="removeItem('lang-${id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  list.insertAdjacentHTML('beforeend', html);
  updatePreview();
}

// ===== Certification Functions =====
function addCertification() {
  const list = document.getElementById('certificationsList');
  const id = Date.now();
  const t = translations[currentLang];
  
  const html = `
    <div class="dynamic-item" id="cert-${id}">
      <div class="dynamic-item-row">
        <input type="text" class="form-input cert-input" data-cert="name-${id}" data-field="cert-name" placeholder="${t['cert-name']}" oninput="updatePreview()" style="flex: 1;">
        <button type="button" class="btn-remove" onclick="removeItem('cert-${id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  list.insertAdjacentHTML('beforeend', html);
  updatePreview();
}

// ===== Remove Item =====
function removeItem(id) {
  document.getElementById(id)?.remove();
  updatePreview();
}

// ===== Get Level Bar Width =====
function getLevelWidth(level) {
  const levels = {
    native: 100,
    advanced: 85,
    proficient: 70,
    intermediate: 55,
    elementary: 40,
    beginner: 25
  };
  return levels[level] || 50;
}

function getLevelText(level) {
  const t = translations[currentLang];
  const key = 'level-' + level;
  return t[key] || level;
}

// ===== Update Preview =====
function updatePreview() {
  const preview = document.getElementById('resumePreview');
  const t = translations[currentLang];
  if (!preview) return;
  
  // Get form values
  const fullName = document.getElementById('fullName')?.value || '';
  const jobTitle = document.getElementById('jobTitle')?.value || '';
  const phone = document.getElementById('phone')?.value || '';
  const email = document.getElementById('email')?.value || '';
  const location = document.getElementById('location')?.value || '';
  const linkedin = document.getElementById('linkedin')?.value || '';
  const summary = document.getElementById('summary')?.value || '';
  const skills = document.getElementById('skills')?.value || '';
  
  // Build education section - ATS format: Degree in Field | University | Year
  let educationHTML = '';
  document.querySelectorAll('[data-edu^="degree-"]').forEach(el => {
    const id = el.getAttribute('data-edu').replace('degree-', '');
    const degree = el.value;
    const field = document.querySelector(`[data-edu="field-${id}"]`)?.value || '';
    const university = document.querySelector(`[data-edu="university-${id}"]`)?.value || '';
    const year = document.querySelector(`[data-edu="year-${id}"]`)?.value || '';
    
    if (degree || university) {
      educationHTML += `
        <div class="cv-edu-item">
          <p class="cv-edu-degree"><strong>${escapeHtml(degree)}${field ? ' in ' + escapeHtml(field) : ''}</strong></p>
          <p class="cv-edu-school">${escapeHtml(university)}${year ? ' | Graduation: ' + escapeHtml(year) : ''}</p>
        </div>
      `;
    }
  });
  
  // Build experience section - ATS format with clear dates and bullets
  let experienceHTML = '';
  document.querySelectorAll('[data-exp^="title-"]').forEach(el => {
    const id = el.getAttribute('data-exp').replace('title-', '');
    const title = el.value;
    const company = document.querySelector(`[data-exp="company-${id}"]`)?.value || '';
    const date = document.querySelector(`[data-exp="date-${id}"]`)?.value || '';
    const desc = document.querySelector(`[data-exp="desc-${id}"]`)?.value || '';
    
    if (title || company) {
      const descLines = desc.split('\n').filter(line => line.trim()).map(line => {
        // Remove leading dash or bullet if present
        return line.replace(/^[-•]\s*/, '').trim();
      });
      experienceHTML += `
        <div class="cv-exp-item">
          <p class="cv-exp-company"><strong>${escapeHtml(company)}</strong></p>
          <p class="cv-exp-title">${escapeHtml(title)} | ${escapeHtml(date).trim() || (currentLang === 'ar' ? 'الحالي' : 'Present')}</p>
          ${descLines.length > 0 ? `
            <ul class="cv-exp-desc">
              ${descLines.map(line => `<li>${escapeHtml(line)}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `;
    }
  });
  
  // Build skills section with bullet points for ATS
  let skillsHTML = '';
  if (skills) {
    const skillLines = skills.split('\n').filter(s => s.trim());
    skillsHTML = skillLines.map(s => {
      const parts = s.split(':');
      if (parts.length > 1) {
        return `<li><strong>${escapeHtml(parts[0].trim())}:</strong> ${escapeHtml(parts.slice(1).join(':').trim())}</li>`;
      }
      return `<li>${escapeHtml(s.trim())}</li>`;
    }).join('');
  }
  
  // Build languages section
  let languagesHTML = '';
  document.querySelectorAll('[data-lang^="name-"]').forEach(el => {
    const id = el.getAttribute('data-lang').replace('name-', '');
    const name = el.value;
    const level = document.querySelector(`[data-lang="level-${id}"]`)?.value || '';
    
    if (name) {
      languagesHTML += `<li>${escapeHtml(name)}: ${getLevelText(level)}</li>`;
    }
  });
  
  // Build certifications section
  let certsHTML = '';
  document.querySelectorAll('[data-cert^="name-"]').forEach(el => {
    const name = el.value;
    if (name) {
      certsHTML += `<li>${escapeHtml(name)}</li>`;
    }
  });
  
  // Set RTL class based on language
  preview.classList.toggle('rtl', currentLang === 'ar');
  
  // Extract LinkedIn username from URL
  const getLinkedInUsername = (url) => {
    if (!url) return '';
    const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/i);
    return match ? match[1] : url;
  };
  
  // Build contact items with icons
  let contactItems = [];
  if (email) {
    contactItems.push(`<span class="cv-contact-item"><svg class="cv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>${escapeHtml(email)}</span>`);
  }
  if (phone) {
    contactItems.push(`<span class="cv-contact-item"><svg class="cv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>${escapeHtml(phone)}</span>`);
  }
  if (location) {
    contactItems.push(`<span class="cv-contact-item"><svg class="cv-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${escapeHtml(location)}</span>`);
  }
  if (linkedin) {
    const linkedinUsername = getLinkedInUsername(linkedin);
    const linkedinUrl = linkedin.startsWith('http') ? linkedin : 'https://' + linkedin;
    contactItems.push(`<span class="cv-contact-item"><svg class="cv-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg><a href="${escapeHtml(linkedinUrl)}" target="_blank">${escapeHtml(linkedinUsername)}</a></span>`);
  }
  
  // Build the full CV - ATS-optimized structure with clear sections
  preview.innerHTML = `
    <header class="cv-header">
      <h1 class="cv-name">${escapeHtml(fullName).toUpperCase() || t['your-name']}</h1>
      <p class="cv-job-title">${escapeHtml(jobTitle).toUpperCase() || t['your-title']}</p>
      <div class="cv-contact">${contactItems.length > 0 ? contactItems.join('<span class="cv-separator">|</span>') : t['add-contact']}</div>
    </header>
    
    <main class="cv-body">
      ${summary ? `
        <section class="cv-section">
          <h2 class="cv-section-title">${t['cv-profile']}</h2>
          <p class="cv-summary">${escapeHtml(summary)}</p>
        </section>
      ` : ''}
      
      ${experienceHTML ? `
        <section class="cv-section">
          <h2 class="cv-section-title">${t['cv-experience']}</h2>
          ${experienceHTML}
        </section>
      ` : ''}
      
      ${educationHTML ? `
        <section class="cv-section">
          <h2 class="cv-section-title">${t['cv-education']}</h2>
          ${educationHTML}
        </section>
      ` : ''}
      
      ${skillsHTML ? `
        <section class="cv-section">
          <h2 class="cv-section-title">${t['cv-skills']}</h2>
          <ul class="cv-skills-list">
            ${skillsHTML}
          </ul>
        </section>
      ` : ''}
      
      ${languagesHTML ? `
        <section class="cv-section">
          <h2 class="cv-section-title">${t['cv-languages']}</h2>
          <ul class="cv-languages-list">
            ${languagesHTML}
          </ul>
        </section>
      ` : ''}
      
      ${certsHTML ? `
        <section class="cv-section">
          <h2 class="cv-section-title">${t['cv-certifications']}</h2>
          <ul class="cv-cert-list">
            ${certsHTML}
          </ul>
        </section>
      ` : ''}
    </main>
  `;
}

// ===== Escape HTML =====
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== Print Resume =====
function printResume() {
  const preview = document.getElementById('resumePreview');
  if (!preview || !preview.innerHTML) {
    alert('Please fill in your resume information first');
    return;
  }
  
  // Create a new window with just the resume
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title></title>
      <style>
        @page {
          size: A4;
          margin: 0.3in 0.4in;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        html, body {
          margin: 0;
          padding: 0;
          background: white;
          font-family: 'Arial', 'Helvetica', sans-serif;
          width: 100%;
          height: 100%;
          border: none;
        }
        .resume-preview {
          width: 100%;
          height: auto;
          margin: 0;
          padding: 0.5in 0.6in;
          box-sizing: border-box;
          background: white;
          color: #1a1a1a;
          font-size: 10pt;
          line-height: 1.5;
        }
        .cv-header {
          text-align: center;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #333;
        }
        .cv-name {
          font-size: 32pt;
          font-weight: 300;
          text-transform: uppercase;
          letter-spacing: 6px;
          margin: 0 0 0.25rem 0;
          color: #1a1a1a;
        }
        .cv-job-title {
          font-size: 8pt;
          font-weight: 400;
          text-transform: uppercase;
          letter-spacing: 4px;
          color: #666;
          margin: 0 0 0.5rem 0;
        }
        .cv-contact {
          font-size: 9pt;
          color: #333;
          margin: 0;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;
          gap: 0.5rem;
        }
        .cv-contact-item {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }
        .cv-contact-item a {
          color: #333;
          text-decoration: none;
        }
        .cv-icon {
          width: 12px;
          height: 12px;
          flex-shrink: 0;
        }
        .cv-separator {
          color: #999;
          margin: 0 0.25rem;
        }
        .cv-section {
          margin-bottom: 1rem;
          page-break-inside: avoid;
        }
        .cv-section-title {
          font-size: 11pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0 0 0.5rem 0;
          color: #1a1a1a;
          padding-bottom: 0.25rem;
          border-bottom: 1px solid #333;
        }
        .cv-summary {
          font-size: 9pt;
          line-height: 1.6;
          text-align: justify;
          color: #333;
          margin: 0;
        }
        .cv-edu-item, .cv-exp-item {
          margin-bottom: 0.5rem;
          page-break-inside: avoid;
        }
        .cv-edu-degree, .cv-exp-company {
          font-size: 9pt;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0;
        }
        .cv-edu-school, .cv-exp-title {
          font-size: 9pt;
          color: #333;
          margin: 0;
        }
        .cv-exp-desc {
          list-style: disc;
          padding-left: 1.25rem;
          margin: 0.25rem 0 0 0;
        }
        .cv-exp-desc li {
          font-size: 9pt;
          color: #333;
          margin-bottom: 0.15rem;
          line-height: 1.5;
        }
        .cv-skills-list, .cv-languages-list, .cv-cert-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .cv-skills-list li, .cv-languages-list li, .cv-cert-list li {
          font-size: 9pt;
          color: #333;
          margin-bottom: 0.25rem;
          line-height: 1.5;
        }
        .cv-skills-list li strong {
          font-weight: 600;
        }
        @media print {
          @page {
            size: A4;
            margin: 0.25in 0.3in;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            border: none !important;
          }
          .resume-preview {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0.4in 0.5in !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      </style>
    </head>
    <body onload="setTimeout(() => window.print(), 100);">
      <div class="resume-preview">
        ${preview.innerHTML}
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
  // Load saved language
  const savedLang = localStorage.getItem('resumeLang') || 'ar';
  setLanguage(savedLang);
  
  // Add input listeners
  document.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('input', updatePreview);
  });
  
  // Initial preview with sample data
  updatePreview();
});
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.querySelector(".nav-menu");
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => navMenu.classList.toggle("open"));
    navMenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => navMenu.classList.remove("open")));
  }
