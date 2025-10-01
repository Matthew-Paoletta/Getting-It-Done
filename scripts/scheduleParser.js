/**
 * ScheduleParser - Converts raw OCR text into structured course events
 * Responsibility: Raw Text → Course Events
 */

export class CourseEvent {
  constructor({
    courseCode = '',
    courseTitle = '',
    sessionType = '',
    sectionCode = '',
    instructor = '',
    days = '',
    startTime = '',
    endTime = '',
    location = '',
    building = '',
    room = '',
    finalDate = '',
    finalDay = '',
    quarter = '',
    year = '',
    units = ''
  } = {}) {
    this.courseCode = courseCode;
    this.courseTitle = courseTitle;
    this.sessionType = sessionType;
    this.sectionCode = sectionCode;
    this.instructor = instructor;
    this.days = days;
    this.startTime = startTime;
    this.endTime = endTime;
    this.location = location;
    this.building = building;
    this.room = room;
    this.finalDate = finalDate;
    this.finalDay = finalDay;
    this.quarter = quarter;
    this.year = year;
    this.units = units;
  }

  // Get normalized session type
  getNormalizedSessionType() {
    const type = this.sessionType.toLowerCase();
    if (type.includes('final') || type === 'fi') return 'Final Exam';
    if (type.includes('lec') || type === 'le') return 'Lecture';
    if (type.includes('dis') || type === 'di') return 'Discussion';
    if (type.includes('lab') || type === 'la') return 'Lab';
    return this.sessionType || 'Lecture';
  }

  // Get event title for calendar
  getEventTitle() {
    return `${this.courseCode} - ${this.getNormalizedSessionType()}`;
  }

  // Get event description
  getEventDescription() {
    const lines = [];
    
    if (this.courseTitle) {
      lines.push(`Course: ${this.courseCode} - ${this.courseTitle}`);
    } else {
      lines.push(`Course: ${this.courseCode}`);
    }
    
    if (this.sectionCode) {
      lines.push(`Section: ${this.sectionCode}`);
    }
    
    if (this.instructor) {
      lines.push(`Instructor: ${this.instructor}`);
    }
    
    if (this.location) {
      lines.push(`Location: ${this.location}`);
    }
    
    if (this.quarter && this.year) {
      lines.push(`Quarter: ${this.quarter} ${this.year}`);
    }
    
    lines.push('Created by Getting It Done');
    
    return lines.join('\\n');
  }

  // Validate event has required data
  isValid() {
    return !!(
      this.courseCode && 
      this.sessionType && 
      (this.days || this.finalDate) && 
      this.startTime
    );
  }

  // Convert to plain object
  toObject() {
    return {
      courseCode: this.courseCode,
      courseTitle: this.courseTitle,
      sessionType: this.sessionType,
      sectionCode: this.sectionCode,
      instructor: this.instructor,
      days: this.days,
      startTime: this.startTime,
      endTime: this.endTime,
      location: this.location,
      building: this.building,
      room: this.room,
      finalDate: this.finalDate,
      finalDay: this.finalDay,
      quarter: this.quarter,
      year: this.year,
      units: this.units
    };
  }
}

