async function extractTextFromImage(imageFile) {
  const { createWorker } = Tesseract;
  const worker = await createWorker();
  
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  
  const { data: { text } } = await worker.recognize(imageFile);
  await worker.terminate();
  
  return text;
}

// Example schedule parser (adjust for UCSD's format)
function parseSchedule(text) {
  // Example: "CSE 101 | Mon/Wed 2:00 PM - 3:20 PM"
  const events = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const [course, ...timeParts] = line.split('|');
    const timeStr = timeParts.join('|').trim();
    
    // (You'll need to customize this for UCSD's format)
    const event = {
      title: course.trim(),
      startTime: parseTime(timeStr), // You'd define this
      endTime: parseEndTime(timeStr),
      days: parseDays(timeStr) // e.g., ["Mon", "Wed"]
    };
    
    events.push(event);
  }
  
  return events;
}

export { extractTextFromImage, parseSchedule };