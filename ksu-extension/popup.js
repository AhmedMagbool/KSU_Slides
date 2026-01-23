const DAYS_MAP = {
  '1': 'الأحد',
  '2': 'الاثنين', 
  '3': 'الثلاثاء',
  '4': 'الأربعاء',
  '5': 'الخميس'
};

document.getElementById('extractBtn').addEventListener('click', () => extract(true));
document.getElementById('downloadBtn').addEventListener('click', () => extract(false));

// Load saved Firebase URL
chrome.storage.local.get(['firebaseUrl'], (result) => {
  if (result.firebaseUrl) {
    document.getElementById('firebaseUrl').value = result.firebaseUrl;
  }
});

async function extract(uploadToFirebase) {
  const major = document.getElementById('major').value;
  const firebaseUrl = document.getElementById('firebaseUrl').value.trim();
  
  if (uploadToFirebase && !firebaseUrl) {
    setStatus('أدخل رابط Firebase Database', 'error');
    return;
  }

  if (firebaseUrl) {
    chrome.storage.local.set({ firebaseUrl });
  }

  setStatus('جاري التحقق من الصفحة...', '');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url || !tab.url.includes('edugate.ksu.edu.sa')) {
      setStatus('افتح صفحة المقررات في موقع الجامعة أولاً', 'error');
      return;
    }

    setStatus('جاري الاستخراج مع الأوقات... قد يأخذ وقت', '');
    document.getElementById('extractBtn').disabled = true;
    document.getElementById('downloadBtn').disabled = true;
    showProgress(true);

    // Inject and execute the extraction script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractDataWithTimes
    });

    console.log('Results:', results);

    if (!results || !results[0] || !results[0].result) {
      setStatus('فشل الاستخراج - لم يتم العثور على بيانات', 'error');
      return;
    }

    const data = results[0].result;
    
    if (data.error) {
      setStatus('خطأ: ' + data.error, 'error');
      return;
    }

    // Add metadata
    data.major = major;
    data.majorName = major === 'general' ? 'إعداد عام' : (major === 'cs' ? 'علوم الحاسب' : 'نظم المعلومات');
    data.exportDate = new Date().toISOString();
    data.lastUpdated = Date.now();

    // Count sections with times
    let withTimes = 0;
    let totalSections = 0;
    Object.values(data.courses || {}).forEach(course => {
      Object.values(course.sections || {}).forEach(section => {
        totalSections++;
        if (section.times && section.times.length > 0) withTimes++;
      });
    });

    if (uploadToFirebase) {
      setStatus('جاري الرفع على Firebase...', '');
      
      try {
        await uploadData(firebaseUrl, major, data);
        setStatus('تم رفع ' + data.totalCourses + ' مادة و ' + data.totalSections + ' شعبة (' + withTimes + ' مع أوقات)', 'success');
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        setStatus('فشل الرفع: ' + uploadError.message, 'error');
        downloadJSON(data, major);
      }
    } else {
      downloadJSON(data, major);
      setStatus('تم تحميل ' + data.totalCourses + ' مادة (' + withTimes + '/' + totalSections + ' شعبة مع أوقات)', 'success');
    }

  } catch (error) {
    console.error('Extract error:', error);
    setStatus('حدث خطأ: ' + error.message, 'error');
  } finally {
    document.getElementById('extractBtn').disabled = false;
    document.getElementById('downloadBtn').disabled = false;
    showProgress(false);
  }
}

