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
  }

  // NEW: Correct common OCR errors in day strings
  // E is never a valid day letter, so E → F (common OCR misread)
  correctOCRDays(dayString) {
    if (!dayString) return '';
    let corrected = dayString;
    // E → F correction (E is never a valid day)
    corrected = corrected.replace(/E/g, 'F');
    corrected = corrected.replace(/e/g, 'f');
    // O → 0 for section codes that might be mixed in
    // l/I/1/| at end are often OCR artifacts
    corrected = corrected.replace(/[lI1|]$/g, '');
    return corrected;
  }

  // NEW: Normalize day strings to a standard format
  // Handles: "TU Th" → "TuTh", "MWE" → "MWF", "mwf" → "MWF"
  normalizeDays(dayString) {
    if (!dayString) return '';
    
    // Step 1: Remove all spaces
    let normalized = dayString.replace(/\s+/g, '');
    
    // Step 2: Apply OCR corrections (E → F)
    normalized = this.correctOCRDays(normalized);
    
    // Step 3: Lowercase for matching
    const lower = normalized.toLowerCase();
    
    // Step 4: Map to standard format
    const dayMappings = {
      'm': 'M',
      'tu': 'Tu',
      'w': 'W',
      'th': 'Th',
      'f': 'F',
      'sa': 'Sa',
      'su': 'Su'
    };
    
    // Known combinations (lowercase → proper case)
    const combinationMappings = {
      'mwf': 'MWF',
      'mw': 'MW',
      'tuth': 'TuTh',
      'tth': 'TuTh',
      'wf': 'WF',
      'mf': 'MF',
      'mwth': 'MWTh',
      'twth': 'TuWTh',
      'mtwthf': 'MTuWThF',
      'mtuthf': 'MTuThF'
    };
    
    // Check for known combinations first
    if (combinationMappings[lower]) {
      return combinationMappings[lower];
    }
    
    // Otherwise, rebuild from individual days
    let result = '';
    let i = 0;
    while (i < lower.length) {
      // Check two-letter days first (Tu, Th, Sa, Su)
      if (i + 1 < lower.length) {
        const twoChar = lower.substring(i, i + 2);
        if (dayMappings[twoChar]) {
          result += dayMappings[twoChar];
          i += 2;
          continue;
        }
      }
      // Check single-letter days (M, W, F)
      const oneChar = lower[i];
      if (dayMappings[oneChar]) {
        result += dayMappings[oneChar];
      }
      i++;
    }
    
    return result || dayString; // Return original if no match
  }

  // NEW: Split concatenated day+time (e.g., "W8:00a-9:50a" → { day: "W", time: "8:00a-9:50a" })
  splitDayTime(field) {
    if (!field) return null;
    
    // Pattern: Day letter(s) immediately followed by time
    const match = field.match(/^(M|Tu|W|Th|F|Sa|Su)(\d{1,2}:\d{2}[ap]m?-\d{1,2}:\d{2}[ap]m?)$/i);
    if (match) {
      return {
        day: this.normalizeDays(match[1]),
        time: match[2]
      };
    }
    return null;
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
    let currentSection = '';  // Track section for inheritance - updated by Discussion/Lab
    let lastAddedEventIndex = -1;  // Track last event to attach orphan instructors
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      console.log(`Line ${i}: "${line.substring(0, 80)}..."`);
      
      // Skip header rows
      if (this.isHeaderLine(line)) {
        console.log('  ⏭️ Skipping header line');
        continue;
      }
      
      // Check for orphan instructor lines - CAPTURE them instead of skipping
      if (this.isOrphanInstructorLine(line)) {
        const instructorName = line.trim();
        // Attach to the current course if it has no instructor
        if (currentCourse && !currentInstructor) {
          currentInstructor = instructorName;
          console.log(`  👨‍🏫 Captured orphan instructor: ${instructorName} for ${currentCourse}`);
          // Also update the last added event if it has no instructor
          if (lastAddedEventIndex >= 0 && events[lastAddedEventIndex] && !events[lastAddedEventIndex].instructor) {
            events[lastAddedEventIndex].instructor = instructorName;
            console.log(`    → Applied to event at index ${lastAddedEventIndex}`);
          }
        } else {
          console.log(`  ⏭️ Skipping orphan instructor (already have one): ${instructorName}`);
        }
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
          // Start with main section, but will be overwritten by Discussion/Lab section
          currentSection = parsed.event.sectionCode || '';
          events.push(parsed.event);
          lastAddedEventIndex = events.length - 1;  // Track for orphan instructor attachment
          console.log(`  ✅ Added main course: ${parsed.courseCode} - ${parsed.event.sessionType} (Section: ${currentSection})`);
        }
        continue;
      }
      
      // Check for secondary session line (section code like A01, B01) - BEFORE exams
      // So that Discussion/Lab section can be captured for exam inheritance
      if (this.isSectionCodeStart(fields[0]) && currentCourse) {
        const parsed = this.parseSecondarySessionLine(fields, currentCourse, currentTitle, currentInstructor, quarter, year);
        if (parsed) {
          // If secondary session has its own section (A01, B01), use it AND update currentSection
          // This section will be inherited by subsequent exams
          if (parsed.sectionCode) {
            currentSection = parsed.sectionCode;  // Update for exam inheritance
          } else if (currentSection) {
            parsed.sectionCode = currentSection;
          }
          events.push(parsed);
          console.log(`  ✅ Added secondary session: ${currentCourse} - ${parsed.sessionType} (Section: ${parsed.sectionCode || 'unknown'})`);
        }
        continue;
      }
      
      // Check for Midterm line - AFTER secondary sessions so we inherit their section
      if (this.isMidtermLine(line) && currentCourse) {
        const parsed = this.parseMidtermLine(fields, currentCourse, currentTitle, currentInstructor, currentSection, quarter, year);
        if (parsed) {
          events.push(parsed);
          console.log(`  ✅ Added midterm: ${currentCourse} (Section: ${currentSection})`);
        }
        continue;
      }
      
      // Check for Final Exam line - AFTER secondary sessions so we inherit their section
      if (this.isFinalExamLine(line) && currentCourse) {
        const parsed = this.parseFinalExamLine(fields, currentCourse, currentTitle, currentInstructor, currentSection, quarter, year);
        if (parsed) {
          events.push(parsed);
          console.log(`  ✅ Added final exam: ${currentCourse} (Section: ${currentSection})`);
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
    const cleaned = (field?.trim() || '').replace(/O/g, '0').replace(/o/g, '0'); // Fix OCR O->0 errors
    return /^[A-Z][0-9]{2}$/i.test(cleaned);
  }
  
  // Helper to clean section codes (fix OCR errors)
  cleanSectionCode(code) {
    if (!code) return '';
    return code.trim().replace(/O/g, '0').replace(/o/g, '0');
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
      
      // Action words to exclude from room detection
      const actionWords = ['DROP', 'CHANGE', 'ENROLLED', 'WAITLIST', 'STATUS', 'POSITION', 'ACTION'];
      
      // Find key fields by pattern matching (more robust than fixed positions)
      let sectionCode = '', sessionType = '', instructor = '', days = '', timeRange = '', building = '', room = '';
      
      for (let i = 2; i < fields.length; i++) {
        const field = fields[i]?.trim() || '';
        if (!field) continue;
        
        // Skip action column words entirely
        if (actionWords.includes(field.toUpperCase())) continue;
        
        // Section code (A00, A01, B00 - must start with A-F, not R which is often a room)
        if (/^[A-F][0-9O]{2}$/i.test(field)) {
          sectionCode = field.replace(/O/g, '0');
        }
        // Session type (LE, DI, LA)
        else if (/^(LE|DI|LA)$/i.test(field)) {
          sessionType = this.normalizeSessionType(field);
        }
        // Instructor (contains comma: "Last, First") - clean trailing colons
        else if (field.includes(',') && !field.match(/^\d/) && field.length > 3) {
          instructor = field.replace(/:$/, '').trim();
        }
        // Check for concatenated day+time first (e.g., "MWF9:00a-9:50a")
        else if (this.splitDayTime(field)) {
          const split = this.splitDayTime(field);
          days = split.day;
          timeRange = split.time;
          console.log(`        Split day+time: ${field} → day=${days}, time=${timeRange}`);
        }
        // Time range (9:00a-9:50a) - check BEFORE days to avoid confusion
        else if (/\d{1,2}:\d{2}[ap]-?\d{1,2}:\d{2}[ap]/i.test(field)) {
          timeRange = field;
        }
        // Building code (PETER, CENTR, SME, FAH, etc.) - check BEFORE days!
        // This prevents building codes like SME/FAH from being misread as days
        else if (this.isBuildingCode(field)) {
          building = field;
        }
        // Days (M, Tu, W, Th, F, MWF, TuTh, etc.) - normalize to handle OCR errors like MWE → MWF
        else if (this.isDaysPattern(field)) {
          days = this.normalizeDays(field);
        }
        // Room number (108, 101, AUD, 1A18, R24) - exclude action words
        else if (/^[A-Z0-9]{2,5}$/i.test(field) && !['LE', 'DI', 'LA', 'FI', 'MI', 'L', 'P'].includes(field.toUpperCase()) && !actionWords.includes(field.toUpperCase())) {
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
      
      // Action words to exclude
      const actionWords = ['DROP', 'CHANGE', 'ENROLLED', 'WAITLIST', 'STATUS', 'POSITION', 'ACTION'];
      
      let sectionCode = '', sessionType = '', days = '', timeRange = '', building = '', room = '';
      
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i]?.trim() || '';
        if (!field) continue;
        
        // Skip action column words entirely
        if (actionWords.includes(field.toUpperCase())) continue;
        
        // Section code (A01, B01 - must start with A-F, not R which is often a room)
        if (/^[A-F][0-9O]{2}$/i.test(field)) {
          sectionCode = field.replace(/O/g, '0');
        }
        // Session type (DI, LA)
        else if (/^(LE|DI|LA)$/i.test(field)) {
          sessionType = this.normalizeSessionType(field);
        }
        // Check for concatenated day+time first (e.g., "W8:00a-9:50a")
        else if (this.splitDayTime(field)) {
          const split = this.splitDayTime(field);
          days = split.day;
          timeRange = split.time;
          console.log(`      Split day+time: ${field} → day=${days}, time=${timeRange}`);
        }
        // Time range (2:00p-2:50p) - check BEFORE days to avoid confusion
        else if (/\d{1,2}:\d{2}[ap]-?\d{1,2}:\d{2}[ap]/i.test(field)) {
          timeRange = field;
        }
        // Building code - check BEFORE days to prevent SME/FAH being misread as days
        else if (this.isBuildingCode(field)) {
          building = field;
        }
        // Single day (M, Tu, W, Th, F) - exact match only
        else if (/^(M|Tu|W|Th|F|Sa|Su)$/i.test(field)) {
          days = this.normalizeDays(field);
        }
        // Multi-day pattern (MW, MWF, TuTh) - normalize to handle OCR errors
        else if (this.isDaysPattern(field)) {
          days = this.normalizeDays(field);
        }
        // Room number (002, 108, AUD, 1A18, R24) - exclude action words
        else if (/^[A-Z0-9]{2,5}$/i.test(field) && !['LE', 'DI', 'LA', 'FI', 'MI', 'L', 'TU', 'TH', 'SA', 'SU'].includes(field.toUpperCase()) && !actionWords.includes(field.toUpperCase())) {
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
      
      // Allow TBA events (no time) - they'll be flagged in the UI
      if (!timeRange && (!days || days === 'TBA')) {
        console.log('    ⚠️ TBA event detected (no time/days)');
        days = 'TBA';
      }
      
      console.log(`    ✅ Secondary session: ${sessionType} on ${days} at ${times.start || 'TBA'}-${times.end || 'TBA'}`);
      
      return new CourseEvent({
        courseCode,
        courseTitle,
        sessionType: sessionType || 'Discussion',
        sectionCode,  // Keep parsed section code
        instructor,
        days,
        startTime: times.start || '',  // Empty string for TBA
        endTime: times.end || '',      // Empty string for TBA
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
  
  parseMidtermLine(fields, courseCode, courseTitle, instructor, inheritedSection, quarter, year) {
    try {
      console.log('    Parsing midterm with fields:', fields);
      
      // Action words to exclude
      const actionWords = ['DROP', 'CHANGE', 'ENROLLED', 'WAITLIST', 'STATUS', 'POSITION', 'ACTION'];
      
      let examDay = '', examDate = '', timeRange = '', building = '', room = '';
      
      for (const field of fields) {
        const f = field?.trim() || '';
        if (!f || f === 'Midterm' || f === 'MI' || actionWords.includes(f.toUpperCase())) continue;
        
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
        sectionCode: inheritedSection || '',  // Use inherited section, leave empty if unknown
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
  
  parseFinalExamLine(fields, courseCode, courseTitle, instructor, inheritedSection, quarter, year) {
    try {
      console.log('    Parsing final exam with fields:', fields);
      
      // Action words to exclude
      const actionWords = ['DROP', 'CHANGE', 'ENROLLED', 'WAITLIST', 'STATUS', 'POSITION', 'ACTION'];
      
      let finalDay = '', finalDate = '', timeRange = '', building = '', room = '';
      
      for (const field of fields) {
        const f = field?.trim() || '';
        if (!f || f === 'Final Exam' || f === 'FI' || actionWords.includes(f.toUpperCase())) continue;
        
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
        sectionCode: inheritedSection || '',  // Use inherited section, leave empty if unknown
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
    if (!field) return false;
    const trimmed = field.trim();
    
    // FIRST: Reject if it looks like a building code (3+ letters that aren't day patterns)
    // Building codes like SME, FAH, COA should NOT be treated as days
    if (this.isBuildingCode(trimmed)) {
      return false;
    }
    
    // SECOND: Check if the RAW string (before normalization) only contains valid day characters
    // Valid characters: M, T, W, F, S (and lowercase), u, h, a for Tu, Th, Sa, Su
    // Remove spaces first for checking
    const noSpaces = trimmed.replace(/\s+/g, '');
    
    // Reject if it contains letters that can't be part of any day
    // Valid day letters: M, T, W, F, S, u, h, a (for Tu, Th, Sa, Su)
    // E is allowed because it might be OCR error for F
    // But reject if it has other letters like B, C, D, G, etc.
    if (/[BCDGIJKLNOPQRVXYZ]/i.test(noSpaces)) {
      return false;
    }
    
    // Now normalize and check pattern
    const normalized = this.normalizeDays(trimmed);
    if (!normalized) return false;
    
    // Check if it matches valid day patterns
    // Valid single days: M, Tu, W, Th, F, Sa, Su
    // Valid combinations: MW, MWF, TuTh, etc.
    return /^(M|Tu|W|Th|F|Sa|Su)+$/i.test(normalized);
  }
  
  cleanDays(field) {
    // Use the comprehensive normalizeDays function
    return this.normalizeDays(field);
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
    
    // Action column words to EXCLUDE - these should never be treated as buildings
    const excludeWords = [
      'DROP', 'CHANGE', 'ENROLLED', 'WAITLIST', 'STATUS', 'POSITION',
      'LE', 'DI', 'LA', 'FI', 'MI', 'MWF', 'TUTH', 'ACTION',
      // Single letter days that might be mistaken for building codes
      'M', 'W', 'F'
    ];
    if (excludeWords.includes(f)) return false;
    
    // All known UCSD buildings - comprehensive list
    const knownBuildings = [
      // Main Lecture Halls
      'CENTR', 'CENTER', 'LEDDN', 'LEDN', 'YORK', 'PCYNH', 'PETER', 'WLH', 'SOLIS', 'PODEM', 'MOS',
      // Engineering/CSE Buildings
      'CSB', 'EBU3B', 'EBU1', 'EBU2', 'JWMMC', 'SME', 'MANDE',
      // Science Buildings
      'MAYER', 'UREY', 'BONNER', 'NSB', 'PACIF', 'MYR-A',
      // Arts & Humanities
      'HSS', 'GALB', 'SEQUO', 'CRAWF',
      // Medical/Biology
      'BSB', 'CMME', 'CMMW', 'MTF', 'LSRI',
      // College Specific
      'APM', 'RCLAS', 'GAL', 'RWAC', 'COA',
      // Other Common Buildings
      'FAH', 'PRICE', 'CPMC', 'DANCE', 'GYM', 'RBC', 'OTRSN', 'ERCA', 'DIB', 'MOGU',
      // 2-letter building codes (Galbraith Hall, etc.)
      'GH', 'AP', 'HL', 'MC', 'PH', 'SH',
      // Generic/TBA
      'TBA', 'REMOTE', 'ONLINE'
    ];
    
    // Check known buildings first
    if (knownBuildings.includes(f)) return true;
    
    // Allow 2-6 letter uppercase codes as potential buildings (fallback)
    // But exclude known non-building patterns
    if (/^[A-Z]{2,6}$/.test(f) && !excludeWords.includes(f)) {
      return true;
    }
    
    return false;
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
    return { start: '', end: '' };  // Return empty - don't guess times for TBA events
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