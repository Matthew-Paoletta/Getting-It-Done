import { setupImageProcess } from './imageProcess.js';

document.addEventListener('DOMContentLoaded', () => {
  // Only call setupImageProcess - it handles all the upload/view functionality
  setupImageProcess();
  
  // Keep quarter dates and other functionality
  const quarterInput = document.getElementById('quarter');
  const yearInput = document.getElementById('year');

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

  // Remove all the duplicate event listeners for upload and file input
  // setupImageProcess() handles these now

  // Keep only the export and calendar functionality
  const exportBtn = document.getElementById('export-btn');
  const previewBtn = document.getElementById('preview-btn');
  const previewArea = document.getElementById('preview-area');
  const status = document.getElementById('status');

  if (exportBtn) {
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
  }

  // Helper Functions (keep these)
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
    if (status) {
      status.textContent = message;
      status.className = type;
      setTimeout(() => status.textContent = '', 5000);
    }
  }
});