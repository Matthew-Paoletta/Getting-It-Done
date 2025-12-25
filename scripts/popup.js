/**
 * Popup initialization and ALL UI display logic centralized here
 */
import { setupImageProcess } from './imageProcess.js';
import { scheduleParser } from './scheduleParser.js';
import { textParser } from './textParser.js';
import { googleCalendarAPI } from './googleCalendar.js';

console.log('🚀 Popup.js loaded');

// ===== TIME OPTIONS FOR DROPDOWNS =====
// Classes can start as early as 8am, end as late as 9:20pm
// Times end in :00, :10, :20, :30, :40, :50
const TIME_OPTIONS = [];
for (let hour = 8; hour <= 21; hour++) {
  for (let minute of [0, 10, 20, 30, 40, 50]) {
    // Skip times after 9:20pm
    if (hour === 21 && minute > 20) continue;
    
    const h12 = hour % 12 || 12;
    const suffix = hour >= 12 ? 'p' : 'a';
    const minStr = minute.toString().padStart(2, '0');
    const display = `${h12}:${minStr}${suffix}m`;
    const value = `${h12}:${minStr}${suffix}`;
    TIME_OPTIONS.push({ value, display });
  }
}

// Day pattern options
const DAY_OPTIONS = [
  { value: 'M', display: 'Monday (M)' },
  { value: 'Tu', display: 'Tuesday (Tu)' },
  { value: 'W', display: 'Wednesday (W)' },
  { value: 'Th', display: 'Thursday (Th)' },
  { value: 'F', display: 'Friday (F)' },
  { value: 'MW', display: 'Mon/Wed (MW)' },
  { value: 'MWF', display: 'Mon/Wed/Fri (MWF)' },
  { value: 'TuTh', display: 'Tue/Thu (TuTh)' },
  { value: 'WF', display: 'Wed/Fri (WF)' },
  { value: 'MF', display: 'Mon/Fri (MF)' },
  { value: 'MTuWThF', display: 'Every Weekday' }
];

// ===== CHECK FOR MISSING INFO =====
// Only prompt for TRULY MISSING values - trust OCR if it read something
// TBA events (days === 'TBA' with no time) are intentionally TBA and should NOT be flagged for review
function checkForMissingInfo(events) {
  const eventsNeedingReview = [];
  
  events.forEach((event, index) => {
    const issues = [];
    const isExam = event.sessionType === 'Final Exam' || event.sessionType === 'Midterm';
    
    // Check if this is a TBA event (both day and time are TBA/empty)
    // These are intentionally TBA and should skip manual review - they'll show a TBA warning instead
    const isTBAEvent = event.days === 'TBA' && (!event.startTime || event.startTime === '');
    if (isTBAEvent) {
      console.log(`⏭️ Skipping TBA event from review: ${event.courseCode} ${event.sessionType}`);
      return; // Skip this event entirely - it's a known TBA, not missing info
    }
    
    // Check for missing days (for non-exam recurring events)
    // Only flag if completely missing - trust OCR if it read any day value
    if (!isExam) {
      if (!event.days || event.days === '' || event.days === 'MISSING_DAY') {
        issues.push({
          field: 'days',
          question: `What day(s) does your ${event.sessionType || 'class'} meet?`,
          type: 'select',
          options: DAY_OPTIONS
        });
      }
      // If OCR read something (even "TBA" or unusual), trust it
    }
    
    // Check for MISSING start time only - trust OCR if it read anything
    if (!event.startTime || event.startTime === '') {
      issues.push({
        field: 'startTime',
        question: 'What time does this class START?',
        type: 'time-select',
        currentValue: ''
      });
    }
    
    // Check for MISSING end time only - trust OCR if it read anything
    if (!event.endTime || event.endTime === '') {
      issues.push({
        field: 'endTime',
        question: 'What time does this class END?',
        type: 'time-select',
        currentValue: ''
      });
    }
    
    // Check for exam-specific date - only if completely missing
    if (isExam) {
      if (event.sessionType === 'Final Exam' && !event.finalDate) {
        issues.push({
          field: 'examDate',
          question: 'What DATE is your Final Exam?',
          type: 'date'
        });
      }
      if (event.sessionType === 'Midterm' && !event.midtermDate) {
        issues.push({
          field: 'examDate',
          question: 'What DATE is your Midterm?',
          type: 'date'
        });
      }
    }
    
    if (issues.length > 0) {
      eventsNeedingReview.push({ index, event, issues });
    }
  });
  
  return eventsNeedingReview;
}

