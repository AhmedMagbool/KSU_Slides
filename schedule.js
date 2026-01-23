import { rtdb } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

// State
let scheduleData = {};
let selectedMajor = null;
let selectedCourses = [];
let generatedSchedules = [];
let currentScheduleIndex = 0;

// DOM Elements
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const coursesGrid = document.getElementById('coursesGrid');
const selectedSummary = document.getElementById('selectedSummary');
const selectedCount = document.getElementById('selectedCount');
const selectedCoursesList = document.getElementById('selectedCoursesList');
const courseSearch = document.getElementById('courseSearch');
const generateBtn = document.getElementById('generateBtn');
const resultsSection = document.getElementById('resultsSection');
const noResults = document.getElementById('noResults');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupMajorButtons();
  setupNavigation();
  setupGenerateButton();
  setupExportButtons();
  setupSearch();
});

// Setup Major Buttons
function setupMajorButtons() {
  document.querySelectorAll('.major-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.major-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      
      selectedMajor = btn.dataset.major;
      selectedCourses = [];
      updateSelectedSummary();
      
      // Enable step 2
      step2.classList.remove('disabled');
      step2.classList.add('active');
      
      // Load courses
      await loadCourses(selectedMajor);
    });
  });
}

// Load Courses from Firebase
async function loadCourses(major) {
  coursesGrid.innerHTML = '<div class="loading-placeholder">جاري تحميل المواد...</div>';
  
  try {
    const snap = await get(ref(rtdb, `scheduleData/${major}`));
    
    if (!snap.exists()) {
      coursesGrid.innerHTML = '<div class="loading-placeholder">لا توجد بيانات لهذا التخصص</div>';
      return;
    }

    scheduleData = snap.val();
    renderCourses(scheduleData.courses);
    
  } catch (error) {
    console.error('Error loading courses:', error);
    coursesGrid.innerHTML = '<div class="loading-placeholder">حدث خطأ في تحميل البيانات</div>';
  }
}

// Render Courses
function renderCourses(courses) {
  if (!courses || Object.keys(courses).length === 0) {
    coursesGrid.innerHTML = '<div class="loading-placeholder">لا توجد مواد</div>';
    return;
  }

  const coursesArray = Object.values(courses);
  
  coursesGrid.innerHTML = coursesArray.map(course => `
    <label class="course-select-item" data-code="${course.code}">
      <input type="checkbox" value="${course.code}">
      <span class="course-checkbox">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </span>
      <span class="course-select-info">
        <span class="course-select-code">${course.code}</span>
        <span class="course-select-name">${course.name}</span>
      </span>
    </label>
  `).join('');

  // Add click handlers
  coursesGrid.querySelectorAll('.course-select-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      toggleCourse(item.dataset.code);
    });
  });
}

// Toggle Course Selection
function toggleCourse(code) {
  const item = coursesGrid.querySelector(`[data-code="${code}"]`);
  
  if (selectedCourses.includes(code)) {
    selectedCourses = selectedCourses.filter(c => c !== code);
    item?.classList.remove('selected');
  } else {
    selectedCourses.push(code);
    item?.classList.add('selected');
  }

  updateSelectedSummary();
  updateStep3State();
}

// Update Selected Summary
function updateSelectedSummary() {
  if (selectedCourses.length === 0) {
    selectedSummary.style.display = 'none';
    return;
  }

  selectedSummary.style.display = 'block';
  selectedCount.textContent = selectedCourses.length;

  selectedCoursesList.innerHTML = selectedCourses.map(code => {
    const course = scheduleData.courses?.[code];
    return `
      <span class="course-chip">
        ${code}
        <button onclick="window.removeCourse('${code}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </span>
    `;
  }).join('');
}

// Remove Course (global for onclick)
window.removeCourse = function(code) {
  toggleCourse(code);
};

// Update Step 3 State
function updateStep3State() {
  if (selectedCourses.length > 0) {
    step3.classList.remove('disabled');
    step3.classList.add('active');
  } else {
    step3.classList.add('disabled');
    step3.classList.remove('active');
  }
}

