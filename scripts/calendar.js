async function addEventsToCalendar(events) {
  try {
    const token = await chrome.identity.getAuthToken({ interactive: true });
    
    for (const event of events) {
      const googleEvent = {
        summary: event.title,
        start: { dateTime: event.startTime },
        end: { dateTime: event.endTime },
        recurrence: event.days.length ? [`RRULE:FREQ=WEEKLY;BYDAY=${event.days.join(',')}`] : []
      };
      
      await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(googleEvent)
      });
    }
    
    return true;
  } catch (error) {
    console.error("Calendar export failed:", error);
    return false;
  }
}

export { addEventsToCalendar };