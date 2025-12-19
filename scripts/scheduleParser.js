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
    if (type.includes('midterm') || type === 'mi') return 'Midterm';
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
    
    lines.push(`Course: ${this.courseCode}${this.courseTitle ? ' - ' + this.courseTitle : ''}`);
    
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
    
    lines.push('');  // Empty line before footer
    lines.push('📚 Created by Getting It Done');
    
    // Join with actual newline characters (will be escaped later)
    return lines.join('\n');
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

    // DON'T clean text here - we need to preserve tabs for parsing!
    // Only do minimal normalization
    const normalizedText = this.normalizeTextForParsing(rawText);
    console.log('Normalized text preview:', normalizedText.substring(0, 300));

    // Parse the actual OCR text
    const parsedEvents = this.parseWebRegFormat(normalizedText, quarter, year);

    if (parsedEvents.length > 0) {
      console.log(`✅ Successfully parsed ${parsedEvents.length} events from OCR text`);
      return parsedEvents;
    }

    // Emergency fallback only if parsing completely fails
    console.log('⚠️ OCR parsing failed, using emergency fallback');
    return this.createEmergencyFallback(quarter, year);
  }

  // NEW: Normalize text while PRESERVING TABS (critical for parsing!)
  normalizeTextForParsing(rawText) {
    return String(rawText)
      .replace(/[–—]/g, '-')           // Normalize dashes
      .replace(/\u00A0/g, ' ')          // Replace non-breaking spaces with regular spaces
      .replace(/\r\n/g, '\n')           // Normalize line endings
      .replace(/\r/g, '\n')             // Normalize old Mac line endings
      // DO NOT replace tabs! We need them for parsing
      // DO NOT collapse whitespace! We need structure
      .trim();
  }

  // COMPLETELY NEW: Direct WebReg table parser for OCR text format
  parseWebRegFormat(text, quarter, year) {
    const events = [];
    console.log('🔍 Parsing WebReg OCR format...');
    
    // Split into lines
    const lines = text.split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
  
    console.log(`Processing ${lines.length} lines...`);
    
    let currentCourse = null;
    let currentTitle = '';
    let currentInstructor = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      console.log(`Line ${i}: "${line.substring(0, 80)}..."`);
      
      // Skip header rows
      if (this.isHeaderLine(line)) {
        console.log('  ⏭️ Skipping header line');
        continue;
      }
      
      // Skip orphan instructor lines (just a name with no other data)
      if (this.isOrphanInstructorLine(line)) {
        console.log('  ⏭️ Skipping orphan instructor line');
        continue;
      }
      
      // Split by tabs
      const fields = line.split('\t').map(f => f.trim()).filter(f => f.length > 0);
      console.log('  Fields:', fields);
      
      // Check for main course line (starts with course code like "CSE 100", "DSC 80")
      if (this.isCourseCodeStart(fields[0])) {
        const parsed = this.parseMainCourseLine(fields, quarter, year);
        if (parsed) {
          currentCourse = parsed.courseCode;
          currentTitle = parsed.courseTitle;
          currentInstructor = parsed.instructor;
          events.push(parsed.event);
          console.log(`  ✅ Added main course: ${parsed.courseCode} - ${parsed.event.sessionType}`);
        }
        continue;
      }
      
      // Check for Midterm line
      if (this.isMidtermLine(line) && currentCourse) {
        const parsed = this.parseMidtermLine(fields, currentCourse, currentTitle, currentInstructor, quarter, year);
        if (parsed) {
          events.push(parsed);
          console.log(`  ✅ Added midterm: ${currentCourse}`);
        }
        continue;
      }
      
      // Check for Final Exam line
      if (this.isFinalExamLine(line) && currentCourse) {
        const parsed = this.parseFinalExamLine(fields, currentCourse, currentTitle, currentInstructor, quarter, year);
        if (parsed) {
          events.push(parsed);
          console.log(`  ✅ Added final exam: ${currentCourse}`);
        }
        continue;
      }
      
      // Check for secondary session line (section code like A01, B01)
      if (this.isSectionCodeStart(fields[0]) && currentCourse) {
        const parsed = this.parseSecondarySessionLine(fields, currentCourse, currentTitle, currentInstructor, quarter, year);
        if (parsed) {
          events.push(parsed);
          console.log(`  ✅ Added secondary session: ${currentCourse} - ${parsed.sessionType}`);
        }
        continue;
      }
      
      console.log('  ⚠️ Line not matched to any pattern');
    }
    
    console.log(`📊 Total events parsed: ${events.length}`);
    return events;
  }

  // ===== LINE TYPE DETECTION =====
  
  isHeaderLine(line) {
    const headerKeywords = ['subject', 'course', 'title', 'section', 'code', 'type', 'instructor', 
                            'grade', 'option', 'units', 'days', 'time', 'bldg', 'room', 'status', 
                            'action', 'position', 'calendar', 'finals', 'print schedule', 'book list'];
    const lowerLine = line.toLowerCase();
    const matchCount = headerKeywords.filter(kw => lowerLine.includes(kw)).length;
    return matchCount >= 2;
  }
  
  isOrphanInstructorLine(line) {
    // Lines that are just names with no schedule data
    // Pattern: "LastName, FirstName" or just "LastName" with no times/days/rooms
    const hasTimePattern = /\d{1,2}:\d{2}[ap]/.test(line);
    const hasDayPattern = /\b(MWF|TuTh|MW|M|Tu|W|Th|F|Sa|Su)\b/i.test(line);
    const hasCourseCode = /^[A-Z]{2,4}\s*\d{1,3}[A-Z]?/.test(line);
    const hasSectionCode = /^[A-Z]\d{2}/.test(line);
    
    // If it has none of the schedule markers and looks like a name
    if (!hasTimePattern && !hasDayPattern && !hasCourseCode && !hasSectionCode) {
      // Check if it looks like a name (contains comma or is short text)
      if (line.includes(',') || (line.length < 30 && /^[A-Za-z\s]+$/.test(line))) {
        return true;
      }
    }
    return false;
  }
  
  isCourseCodeStart(field) {
    // Match: CSE 100, DSC 80, MATH 18, CSE 150A, etc.
    return /^[A-Z]{2,4}\s*\d{1,3}[A-Z]?$/i.test(field?.trim() || '');
  }
  
  isSectionCodeStart(field) {
    // Match: A00, A01, B00, B01, etc. (also handle OCR errors like BOO -> B00)
    const cleaned = (field?.trim() || '').replace(/O/g, '0'); // Fix OCR O->0 errors
    return /^[A-Z][0-9]{2}$/i.test(cleaned);
  }
  
  isMidtermLine(line) {
    return /midterm/i.test(line) || /\bMI\b/.test(line);
  }
  
  isFinalExamLine(line) {
    return /final\s*exam/i.test(line) || /\bFI\b/.test(line);
  }

  // ===== PARSING FUNCTIONS =====
  
  parseMainCourseLine(fields, quarter, year) {
    try {
      console.log('    Parsing main course with fields:', fields);
      
      const courseCode = fields[0]?.trim() || '';
      const courseTitle = fields[1]?.trim() || '';
      
      // Find key fields by pattern matching (more robust than fixed positions)
      let sectionCode = '', sessionType = '', instructor = '', days = '', timeRange = '', building = '', room = '';
      
      for (let i = 2; i < fields.length; i++) {
        const field = fields[i]?.trim() || '';
        if (!field) continue;
        
        // Section code (A00, B00)
        if (/^[A-Z][0-9O]{2}$/i.test(field)) {
          sectionCode = field.replace(/O/g, '0');
        }
        // Session type (LE, DI, LA)
        else if (/^(LE|DI|LA)$/i.test(field)) {
          sessionType = this.normalizeSessionType(field);
        }
        // Instructor (contains comma: "Last, First")
        else if (field.includes(',') && !field.match(/^\d/) && field.length > 3) {
          instructor = field;
        }
        // Days (M, Tu, W, Th, F, MWF, TuTh, etc.)
        else if (this.isDaysPattern(field)) {
          days = this.cleanDays(field);
        }
        // Time range (9:00a-9:50a)
        else if (/\d{1,2}:\d{2}[ap]-?\d{1,2}:\d{2}[ap]/i.test(field)) {
          timeRange = field;
        }
        // Building code (PETER, CENTR, LEDDN, etc.)
        else if (this.isBuildingCode(field)) {
          building = field;
        }
        // Room number (108, 101, AUD, 1A18)
        else if (/^[A-Z0-9]{2,5}$/i.test(field) && !['LE', 'DI', 'LA', 'FI', 'MI', 'L', 'P'].includes(field.toUpperCase())) {
          if (!building) {
            building = field;
          } else {
            room = field;
          }
        }
      }
      
      if (!courseCode) return null;
      
      const times = this.parseTimeRange(timeRange);
      
      const event = new CourseEvent({
        courseCode,
        courseTitle,
        sessionType: sessionType || 'Lecture',
        sectionCode,
        instructor,
        days,
        startTime: times.start,
        endTime: times.end,
        location: building && room ? `${building} ${room}` : building || room || 'TBA',
        building,
        room,
        quarter,
        year
      });
      
      return { courseCode, courseTitle, instructor, event };
    } catch (error) {
      console.error('Error parsing main course line:', error);
      return null;
    }
  }
  
  parseSecondarySessionLine(fields, courseCode, courseTitle, instructor, quarter, year) {
    try {
      console.log('    Parsing secondary session with fields:', fields);
      
      let sectionCode = '', sessionType = '', days = '', timeRange = '', building = '', room = '';
      
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i]?.trim() || '';
        if (!field) continue;
        
        // Section code (A01, B01, etc.)
        if (/^[A-Z][0-9O]{2}$/i.test(field)) {
          sectionCode = field.replace(/O/g, '0');
        }
        // Session type (DI, LA)
        else if (/^(LE|DI|LA)$/i.test(field)) {
          sessionType = this.normalizeSessionType(field);
        }
        // Single day (M, Tu, W, Th, F) - check BEFORE time to catch standalone days
        else if (/^(M|Tu|W|Th|F|Sa|Su)$/i.test(field)) {
          days = field;
        }
        // Multi-day pattern (MW, MWF, TuTh) - clean up OCR errors
        else if (this.isDaysPattern(field)) {
          days = this.cleanDays(field);
        }
        // Time range (2:00p-2:50p)
        else if (/\d{1,2}:\d{2}[ap]-?\d{1,2}:\d{2}[ap]/i.test(field)) {
          timeRange = field;
        }
        // Building code
        else if (this.isBuildingCode(field)) {
          building = field;
        }
        // Room number (002, 108, AUD, 1A18)
        else if (/^[A-Z0-9]{2,5}$/i.test(field) && !['LE', 'DI', 'LA', 'FI', 'MI', 'L', 'W', 'M', 'F'].includes(field.toUpperCase())) {
          if (!building) {
            building = field;
          } else if (!room) {
            room = field;
          }
        }
      }
      
      const times = this.parseTimeRange(timeRange);
      
      // If no days found but we have a time, mark for manual review
      if (!days && timeRange) {
        console.log('    ⚠️ No days found - OCR may have dropped the day column');
        days = 'MISSING_DAY'; // Don't guess - let user see this needs review
      }
      
      if (!timeRange) {
        console.log('    ⚠️ No time found, skipping');
        return null;
      }
      
      console.log(`    ✅ Secondary session: ${sessionType} on ${days} at ${times.start}-${times.end}`);
      
      return new CourseEvent({
        courseCode,
        courseTitle,
        sessionType: sessionType || 'Discussion',
        sectionCode,
        instructor,
        days,
        startTime: times.start,
        endTime: times.end,
        location: building && room ? `${building} ${room}` : building || room || 'TBA',
        building,
        room,
        quarter,
        year
      });
    } catch (error) {
      console.error('Error parsing secondary session line:', error);
      return null;
    }
  }
  
  parseMidtermLine(fields, courseCode, courseTitle, instructor, quarter, year) {
    try {
      console.log('    Parsing midterm with fields:', fields);
      
      let examDay = '', examDate = '', timeRange = '', building = '', room = '';
      
      for (const field of fields) {
        const f = field?.trim() || '';
        if (!f || f === 'Midterm' || f === 'MI') continue;
        
        // Day + Date pattern: "Sa 02/07/2026"
        const dayDateMatch = f.match(/^(M|Tu|W|Th|F|Sa|Su)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})$/i);
        if (dayDateMatch) {
          examDay = dayDateMatch[1];
          examDate = dayDateMatch[2];
          continue;
        }
        
        // Time range
        if (/\d{1,2}:\d{2}[ap]-?\d{1,2}:\d{2}[ap]/i.test(f)) {
          timeRange = f;
          continue;
        }
        
        // Building
        if (this.isBuildingCode(f)) {
          building = f;
          continue;
        }
        
        // Room
        if (/^[A-Z0-9]{2,5}$/i.test(f) && !['MI', 'FI'].includes(f.toUpperCase())) {
          if (building && !room) {
            room = f;
          }
        }
      }
      
      const times = this.parseTimeRange(timeRange);
      
      return new CourseEvent({
        courseCode,
        courseTitle,
        sessionType: 'Midterm',
        sectionCode: 'MI',
        instructor,
        days: examDay,
        startTime: times.start,
        endTime: times.end,
        location: building && room ? `${building} ${room}` : building || room || 'TBA',
        building,
        room,
        finalDate: examDate,
        finalDay: examDay,
        quarter,
        year
      });
    } catch (error) {
      console.error('Error parsing midterm line:', error);
      return null;
    }
  }
  
  parseFinalExamLine(fields, courseCode, courseTitle, instructor, quarter, year) {
    try {
      console.log('    Parsing final exam with fields:', fields);
      
      let finalDay = '', finalDate = '', timeRange = '', building = '', room = '';
      
      for (const field of fields) {
        const f = field?.trim() || '';
        if (!f || f === 'Final Exam' || f === 'FI') continue;
        
        // Day + Date pattern: "W 03/18/2026", "Sa 03/14/2026"
        const dayDateMatch = f.match(/^(M|Tu|W|Th|F|Sa|Su)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})$/i);
        if (dayDateMatch) {
          finalDay = dayDateMatch[1];
          finalDate = dayDateMatch[2];
          continue;
        }
        
        // Time range
        if (/\d{1,2}:\d{2}[ap]-?\d{1,2}:\d{2}[ap]/i.test(f)) {
          timeRange = f;
          continue;
        }
        
        // Building
        if (this.isBuildingCode(f)) {
          building = f;
          continue;
        }
        
        // Room
        if (/^[A-Z0-9]{2,5}$/i.test(f) && !['MI', 'FI'].includes(f.toUpperCase())) {
          if (building && !room) {
            room = f;
          }
        }
      }
      
      const times = this.parseTimeRange(timeRange);
      
      return new CourseEvent({
        courseCode,
        courseTitle,
        sessionType: 'Final Exam',
        sectionCode: 'FI',
        instructor,
        days: finalDay,
        startTime: times.start,
        endTime: times.end,
        location: building && room ? `${building} ${room}` : building || room || 'TBA',
        building,
        room,
        finalDate,
        finalDay,
        quarter,
        year
      });
    } catch (error) {
      console.error('Error parsing final exam line:', error);
      return null;
    }
  }

  // ===== HELPER FUNCTIONS =====
  
  isDaysPattern(field) {
    // Match day patterns, accounting for OCR errors like "F l" -> "F"
    const cleaned = field?.trim().replace(/\s+[lI1|]$/i, '').trim() || '';
    return /^(M|Tu|W|Th|F|Sa|Su|MW|MWF|TuTh|TTh)+$/i.test(cleaned);
  }
  
  cleanDays(field) {
    // Clean up OCR errors in days field
    let cleaned = field?.trim() || '';
    cleaned = cleaned.replace(/\s+[lI1|]$/i, ''); // Remove trailing "l", "I", "1", "|"
    cleaned = cleaned.replace(/\s+/g, ''); // Remove spaces
    return cleaned;
  }
  
  normalizeSessionType(type) {
    const map = {
      'LE': 'Lecture',
      'DI': 'Discussion',
      'LA': 'Lab',
      'FI': 'Final Exam',
      'MI': 'Midterm'
    };
    return map[type?.toUpperCase()] || type || 'Lecture';
  }
  
  isBuildingCode(field) {
    const f = field?.trim().toUpperCase() || '';
    const knownBuildings = [
      'PETER', 'CENTR', 'CENTER', 'WLH', 'YORK', 'SOLIS', 'LEDDN', 'LEDN',
      'APM', 'HSS', 'CSB', 'EBU3B', 'PCYNH', 'MANDE', 'FAH', 'RWAC', 
      'MOGU', 'DIB', 'MOS', 'PODEM', 'SEQUO', 'GALB', 'TBA', 'REMOTE'
    ];
    return knownBuildings.includes(f) || 
           (/^[A-Z]{3,6}$/.test(f) && !['LE', 'DI', 'LA', 'FI', 'MI', 'MWF', 'TUTH'].includes(f));
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