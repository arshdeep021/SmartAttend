import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\singh\\.gemini\\antigravity\\brain\\da389f8b-7540-4853-aa94-23ded675a620';

async function run() {
  console.log('Launching Chrome via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1366, height: 850 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // 1. Landing Page
  console.log('1. Capturing Landing Page...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_landing_page.png') });

  // 2. Login Page
  console.log('2. Capturing Login Page...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_login_page.png') });

  // 3. Login as at-risk student Kabir Mehta
  console.log('3. Logging in as at-risk student (Kabir Mehta)...');
  await page.evaluate(() => {
    localStorage.clear();
    const emailInput = document.querySelector('input[type="email"]');
    const passInput = document.querySelector('input[type="password"]');
    emailInput.value = 'kabir.mehta@smartattend.edu';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    passInput.value = 'Student@123';
    passInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  console.log('Capturing Low Attendance Modal popup on login...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_low_attendance_modal_alert.png') });

  // 4. Acknowledge modal
  console.log('4. Acknowledging modal and capturing dashboard with red warning banner...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const ack = btns.find(b => b.textContent.includes('Acknowledge'));
    if (ack) ack.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_student_dashboard_low_attendance.png') });

  // 5. Open QR Scanner Modal
  console.log('5. Opening QR Scanner Modal...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const scanBtn = btns.find(b => b.textContent.includes('Scan Attendance'));
    if (scanBtn) scanBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '05_student_qr_scanner_modal.png') });

  // 6. Manual PIN tab
  console.log('6. Capturing Manual PIN Code fallback view...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const manualBtn = btns.find(b => b.textContent.includes('Manual Session Code'));
    if (manualBtn) manualBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '06_student_manual_pin_entry.png') });

  // 7. Student Attendance History
  console.log('7. Capturing Attendance History...');
  await page.goto('http://localhost:5173/student/history', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '07_student_attendance_history.png') });

  // 8. LOGOUT and Login as Teacher Dr. Sharma
  console.log('8. Logging in as Teacher Dr. Sharma...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 500));

  await page.evaluate(() => {
    // Click Teacher tab
    const btns = Array.from(document.querySelectorAll('button'));
    const teacherTab = btns.find(b => b.textContent.trim() === 'Teacher');
    if (teacherTab) teacherTab.click();

    const emailInput = document.querySelector('input[type="email"]');
    const passInput = document.querySelector('input[type="password"]');
    emailInput.value = 'dr.sharma@smartattend.edu';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    passInput.value = 'Teacher@123';
    passInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  console.log('Capturing Teacher Dashboard...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '08_teacher_dashboard.png') });

  // 9. Teacher Live Projector Screen
  console.log('9. Capturing Teacher Live Rotating QR Screen...');
  const activeLink = await page.evaluate(() => {
    const link = document.querySelector('a[href*="/teacher/live?sessionId="]');
    return link ? link.getAttribute('href') : null;
  });

  if (activeLink) {
    await page.goto('http://localhost:5173' + activeLink, { waitUntil: 'networkidle2' });
  } else {
    // Click Quick Live button on first course
    await page.evaluate(() => {
      const liveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Quick Live'));
      if (liveBtn) liveBtn.click();
    });
    await new Promise(r => setTimeout(r, 500));
    // Click launch
    await page.evaluate(() => {
      const launchBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch Projector QR'));
      if (launchBtn) launchBtn.click();
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
  }
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '09_teacher_live_qr_projector.png') });

  // 10. Teacher Courses & Roster
  console.log('10. Capturing Teacher Courses & Roster Management...');
  await page.goto('http://localhost:5173/teacher/courses', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '10_teacher_courses_roster.png') });

  // 11. Teacher Reports & Eligibility Breakdown
  console.log('11. Capturing Teacher Reports...');
  await page.goto('http://localhost:5173/teacher/reports', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '11_teacher_reports.png') });

  // 12. LOGOUT and Login as Administrator
  console.log('12. Logging in as Administrator...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 500));

  await page.evaluate(() => {
    // Click Admin tab
    const btns = Array.from(document.querySelectorAll('button'));
    const adminTab = btns.find(b => b.textContent.trim() === 'Admin');
    if (adminTab) adminTab.click();

    const emailInput = document.querySelector('input[type="email"]');
    const passInput = document.querySelector('input[type="password"]');
    emailInput.value = 'admin@smartattend.edu';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    passInput.value = 'Admin@123';
    passInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  console.log('Capturing Admin Dashboard...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '12_admin_dashboard.png') });

  // 13. Admin Teacher Approvals
  console.log('13. Capturing Admin Teacher Approvals Queue...');
  await page.goto('http://localhost:5173/admin/approvals', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '13_admin_teacher_approvals.png') });

  // 14. Admin System Settings
  console.log('14. Capturing Admin System Settings...');
  await page.goto('http://localhost:5173/admin/settings', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '14_admin_system_settings.png') });

  // 15. Admin Audit Trail
  console.log('15. Capturing Admin Audit Trail...');
  await page.goto('http://localhost:5173/admin/audit-logs', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '15_admin_audit_logs.png') });

  console.log('✅ ALL SCREENSHOTS SUCCESSFULLY UPDATED WITH ROLE LOGOUTS!');
  await browser.close();
}

run().catch(err => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});
