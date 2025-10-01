/**
 * Google Calendar API integration and ICS file generation for Chrome extension
 * Combined functionality from GoogleCalendarAPI and CalendarGenerator
 */

export class GoogleCalendarAPI {
  constructor() {
    this.accessToken = null;
    this.isAuthenticated = false;
  }

  // ===== ICS FILE GENERATION METHODS =====

  /**
* Generate ICS file content from events
   */
  generateICSFile(events, quarter, year) {
    console.log('🔧 generateICSFile called with:', { 
      eventsLength: events.length, 
      quarter, 
      year 
    });

    try {
      // ICS file header
      let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Getting It Done//UCSD Schedule//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:UCSD ${quarter} ${year} Schedule`,
        'X-WR-TIMEZONE:America/Los_Angeles'
      ].join('\r\n') + '\r\n';

      let eventsCreated = 0;
      const createdICSEvents = []; // ← NEW: Track created ICS events for display

      // Add timezone definition
      icsContent += [
        'BEGIN:VTIMEZONE',
        'TZID:America/Los_Angeles',
        'BEGIN:DAYLIGHT',
        'TZOFFSETFROM:-0800',
        'TZOFFSETTO:-0700',
        'TZNAME:PDT',
        'DTSTART:20070311T020000',
        'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
        'END:DAYLIGHT',
        'BEGIN:STANDARD',
        'TZOFFSETFROM:-0700',
        'TZOFFSETTO:-0800',
        'TZNAME:PST',
        'DTSTART:20071104T020000',
        'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
        'END:STANDARD',
        'END:VTIMEZONE'
      ].join('\r\n') + '\r\n';

      // Process each event
      for (const event of events) {
        try {
          console.log('📅 Processing event:', event.courseCode, event.getNormalizedSessionType());

          const sessionType = event.getNormalizedSessionType();
          
          // Skip if no required data
          if (!event.courseCode || !event.startTime || !event.endTime) {
            console.log('⚠️ Skipping event with missing data:', event.courseCode);
            continue;
          }

          // Handle Final Exams (one-time events)
          if (sessionType === 'Final Exam') {
            console.log('🎯 Creating Final Exam event for:', event.courseCode);
            const finalEvent = this.createFinalExamEvent(event, quarter, year);
            if (finalEvent) {
              icsContent += finalEvent + '\r\n';
              eventsCreated++;
              
              // ← NEW: Track final exam for display
              createdICSEvents.push({
                type: 'Final Exam',
                title: `${event.courseCode} Final Exam`,
                courseCode: event.courseCode,
                courseTitle: event.courseTitle || '',
                days: event.finalDay || 'TBA',
                date: event.finalDate || 'TBA',
                startTime: event.startTime,
                endTime: event.endTime,
                location: event.location || 'TBA',
                instructor: event.instructor || '',
                recurrence: 'One-time event'
              });
              
              console.log('✅ Added Final Exam:', event.courseCode);
            }
            continue;
          }

          // Handle regular weekly events (Lectures, Discussions, Labs)
          if (sessionType === 'Lecture' || sessionType === 'Discussion' || sessionType === 'Lab') {
            console.log('📚 Creating weekly event for:', event.courseCode, sessionType);
            console.log('Event days:', event.days);
            
            const weeklyEvents = this.createWeeklyEvents(event, quarter, year);
            console.log('Generated weekly events:', weeklyEvents.length);
            
            for (const weeklyEvent of weeklyEvents) {
              icsContent += weeklyEvent + '\r\n';
              eventsCreated++;
              console.log('✅ Added weekly event:', event.courseCode, sessionType);
            }
            
            // ← NEW: Track weekly events for display (one entry per course/session)
            if (weeklyEvents.length > 0) {
              const { startDate, endDate } = this.getQuarterDates(quarter, year);
              const totalOccurrences = this.calculateWeeklyOccurrences(event.days, startDate, endDate);
              
              createdICSEvents.push({
                type: sessionType,
                title: `${event.courseCode} - ${sessionType}`,
                courseCode: event.courseCode,
                courseTitle: event.courseTitle || '',
                days: event.days || 'TBA',
                startTime: event.startTime,
                endTime: event.endTime,
                location: event.location || 'TBA',
                instructor: event.instructor || '',
                recurrence: `Weekly • ${totalOccurrences} occurrences • ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
              });
            }
          }

        } catch (eventError) {
          console.error('❌ Error processing event:', event.courseCode, eventError);
        }
      }

      // ICS file footer
      icsContent += 'END:VCALENDAR\r\n';

      const filename = `ucsd-${quarter.toLowerCase()}-${year}-schedule.ics`;
      
      console.log('✅ ICS file generated:', {
        filename,
        eventsCreated,
        contentLength: icsContent.length
      });

      return {
        content: icsContent,
        filename: filename,
        eventsCreated: eventsCreated,
        icsEvents: createdICSEvents // ← NEW: Return the tracked events for display
      };

    } catch (error) {
      console.error('❌ generateICSFile failed:', error);
      throw new Error(`Failed to generate ICS file: ${error.message}`);
    }
  }

  /**
   * Create a final exam event
   */
  createFinalExamEvent(event, quarter, year) {
    try {
      // Parse final exam date (format: MM/DD/YYYY or similar)
      const finalDate = event.finalDate;
      if (!finalDate) return null;

      // Simple date parsing - adjust as needed based on your date format
      let examDate;
      if (finalDate.includes('/')) {
        const [month, day, examYear] = finalDate.split('/');
        examDate = new Date(parseInt(examYear), parseInt(month) - 1, parseInt(day));
      } else {
        // Default to a date in the quarter if parsing fails
        examDate = new Date(parseInt(year), 11, 15); // December 15th as default
      }

      // Parse start and end times
      const startDateTime = this.parseTimeToDate(event.startTime, examDate);
      const endDateTime = this.parseTimeToDate(event.endTime, examDate);

      if (!startDateTime || !endDateTime) {
        console.log('⚠️ Could not parse times for final exam:', event.courseCode);
        return null;
      }

      const uid = `final-${event.courseCode.replace(/\s+/g, '')}-${quarter}-${year}@ucsd.edu`;
      
      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART;TZID=America/Los_Angeles:${this.formatDateTimeForICS(startDateTime)}`,
        `DTEND;TZID=America/Los_Angeles:${this.formatDateTimeForICS(endDateTime)}`,
        `SUMMARY:${event.courseCode} Final Exam`,
        `DESCRIPTION:${event.getEventDescription()}`,
        `LOCATION:${event.location || 'TBA'}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT'
      ].join('\r\n');

    } catch (error) {
      console.error('❌ Error creating final exam event:', error);
      return null;
    }
  }

  /**
   * Create weekly recurring events
   */
  createWeeklyEvents(event, quarter, year) {
    const events = [];
    
    try {
      console.log('🔄 Creating weekly events for:', event.courseCode, event.getNormalizedSessionType());
      console.log('Event details:', {
        days: event.days,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location
      });
      
      // Get quarter start and end dates
      const { startDate, endDate } = this.getQuarterDates(quarter, year);
      console.log('Quarter dates:', startDate, 'to', endDate);
      
      // FIXED: Handle case where days might be empty - use fallback days based on session type
      let daysToUse = event.days;
      if (!daysToUse || daysToUse.length === 0) {
        // Fallback: assign common days based on session type
        if (event.getNormalizedSessionType() === 'Lecture') {
          daysToUse = 'MWF'; // Most lectures are MWF
        } else if (event.getNormalizedSessionType() === 'Discussion') {
          daysToUse = 'F'; // Most discussions are Friday
        } else {
          daysToUse = 'MW'; // Default fallback
        }
        console.log('⚠️ No days specified, using fallback:', daysToUse);
      }
      
      // Parse days (e.g., "MWF" -> ["MO", "WE", "FR"])
      const icsWeekdays = this.parseWeekdays(daysToUse);
      console.log('Parsed weekdays:', icsWeekdays);
      
      if (icsWeekdays.length === 0) {
        console.log('⚠️ No valid weekdays found for:', event.courseCode, daysToUse);
        return events;
      }

      // Create recurring events for each weekday
      for (const weekday of icsWeekdays) {
        console.log('🗓️ Processing weekday:', weekday);
        
        const firstOccurrence = this.findFirstWeekdayInRange(weekday, startDate, endDate);
        if (!firstOccurrence) {
          console.log('⚠️ Could not find first occurrence for weekday:', weekday);
          continue;
        }
        
        console.log('📅 First occurrence for', weekday, ':', firstOccurrence.toDateString());

        // Parse times for this day
        const startDateTime = this.parseTimeToDate(event.startTime, firstOccurrence);
        const endDateTime = this.parseTimeToDate(event.endTime, firstOccurrence);

        if (!startDateTime || !endDateTime) {
          console.log('⚠️ Could not parse times for:', event.courseCode, event.startTime, event.endTime);
          continue;
        }

        console.log('⏰ Times parsed:', startDateTime.toLocaleString(), 'to', endDateTime.toLocaleString());

        // Create unique UID
        const uid = `${event.courseCode.replace(/\s+/g, '')}-${event.sessionType}-${weekday}-${quarter}-${year}@ucsd.edu`;
        
        // Create the recurring event
        const recurringEvent = [
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTART;TZID=America/Los_Angeles:${this.formatDateTimeForICS(startDateTime)}`,
          `DTEND;TZID=America/Los_Angeles:${this.formatDateTimeForICS(endDateTime)}`,
          `RRULE:FREQ=WEEKLY;UNTIL=${this.formatDateForICS(endDate)}T235959Z`,
          `SUMMARY:${event.getEventTitle()}`,
          `DESCRIPTION:${event.getEventDescription()}`,
          `LOCATION:${event.location || 'TBA'}`,
          'STATUS:CONFIRMED',
          'TRANSP:OPAQUE',
          'END:VEVENT'
        ].join('\r\n');

        events.push(recurringEvent);
        console.log('✅ Created weekly event for:', event.courseCode, event.getNormalizedSessionType(), weekday);
      }

      console.log(`📊 Created ${events.length} weekly events for ${event.courseCode}`);

    } catch (error) {
      console.error('❌ Error creating weekly events:', error);
    }

    return events;
  }

  /**
   * Helper function to parse weekdays
   */
  parseWeekdays(daysStr) {
    const dayMap = {
      'M': 'MO', 'Tu': 'TU', 'W': 'WE', 'Th': 'TH', 'F': 'FR'
    };
    
    const days = [];
    const dayString = daysStr || '';
    
    // Handle common patterns
    if (dayString.includes('MWF')) {
      days.push('MO', 'WE', 'FR');
    } else if (dayString.includes('TTh') || dayString.includes('TuTh')) {
      days.push('TU', 'TH');
    } else if (dayString.includes('MW')) {
      days.push('MO', 'WE');
    } else {
      // Parse individual days
      Object.entries(dayMap).forEach(([key, value]) => {
        if (dayString.includes(key)) {
          days.push(value);
        }
      });
    }
    
    return [...new Set(days)]; // Remove duplicates
  }

  /**
   * Helper function to get quarter dates
   */
  getQuarterDates(quarter, year) {
    const yearInt = parseInt(year);
    const quarterDates = {
      'Fall': { 
        startDate: new Date(yearInt, 8, 25), // September 25
        endDate: new Date(yearInt, 11, 15)   // December 15
      },
      'Winter': { 
        startDate: new Date(yearInt, 0, 8),  // January 8
        endDate: new Date(yearInt, 2, 22)    // March 22
      },
      'Spring': { 
        startDate: new Date(yearInt, 2, 25), // March 25
        endDate: new Date(yearInt, 5, 15)    // June 15
      },
      'Summer': { 
        startDate: new Date(yearInt, 5, 20), // June 20
        endDate: new Date(yearInt, 7, 30)    // August 30
      }
    };
    
    return quarterDates[quarter] || quarterDates['Fall'];
  }

  /**
   * Find first occurrence of weekday in date range
   */
  findFirstWeekdayInRange(weekday, startDate, endDate) {
    const weekdayMap = {
      'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6, 'SU': 0
    };
    
    const targetDay = weekdayMap[weekday];
    if (targetDay === undefined) return null;
    
    const current = new Date(startDate);
    
    // Find first occurrence
    while (current <= endDate) {
      if (current.getDay() === targetDay) {
        return new Date(current);
      }
      current.setDate(current.getDate() + 1);
    }
    
    return null;
  }

  /**
   * Parse time string to Date object
   */
  parseTimeToDate(timeStr, baseDate) {
    if (!timeStr || !baseDate) return null;
    
    // Parse time like "2:00pm" or "11:30am"
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (!timeMatch) return null;
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const period = timeMatch[3].toLowerCase();
    
    // Convert to 24-hour format
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    const dateTime = new Date(baseDate);
    dateTime.setHours(hours, minutes, 0, 0);
    
    return dateTime;
  }

  /**
   * Format date for ICS
   */
  formatDateTimeForICS(date) {
    if (!date) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  }

  /**
   * Format date for ICS (date only)
   */
  formatDateForICS(date) {
    if (!date) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}${month}${day}`;
  }

  /**
   * Download ICS file
   */
  downloadICS(icsData) {
    try {
      console.log('📥 downloadICS called with:', icsData.filename);
      
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
      
      console.log('✅ downloadICS completed');
      return true;
      
    } catch (error) {
      console.error('❌ downloadICS failed:', error);
      throw error;
    }
  }

  // ===== GOOGLE CALENDAR API METHODS =====

  // Authenticate with Google using Chrome's identity API
  async authenticate() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('Authentication failed:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        
        this.accessToken = token;
        this.isAuthenticated = true;
        console.log('✅ Successfully authenticated with Google');
        resolve(token);
      });
    });
  }

  // Create multiple calendar events for Google Calendar
  async createMultipleEvents(eventsData, calendarId = 'primary', progressCallback = null) {
    if (!this.isAuthenticated) {
      await this.authenticate();
    }

    console.log(`Creating ${eventsData.length} Google Calendar events...`);
    
    const results = {
      created: [],
      failed: [],
      total: eventsData.length
    };

    for (let i = 0; i < eventsData.length; i++) {
      const eventData = eventsData[i];
      
      try {
        // Update progress
        if (progressCallback) {
          progressCallback({
            current: i + 1,
            total: eventsData.length,
            eventName: eventData.summary || `${eventData.courseCode} - ${eventData.sessionType}`
          });
        }

        const createdEvent = await this.createCalendarEvent(eventData, calendarId);
        results.created.push({
          original: eventData,
          created: createdEvent
        });

        // Small delay to avoid rate limiting
        await this.delay(100);
        
      } catch (error) {
        console.error(`Failed to create event for ${eventData.courseCode}:`, error);
        results.failed.push({
          original: eventData,
          error: error.message
        });
      }
    }

    console.log(`🎉 Google Calendar sync complete: ${results.created.length} created, ${results.failed.length} failed`);
    return results;
  }

  // Create a single calendar event for Google Calendar
  async createCalendarEvent(eventData, calendarId = 'primary') {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    const event = this.formatEventForGoogleCalendar(eventData);
    
    try {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Calendar API error: ${error.error?.message || response.statusText}`);
      }

      const createdEvent = await response.json();
      console.log('Event created:', createdEvent.summary);
      return createdEvent;
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      throw error;
    }
  }

  // Format event data for Google Calendar API
  formatEventForGoogleCalendar(eventData) {
    const { 
      courseCode, 
      courseTitle, 
      sessionType, 
      instructor, 
      days, 
      startTime, 
      endTime, 
      location, 
      quarter, 
      year 
    } = eventData;

    // Convert days to recurring pattern
    const recurrence = this.createRecurrenceRule(days, quarter, year);
    
    // Convert times to ISO format
    const startDateTime = this.createDateTime(days, startTime, quarter, year);
    const endDateTime = this.createDateTime(days, endTime, quarter, year);

    const event = {
      summary: `${courseCode} - ${sessionType}`,
      description: this.createEventDescription(eventData),
      location: location || '',
      start: {
        dateTime: startDateTime,
        timeZone: 'America/Los_Angeles'
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'America/Los_Angeles'
      },
      recurrence: recurrence,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 },
          { method: 'email', minutes: 60 }
        ]
      },
      colorId: this.getEventColor(sessionType)
    };

    return event;
  }

  // Create event description for Google Calendar
  createEventDescription(eventData) {
    const { courseCode, courseTitle, sessionType, instructor, sectionCode, location } = eventData;
    
    let description = `Course: ${courseCode} - ${courseTitle}\n`;
    description += `Session: ${sessionType}`;
    
    if (sectionCode) {
      description += ` (Section ${sectionCode})`;
    }
    
    description += `\n`;
    
    if (instructor) {
      description += `Instructor: ${instructor}\n`;
    }
    
    if (location) {
      description += `Location: ${location}\n`;
    }
    
    description += `\n📚 Created by Getting It Done Extension`;
    
    return description;
  }

  // Convert class days and times to ISO datetime for Google Calendar
  createDateTime(days, time, quarter, year) {
    // Get the first occurrence date based on quarter start and days
    const quarterDates = this.getQuarterDates(quarter, year);
    const startDate = new Date(quarterDates.recurringStart + 'T00:00:00');
    
    // Find the first occurrence of the class day
    const firstOccurrence = this.findFirstDayOccurrence(startDate, days);
    
    // Parse the time (e.g., "2:00p" or "10:30a")
    const { hours, minutes } = this.parseTime(time);
    
    firstOccurrence.setHours(hours, minutes, 0, 0);
    
    return firstOccurrence.toISOString();
  }

  // Find first occurrence of class days in the quarter for Google Calendar
  findFirstDayOccurrence(startDate, days) {
    const dayMap = {
      'M': 1, 'Tu': 2, 'W': 3, 'Th': 4, 'F': 5, 'Sa': 6, 'Su': 0
    };
    
    // Parse days (e.g., "MWF", "TuTh", "M")
    const classDays = this.parseDaysStringToArray(days);
    const firstClassDay = classDays[0];
    const targetDay = dayMap[firstClassDay];
    
    const date = new Date(startDate);
    const currentDay = date.getDay();
    
    // Calculate days to add to get to target day
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd < 0) {
      daysToAdd += 7;
    }
    
    date.setDate(date.getDate() + daysToAdd);
    return date;
  }

  // Parse days string into array for Google Calendar
  parseDaysStringToArray(daysStr) {
    // Handle common patterns
    const patterns = {
      'MWF': ['M', 'W', 'F'],
      'MW': ['M', 'W'],
      'TuTh': ['Tu', 'Th'],
      'M': ['M'],
      'Tu': ['Tu'],
      'W': ['W'],
      'Th': ['Th'],
      'F': ['F'],
      'Sa': ['Sa'],
      'Su': ['Su']
    };
    
    return patterns[daysStr] || ['M'];
  }

  // Create recurrence rule for repeating events in Google Calendar
  createRecurrenceRule(days, quarter, year) {
    const quarterDates = this.getQuarterDates(quarter, year);
    const classesEnd = this.getClassesEndDate(quarter, year);
    const formattedEndDate = classesEnd.toISOString().split('T')[0].replace(/-/g, '');
    
    // Convert days to RRULE format
    const dayMap = {
      'M': 'MO', 'Tu': 'TU', 'W': 'WE', 'Th': 'TH', 'F': 'FR', 'Sa': 'SA', 'Su': 'SU'
    };
    
    const classDays = this.parseDaysStringToArray(days);
    const ruleDays = classDays.map(day => dayMap[day]).join(',');
    
    return [`RRULE:FREQ=WEEKLY;BYDAY=${ruleDays};UNTIL=${formattedEndDate}T235959Z`];
  }

  // ===== SHARED UTILITY METHODS =====

  // Get quarter dates
  getQuarterDates(quarter, year) {
    const y = String(year);
    const dates = {
      'Fall': { 
        start: `09/25/${y}`,           // Week 0 starts (Thu/Fri only)
        recurringStart: `09/29/${y}`,  // Regular classes start Monday
        end: `12/13/${y}`              // Quarter officially ends
      },
      'Winter': { 
        start: `01/06/${y}`, 
        recurringStart: `01/06/${y}`, 
        end: `03/21/${y}` 
      },
      'Spring': { 
        start: `03/31/${y}`, 
        recurringStart: `03/31/${y}`, 
        end: `06/13/${y}` 
      },
      'Summer Session 1': { 
        start: `06/23/${y}`, 
        recurringStart: `06/23/${y}`, 
        end: `08/01/${y}` 
      },
      'Summer Session 2': { 
        start: `08/04/${y}`, 
        recurringStart: `08/04/${y}`, 
        end: `09/12/${y}` 
      }
    };
    return dates[quarter] || dates['Fall'];
  }

  // Get finals week range
  getFinalsWeekRange(quarter, year) {
    // Finals week for Fall 2025 starts Saturday 12/7/2025
    const finalsStartDates = {
      'Fall': `12/07/${year}`,      // Fall finals start Saturday 12/7
      'Winter': `03/15/${year}`,    // Estimate for Winter
      'Spring': `06/07/${year}`,    // Estimate for Spring
      'Summer Session 1': `07/26/${year}`,
      'Summer Session 2': `09/07/${year}`
    };
    
    const finalsStartStr = finalsStartDates[quarter] || finalsStartDates['Fall'];
    const finalsStart = new Date(finalsStartStr + 'T00:00:00');
    
    // Finals end about a week later
    const finalsEnd = new Date(finalsStart);
    finalsEnd.setDate(finalsEnd.getDate() + 7);
    finalsEnd.setHours(23, 59, 59, 0);
    
    console.log(`📝 Finals week: ${finalsStart.toDateString()} - ${finalsEnd.toDateString()}`);
    
    return { finalsStart, finalsEnd };
  }

  // Get classes end date (day before finals)
  getClassesEndDate(quarter, year) {
    // Regular classes end the day BEFORE finals week starts
    const { finalsStart } = this.getFinalsWeekRange(quarter, year);
    const classesEnd = new Date(finalsStart);
    classesEnd.setDate(classesEnd.getDate() - 1); // Day before finals
    classesEnd.setHours(23, 59, 59, 0);
    
    console.log(`🏁 Regular classes end: ${classesEnd.toDateString()} (day before finals)`);
    return classesEnd;
  }

  // Parse days to array for ICS format
  parseDaysToArray(daysStr) {
    const dayMappings = {
      'MWF': ['MO', 'WE', 'FR'],
      'MW': ['MO', 'WE'],
      'WF': ['WE', 'FR'],
      'TuTh': ['TU', 'TH'],
      'TTh': ['TU', 'TH'],
      'M': ['MO'],
      'Tu': ['TU'],
      'W': ['WE'],
      'Th': ['TH'],
      'F': ['FR']
    };

    return dayMappings[daysStr] || [];
  }

  // Get first occurrence date for ICS
  getFirstOccurrenceDate(startDateStr, dayCode) {
    const dayIndex = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };
    const targetDay = dayIndex[dayCode];
    
    const date = new Date(startDateStr + 'T00:00:00');
    
    while (date.getDay() !== targetDay) {
      date.setDate(date.getDate() + 1);
    }
    
    return date;
  }

  // Parse time string (e.g., "2:00p", "10:30a")
  parseTime(timeStr) {
    const match = String(timeStr || '').match(/(\d{1,2}):(\d{2})([ap])/i);
    if (!match) return { hours: 9, minutes: 0 };
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toLowerCase();
    
    if (period === 'p' && hours !== 12) hours += 12;
    if (period === 'a' && hours === 12) hours = 0;
    
    return { hours, minutes };
  }

  // Format ICS DateTime
  formatICSDateTime(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  }

  // Get event color based on session type
  getEventColor(sessionType) {
    const colors = {
      'Lecture': '1',      // Blue
      'Discussion': '2',   // Green
      'Lab': '6',         // Orange
      'Final Exam': '4'   // Red
    };
    
    return colors[sessionType] || '1';
  }

  // Utility delay function
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Revoke authentication
  async revokeAuthentication() {
    if (this.accessToken) {
      chrome.identity.removeCachedAuthToken({ token: this.accessToken }, () => {
        this.accessToken = null;
        this.isAuthenticated = false;
        console.log('Authentication revoked');
      });
    }
  }

  // ← NEW: Helper method to calculate weekly occurrences
  calculateWeeklyOccurrences(daysStr, startDate, endDate) {
    const weekdays = this.parseWeekdays(daysStr);
    if (weekdays.length === 0) return 0;
    
    let totalOccurrences = 0;
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][currentDate.getDay()];
      if (weekdays.includes(dayOfWeek)) {
        totalOccurrences++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return totalOccurrences;
  }
}

// Export a singleton instance
export const googleCalendarAPI = new GoogleCalendarAPI();

// Export the singleton as calendarGenerator for backwards compatibility
export const calendarGenerator = googleCalendarAPI;