async function extractDataWithTimes() {
  const DAYS = {
    '1': 'الأحد',
    '2': 'الاثنين', 
    '3': 'الثلاثاء',
    '4': 'الأربعاء',
    '5': 'الخميس'
  };

  // Helper to wait
  const wait = ms => new Promise(r => setTimeout(r, ms));

  try {
    const table = document.getElementById('myForm:timetable');
    
    if (!table) {
      return { error: 'لم يتم العثور على جدول المقررات' };
    }

    const rows = table.querySelectorAll('tbody tr');
    
    if (rows.length === 0) {
      return { error: 'الجدول فارغ - اضغط بحث أولاً' };
    }

    const courses = {};
    let count = 0;
    let timesFound = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.querySelectorAll('td');
      if (cells.length < 7) continue;

      const code = cells[0]?.textContent?.trim() || '';
      const name = cells[1]?.textContent?.trim() || '';
      const section = cells[2]?.textContent?.trim() || '';
      const activity = cells[3]?.textContent?.trim() || '';
      const hours = cells[4]?.textContent?.trim() || '';
      const gender = cells[5]?.textContent?.trim() || '';
      const status = cells[6]?.textContent?.trim() || '';

      if (!code || !section) continue;

      if (!courses[code]) {
        courses[code] = {
          code,
          name,
          hours: parseInt(hours) || 0,
          sections: {}
        };
      }

      let times = [];
      let instructor = '';

      // Try to get details by clicking the link
      const detailLink = cells[7]?.querySelector('a') || row.querySelector('a[onclick]');
      
      if (detailLink) {
        try {
          // Click the details link
          detailLink.click();
          await wait(800);

          // Find the dialog
          const dialogs = document.querySelectorAll('.ui-dialog, [class*="dialog"]');
          
          for (const dialog of dialogs) {
            // Check if dialog is visible
            if (dialog.style.display === 'none' || dialog.offsetParent === null) continue;
            
            // Look for times table
            const allTables = dialog.querySelectorAll('table');
            
            for (const t of allTables) {
              // Check if this is the times table by looking at headers
              const firstRow = t.querySelector('tr');
              if (!firstRow) continue;
              
              const headerText = firstRow.textContent || '';
              
              if (headerText.includes('اليوم') || headerText.includes('الوقت')) {
                // This is likely the times table
                const dataRows = t.querySelectorAll('tr');
                
                for (let j = 1; j < dataRows.length; j++) {
                  const tds = dataRows[j].querySelectorAll('td');
                  if (tds.length >= 2) {
                    const dayText = tds[0]?.textContent?.trim();
                    const timeText = tds[1]?.textContent?.trim();
                    const roomText = tds[2]?.textContent?.trim() || '';

                    // Day should be 1-5
                    if (dayText && timeText && /^[1-5]$/.test(dayText)) {
                      const timeParts = timeText.split('-').map(t => t.trim());
                      times.push({
                        day: DAYS[dayText] || dayText,
                        dayNum: parseInt(dayText),
                        start: timeParts[0] || '',
                        end: timeParts[1] || '',
                        room: roomText
                      });
                    }
                  }
                }
              }
            }

            // Get instructor
            const dialogText = dialog.textContent || '';
            const instMatch = dialogText.match(/المحاضر\s*[:\s]\s*([^\n\r]+)/);
            if (instMatch) {
              instructor = instMatch[1].replace(/لم يحدد من الكلية/g, '').trim();
            }

            // Close the dialog
            const closeBtn = dialog.querySelector('.ui-dialog-titlebar-close, .ui-icon-closethick, [class*="close"]');
            if (closeBtn) {
              closeBtn.click();
            } else {
              // Try clicking outside or pressing escape
              const closeLink = dialog.querySelector('a[onclick*="hide"], button[onclick*="hide"]');
              if (closeLink) closeLink.click();
            }
            
            await wait(400);
            break;
          }
        } catch (e) {
          console.log('Error getting details for', code, section, e);
        }
      }

      if (times.length > 0) timesFound++;

      courses[code].sections[section] = {
        sectionNumber: section,
        activity,
        gender,
        status,
        instructor,
        times
      };

      count++;
      
      // Update progress indicator on page
      console.log(`Processed ${count}/${rows.length}: ${code} - ${section} (${times.length} times)`);
    }

    console.log(`Extraction complete: ${Object.keys(courses).length} courses, ${count} sections, ${timesFound} with times`);

    return {
      totalCourses: Object.keys(courses).length,
      totalSections: count,
      sectionsWithTimes: timesFound,
      courses
    };

  } catch (e) {
    return { error: e.message };
  }
}

async function uploadData(firebaseUrl, major, data) {
  const baseUrl = firebaseUrl.replace(/\/$/, '');
  const url = baseUrl + '/scheduleData/' + major + '.json';
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error('Firebase error: ' + response.status);
  }
  
  return await response.json();
}

function downloadJSON(data, major) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ksu-' + major + '-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  
  URL.revokeObjectURL(url);
}

function setStatus(text, type) {
  const el = document.getElementById('status');
  el.textContent = text;
  el.className = 'status' + (type ? ' ' + type : '');
}

function showProgress(show) {
  document.getElementById('progress').style.display = show ? 'block' : 'none';
}