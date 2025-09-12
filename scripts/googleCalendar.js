// Google Calendar API integration for Chrome extension
export class GoogleCalendarAPI {
    constructor() {
        this.accessToken = null;
        this.isAuthenticated = false;
    }

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
                console.log('Successfully authenticated with Google');
                resolve(token);
            });
        });
    }

    // Create a single calendar event
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

    // Create multiple calendar events
    async createMultipleEvents(eventsData, calendarId = 'primary', progressCallback = null) {
        if (!this.isAuthenticated) {
            await this.authenticate();
        }

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

        return results;
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
                timeZone: 'America/Los_Angeles' // Adjust for your timezone
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

    // Create event description
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

    // Convert class days and times to ISO datetime
    createDateTime(days, time, quarter, year) {
        // Get the first occurrence date based on quarter start and days
        const quarterDates = this.getQuarterDates(quarter, year);
        const startDate = new Date(quarterDates.start);
        
        // Find the first occurrence of the class day
        const firstOccurrence = this.findFirstDayOccurrence(startDate, days);
        
        // Parse the time (e.g., "2:00p" or "10:30a")
        const { hours, minutes } = this.parseTime(time);
        
        firstOccurrence.setHours(hours, minutes, 0, 0);
        
        return firstOccurrence.toISOString();
    }

    // Parse time string (e.g., "2:00p", "10:30a")
    parseTime(timeStr) {
        const match = timeStr.match(/(\d+):(\d+)([ap])/i);
        if (!match) throw new Error(`Invalid time format: ${timeStr}`);
        
        let hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const ampm = match[3].toLowerCase();
        
        if (ampm === 'p' && hours !== 12) {
            hours += 12;
        } else if (ampm === 'a' && hours === 12) {
            hours = 0;
        }
        
        return { hours, minutes };
    }

    // Find first occurrence of class days in the quarter
    findFirstDayOccurrence(startDate, days) {
        const dayMap = {
            'M': 1, 'Tu': 2, 'W': 3, 'Th': 4, 'F': 5, 'Sa': 6, 'Su': 0
        };
        
        // Parse days (e.g., "MWF", "TuTh", "M")
        const classDays = this.parseDays(days);
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

    // Parse days string into array
    parseDays(daysStr) {
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

    // Create recurrence rule for repeating events
    createRecurrenceRule(days, quarter, year) {
        const quarterDates = this.getQuarterDates(quarter, year);
        const endDate = new Date(quarterDates.end);
        const formattedEndDate = endDate.toISOString().split('T')[0].replace(/-/g, '');
        
        // Convert days to RRULE format
        const dayMap = {
            'M': 'MO', 'Tu': 'TU', 'W': 'WE', 'Th': 'TH', 'F': 'FR', 'Sa': 'SA', 'Su': 'SU'
        };
        
        const classDays = this.parseDays(days);
        const ruleDays = classDays.map(day => dayMap[day]).join(',');
        
        return [`RRULE:FREQ=WEEKLY;BYDAY=${ruleDays};UNTIL=${formattedEndDate}T235959Z`];
    }

    // Get quarter dates (same as in scheduleParser.js)
    getQuarterDates(quarter, year) {
        const quarterDates = {
            'Fall': {
                start: `09/26/${year}`,
                end: `12/13/${year}`
            },
            'Winter': {
                start: `01/08/${year}`,
                end: `03/21/${year}`
            },
            'Spring': {
                start: `03/31/${year}`,
                end: `06/13/${year}`
            },
            'Summer Session 1': {
                start: `06/24/${year}`,
                end: `08/02/${year}`
            },
            'Summer Session 2': {
                start: `08/05/${year}`,
                end: `09/13/${year}`
            }
        };
        
        return quarterDates[quarter] || quarterDates['Fall'];
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
}

// Export a singleton instance
export const googleCalendarAPI = new GoogleCalendarAPI();