// ===== DISPLAY REVIEW FORM FOR MISSING INFO =====
function displayMissingInfoReview(events, eventsNeedingReview, quarter, year) {
  console.log('🔍 Showing review form for', eventsNeedingReview.length, 'events with missing info');
  
  const resultArea = document.getElementById('result-area');
  if (!resultArea) return;
  
  // Build review cards
  const reviewCards = eventsNeedingReview.map(({ index, event, issues }) => {
    const sessionType = event.sessionType || 'Unknown';
    const color = getSessionColor(sessionType);
    
    // Build questions HTML
    const questionsHtml = issues.map(issue => {
      let inputHtml = '';
      
      if (issue.type === 'select') {
        // Day selection dropdown
        const options = issue.options.map(opt => 
          `<option value="${opt.value}">${opt.display}</option>`
        ).join('');
        inputHtml = `
          <select class="review-select" data-field="${issue.field}">
            <option value="">-- Select --</option>
            ${options}
          </select>
        `;
      } else if (issue.type === 'time-select') {
        // Time dropdown
        const options = TIME_OPTIONS.map(opt => 
          `<option value="${opt.value}">${opt.display}</option>`
        ).join('');
        inputHtml = `
          <select class="review-select time-select" data-field="${issue.field}">
            <option value="">-- Select Time --</option>
            ${options}
          </select>
          ${issue.currentValue ? `<span class="ocr-hint">OCR read: "${issue.currentValue}"</span>` : ''}
        `;
      } else if (issue.type === 'date') {
        // Date picker
        inputHtml = `
          <input type="date" class="review-date" data-field="${issue.field}">
        `;
      }
      
      return `
        <div class="review-question">
          <label class="question-label">❓ ${issue.question}</label>
          <div class="question-input">
            ${inputHtml}
          </div>
        </div>
      `;
    }).join('');
    
    // Show what we DID successfully read
    const readInfo = [];
    if (event.courseCode) readInfo.push(`📚 ${event.courseCode}`);
    if (event.days && event.days !== 'MISSING_DAY' && event.days !== 'TBA') readInfo.push(`📅 ${event.days}`);
    if (event.startTime && /^\d{1,2}:\d{2}[ap]$/i.test(event.startTime)) readInfo.push(`⏰ ${event.startTime}`);
    if (event.endTime && /^\d{1,2}:\d{2}[ap]$/i.test(event.endTime)) readInfo.push(`⏰ to ${event.endTime}`);
    if (event.location && event.location !== 'TBA') readInfo.push(`📍 ${event.location}`);
    
    return `
      <div class="review-card" data-event-index="${index}">
        <div class="review-header">
          <span class="type-pill" style="background:${color}22;color:${color};border:1px solid ${color}44;">
            ${sessionType}
          </span>
          <span class="review-course">${event.courseCode || 'Unknown Course'}</span>
        </div>
        ${event.courseTitle ? `<div class="review-title">${event.courseTitle}</div>` : ''}
        ${readInfo.length > 0 ? `
          <div class="review-detected">
            <span class="detected-label">✅ Detected:</span> ${readInfo.join(' • ')}
          </div>
        ` : ''}
        <div class="review-questions">
          ${questionsHtml}
        </div>
      </div>
    `;
  }).join('');
  
  // Count events that are OK
  const okCount = events.length - eventsNeedingReview.length;
  
  resultArea.innerHTML = `
    <section class="results-wrap">
      <h2 class="results-title">🔍 Some Info Needs Your Help</h2>
      <div class="results-subtitle">
        We found ${events.length} events, but ${eventsNeedingReview.length} need some info filled in.
        ${okCount > 0 ? `<br><span style="color: var(--success);">✅ ${okCount} events look good!</span>` : ''}
      </div>
      
      <div class="review-tip">
        💡 <strong>Why?</strong> OCR sometimes misreads text. Please verify the info below.
      </div>
      
      <div class="review-cards">
        ${reviewCards}
      </div>
      
      <div class="review-actions">
        <button id="apply-fixes-btn" class="btn primary">
          ✅ Apply & Continue
        </button>
        <button id="skip-problem-events-btn" class="btn secondary">
          ⏭️ Skip These (use ${okCount} good ones)
        </button>
      </div>
    </section>
  `;
  
  // Setup Apply button
  document.getElementById('apply-fixes-btn')?.addEventListener('click', () => {
    console.log('✅ Applying user corrections...');
    
    // Gather all corrections from the form
    document.querySelectorAll('.review-card').forEach(card => {
      const eventIndex = parseInt(card.dataset.eventIndex);
      const event = events[eventIndex];
      
      // Get day selection
      const daySelect = card.querySelector('[data-field="days"]');
      if (daySelect?.value) {
        event.days = daySelect.value;
        console.log(`✅ Set ${event.courseCode} days to: ${event.days}`);
      }
      
      // Get start time
      const startSelect = card.querySelector('[data-field="startTime"]');
      if (startSelect?.value) {
        event.startTime = startSelect.value;
        console.log(`✅ Set ${event.courseCode} start time to: ${event.startTime}`);
      }
      
      // Get end time
      const endSelect = card.querySelector('[data-field="endTime"]');
      if (endSelect?.value) {
        event.endTime = endSelect.value;
        console.log(`✅ Set ${event.courseCode} end time to: ${event.endTime}`);
      }
      
      // Get exam date
      const dateInput = card.querySelector('[data-field="examDate"]');
      if (dateInput?.value) {
        if (event.sessionType === 'Final Exam') {
          event.finalDate = dateInput.value;
        } else if (event.sessionType === 'Midterm') {
          event.midtermDate = dateInput.value;
        }
        console.log(`✅ Set ${event.courseCode} exam date`);
      }
    });
    
    // Filter out events still missing critical info (but ALLOW TBA events through - they'll show a warning)
    const validEvents = events.filter(e => {
      const isExam = e.sessionType === 'Final Exam' || e.sessionType === 'Midterm';
      const isTBAEvent = e.days === 'TBA' || (!e.startTime && !e.endTime);
      
      // TBA events are valid - they'll be shown with a warning in the results
      if (isTBAEvent) return true;
      
      const hasDays = isExam || (e.days && e.days !== 'MISSING_DAY');
      const hasTime = e.startTime && e.endTime;
      return hasDays && hasTime;
    });
    
    console.log(`📊 ${validEvents.length} events ready after corrections (includes TBA events)`);
    
    if (validEvents.length === 0) {
      alert('Please fill in at least the day and time fields to continue.');
      return;
    }
    
    // Go directly to results - no more review loops!
    displayScheduleResults(validEvents, quarter, year);
  });
  
  // Setup Skip button
  document.getElementById('skip-problem-events-btn')?.addEventListener('click', () => {
    // Get only the events that don't need review
    const goodEventIndices = new Set(eventsNeedingReview.map(r => r.index));
    const goodEvents = events.filter((_, i) => !goodEventIndices.has(i));
    
    console.log(`⏭️ Skipping ${eventsNeedingReview.length} problem events, using ${goodEvents.length}`);
    
    if (goodEvents.length === 0) {
      alert('All events need review. Please fill in the missing info to continue.');
      return;
    }
    
    displayScheduleResults(goodEvents, quarter, year);
  });
}

