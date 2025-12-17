/**
 * Popup initialization and ALL UI display logic centralized here
 */
import { setupImageProcess } from './imageProcess.js';
import { scheduleParser } from './scheduleParser.js';
import { textParser } from './textParser.js';
import { googleCalendarAPI } from './googleCalendar.js';

console.log('🚀 Popup.js loaded');

// ===== UI HELPER FUNCTIONS =====
function getSessionColor(type) {
  const map = { 
    Lecture: '#3366ff', 
    Discussion: '#22aa88', 
    Lab: '#cc6600', 
    'Final Exam': '#8a5cf0',
    'Midterm': '#e91e63'  // Pink for midterms
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

// ===== MAIN DISPLAY FUNCTIONS =====
export function displayScheduleResults(events, quarter, year) {
  console.log('📊 Displaying results for', events.length, 'events');
  
  const resultArea = document.getElementById('result-area');
  if (!resultArea) {
    console.error('❌ Result area not found');
    return;
  }
  
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
      return `
        <div class="session-row">
          <span class="type-pill" style="background:${color}22;color:${color};border:1px solid ${color}44;">
            ${sessionType}
          </span>
          <div class="session-info">
            <div class="line-1">
              <span class="days">${event.days || event.finalDay || ''}</span>
              <span class="time">${event.startTime || ''}–${event.endTime || ''}</span>
            </div>
            <div class="line-2">
              ${event.location ? `<span class="loc">📍 ${event.location}</span>` : ''}
              ${event.sectionCode ? `<span class="sec">Section ${event.sectionCode}</span>` : ''}
              ${event.instructor ? `<span class="inst">👨‍🏫 ${event.instructor}</span>` : ''}
            </div>
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

  // Render results
  resultArea.innerHTML = `
    <section class="results-wrap">
      <h2 class="results-title">📅 Schedule Parsed Successfully</h2>
      <div class="results-subtitle">${stats.totalEvents} event(s) found • ${stats.courseCount} course(s) • ${quarter} ${year}</div>
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
          <button id="google-calendar-btn" class="download-btn secondary">
            📅 Add to Google Calendar
          </button>
        </div>
      </div>
    </section>
  `;

  console.log('✅ Results displayed, setting up export buttons...');
  setupExportButtons(events, quarter, year);
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
          
          // ← MOVED TO POPUP.JS: Display ICS events in popup BEFORE download
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

    // Google Calendar Button setup
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
    
  }, 100);
  
  console.log('🎯 Export buttons setup initiated');
}

// ===== NEW: Display OCR results for debugging =====
export function displayOCRText(ocrResult, quarter, year) {
  console.log('🔍 Displaying OCR text for analysis');
  
  const resultArea = document.getElementById('result-area');
  if (!resultArea) return;
  
  // Create OCR text display
  const ocrDisplayHtml = `
    <section class="results-wrap">
      <h2 class="results-title">🔍 OCR Analysis Results</h2>
      <div class="results-subtitle">Text extracted from your WebReg screenshot • ${quarter} ${year}</div>
      
      <div style="margin: 16px 0;">
        <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px 0; color: #495057; font-size: 14px;">📊 OCR Metadata:</h4>
          <div style="font-size: 12px; color: #6c757d;">
            <span style="margin-right: 16px;">📁 File: ${ocrResult.metadata.fileName}</span>
            <span style="margin-right: 16px;">📏 Size: ${Math.round(ocrResult.metadata.fileSize / 1024)} KB</span>
            <span style="margin-right: 16px;">⏱️ Processing: ${ocrResult.metadata.processingTime}ms</span>
            <span>🔧 Engine: ${ocrResult.metadata.ocrEngine}</span>
          </div>
        </div>

        <div style="background: #fff; border: 2px solid #007bff; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
          <h4 style="margin: 0 0 12px 0; color: #007bff; font-size: 14px;">
            📄 Raw OCR Text (${ocrResult.text.length} characters)
          </h4>
          <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.4; max-height: 400px; overflow-y: auto; white-space: pre-wrap; word-wrap: break-word;">
${ocrResult.text}
          </div>
        </div>

        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px 0; color: #856404; font-size: 14px;">🔧 Debug Information:</h4>
          <div style="font-size: 12px; color: #856404; line-height: 1.5;">
            <strong>What we're looking for:</strong><br>
            • Course codes (like "CSE 105", "MATH 18", "BILD 1")<br>
            • Session types (Lecture, Discussion, Lab, Final Exam)<br>
            • Days (MW, TuTh, MWF, etc.)<br>
            • Times (like "2:00pm-3:20pm")<br>
            • Locations (CENTR 101, WLH 2005, etc.)<br>
            • Instructors (Last, First format)<br><br>
            <strong>Parsing will start after you analyze this text...</strong>
          </div>
        </div>

        <div class="export-buttons" style="text-align: center;">
          <button id="continue-parsing-btn" class="btn primary" style="margin-right: 12px;">
            ✅ Continue with Parsing
          </button>
          <button id="retry-ocr-btn" class="btn secondary">
            🔄 Try Different Image
          </button>
        </div>
      </div>
    </section>
  `;
  
  resultArea.innerHTML = ocrDisplayHtml;
  
  // Set up continue button
  const continueBtn = document.getElementById('continue-parsing-btn');
  if (continueBtn) {
    continueBtn.onclick = () => {
      console.log('🚀 User approved OCR text, continuing with parsing...');
      
      // Now parse the events
      const events = scheduleParser.parseTextToEvents(ocrResult.text, quarter, year);
      
      if (!events || events.length === 0) {
        displayError(new Error('No class schedule data could be parsed from the OCR text'));
        return;
      }

      // Validate events
      const validEvents = events.filter(event => event.isValid());
      if (validEvents.length === 0) {
        displayError(new Error('No valid events could be created from the schedule data'));
        return;
      }

      console.log('✅ Schedule parsing completed');
      console.log(`📊 Created ${validEvents.length} valid events`);

      // Display results
      displayScheduleResults(validEvents, quarter, year);
    };
  }
  
  // Set up retry button
  const retryBtn = document.getElementById('retry-ocr-btn');
  if (retryBtn) {
    retryBtn.onclick = () => {
      location.reload();
    };
  }
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

    // Display results using existing display function
    displayScheduleResults(result.events, quarter, year);

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