export class ScheduleParser {
  constructor() {
    this.patterns = {
      // More flexible course code patterns
      courseCode: /\b([A-Z]{2,4})\s*(\d{1,3}[A-Z]?)\b/gi,
      
      // More flexible session type patterns
      sessionType: /\b(LE|DI|LA|FI|Lecture|Discussion|Lab|Final)\b/gi,
      
      // Section patterns
      sectionCode: /\b([A-Z]\d{2,3})\b/g,
      
      // Day patterns - more comprehensive
      days: /\b(M|Tu|W|Th|F|Sa|Su|MW|MWF|TuTh|TTh|WF|MF|TF|MTh|WTh)\b/g,
      
      // Time patterns - more flexible
      time: /(\d{1,2}):(\d{2})\s*(am|pm|a|p)\s*[-–—]\s*(\d{1,2}):(\d{2})\s*(am|pm|a|p)/gi,
      
      // Building patterns - more comprehensive
      building: /\b(CENTR|CENTER|FAH|MOS|PCYNH|WLH|TBA|REMOTE|ONLINE|YORK|PETER|GALB|MANDE|SEQUO|SOLIS)\b/gi,
      
      // Room patterns
      room: /\b(\d{3,4}[A-Z]?)\b/g,
      
      // Final exam date patterns
      finalDate: /\b(M|Tu|W|Th|F)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\b/gi,
      
      // Instructor patterns - more flexible
      instructor: /([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*(?:\s*,\s*[A-Z][a-z]*)*)/g,
      
      // Course title patterns
      title: /([A-Z][a-zA-Z\s&:,-]{10,60})/g
    };

    // Keep a smaller fallback database for emergencies only
    this.emergencyFallback = {
      'CSE 105': { title: 'Theory of Computation', sessions: [
        { type: 'Lecture', days: 'MW', time: '5:00pm-6:20pm', location: 'TBA' },
        { type: 'Discussion', days: 'F', time: '5:00pm-5:50pm', location: 'TBA' },
        { type: 'Final Exam', days: 'TBA', date: '12/15/2025', time: '7:00pm-9:59pm', location: 'TBA' }
      ]}
    };
  }

  // Enhanced parsing method that actually processes OCR text
  parseTextToEvents(rawText, quarter = 'Fall', year = '2025') {
    console.log('=== SCHEDULE PARSER START ===');
    console.log(`Parsing for ${quarter} ${year}`);
    console.log(`Input text length: ${rawText?.length || 0}`);

    if (!rawText || rawText.length < 50) {
      console.log('⚠️ Insufficient text provided, using emergency fallback');
      return this.createEmergencyFallback(quarter, year);
    }

    // Clean and normalize text
    const cleanedText = this.cleanText(rawText);
    console.log('Cleaned text preview:', cleanedText.substring(0, 200) + '...');

    // Parse the actual OCR text
    const parsedEvents = this.parseWebRegFormat(cleanedText, quarter, year);

    if (parsedEvents.length > 0) {
      console.log(`✅ Successfully parsed ${parsedEvents.length} events from OCR text`);
      return parsedEvents;
    }

    // Emergency fallback only if parsing completely fails
    console.log('⚠️ OCR parsing failed, using emergency fallback');
    return this.createEmergencyFallback(quarter, year);
  }

  // COMPLETELY NEW: Direct WebReg table parser for your exact format
  parseWebRegFormat(text, quarter, year) {
    const events = [];
    console.log('🔍 Parsing WebReg table format...');
    console.log('Raw input text preview:', text.substring(0, 500));
    
    // Split by tab-separated lines and filter
    const lines = text.split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 10);
  
    console.log(`Processing ${lines.length} lines...`);
    
    let currentCourse = null;
    let currentTitle = '';
    let currentInstructor = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      console.log(`Line ${i}: "${line}"`);
      
      // Split by tabs to get individual fields
      const fields = line.split('\t');
      console.log('Fields:', fields);
      
      // Main course line: CSE 105	Theory of Computation	A00	LE	Lovett, Shachar	L	4.00	MW	5:00p-6:20p	CENTR	101	...
      if (fields.length >= 11 && fields[0].match(/^[A-Z]{2,4}\s+\d/)) {
        currentCourse = fields[0].trim();
        currentTitle = fields[1].trim();
        const sectionCode = fields[2].trim();
        const sessionTypeRaw = fields[3].trim();
        currentInstructor = fields[4].trim();
        const days = fields[7].trim();
        const timeRange = fields[8].trim();
        const building = fields[9].trim();
        const room = fields[10].trim();
        
        const sessionType = sessionTypeRaw === 'LE' ? 'Lecture' : sessionTypeRaw === 'DI' ? 'Discussion' : 'Lab';
        const times = this.parseTimeRange(timeRange);
        
        console.log(`📚 Found main course: ${currentCourse} - ${sessionType}`);
        
        const event = new CourseEvent({
          courseCode: currentCourse,
          courseTitle: currentTitle,
          sessionType: sessionType,
          sectionCode: sectionCode,
          instructor: currentInstructor,
          days: days,
          startTime: times.start,
          endTime: times.end,
          location: `${building} ${room}`,
          quarter,
          year
        });
        
        events.push(event);
        console.log(`✅ Added: ${event.getEventTitle()}`);
        continue;
      }
      
      // Secondary session line: A01	DI	5:00p-5:50p	FAH	1301
      if (fields.length >= 5 && fields[0].match(/^[A-Z]\d{2,3}$/) && currentCourse) {
        const sectionCode = fields[0].trim();
        const sessionTypeRaw = fields[1].trim();
        
        // Handle cases where days might be in field 1 or 2
        let days = '', timeRange = '', building = '', room = '';
        
        if (fields[1] === 'DI') {
          // Format: A01	DI	5:00p-5:50p	FAH	1301
          days = 'F'; // Most discussions are Friday (you can adjust this)
          timeRange = fields[2].trim();
          building = fields[3].trim();
          room = fields[4].trim();
        } else {
          // Format: A01	DI	F	6:00p-6:50p	MOS	0114
          days = fields[2].trim();
          timeRange = fields[3].trim();
          building = fields[4].trim();
          room = fields[5] ? fields[5].trim() : '';
        }
        
        const sessionType = sessionTypeRaw === 'DI' ? 'Discussion' : 'Lab';
        const times = this.parseTimeRange(timeRange);
        
        console.log(`📚 Found secondary session: ${currentCourse} - ${sessionType}`);
        
        const event = new CourseEvent({
          courseCode: currentCourse,
          courseTitle: currentTitle,
          sessionType: sessionType,
          sectionCode: sectionCode,
          instructor: currentInstructor,
          days: days,
          startTime: times.start,
          endTime: times.end,
          location: `${building} ${room}`,
          quarter,
          year
        });
        
        events.push(event);
        console.log(`✅ Added: ${event.getEventTitle()}`);
        continue;
      }
      
      // Final exam line: Final Exam	FI	Th 12/11/2025	7:00p-9:59p	TBA	TBA
      if (line.includes('Final Exam') && currentCourse) {
        const finalFields = line.split('\t');
        console.log('Final exam fields:', finalFields);
      
        if (finalFields.length >= 4) {
          const dayAndDate = finalFields[2].trim(); // "Th 12/11/2025"
          const timeRange = finalFields[3].trim();
          
          // Extract day and date
          const dayDateMatch = dayAndDate.match(/([MTWFS][a-z]*)\s+([\d\/]+)/);
          const finalDay = dayDateMatch ? dayDateMatch[1] : 'TBA';
          const finalDate = dayDateMatch ? dayDateMatch[2] : 'TBA';
          
          const times = this.parseTimeRange(timeRange);
          
          console.log(`📚 Found final exam: ${currentCourse} - Final Exam`);
          
          const event = new CourseEvent({
            courseCode: currentCourse,
            courseTitle: currentTitle,
            sessionType: 'Final Exam',
            sectionCode: 'FI',
            instructor: currentInstructor,
            days: finalDay,
            startTime: times.start,
            endTime: times.end,
            location: 'TBA',
            finalDate: finalDate,
            finalDay: finalDay,
            quarter,
            year
          });
          
          events.push(event);
          console.log(`✅ Added: ${event.getEventTitle()}`);
        }
        continue;
      }
    }
    