// ===== ENTRY POINT: Check events and show review if needed =====
export function processAndDisplayEvents(events, quarter, year) {
  console.log('🔄 Processing', events.length, 'events...');
  
  // Check for missing info
  const eventsNeedingReview = checkForMissingInfo(events);
  
  if (eventsNeedingReview.length > 0) {
    // Show review form
    displayMissingInfoReview(events, eventsNeedingReview, quarter, year);
  } else {
    // All events look good, show results directly
    displayScheduleResults(events, quarter, year);
  }
}

// ===== UI HELPER FUNCTIONS =====
function getSessionColor(type) {
  const map = { 
    Lecture: '#3366ff', 
    Discussion: '#22aa88', 
    Lab: '#cc6600', 
    'Final Exam': '#8a5cf0',
    'Midterm': '#e91e63'
  };
  return map[type] || '#667eea';
}

function getICSEventColor(eventType) {
  const colors = {
    'Lecture': '#3366ff',
    'Discussion': '#22aa88', 
    'Lab': '#cc6600',
    'Final Exam': '#8a5cf0',
    'Midterm': '#e91e63'
  };
  return colors[eventType] || '#667eea';
}

// ===== HELPER: Check if event has TBA schedule =====
function isTBAEvent(event) {
  const isExam = event.sessionType === 'Final Exam' || event.sessionType === 'Midterm';
  const days = event.days || '';
  const hasTBADays = !days || days === 'TBA' || days === 'MISSING_DAY';
  const hasTBATime = !event.startTime || event.startTime === 'TBA' || !event.endTime || event.endTime === 'TBA';
  
  // For exams, check finalDate instead of days
  if (isExam) {
    return hasTBATime; // Exams need time, date is separate
  }
  
  return hasTBADays || hasTBATime;
}

