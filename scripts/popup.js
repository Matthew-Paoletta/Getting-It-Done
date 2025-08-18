import { setupUpload } from './upload.js';

document.addEventListener('DOMContentLoaded', () => {
  setupUpload();
  const uploadBtn = document.getElementById('upload-btn');
  const fileInput = document.getElementById('schedule-upload');
  const status = document.getElementById('status-message');
  const previewArea = document.getElementById('preview-area');
  const previewBtn = document.getElementById('preview-btn');
  const exportBtn = document.getElementById('export-btn');
  const quarterInput = document.getElementById('quarter');
  const yearInput = document.getElementById('year');

  let uploadedImageUrl = null;

  const ucsdQuarterDates = {
    'Fall 2025': { start: '09/25/2025', end: '12/05/2025' },
    'Winter 2025': { start: '01/06/2025', end: '03/14/2025' },
    'Spring 2025': { start: '03/31/2025', end: '06/06/2025' },
    'Summer Session 1 2025': { start: '06/30/2025', end: '08/01/2025' },
    'Summer Session 2 2025': { start: '08/04/2025', end: '09/05/2025' },
    'Fall 2026': { start: '09/24/2026', end: '12/04/2026' },
    'Winter 2026': { start: '01/05/2026', end: '03/13/2026' },
    'Spring 2026': { start: '03/30/2026', end: '06/05/2026' },
    'Summer Session 1 2026': { start: '06/29/2026', end: '07/31/2026' },
    'Summer Session 2 2026': { start: '08/03/2026', end: '09/04/2026' },
    'Fall 2027': { start: '09/23/2027', end: '12/03/2027' },
    'Winter 2027': { start: '01/04/2027', end: '03/12/2027' },
    'Spring 2027': { start: '03/29/2027', end: '06/04/2027' },
    'Summer Session 1 2027': { start: '06/28/2027', end: '07/30/2027' },
    'Summer Session 2 2027': { start: '08/02/2027', end: '09/03/2027' },
    'Fall 2028': { start: '09/28/2028', end: '12/08/2028' },
    'Winter 2028': { start: '01/10/2028', end: '03/17/2028' },
    'Spring 2028': { start: '04/03/2028', end: '06/09/2028' },
    'Summer Session 1 2028': { start: '07/03/2028', end: '08/04/2028' },
    'Summer Session 2 2028': { start: '08/07/2028', end: '09/08/2028' }
    // Add more years/quarters as needed
  };

  // Analyze Button
  document.getElementById('analyze-btn').addEventListener('click', async () => {
    status.textContent = '';
    previewArea.textContent = '';

    if (!fileInput.files.length) {
      status.textContent = 'Please select an image file.';
      return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
      const response = await fetch('http://localhost:5000/upload', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (response.ok) {
        previewArea.textContent = JSON.stringify(result, null, 2);
        // Save events to chrome.storage.local for preview/export
        if (result && result.events) {
          chrome.storage.local.set({ events: result.events }, () => {
            status.textContent = 'Schedule analyzed and saved!';
          });
        } else {
          status.textContent = 'No events found in image.';
        }
      } else {
        status.textContent = result.error || 'Error analyzing image.';
      }
    } catch (err) {
      status.textContent = 'Failed to connect to backend.';
    }
  });

  // Preview Button Functionality
  previewBtn.addEventListener('click', async () => {
    chrome.storage.local.get('events', ({ events }) => {
      if (!events || events.length === 0) {
        showStatus('No schedule to preview. Process an image first.', 'error');
        return;
      }
      previewArea.innerHTML = generateSchedulePreview(events);
      previewArea.style.display = 'block';
      showStatus('Schedule preview generated', 'success');
    });
  });

  // Export to Google Calendar Button
  exportBtn.addEventListener('click', async () => {
    const quarter = quarterInput.value;
    const year = yearInput.value;
    chrome.storage.local.get('events', ({ events }) => {
      if (!events || events.length === 0) {
        showStatus('No events to export. Process an image first.', 'error');
        return;
      }
      try {
        showStatus('Creating calendar...', 'loading');
        const calendarEvents = events.map(event => ({
          ...event,
          start: calculateDate(event.day, event.time, quarter, year),
          end: calculateDate(event.day, event.time, quarter, year, event.duration)
        }));
        const calendarLink = generateCalendarLink(calendarEvents);
        window.open(calendarLink, '_blank');
        showStatus('Calendar opened in new tab!', 'success');
      } catch (error) {
        console.error('Export failed:', error);
        showStatus('Failed to create calendar', 'error');
      }
    });
  });

  // When the button is clicked, trigger the file input
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  // When a file is selected, store its URL
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      uploadedImageUrl = URL.createObjectURL(fileInput.files[0]);
      uploadBtn.textContent = "Image Selected";
    }
  });

  // Optional: Show image preview when "Preview Schedule" is clicked
  previewBtn.addEventListener('click', () => {
    previewArea.innerHTML = '';
    if (uploadedImageUrl) {
      const img = document.createElement('img');
      img.src = uploadedImageUrl;
      img.alt = 'Schedule Preview';
      img.style.maxWidth = '100%';
      img.style.margin = '10px 0';
      previewArea.appendChild(img);
    } else {
      previewArea.textContent = 'No image uploaded.';
    }
  });

  // Show image preview when a file is selected
  fileInput.addEventListener('change', () => {
    const preview = document.getElementById('preview-area');
    preview.innerHTML = ''; // Clear previous preview
    if (fileInput.files && fileInput.files[0]) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(fileInput.files[0]);
      img.alt = 'Schedule Image Preview';
      img.style.maxWidth = '100%';
      img.style.marginBottom = '10px';
      preview.appendChild(img);
    }
  });

  // Helper Functions
  function generateSchedulePreview(events) {
    return `
      <h3>Your Schedule Preview</h3>
      <table class="schedule-table">
        <tr>
          <th>Course</th>
          <th>Day</th>
          <th>Time</th>
        </tr>
        ${events.map(event => `
          <tr>
            <td>${event.course}</td>
            <td>${event.day}</td>
            <td>${event.time}</td>
          </tr>
        `).join('')}
      </table>
    `;
  }

  function calculateDate(dayOfWeek, time, quarter, year, durationHours = 1) {
  // Compose key for lookup
  let key = quarter;
  if (!quarter.toLowerCase().includes('summer')) {
    key += ` ${year}`;
  } else {
    // For summer, dropdown value is "Summer Session 1" or "Summer Session 2"
    key = `${quarter} ${year}`;
  }
  const dates = ucsdQuarterDates[key];
  if (!dates) return '';

  const startDate = new Date(dates.start);
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const targetDay = days.indexOf(dayOfWeek.toLowerCase().substr(0, 3));
  while (startDate.getDay() !== targetDay) {
    startDate.setDate(startDate.getDate() + 1);
  }
  const [timePart, period] = time.split(' ');
  let [hours, minutes] = timePart.split(':').map(Number);
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  startDate.setHours(hours, minutes);
  // Optionally, add duration for end time
  if (durationHours) {
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + durationHours);
    return {
      start: startDate.toISOString().replace(/\.\d{3}Z$/, ''),
      end: endDate.toISOString().replace(/\.\d{3}Z$/, '')
    };
  }
  return startDate.toISOString().replace(/\.\d{3}Z$/, '');
  }

  function generateCalendarLink(events) {
    const baseUrl = 'https://calendar.google.com/calendar/u/0/r/eventedit';
    if (events.length > 0) {
      const firstEvent = events[0];
      return `${baseUrl}?text=${encodeURIComponent(firstEvent.course)}` +
             `&dates=${formatCalendarTime(firstEvent.start)}` +
             `/${formatCalendarTime(firstEvent.end)}` +
             `&details=${encodeURIComponent('Imported from Getting It Done')}`;
    }
    return baseUrl;
  }

  function formatCalendarTime(isoString) {
    return isoString.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.className = type;
    setTimeout(() => status.textContent = '', 5000);
  }
});