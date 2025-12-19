/**
 * Google Calendar API integration and ICS file generation for Chrome extension
 * Combined functionality from GoogleCalendarAPI and CalendarGenerator
 */

import { getGoogleMapsLocation } from './schoolConfig.js';

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
      const createdICSEvents = [];

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

          // Handle Final Exams and Midterms (one-time events)
          if (sessionType === 'Final Exam' || sessionType === 'Midterm') {
            console.log(`🎯 Creating ${sessionType} event for:`, event.courseCode);
            const examEvent = this.createExamEvent(event, sessionType, quarter, year);
            if (examEvent) {
              icsContent += examEvent + '\r\n';
              eventsCreated++;
              
              createdICSEvents.push({
                type: sessionType,
                title: `${event.courseCode} ${sessionType}`,
                courseCode: event.courseCode,
                courseTitle: event.courseTitle || '',
                days: event.finalDay || event.days || 'TBA',
                date: event.finalDate || 'TBA',
                startTime: event.startTime,
                endTime: event.endTime,
                location: event.location || 'TBA',
                instructor: event.instructor || '',
                recurrence: 'One-time event'
              });
              
              console.log(`✅ Added ${sessionType}:`, event.courseCode);
            }
            continue;
          }

          // Handle regular weekly events (Lectures, Discussions, Labs)
          if (sessionType === 'Lecture' || sessionType === 'Discussion' || sessionType === 'Lab') {
            console.log('📚 Creating weekly event for:', event.courseCode, sessionType);
            console.log('Event days:', event.days, 'Times:', event.startTime, '-', event.endTime);
            
            // Check if we have days - if not, skip
            if (!event.days || event.days.trim() === '') {
              console.log('⚠️ No days specified for weekly event, skipping:', event.courseCode);
              continue;
            }
            
            const weeklyEventContent = this.createWeeklyEventICS(event, quarter, year);
            
            if (weeklyEventContent) {
              icsContent += weeklyEventContent + '\r\n';
              eventsCreated++;
              
              const { startDate, endDate } = this.getQuarterDatesForICS(quarter, year);
              
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
                recurrence: `Weekly on ${event.days} • ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
              });
              
              console.log('✅ Added weekly event:', event.courseCode, sessionType);
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
        icsEvents: createdICSEvents
      };

    } catch (error) {
      console.error('❌ generateICSFile failed:', error);
      throw new Error(`Failed to generate ICS file: ${error.message}`);
    }
  }

  /**
   * Create exam event (Final or Midterm) - PRESERVED FORMAT
   */
  createExamEvent(event, examType, quarter, year) {
    try {
      const finalDate = event.finalDate;
      if (!finalDate) {
        console.log(`⚠️ No date for ${examType}:`, event.courseCode);
        return null;
      }

      // Parse date (format: MM/DD/YYYY)
      let examDate;
      if (finalDate.includes('/')) {
        const parts = finalDate.split('/');
        const month = parseInt(parts[0]) - 1;
        const day = parseInt(parts[1]);
        const examYear = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
        examDate = new Date(examYear, month, day);
      } else {
        console.log('⚠️ Could not parse date:', finalDate);
        return null;
      }

      // Parse times
      const startDateTime = this.parseTimeToDate(event.startTime, examDate);
      const endDateTime = this.parseTimeToDate(event.endTime, examDate);

      if (!startDateTime || !endDateTime) {
        console.log(`⚠️ Could not parse times for ${examType}:`, event.courseCode);
        return null;
      }

      const uid = `${examType.toLowerCase().replace(' ', '-')}-${event.courseCode.replace(/\s+/g, '')}-${quarter}-${year}@gettingitdone.ucsd`;
      
      // Format location for Google Maps recognition
      const mapsLocation = getGoogleMapsLocation(event.location, event.building, event.room);
      
      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART;TZID=America/Los_Angeles:${this.formatDateTimeForICS(startDateTime)}`,
        `DTEND;TZID=America/Los_Angeles:${this.formatDateTimeForICS(endDateTime)}`,
        `SUMMARY:${event.courseCode} ${examType}`,
        `DESCRIPTION:${this.escapeICSText(event.getEventDescription())}`,
        `LOCATION:${mapsLocation}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT'
      ].join('\r\n');

    } catch (error) {
      console.error(`❌ Error creating ${examType} event:`, error);
      return null;
    }
  }

  /**
   * Create a weekly recurring event - FIXED VERSION
   */
  createWeeklyEventICS(event, quarter, year) {
    try {
      console.log('🔄 Creating weekly ICS event for:', event.courseCode, event.getNormalizedSessionType());
      
      // Get quarter dates
      const { startDate, endDate } = this.getQuarterDatesForICS(quarter, year);
      console.log('Quarter dates:', startDate.toDateString(), 'to', endDate.toDateString());
      
      // Parse days to ICS format (e.g., "MWF" -> "MO,WE,FR")
      const icsDays = this.convertDaysToICSFormat(event.days);
      console.log('ICS days:', icsDays);
      
      if (!icsDays) {
        console.log('⚠️ Could not parse days:', event.days);
        return null;
      }
      
      // Find first occurrence of this class
      const firstDayCode = icsDays.split(',')[0]; // Get first day (e.g., "MO")
      const firstOccurrence = this.findFirstWeekdayInRange(firstDayCode, startDate, endDate);
      
      if (!firstOccurrence) {
        console.log('⚠️ Could not find first occurrence');
        return null;
      }
      
      console.log('First occurrence:', firstOccurrence.toDateString());
      
      // Parse times
      const startDateTime = this.parseTimeToDate(event.startTime, firstOccurrence);
      const endDateTime = this.parseTimeToDate(event.endTime, firstOccurrence);
      
      if (!startDateTime || !endDateTime) {
        console.log('⚠️ Could not parse times:', event.startTime, event.endTime);
        return null;
      }
      
      console.log('Start time:', startDateTime.toLocaleString());
      console.log('End time:', endDateTime.toLocaleString());
      
      // Create unique ID
      const uid = `${event.courseCode.replace(/\s+/g, '')}-${event.sessionType}-${quarter}-${year}@gettingitdone.ucsd`;
      
      // Format the UNTIL date (end of quarter at 11:59:59 PM UTC)
      const untilDate = this.formatUntilDate(endDate);
      
      // Format location for Google Maps recognition
      const mapsLocation = getGoogleMapsLocation(event.location, event.building, event.room);
      
      // Build the VEVENT
      const vevent = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART;TZID=America/Los_Angeles:${this.formatDateTimeForICS(startDateTime)}`,
        `DTEND;TZID=America/Los_Angeles:${this.formatDateTimeForICS(endDateTime)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${icsDays};UNTIL=${untilDate}`,
        `SUMMARY:${event.courseCode} - ${event.getNormalizedSessionType()}`,
        `DESCRIPTION:${this.escapeICSText(event.getEventDescription())}`,
        `LOCATION:${mapsLocation}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT'
      ].join('\r\n');
      
      console.log('✅ Created VEVENT for:', event.courseCode);
      return vevent;
      
    } catch (error) {
      console.error('❌ Error creating weekly event:', error);
      return null;
    }
  }

  /**
   * Convert days string to ICS BYDAY format
   * "MWF" -> "MO,WE,FR"
   * "TuTh" -> "TU,TH"
   */
  convertDaysToICSFormat(daysStr) {
    if (!daysStr) return null;
    
    const dayMap = {
      'M': 'MO',
      'Tu': 'TU',
      'W': 'WE',
      'Th': 'TH',
      'F': 'FR',
      'Sa': 'SA',
      'Su': 'SU'
    };
    
    const days = [];
    let i = 0;
    const str = daysStr.trim();
    
    while (i < str.length) {
      // Check for two-character days first (Tu, Th, Sa, Su)
      if (i + 1 < str.length) {
        const twoChar = str.substring(i, i + 2);
        if (dayMap[twoChar]) {
          days.push(dayMap[twoChar]);
          i += 2;
          continue;
        }
      }
      
      // Check for single character days (M, W, F)
      const oneChar = str[i];
      if (dayMap[oneChar]) {
        days.push(dayMap[oneChar]);
      }
      i++;
    }
    
    return days.length > 0 ? days.join(',') : null;
  }

  /**
   * Get quarter dates for ICS generation - UPDATED WITH CORRECT DATES
   */
  getQuarterDatesForICS(quarter, year) {
    const yearInt = parseInt(year);
    
    // UCSD Quarter dates
    const quarterDates = {
      'Fall': { 
        startDate: new Date(yearInt, 8, 25),  // September 25 (Week 0)
        endDate: new Date(yearInt, 11, 6)     // December 6 (last day of classes before finals)
      },
      'Winter': { 
        startDate: new Date(yearInt, 0, 5),   // January 5 (first day of instruction)
        endDate: new Date(yearInt, 2, 13)     // March 13 (last day of classes before finals)
      },
      'Spring': { 
        startDate: new Date(yearInt, 2, 30),  // March 30
        endDate: new Date(yearInt, 5, 6)      // June 6
      },
      'Summer Session 1': { 
        startDate: new Date(yearInt, 5, 30),  // June 30
        endDate: new Date(yearInt, 7, 2)      // August 2
      },
      'Summer Session 2': { 
        startDate: new Date(yearInt, 7, 4),   // August 4
        endDate: new Date(yearInt, 8, 6)      // September 6
      }
    };
    
    const dates = quarterDates[quarter] || quarterDates['Winter'];
    
    console.log(`📅 Quarter dates for ${quarter} ${year}:`, 
      dates.startDate.toDateString(), 'to', dates.endDate.toDateString());
    
    return dates;
  }

  /**
   * Format UNTIL date for RRULE (must be in UTC)
   */
  formatUntilDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}T235959Z`;
  }

  /**
   * Escape text for ICS format
   * In ICS, newlines must be represented as \n (backslash + n)
   */
  escapeICSText(text) {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')      // Escape backslashes first
      .replace(/;/g, '\\;')        // Escape semicolons
      .replace(/,/g, '\\,')        // Escape commas
      .replace(/\r\n/g, '\\n')     // Convert Windows newlines
      .replace(/\r/g, '\\n')       // Convert old Mac newlines
      .replace(/\n/g, '\\n');      // Convert Unix newlines
  }

  /**
   * Find first weekday in range
   */
  findFirstWeekdayInRange(dayCode, startDate, endDate) {
    const dayIndex = { 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6, 'SU': 0 };
    const targetDay = dayIndex[dayCode];
    
    if (targetDay === undefined) {
      console.log('⚠️ Unknown day code:', dayCode);
      return null;
    }
    
    const date = new Date(startDate);
    
    // Find the first occurrence of the target day
    while (date.getDay() !== targetDay && date <= endDate) {
      date.setDate(date.getDate() + 1);
    }
    
    return date <= endDate ? date : null;
  }

  /**
   * Parse time string to Date object
   */
  parseTimeToDate(timeStr, baseDate) {
    if (!timeStr || !baseDate) return null;
    
    // Handle formats: "9:00am", "9:00a", "9:00 am", "9:00p", etc.
    const match = String(timeStr).match(/(\d{1,2}):(\d{2})\s*([ap])m?/i);
    if (!match) {
      console.log('⚠️ Could not parse time:', timeStr);
      return null;
    }
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toLowerCase();
    
    // Convert to 24-hour format
    if (period === 'p' && hours !== 12) {
      hours += 12;
    } else if (period === 'a' && hours === 12) {
      hours = 0;
    }
    
    const result = new Date(baseDate);
    result.setHours(hours, minutes, 0, 0);
    
    return result;
  }

  /**
   * Format DateTime for ICS (YYYYMMDDTHHMMSS)
   */
  formatDateTimeForICS(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  }

  /**
   * Helper function to get quarter dates (for Google Calendar compatibility)
   */
  getQuarterDates(quarter, year) {
    const { startDate, endDate } = this.getQuarterDatesForICS(quarter, year);
    return { startDate, endDate };
  }

  /**
   * Authenticate with Google using Chrome's identity API
   */
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

  // ===== GOOGLE CALENDAR API METHODS =====

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
    const { startDate } = this.getQuarterDatesForICS(quarter, year);
    
    // Find the first occurrence of the class day
    const firstOccurrence = this.findFirstDayOccurrence(startDate, days);
    
    // Parse the time
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
    const { endDate } = this.getQuarterDatesForICS(quarter, year);
    const formattedEndDate = this.formatUntilDate(endDate);
    
    // Convert days to RRULE format
    const icsDays = this.convertDaysToICSFormat(days);
    
    return [`RRULE:FREQ=WEEKLY;BYDAY=${icsDays};UNTIL=${formattedEndDate}`];
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
    
    // Find the first occurrence of the target day
    while (date.getDay() !== targetDay) {
      date.setDate(date.getDate() + 1);
    }
    
    return date;
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
}

// Export a singleton instance
export const googleCalendarAPI = new GoogleCalendarAPI();

// Export the singleton as calendarGenerator for backwards compatibility
export const calendarGenerator = googleCalendarAPI;