// ===== MAIN DISPLAY FUNCTIONS =====
export function displayScheduleResults(events, quarter, year) {
  console.log('📊 Displaying results for', events.length, 'events');
  
  const resultArea = document.getElementById('result-area');
  if (!resultArea) {
    console.error('❌ Result area not found');
    return;
  }
  
  // Separate TBA events from exportable events
  const exportableEvents = events.filter(e => !isTBAEvent(e));
  const tbaEvents = events.filter(e => isTBAEvent(e));
  
  console.log(`📊 ${exportableEvents.length} exportable, ${tbaEvents.length} TBA events`);
  
  // Group events by course
  const grouped = events.reduce((acc, event) => {
    const key = event.courseCode || 'Unknown Course';
    if (!acc[key]) {
      acc[key] = {
        title: event.courseTitle || '',
        items: []
      };
    }
    acc[key].items.push(event);
    return acc;
  }, {});

  // Get event statistics
  const stats = scheduleParser.getEventStatistics(events);

  // Create type chips
  const chips = Object.entries(stats.sessionTypes)
    .map(([type, count]) => `<span class="chip">${type}: ${count}</span>`)
    .join('');

  // Create course cards
  const courseCards = Object.entries(grouped).map(([courseCode, group]) => {
    const sessions = group.items.map(event => {
      const sessionType = event.getNormalizedSessionType();
      const color = getSessionColor(sessionType);
      const isTBA = isTBAEvent(event);
      
      // TBA notice for events that won't be exported
      const tbaNotice = isTBA ? `
        <div class="tba-notice">
          ⚠️ <strong>Not exported</strong> — Day/time TBA. Check WebReg for updates.
        </div>` : '';
      
      // For exams, show the date (03/16/2026) not the day letter (M)
      const isExam = sessionType === 'Final Exam' || sessionType === 'Midterm';
      const displayDate = isExam ? (event.finalDate || 'TBA') : (event.days || event.finalDay || 'TBA');
      
      // For time display, show "TBA" if both start and end are missing, otherwise show the range
      const hasTime = event.startTime && event.endTime;
      const timeDisplay = hasTime ? `${event.startTime}–${event.endTime}` : 'TBA';
      
      return `
        <div class="session-row ${isTBA ? 'tba-event' : ''}">
          <span class="type-pill" style="background:${color}22;color:${color};border:1px solid ${color}44;">
            ${sessionType}
          </span>
          <div class="session-info">
            <div class="line-1">
              <span class="days">${displayDate}</span>
              <span class="time">${timeDisplay}</span>
            </div>
            <div class="line-2">
              ${event.location ? `<span class="loc">📍 ${event.location}</span>` : ''}
              ${event.sectionCode ? `<span class="sec">Section ${event.sectionCode}</span>` : ''}
              ${event.instructor ? `<span class="inst">👨‍🏫 ${event.instructor}</span>` : ''}
            </div>
            ${tbaNotice}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="course-card">
        <div class="course-header">
          <div class="course-code">${courseCode}</div>
          ${group.title ? `<div class="course-title">${group.title}</div>` : ''}
        </div>
        <div class="course-body">${sessions}</div>
      </div>`;
  }).join('');

  // TBA warning message if there are TBA events
  const tbaWarning = tbaEvents.length > 0 ? `
    <div class="tba-warning">
      ⚠️ <strong>${tbaEvents.length} event(s)</strong> have TBA times and won't be exported. Check WebReg for updates.
    </div>` : '';

  // Render results
  resultArea.innerHTML = `
    <section class="results-wrap">
      <h2 class="results-title">📅 Schedule Parsed Successfully</h2>
      <div class="results-subtitle">${stats.totalEvents} event(s) found • ${exportableEvents.length} exportable • ${quarter} ${year}</div>
      ${tbaWarning}
      <div class="results-chips">${chips}</div>
      <div class="events-grid">
        ${courseCards || '<div class="empty">No sessions detected in the image.</div>'}
      </div>
      <div class="export-card">
        <h3>🎯 Export Your Schedule</h3>
        <p>Download your complete class schedule as a .ics calendar file that you can import into Google Calendar, Outlook, or any calendar app.</p>
        <div class="export-buttons">
          <button id="download-ics-btn" class="download-btn">
            📥 Download .ics File
          </button>
          <!-- Google Calendar direct sync - hidden until app is verified
          <button id="google-calendar-btn" class="download-btn secondary">
            📅 Add to Google Calendar
          </button>
          -->
        </div>
      </div>
    </section>
  `;

  console.log('✅ Results displayed, setting up export buttons...');
  // Only pass exportable events to the export buttons (exclude TBA events)
  setupExportButtons(exportableEvents, quarter, year);
}

export function displayICSEventsPreview(icsEvents, filename) {
  console.log('📋 Displaying ICS events preview for', icsEvents.length, 'events');
  
  const resultArea = document.getElementById('result-area');
  if (!resultArea) return;
  
  // Create ICS preview section
  const icsPreviewHtml = `
    <div class="ics-preview-card" style="margin-top: 20px; background: #e8f5e9; border: 2px solid #4CAF50; border-radius: 8px; padding: 16px;">
      <h3 style="color: #2E7D32; margin: 0 0 12px 0; font-size: 16px;">
        📄 ICS File Contents Preview
      </h3>
      <div style="background: white; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
        <div style="font-weight: 600; color: #1976D2; margin-bottom: 8px;">
          📁 File: ${filename}
        </div>
        <div style="font-size: 12px; color: #666; margin-bottom: 12px;">
          ${icsEvents.length} calendar events will be added to your calendar
        </div>
        
        <div class="ics-events-list" style="max-height: 300px; overflow-y: auto;">
          ${icsEvents.map(event => `
            <div class="ics-event-item" style="border-left: 4px solid ${getICSEventColor(event.type)}; padding: 8px 12px; margin: 6px 0; background: #fafafa; border-radius: 0 4px 4px 0;">
              <div style="font-weight: 600; color: #333; margin-bottom: 2px;">
                ${event.title}
              </div>
              <div style="font-size: 11px; color: #666; line-height: 1.4;">
                <span style="margin-right: 12px;">📅 ${event.days}</span>
                <span style="margin-right: 12px;">⏰ ${event.startTime} - ${event.endTime}</span>
                ${event.location !== 'TBA' ? `<span style="margin-right: 12px;">📍 ${event.location}</span>` : ''}
              </div>
              ${event.instructor ? `<div style="font-size: 11px; color: #666; margin-top: 2px;">👨‍🏫 ${event.instructor}</div>` : ''}
              <div style="font-size: 10px; color: #888; margin-top: 4px; font-style: italic;">
                ${event.recurrence}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 8px; font-size: 11px; color: #856404;">
        <strong>✨ Import Instructions:</strong> After downloading, open your calendar app (Google Calendar, Outlook, Apple Calendar) and import this .ics file to add all these events automatically.
      </div>
    </div>
  `;
  
  // Insert the preview after the existing export card
  const exportCard = resultArea.querySelector('.export-card');
  if (exportCard) {
    exportCard.insertAdjacentHTML('afterend', icsPreviewHtml);
    
    // Scroll to the preview
    const previewCard = resultArea.querySelector('.ics-preview-card');
    if (previewCard) {
      previewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

export function displayError(error) {
  console.error('❌ Processing failed:', error);
  
  // Show error in result area
  const resultArea = document.getElementById('result-area');
  if (resultArea) {
    resultArea.innerHTML = `
      <div class="results-wrap">
        <h2 style="color: var(--error);">❌ Processing Failed</h2>
        <p><strong>Error:</strong> ${error.message}</p>
        <div class="instructions-box" style="background: #ffebee; border: 1px solid #ffcdd2;">
          <h3>💡 Troubleshooting Tips:</h3>
          <ul style="padding-left: 20px; margin: 8px 0;">
            <li>Make sure you uploaded a screenshot of your WebReg schedule (List view)</li>
            <li>Ensure the image is clear and all text is readable</li>
            <li>Try taking a new screenshot with better lighting/contrast</li>
            <li>Make sure all courses and their details are visible in the screenshot</li>
            <li>Check that the image shows the complete table with headers</li>
          </ul>
        </div>
        <button onclick="location.reload()" class="btn primary" style="margin-top: 16px;">
          🔄 Try Again
        </button>
      </div>
    `;
  }
}

// ===== BUTTON SETUP FUNCTIONS =====
export function setupExportButtons(events, quarter, year) {
  console.log('🔧 Setting up export buttons for', events.length, 'events');
  
  setTimeout(() => {
    console.log('🔍 Setting up download button...');
    
    const downloadBtn = document.getElementById('download-ics-btn');
    if (downloadBtn) {
      console.log('✅ Download button found');
      
      downloadBtn.onclick = null;
      
      downloadBtn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔘 DOWNLOAD BUTTON CLICKED!');
        
        try {
          this.disabled = true;
          this.textContent = '⏳ Generating...';
          
          console.log('📄 Generating ICS file...');
          console.log('Events:', events.length, 'Quarter:', quarter, 'Year:', year);
          
          const icsData = googleCalendarAPI.generateICSFile(events, quarter, year);
          console.log('✅ ICS generated:', icsData.filename);
          
          // Display ICS events in popup BEFORE download
          displayICSEventsPreview(icsData.icsEvents, icsData.filename);
          
          console.log('📥 Starting download...');
          
          const blob = new Blob([icsData.content], { 
            type: 'text/calendar;charset=utf-8' 
          });
          
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = icsData.filename;
          
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          URL.revokeObjectURL(url);
          
          console.log('✅ Download completed');
          
          this.textContent = '✅ Downloaded!';
          this.style.background = '#4CAF50';
          
          setTimeout(() => {
            this.disabled = false;
            this.textContent = '📥 Download .ics File';
            this.style.background = '';
          }, 2000);
          
        } catch (error) {
          console.error('❌ Download failed:', error);
          
          this.disabled = false;
          this.textContent = '❌ Failed';
          this.style.background = '#f44336';
          
          setTimeout(() => {
            this.textContent = '📥 Download .ics File';
            this.style.background = '';
          }, 3000);
        }
      };
      
      console.log('✅ Download button handler attached');
    } else {
      console.error('❌ Download button not found');
    }

    // Google Calendar Button setup - DISABLED until Google verification is complete
    // Uncomment this section when ready to enable direct Google Calendar sync
    /*
    const googleBtn = document.getElementById('google-calendar-btn');
    if (googleBtn) {
      console.log('✅ Google Calendar button found');
      
      googleBtn.onclick = null;
      
      googleBtn.onclick = async function(e) {
        e.preventDefault();
        console.log('🔘 Google Calendar button clicked');
        
        try {
          this.disabled = true;
          this.textContent = '🔐 Authenticating...';
          
          await googleCalendarAPI.authenticate();
          this.textContent = '📅 Creating Events...';
          
          const googleEvents = events.map(event => ({
            courseCode: event.courseCode,
            courseTitle: event.courseTitle,
            sessionType: event.getNormalizedSessionType(),
            instructor: event.instructor,
            days: event.days,
            startTime: event.startTime,
            endTime: event.endTime,
            location: event.location,
            quarter: quarter,
            year: year
          }));

          const results = await googleCalendarAPI.createMultipleEvents(
            googleEvents,
            'primary',
            (progress) => {
              this.textContent = `📅 Creating... ${progress.current}/${progress.total}`;
            }
          );
          
          this.textContent = `✅ Added ${results.created.length} Events!`;
          this.style.background = '#4CAF50';
          
          setTimeout(() => {
            this.disabled = false;
            this.textContent = '📅 Add to Google Calendar';
            this.style.background = '';
          }, 3000);
          
        } catch (error) {
          console.error('❌ Google Calendar sync failed:', error);
          alert(`Google Calendar sync failed: ${error.message}`);
          
          this.disabled = false;
          this.textContent = '❌ Sync Failed';
          this.style.background = '#f44336';
          
          setTimeout(() => {
            this.textContent = '📅 Add to Google Calendar';
            this.style.background = '';
          }, 3000);
        }
      };
    }
    */
    
  }, 100);
  
  console.log('🎯 Export buttons setup initiated');
}

// ===== INPUT METHOD TOGGLE =====
function setupInputMethodToggle() {
  const imageMethodBtn = document.getElementById('method-image');
  const textMethodBtn = document.getElementById('method-text');
  const imageSection = document.getElementById('image-input-section');
  const textSection = document.getElementById('text-input-section');
  const processStep = document.getElementById('process-step');

  if (!imageMethodBtn || !textMethodBtn) {
    console.error('❌ Input method buttons not found');
    return;
  }

  console.log('✅ Found toggle buttons, setting up listeners...');

  // Text method is now default - hide process step initially
  processStep.style.display = 'none';

  imageMethodBtn.addEventListener('click', () => {
    console.log('📷 Image method clicked');
    imageMethodBtn.classList.add('active');
    textMethodBtn.classList.remove('active');
    imageSection.style.display = 'block';
    textSection.style.display = 'none';
    processStep.style.display = 'flex';
  });

  textMethodBtn.addEventListener('click', () => {
    console.log('📋 Text method clicked');
    textMethodBtn.classList.add('active');
    imageMethodBtn.classList.remove('active');
    textSection.style.display = 'block';
    imageSection.style.display = 'none';
    processStep.style.display = 'none';
  });

  console.log('✅ Input method toggle setup complete');
}

// ===== TEXT INPUT HANDLING =====
function setupTextInput() {
  const textArea = document.getElementById('schedule-text');
  const charCount = document.getElementById('text-char-count');
  const parseBtn = document.getElementById('parse-text-btn');

  if (!textArea || !parseBtn) {
    console.error('❌ Text input elements not found');
    return;
  }

  // Update character count and enable/disable button
  textArea.addEventListener('input', () => {
    const length = textArea.value.length;
    charCount.textContent = `${length} characters`;
    
    if (length > 50) {
      charCount.classList.add('has-content');
      parseBtn.disabled = false;
    } else {
      charCount.classList.remove('has-content');
      parseBtn.disabled = true;
    }
  });

  // Parse button click handler
  parseBtn.addEventListener('click', () => {
    console.log('🔄 Parse button clicked');
    handleTextParsing();
  });

  console.log('✅ Text input setup complete');
}

// ===== TEXT PARSING HANDLER =====
function handleTextParsing() {
  console.log('🔄 Starting text parsing...');
  
  const textArea = document.getElementById('schedule-text');
  const parseBtn = document.getElementById('parse-text-btn');
  const quarterSelect = document.getElementById('quarter');
  const yearSelect = document.getElementById('year');

  if (!textArea || !textArea.value.trim()) {
    displayError(new Error('Please paste your WebReg schedule text'));
    return;
  }

  const rawText = textArea.value;
  const quarter = quarterSelect?.value || 'Fall';
  const year = yearSelect?.value || '2025';

  // Disable button and show progress
  parseBtn.disabled = true;
  parseBtn.innerHTML = '⏳ Parsing...';

  try {
    console.log(`📝 Parsing text for ${quarter} ${year}`);
    console.log(`Text preview: ${rawText.substring(0, 200)}...`);

    // Parse the text using textParser
    const result = textParser.parseWebRegText(rawText, quarter, year);

    if (result.error && result.events.length === 0) {
      throw new Error(result.error);
    }

    console.log(`✅ Parsed ${result.events.length} events`);

    // Process events and check for missing info
    processAndDisplayEvents(result.events, quarter, year);

    // Show success feedback
    parseBtn.innerHTML = '✅ Parsed!';
    parseBtn.style.background = '#4CAF50';

    setTimeout(() => {
      parseBtn.disabled = false;
      parseBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        Parse Schedule Text
      `;
      parseBtn.style.background = '';
    }, 2000);

  } catch (error) {
    console.error('❌ Text parsing failed:', error);
    displayTextParsingError(error);

    parseBtn.disabled = false;
    parseBtn.innerHTML = '❌ Failed - Try Again';
    parseBtn.style.background = '#f44336';

    setTimeout(() => {
      parseBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        Parse Schedule Text
      `;
      parseBtn.style.background = '';
    }, 3000);
  }
}

// ===== TEXT PARSING ERROR DISPLAY =====
function displayTextParsingError(error) {
  const resultArea = document.getElementById('result-area');
  if (!resultArea) return;

  resultArea.innerHTML = `
    <div class="results-wrap">
      <h2 style="color: var(--error);">❌ Text Parsing Failed</h2>
      <p><strong>Error:</strong> ${error.message}</p>
      
      <div class="instructions-box" style="background: #ffebee; border: 1px solid #ffcdd2;">
        <h3>💡 Tips for copying from WebReg:</h3>
        <ul style="padding-left: 20px; margin: 8px 0;">
          <li>Make sure you're on the <strong>"List" tab</strong> in WebReg</li>
          <li>Select the entire schedule table including all rows</li>
          <li>Copy with Ctrl+C (Windows) or Cmd+C (Mac)</li>
          <li>Paste directly into the text box</li>
          <li>Make sure your schedule has at least one enrolled course</li>
        </ul>
      </div>

      <div class="instructions-box" style="background: #e3f2fd; border: 1px solid #90caf9; margin-top: 12px;">
        <h3>📋 Expected format example:</h3>
        <pre style="font-size: 10px; overflow-x: auto; white-space: pre-wrap; background: #f5f5f5; padding: 8px; border-radius: 4px; margin-top: 8px;">
CSE 100	Advanced Data Structures	A00	LE	Sahoo, Debashis	L	4.00	MWF	9:00a-9:50a	PETER	108
    A01	DI	W	8:00p-8:50p	PETER	108
    Midterm	MI	Sa 02/07/2026	3:00p-4:50p	PETER	108
    Final Exam	FI	W 03/18/2026	8:00a-10:59a	PETER	108
        </pre>
      </div>

      <button onclick="location.reload()" class="btn primary" style="margin-top: 16px;">
        🔄 Try Again
      </button>
    </div>
  `;
}

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM loaded, initializing...');
  
  try {
    // Add these two new setup calls
    setupInputMethodToggle();
    setupTextInput();
    
    // Setup image processing (existing)
    setupImageProcess();
    
    console.log('✅ All initialization completed');
  } catch (error) {
    console.error('❌ Failed during initialization:', error);
  }
});