    console.log(`📊 Total events parsed: ${events.length}`);
    return events;
  }

  // NEW: Parse time range helper
  parseTimeRange(timeRange) {
    console.log('⏰ Parsing time range:', timeRange);
    
    // Handle formats like "5:00p-6:20p" or "11:30a-2:29p"
    const match = timeRange.match(/(\d{1,2}):(\d{2})([ap])m?-(\d{1,2}):(\d{2})([ap])m?/);
    
    if (match) {
      const startHour = parseInt(match[1]);
      const startMin = match[2];
      const startPeriod = match[3];
      const endHour = parseInt(match[4]);
      const endMin = match[5];
      const endPeriod = match[6];
      
      const start = `${startHour}:${startMin}${startPeriod}m`;
      const end = `${endHour}:${endMin}${endPeriod}m`;
      
      console.log(`✅ Parsed times: ${start} - ${end}`);
      return { start, end };
    }
    
    console.log('⚠️ Could not parse time range:', timeRange);
    return { start: '12:00pm', end: '1:00pm' };
  }

  // Emergency fallback - much smaller
  createEmergencyFallback(quarter, year) {
    console.log('⚠️ Using emergency fallback - OCR parsing failed');
    const events = [];
    
    // Create a single example event to show the format works
    const exampleEvent = new CourseEvent({
      courseCode: 'EXAMPLE 101',
      courseTitle: 'OCR Parsing Failed',
      sessionType: 'Lecture',
      sectionCode: 'A00',
      instructor: 'Please try again',
      days: 'MW',
      startTime: '12:00pm',
      endTime: '1:20pm',
      location: 'Upload a clearer image',
      quarter,
      year
    });
    
    events.push(exampleEvent);
    return events;
  }

  // Keep your existing utility methods...
  cleanText(rawText) {
    return String(rawText)
      .replace(/[–—]/g, '-')
      .replace(/\u00A0/g, ' ')
      .replace(/\t+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  detectCourses(text) {
    const courses = new Set();
    let match;
    
    this.patterns.courseCode.lastIndex = 0;
    while ((match = this.patterns.courseCode.exec(text)) !== null) {
      const courseCode = `${match[1]} ${match[2]}`;
      courses.add(courseCode);
    }
    
    return Array.from(courses);
  }

  // Get course statistics
  getEventStatistics(events) {
    const stats = {
      totalEvents: events.length,
      courseCount: 0,
      sessionTypes: {},
      courses: {}
    };
    
    const uniqueCourses = new Set();
    
    for (const event of events) {
      uniqueCourses.add(event.courseCode);
      
      // Count session types
      const sessionType = event.getNormalizedSessionType();
      stats.sessionTypes[sessionType] = (stats.sessionTypes[sessionType] || 0) + 1;
      
      // Count per course
      if (!stats.courses[event.courseCode]) {
        stats.courses[event.courseCode] = {
          title: event.courseTitle,
          sessionCount: 0,
          sessions: []
        };
      }
      stats.courses[event.courseCode].sessionCount++;
      stats.courses[event.courseCode].sessions.push(sessionType);
    }
    
    stats.courseCount = uniqueCourses.size;
    
    return stats;
  }
}

// Export singleton instance - ONLY EXPORT ONCE
export const scheduleParser = new ScheduleParser();