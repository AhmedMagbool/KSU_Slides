import puppeteer from 'puppeteer';
import admin from 'firebase-admin';

// Firebase Setup
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});
const db = admin.database();

// Constants
const DAYS_MAP = {
  '1': 'الأحد',
  '2': 'الاثنين',
  '3': 'الثلاثاء',
  '4': 'الأربعاء',
  '5': 'الخميس'
};

const CAMPUS_CODE = '65'; // الرياض - طالبات

const MAJORS = [
  { code: 'general', name: 'إعداد عام', deptCode: '4' },
  { code: 'cs', name: 'علوم الحاسب', deptCode: '4' },
  { code: 'is', name: 'نظم المعلومات', deptCode: '4' }
];

const BASE_URL = 'https://edugate.ksu.edu.sa/ksu/ui/guest/timetable/index/scheduleCoursesIndex.faces';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeKSU() {
  console.log('Starting KSU Scraper...');
  console.log('Time:', new Date().toISOString());

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    for (const major of MAJORS) {
      console.log(`\n=== Scraping ${major.name} (${major.code}) ===`);
      const data = await scrapeMajor(browser, major);
      
      if (data && Object.keys(data.courses).length > 0) {
        await saveToFirebase(major.code, data);
        console.log(`Saved ${Object.keys(data.courses).length} courses for ${major.name}`);
      }
    }
  } catch (error) {
    console.error('Scraping error:', error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('\nScraping completed!');
}

async function scrapeMajor(browser, major) {
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  try {
    // Go to the schedule page
    console.log('Loading page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(2000);

    // Select campus (if dropdown exists)
    try {
      await page.select('select[id*="campus"]', CAMPUS_CODE);
      await sleep(1000);
    } catch (e) {
      console.log('Campus selector not found, continuing...');
    }

    // Click search button
    const searchBtn = await page.$('input[type="submit"], button[type="submit"], input[value*="بحث"], button:has-text("بحث")');
    if (searchBtn) {
      await searchBtn.click();
      await sleep(3000);
    }

    // Wait for table
    await page.waitForSelector('table[id*="timetable"], table.dataTable, #myForm\\:timetable', { timeout: 30000 });
    console.log('Table loaded');

    // Get all rows
    const courses = {};
    let totalSections = 0;
    let sectionsWithTimes = 0;

    const rowCount = await page.evaluate(() => {
      const table = document.querySelector('table[id*="timetable"], #myForm\\:timetable');
      return table ? table.querySelectorAll('tbody tr').length : 0;
    });

    console.log(`Found ${rowCount} rows`);

    for (let i = 0; i < rowCount; i++) {
      try {
        // Re-query to avoid stale references
        const rowData = await page.evaluate((index) => {
          const table = document.querySelector('table[id*="timetable"], #myForm\\:timetable');
          if (!table) return null;
          
          const rows = table.querySelectorAll('tbody tr');
          if (index >= rows.length) return null;
          
          const row = rows[index];
          const cells = row.querySelectorAll('td');
          if (cells.length < 7) return null;

          return {
            code: cells[0]?.textContent?.trim() || '',
            name: cells[1]?.textContent?.trim() || '',
            section: cells[2]?.textContent?.trim() || '',
            activity: cells[3]?.textContent?.trim() || '',
            hours: cells[4]?.textContent?.trim() || '',
            gender: cells[5]?.textContent?.trim() || '',
            status: cells[6]?.textContent?.trim() || '',
            hasDetailLink: !!cells[7]?.querySelector('a')
          };
        }, i);

        if (!rowData || !rowData.code || !rowData.section) continue;

        // Initialize course
        if (!courses[rowData.code]) {
          courses[rowData.code] = {
            code: rowData.code,
            name: rowData.name,
            hours: parseInt(rowData.hours) || 0,
            sections: {}
          };
        }

        // Get times by clicking details
        let times = [];
        let instructor = '';

        if (rowData.hasDetailLink) {
          try {
            // Click the details link
            await page.evaluate((index) => {
              const table = document.querySelector('table[id*="timetable"], #myForm\\:timetable');
              const rows = table.querySelectorAll('tbody tr');
              const link = rows[index]?.querySelector('td:last-child a');
              if (link) link.click();
            }, i);

            await sleep(800);

            // Extract data from dialog
            const dialogData = await page.evaluate((daysMap) => {
              const times = [];
              let instructor = '';

              // Find visible dialog
              const dialogs = document.querySelectorAll('.ui-dialog, [role="dialog"], div[class*="dialog"]');
              
              for (const dialog of dialogs) {
                if (dialog.style.display === 'none' || !dialog.offsetParent) continue;

                // Find times table
                const tables = dialog.querySelectorAll('table');
                for (const table of tables) {
                  const rows = table.querySelectorAll('tr');
                  let isTimesTable = false;

                  for (let j = 0; j < rows.length; j++) {
                    const cells = rows[j].querySelectorAll('td, th');
                    const rowText = rows[j].textContent || '';

                    // Check if header row
                    if (rowText.includes('اليوم') || rowText.includes('الوقت')) {
                      isTimesTable = true;
                      continue;
                    }

                    if (isTimesTable && cells.length >= 2) {
                      const day = cells[0]?.textContent?.trim();
                      const time = cells[1]?.textContent?.trim();
                      const room = cells[2]?.textContent?.trim() || '';

                      if (day && time && /^[1-5]$/.test(day)) {
                        const timeParts = time.split('-').map(t => t.trim());
                        times.push({
                          day: daysMap[day] || day,
                          dayNum: parseInt(day),
                          start: timeParts[0] || '',
                          end: timeParts[1] || '',
                          room: room
                        });
                      }
                    }
                  }
                }

                // Get instructor
                const text = dialog.textContent || '';
                const match = text.match(/المحاضر\s*[:\s]\s*([^\n\r]+)/);
                if (match) {
                  instructor = match[1].replace(/لم يحدد من الكلية/g, '').trim();
                }

                break;
              }

              return { times, instructor };
            }, DAYS_MAP);

            times = dialogData.times || [];
            instructor = dialogData.instructor || '';

            // Close dialog
            await page.evaluate(() => {
              const closeBtn = document.querySelector('.ui-dialog-titlebar-close, .ui-icon-closethick');
              if (closeBtn) closeBtn.click();
              
              // Also try clicking overlay
              const overlay = document.querySelector('.ui-widget-overlay');
              if (overlay) overlay.click();
            });

            await sleep(400);

          } catch (e) {
            console.log(`Error getting details for ${rowData.code}-${rowData.section}:`, e.message);
          }
        }

        if (times.length > 0) sectionsWithTimes++;
        totalSections++;

        courses[rowData.code].sections[rowData.section] = {
          sectionNumber: rowData.section,
          activity: rowData.activity,
          gender: rowData.gender,
          status: rowData.status,
          instructor,
          times
        };

        if (totalSections % 10 === 0) {
          console.log(`Progress: ${totalSections}/${rowCount} sections (${sectionsWithTimes} with times)`);
        }

      } catch (rowError) {
        console.log(`Error on row ${i}:`, rowError.message);
      }
    }

    console.log(`Completed: ${Object.keys(courses).length} courses, ${totalSections} sections, ${sectionsWithTimes} with times`);

    return {
      major: major.code,
      majorName: major.name,
      exportDate: new Date().toISOString(),
      lastUpdated: Date.now(),
      totalCourses: Object.keys(courses).length,
      totalSections,
      sectionsWithTimes,
      courses
    };

  } catch (error) {
    console.error(`Error scraping ${major.name}:`, error);
    return null;
  } finally {
    await page.close();
  }
}

async function saveToFirebase(majorCode, data) {
  console.log(`Saving to Firebase: scheduleData/${majorCode}`);
  await db.ref(`scheduleData/${majorCode}`).set(data);
}

// Run
scrapeKSU()
  .then(() => {
    console.log('All done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });   