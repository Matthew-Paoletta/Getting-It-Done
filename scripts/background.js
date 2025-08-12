// ======================
// 🛠️ OAuth Token Management
// ======================

let authToken = null;

// Get Google OAuth token (with user prompt if needed)
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        authToken = token;
        resolve(token);
      }
    });
  });
}

// ======================
// 📡 API Communication
// ======================

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getAuthToken':
      getAuthToken().then(sendResponse);
      return true; // Required for async

    case 'addCalendarEvents':
      addEventsToCalendar(request.events).then(sendResponse);
      return true;

    case 'getTasks':
      fetchTasks().then(sendResponse);
      return true;
  }
});

// ======================
// 🗓️ Google Calendar API
// ======================

async function addEventsToCalendar(events) {
  try {
    const token = await getAuthToken();
    
    for (const event of events) {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(event)
        }
      );
      
      if (!response.ok) throw new Error('Event creation failed');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Calendar API Error:', error);
    return { success: false, error: error.message };
  }
}

// ======================
// ✅ Google Tasks API (Bonus)
// ======================

async function fetchTasks() {
  try {
    const token = await getAuthToken();
    const response = await fetch(
      'https://tasks.googleapis.com/tasks/v1/users/@me/lists/@default/tasks',
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    return await response.json();
  } catch (error) {
    console.error('Tasks API Error:', error);
    return { items: [] };
  }
}