// Setup Search
function setupSearch() {
  courseSearch?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    
    coursesGrid.querySelectorAll('.course-select-item').forEach(item => {
      const code = item.dataset.code.toLowerCase();
      const name = item.querySelector('.course-select-name')?.textContent.toLowerCase() || '';
      
      if (code.includes(query) || name.includes(query)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  });
}

// Setup Generate Button
function setupGenerateButton() {
  generateBtn?.addEventListener('click', generateSchedules);
}

// Generate Schedules
function generateSchedules() {
  if (selectedCourses.length === 0) return;

  // Get preferences
  const timePreference = document.getElementById('timePreference')?.value || 'any';
  const daysOff = Array.from(document.querySelectorAll('.days-checkboxes input:checked'))
    .map(cb => parseInt(cb.value));

  // Get all sections for selected courses
  const courseSections = selectedCourses.map(code => {
    const course = scheduleData.courses?.[code];
    if (!course) return null;

    const sections = Object.values(course.sections || {})
      .filter(s => s.status === 'مفتوحة' || s.status === 'مفتوح')
      .filter(s => {
        // Filter by days off
        if (daysOff.length > 0 && s.times) {
          for (const time of s.times) {
            if (daysOff.includes(time.dayNum)) return false;
          }
        }
        
        // Filter by time preference
        if (timePreference !== 'any' && s.times) {
          for (const time of s.times) {
            const hour = parseInt(time.start?.split(':')[0]) || 0;
            if (timePreference === 'morning' && hour >= 12) return false;
            if (timePreference === 'afternoon' && hour < 12) return false;
          }
        }
        
        return true;
      });

    return { code, name: course.name, sections };
  }).filter(Boolean);

  // Check if all courses have sections
  const missingCourses = courseSections.filter(c => c.sections.length === 0);
  if (missingCourses.length > 0) {
    alert(`لا توجد شعب متاحة للمواد التالية:\n${missingCourses.map(c => c.code).join('\n')}`);
    return;
  }

  // Generate all combinations
  generatedSchedules = generateCombinations(courseSections);
  currentScheduleIndex = 0;

  // Show results
  if (generatedSchedules.length > 0) {
    resultsSection.style.display = 'block';
    noResults.style.display = 'none';
    document.getElementById('schedulesCount').textContent = generatedSchedules.length;
    document.getElementById('totalSchedules').textContent = generatedSchedules.length;
    displaySchedule(0);
  } else {
    resultsSection.style.display = 'none';
    noResults.style.display = 'block';
  }

  // Scroll to results
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Generate Combinations (Backtracking)
function generateCombinations(courseSections) {
  const results = [];
  const maxResults = 100; // Limit to prevent performance issues

  function backtrack(index, currentSchedule, occupiedSlots) {
    if (results.length >= maxResults) return;
    
    if (index === courseSections.length) {
      results.push([...currentSchedule]);
      return;
    }

    const course = courseSections[index];
    
    for (const section of course.sections) {
      // Check for conflicts
      let hasConflict = false;
      const sectionSlots = [];

      for (const time of (section.times || [])) {
        const slots = getTimeSlots(time);
        for (const slot of slots) {
          if (occupiedSlots.has(slot)) {
            hasConflict = true;
            break;
          }
          sectionSlots.push(slot);
        }
        if (hasConflict) break;
      }

      if (!hasConflict) {
        // Add slots
        sectionSlots.forEach(s => occupiedSlots.add(s));
        currentSchedule.push({
          code: course.code,
          name: course.name,
          section: section
        });

        backtrack(index + 1, currentSchedule, occupiedSlots);

        // Remove slots (backtrack)
        currentSchedule.pop();
        sectionSlots.forEach(s => occupiedSlots.delete(s));
      }
    }
  }

  backtrack(0, [], new Set());
  return results;
}

// Get Time Slots for conflict detection
function getTimeSlots(time) {
  const slots = [];
  const day = time.dayNum || 0;
  const startMinutes = parseTime(time.start);
  const endMinutes = parseTime(time.end);

  // Create 15-minute slots
  for (let m = startMinutes; m < endMinutes; m += 15) {
    slots.push(`${day}-${m}`);
  }

  return slots;
}

// Parse Time String to Minutes
function parseTime(timeStr) {
  if (!timeStr) return 0;
  
  // Handle Arabic AM/PM
  const isPM = timeStr.includes('م') || timeStr.toLowerCase().includes('pm');
  const cleanTime = timeStr.replace(/[صمapمAMPM\s]/gi, '').trim();
  const parts = cleanTime.split(':');
  
  let hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  
  if (isPM && hours < 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
}

// Display Schedule
function displaySchedule(index) {
  if (index < 0 || index >= generatedSchedules.length) return;

  currentScheduleIndex = index;
  const schedule = generatedSchedules[index];

  document.getElementById('currentScheduleNum').textContent = index + 1;
  
  // Update navigation buttons
  document.getElementById('prevSchedule').disabled = index === 0;
  document.getElementById('nextSchedule').disabled = index === generatedSchedules.length - 1;

  // Generate time slots (8 AM to 8 PM)
  const timeSlots = [];
  for (let h = 8; h <= 20; h++) {
    timeSlots.push(`${h}:00`);
  }

  // Build table
  const tbody = document.getElementById('scheduleBody');
  tbody.innerHTML = '';

  const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
  const courseColors = {};
  let colorIndex = 1;

  // Assign colors to courses
  schedule.forEach(item => {
    if (!courseColors[item.code]) {
      courseColors[item.code] = colorIndex++;
    }
  });

  // Create cells map
  const cellsMap = {};
  
  schedule.forEach(item => {
    const times = item.section.times || [];
    times.forEach(time => {
      const dayIndex = time.dayNum - 1;
      if (dayIndex < 0 || dayIndex >= 5) return;

      const startMinutes = parseTime(time.start);
      const endMinutes = parseTime(time.end);
      const startHour = Math.floor(startMinutes / 60);
      const duration = Math.ceil((endMinutes - startMinutes) / 60);

      const key = `${startHour}-${dayIndex}`;
      cellsMap[key] = {
        item,
        time,
        rowspan: duration,
        color: courseColors[item.code]
      };

      // Mark spanned cells
      for (let h = 1; h < duration; h++) {
        cellsMap[`${startHour + h}-${dayIndex}`] = 'spanned';
      }
    });
  });

  // Generate rows
  timeSlots.forEach(slot => {
    const hour = parseInt(slot.split(':')[0]);
    const tr = document.createElement('tr');
    
    // Time cell
    const timeCell = document.createElement('td');
    timeCell.className = 'time-cell';
    timeCell.textContent = formatHour(hour);
    tr.appendChild(timeCell);

    // Day cells
    for (let d = 0; d < 5; d++) {
      const key = `${hour}-${d}`;
      const cellData = cellsMap[key];

      if (cellData === 'spanned') continue;

      const td = document.createElement('td');

      if (cellData) {
        td.rowSpan = cellData.rowspan;
        td.innerHTML = `
          <div class="schedule-cell color-${cellData.color}">
            <div class="course-code">${cellData.item.code}</div>
            <div class="course-section">شعبة ${cellData.item.section.sectionNumber}</div>
            ${cellData.time.room ? `<div class="course-room">${cellData.time.room}</div>` : ''}
          </div>
        `;
      }

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  });

  // Display section details
  displaySectionDetails(schedule, courseColors);
}

// Format Hour
function formatHour(hour) {
  if (hour === 0 || hour === 12) return '12:00';
  if (hour < 12) return `${hour}:00 ص`;
  return `${hour - 12}:00 م`;
}

// Display Section Details
function displaySectionDetails(schedule, courseColors) {
  const container = document.getElementById('sectionsDetails');
  
  container.innerHTML = schedule.map(item => `
    <div class="section-detail-card" style="border-color: var(--primary);">
      <h4>${item.code} - ${item.name}</h4>
      <p><strong>الشعبة:</strong> ${item.section.sectionNumber}</p>
      <p><strong>النوع:</strong> ${item.section.activity || '—'}</p>
      <p><strong>المحاضر:</strong> ${item.section.instructor || 'غير محدد'}</p>
      <p><strong>الأوقات:</strong> ${formatTimes(item.section.times)}</p>
    </div>
  `).join('');
}

// Format Times
function formatTimes(times) {
  if (!times || times.length === 0) return 'غير محدد';
  
  return times.map(t => `${t.day || ''} ${t.start || ''} - ${t.end || ''}`).join('، ');
}

// Setup Navigation
function setupNavigation() {
  document.getElementById('prevSchedule')?.addEventListener('click', () => {
    displaySchedule(currentScheduleIndex - 1);
  });

  document.getElementById('nextSchedule')?.addEventListener('click', () => {
    displaySchedule(currentScheduleIndex + 1);
  });

  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.querySelector('.nav-menu');
  navToggle?.addEventListener('click', () => {
    navMenu?.classList.toggle('open');
  });
}

// Setup Export Buttons
function setupExportButtons() {
  document.getElementById('exportImage')?.addEventListener('click', exportAsImage);
  document.getElementById('exportPDF')?.addEventListener('click', exportAsPDF);
}

// Export as Image
async function exportAsImage() {
  const table = document.querySelector('.schedule-table-wrapper');
  if (!table) return;

  try {
    // Dynamic import html2canvas
    const html2canvas = (await import('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.esm.js')).default;
    
    const canvas = await html2canvas(table, {
      backgroundColor: '#1a1a2e',
      scale: 2
    });

    const link = document.createElement('a');
    link.download = `schedule-${currentScheduleIndex + 1}.png`;
    link.href = canvas.toDataURL();
    link.click();
  } catch (error) {
    console.error('Export error:', error);
    alert('حدث خطأ في التصدير');
  }
}

// Export as PDF
function exportAsPDF() {
  window.print();
}