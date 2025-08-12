// Handle image upload
document.getElementById('process-btn').addEventListener('click', async () => {
  const fileInput = document.getElementById('schedule-upload');
  if (!fileInput.files.length) return;

  const imageFile = fileInput.files[0];
  const imageUrl = URL.createObjectURL(imageFile);

  // Show preview
  const previewArea = document.getElementById('preview-area');
  previewArea.innerHTML = `<img src="${imageUrl}" alt="Schedule Preview">`;

  // Extract text using OCR (Tesseract.js)
  const extractedText = await extractTextFromImage(imageFile);
  const events = parseSchedule(extractedText); // (You'll define this)
  
  // Save events for later export
  chrome.storage.local.set({ events });
});

// Export to Google Calendar
document.getElementById('export-btn').addEventListener('click', async () => {
  const { events } = await chrome.storage.local.get('events');
  if (!events?.length) return;

  const success = await addEventsToCalendar(events); // Defined in calendar.js
  const statusEl = document.getElementById('calendar-status');
  statusEl.textContent = success ? "✅ Added to Google Calendar!" : "❌ Failed to export.";
});
// Inside popup.js
const result = await chrome.runtime.sendMessage({
  action: 'addCalendarEvents',
  events: parsedEvents
});

if (result.success) {
  alert('Added to Google Calendar!');
} else {
  alert(`Error: ${result.error}`);
}