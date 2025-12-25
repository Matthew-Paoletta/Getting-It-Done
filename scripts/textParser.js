/**
 * TextParser - Parses raw WebReg text (copied from browser) into course events
 * This handles the tab-separated format when users copy/paste from WebReg
 */

import { CourseEvent } from './scheduleParser.js';

export class TextParser {
  constructor() {
    console.log('📝 TextParser initialized');
  }

  // NEW: Correct common OCR errors in day strings
  // E is never a valid day letter, so E → F (common OCR misread)
  correctOCRDays(dayString) {
    if (!dayString) return '';
    let corrected = dayString;
    // E → F correction (E is never a valid day)
    corrected = corrected.replace(/E/g, 'F');
    corrected = corrected.replace(/e/g, 'f');
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

  /**
   * Main parsing function - takes raw pasted text and returns CourseEvents
   */
  parseWebRegText(rawText, quarter = 'Fall', year = '2025') {
    console.log('=== TEXT PARSER START ===');
    console.log(`Parsing for ${quarter} ${year}`);
    console.log(`Input text length: ${rawText?.length || 0}`);
    
    if (!rawText || rawText.trim().length < 20) {
      console.log('⚠️ Insufficient text provided');
      return { events: [], error: 'Please paste your WebReg schedule text' };
    }

    const events = [];
    const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    console.log(`📄 Processing ${lines.length} lines...`);

    let currentCourse = null;
    let currentTitle = '';
    let currentInstructor = '';
    let currentUnits = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Split by tabs, but also handle multiple spaces as separators
      const fields = line.split(/\t/).map(f => f.trim()).filter(f => f.length > 0);
      
      console.log(`Line ${i}: "${line.substring(0, 80)}..." → ${fields.length} fields`);
      console.log(`  Fields:`, fields);

      // Skip header rows or empty lines
      if (this.isHeaderRow(line) || fields.length < 2) {
        console.log(`  ⏭️ Skipping (header or too few fields)`);
        continue;
      }

      // Check if this is a main course line (starts with course code like "CSE 100")
      if (this.isCourseCodeLine(fields[0])) {
        const parsed = this.parseMainCourseLine(fields, quarter, year);
        if (parsed) {
          currentCourse = parsed.courseCode;
          currentTitle = parsed.courseTitle;
          currentInstructor = parsed.instructor;
          currentUnits = parsed.units;
          events.push(parsed.event);
          console.log(`  ✅ Added main course: ${parsed.courseCode} - ${parsed.event.sessionType}`);
        }
        continue;
      }

      // Check if this is a Midterm line
      if (this.isMidtermLine(line) && currentCourse) {
        const parsed = this.parseMidtermLine(fields, currentCourse, currentTitle, currentInstructor, quarter, year);
        if (parsed) {
          events.push(parsed);
          console.log(`  ✅ Added midterm: ${currentCourse}`);
        }
        continue;
      }

      // Check if this is a final exam line
      if (this.isFinalExamLine(line) && currentCourse) {
        const parsed = this.parseFinalExamLine(fields, currentCourse, currentTitle, currentInstructor, quarter, year);
        if (parsed) {
          events.push(parsed);
          console.log(`  ✅ Added final exam: ${currentCourse}`);
        }
        continue;
      }

      // Check if this is a secondary session line (discussion, lab - starts with section code like "A01")
      if ((this.isSectionCodeLine(fields[0]) || this.looksLikeSecondaryLine(fields)) && currentCourse) {
        const parsed = this.parseSecondarySessionLine(fields, currentCourse, currentTitle, currentInstructor, quarter, year);
        if (parsed) {
          events.push(parsed);
          console.log(`  ✅ Added secondary session: ${currentCourse} - ${parsed.sessionType}`);
        }
        continue;
      }

      console.log(`  ⚠️ Line not matched to any pattern`);
    }

    console.log(`📊 Total events parsed: ${events.length}`);
    
    // Validate events
    const validEvents = events.filter(event => event.isValid());
    console.log(`✅ Valid events: ${validEvents.length}`);

    // Log what we got
    validEvents.forEach((e, i) => {
      console.log(`  Event ${i + 1}: ${e.courseCode} - ${e.sessionType} - ${e.days} ${e.startTime}-${e.endTime} @ ${e.location}`);
    });

    return {
      events: validEvents,
      totalParsed: events.length,
      validCount: validEvents.length,
      error: validEvents.length === 0 ? 'No valid events could be parsed from the text. Make sure you copied the full schedule from the List view.' : null
    };
  }

  /**
   * Check if a line is a header row (column names)
   */
  isHeaderRow(line) {
    const headerKeywords = ['subject', 'course', 'section', 'type', 'instructor', 'grade', 'units', 'days', 'time', 'bldg', 'room', 'status'];
    const lowerLine = line.toLowerCase();
    return headerKeywords.filter(kw => lowerLine.includes(kw)).length >= 3;
  }

  /**
   * Check if field starts with a course code (e.g., "CSE 100", "MATH 18")
   */
  isCourseCodeLine(field) {
    // Match patterns like "CSE 100", "MATH 18", "BILD 1", "CSE 100R"
    return /^[A-Z]{2,4}\s*\d{1,3}[A-Z]?\s*$/i.test(field?.trim() || '');
  }

  /**
   * Check if field is a section code (e.g., "A00", "B01")
   */
  isSectionCodeLine(field) {
    return /^[A-Z]\d{2,3}$/i.test(field?.trim() || '');
  }

  /**
   * Check if this looks like a secondary line (DI, LA session types)
   */
  looksLikeSecondaryLine(fields) {
    // Look for DI or LA in the fields
    return fields.some(f => /^(DI|LA)$/i.test(f.trim()));
  }

  /**
   * Check if line contains a midterm
   */
  isMidtermLine(line) {
    return /midterm|^MI\b/i.test(line);
  }

  /**
   * Check if line contains a final exam
   */
  isFinalExamLine(line) {
    return /final\s*exam|^FI\b/i.test(line);
  }

  /**
   * Parse a main course line
   * Format: CSE 100  	Advanced Data Structures	A00	LE	Sahoo, Debashis	L	4.00	MWF	9:00a-9:50a	PETER	108	Enrolled
   */
  parseMainCourseLine(fields, quarter, year) {
    try {
      console.log(`    Parsing main course line with ${fields.length} fields`);
      
      // First field is course code
      const courseCode = fields[0]?.trim() || '';
      
      // Second field is usually course title
      let courseTitle = '';
      let startIdx = 1;
      
      // Check if field 1 looks like a title (not a section code or session type)
      if (fields[1] && !this.isSectionCodeLine(fields[1]) && !/^(LE|DI|LA|FI|MI)$/i.test(fields[1])) {
        courseTitle = fields[1].trim();
        startIdx = 2;
      }
      
      // Find other fields
      let sectionCode = '', sessionType = '', instructor = '', days = '', timeRange = '', building = '', room = '';
      
      for (let i = startIdx; i < fields.length; i++) {
        const field = fields[i]?.trim() || '';
        if (!field) continue;
        
        console.log(`      Field ${i}: "${field}"`);
        
        if (/^[A-Z]\d{2,3}$/.test(field)) {
          sectionCode = field;
          console.log(`        → Section code`);
        } else if (/^(LE|DI|LA|FI|MI)$/i.test(field)) {
          sessionType = this.normalizeSessionType(field);
          console.log(`        → Session type: ${sessionType}`);
        } else if (/,/.test(field) && field.length > 3 && !field.match(/^\d/)) {
          // Likely instructor name (Last, First format)
          instructor = field.replace(/:$/, '').trim(); // Remove trailing colon from OCR
          console.log(`        → Instructor`);
        } else if (this.splitDayTime(field)) {
          // Handle concatenated day+time (e.g., "MWF9:00a-9:50a")
          const split = this.splitDayTime(field);
          days = split.day;
          timeRange = split.time;
          console.log(`        → Split day+time: day=${days}, time=${timeRange}`);
        } else if (this.isTimeRange(field)) {
          timeRange = field;
          console.log(`        → Time range`);
        } else if (this.isBuildingCode(field)) {
          building = field;
          console.log(`        → Building`);
        } else if (this.isDaysField(field)) {
          days = this.normalizeDays(field);
          console.log(`        → Days (normalized: ${days})`);
        } else if (this.isBuildingCode(field)) {
          building = field;
          console.log(`        → Building`);
        } else if (/^\d{3,4}[A-Z]?$/.test(field)) {
          room = field;
          console.log(`        → Room`);
        }
      }

      if (!courseCode) {
        console.log(`    ❌ No course code found`);
        return null;
      }

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

      console.log(`    ✅ Created event: ${courseCode} ${sessionType} ${days} ${times.start}-${times.end}`);

      return {
        courseCode,
        courseTitle,
        instructor,
        units: '',
        event
      };
    } catch (error) {
      console.error('Error parsing main course line:', error);
      return null;
    }
  }

  /**
   * Parse a secondary session line (discussion, lab)
   * Format: A01	DI		 	 	W	8:00p-8:50p	PETER	108
   */
  parseSecondarySessionLine(fields, courseCode, courseTitle, instructor, quarter, year) {
    try {
      console.log(`    Parsing secondary session line`);
      
      let sectionCode = '', sessionType = '', days = '', timeRange = '', building = '', room = '';

      for (let i = 0; i < fields.length; i++) {
        const field = fields[i]?.trim() || '';
        if (!field) continue;
        
        if (/^[A-Z]\d{2,3}$/.test(field)) {
          sectionCode = field;
        } else if (/^(LE|DI|LA|FI|MI)$/i.test(field)) {
          sessionType = this.normalizeSessionType(field);
        } else if (this.splitDayTime(field)) {
          // Handle concatenated day+time (e.g., "W8:00p-8:50p")
          const split = this.splitDayTime(field);
          days = split.day;
          timeRange = split.time;
          console.log(`      Split day+time: ${field} → day=${days}, time=${timeRange}`);
        } else if (this.isTimeRange(field)) {
          timeRange = field;
        } else if (this.isBuildingCode(field)) {
          building = field;
        } else if (this.isDaysField(field)) {
          days = this.normalizeDays(field);
        } else if (/^\d{3,4}[A-Z]?$/.test(field)) {
          room = field;
        }
      }

      // If no session type found, default based on context
      if (!sessionType) {
        sessionType = 'Discussion';
      }

      const times = this.parseTimeRange(timeRange);

      // Must have at least days and time to be valid
      if (!days || !timeRange) {
        console.log(`    ⚠️ Missing days or time for secondary session`);
        return null;
      }

      return new CourseEvent({
        courseCode,
        courseTitle,
        sessionType,
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

  /**
   * Parse a midterm line
   * Format: Midterm	 	MI		 	 	Sa 02/07/2026	3:00p-4:50p	PETER	108
   */
  parseMidtermLine(fields, courseCode, courseTitle, instructor, quarter, year) {
    try {
      console.log(`    Parsing midterm line`);
      
      let examDay = '', examDate = '', timeRange = '', building = '', room = '';

      for (const field of fields) {
        const f = field?.trim() || '';
        if (!f) continue;
        
        // Look for day + date pattern like "Sa 02/07/2026"
        const dayDateMatch = f.match(/^(M|Tu|W|Th|F|Sa|Su)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})$/i);
        if (dayDateMatch) {
          examDay = dayDateMatch[1];
          examDate = dayDateMatch[2];
          console.log(`      Found date: ${examDay} ${examDate}`);
          continue;
        }

        // Look for time range
        if (this.isTimeRange(f)) {
          timeRange = f;
          console.log(`      Found time: ${timeRange}`);
          continue;
        }

        // Look for building
        if (this.isBuildingCode(f)) {
          building = f;
          console.log(`      Found building: ${building}`);
          continue;
        }

        // Look for room
        if (/^\d{3,4}[A-Z]?$/.test(f)) {
          room = f;
          console.log(`      Found room: ${room}`);
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

  /**
   * Parse a final exam line
   * Format: Final Exam	 	FI		 	 	W 03/18/2026	8:00a-10:59a	PETER	108
   */
  parseFinalExamLine(fields, courseCode, courseTitle, instructor, quarter, year) {
    try {
      console.log(`    Parsing final exam line`);
      
      let finalDay = '', finalDate = '', timeRange = '', building = '', room = '';

      for (const field of fields) {
        const f = field?.trim() || '';
        if (!f) continue;
        
        // Look for day + date pattern like "W 03/18/2026"
        const dayDateMatch = f.match(/^(M|Tu|W|Th|F|Sa|Su)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})$/i);
        if (dayDateMatch) {
          finalDay = dayDateMatch[1];
          finalDate = dayDateMatch[2];
          console.log(`      Found date: ${finalDay} ${finalDate}`);
          continue;
        }

        // Look for time range
        if (this.isTimeRange(f)) {
          timeRange = f;
          console.log(`      Found time: ${timeRange}`);
          continue;
        }

        // Look for building
        if (this.isBuildingCode(f)) {
          building = f;
          console.log(`      Found building: ${building}`);
          continue;
        }

        // Look for room
        if (/^\d{3,4}[A-Z]?$/.test(f)) {
          room = f;
          console.log(`      Found room: ${room}`);
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

  /**
   * Check if field looks like days (M, Tu, W, Th, F, MWF, TuTh, etc.)
   * Now handles OCR errors and spacing issues, but rejects building codes
   */
  isDaysField(field) {
    if (!field) return false;
    const trimmed = field.trim();
    
    // FIRST: Reject if it looks like a building code
    if (this.isBuildingCode(trimmed)) {
      return false;
    }
    
    // SECOND: Check if string only contains valid day characters
    // Valid: M, T, W, F, S, u, h, a, E (OCR error for F)
    // Reject if it has other letters like B, C, D, G, etc.
    const noSpaces = trimmed.replace(/\s+/g, '');
    if (/[BCDGIJKLNOPQRVXYZ]/i.test(noSpaces)) {
      return false;
    }
    
    const normalized = this.normalizeDays(trimmed);
    // Match single days or combinations after normalization
    return /^(M|Tu|W|Th|F|Sa|Su)+$/i.test(normalized);
  }

  /**
   * Check if field is a time range
   */
  isTimeRange(field) {
    return /\d{1,2}:\d{2}[ap]-?\d{1,2}:\d{2}[ap]/i.test(field || '');
  }

  /**
   * Check if field is a building code (common UCSD buildings)
   * Expanded list with 2-letter codes and fallback pattern
   */
  isBuildingCode(field) {
    const f = field?.trim().toUpperCase() || '';
    
    // Words to exclude - never treat these as buildings
    const excludeWords = [
      'DROP', 'CHANGE', 'ENROLLED', 'WAITLIST', 'STATUS', 'POSITION',
      'LE', 'DI', 'LA', 'FI', 'MI', 'MWF', 'TUTH', 'ACTION',
      'L', 'P', 'NP', 'TBA', 'M', 'W', 'F'
    ];
    if (excludeWords.includes(f)) return false;
    
    // Comprehensive UCSD building codes
    const buildings = [
      // Main buildings
      'PETER', 'CENTR', 'CENTER', 'WLH', 'YORK', 'SOLIS', 'LEDDN', 'LEDN', 'APM', 'HSS', 'CSB',
      'EBU3B', 'EBU1', 'EBU2', 'PCYNH', 'MANDE', 'FAH', 'RWAC', 'MOGU', 'DIB', 'MOS',
      // Engineering/Science
      'SME', 'JWMMC', 'MAYER', 'UREY', 'BONNER', 'NSB', 'PACIF', 'MYR-A',
      // Arts & Humanities
      'GALB', 'SEQUO', 'CRAWF',
      // Medical/Biology
      'BSB', 'CMME', 'CMMW', 'MTF', 'LSRI',
      // College Specific
      'RCLAS', 'GAL', 'COA',
      // Other buildings
      'PRICE', 'CPMC', 'DANCE', 'GYM', 'RBC', 'OTRSN', 'ERCA', 'PODEM',
      // 2-letter building codes
      'GH', 'AP', 'HL', 'MC', 'PH', 'SH',
      // Remote/Online
      'REMOTE', 'ONLINE'
    ];
    
    // Check known buildings first
    if (buildings.includes(f)) return true;
    
    // Fallback: 2-6 uppercase letters that aren't excluded
    if (/^[A-Z]{2,6}$/.test(f) && !excludeWords.includes(f)) {
      return true;
    }
    
    return false;
  }

  /**
   * Normalize session type abbreviations
   */
  normalizeSessionType(type) {
    const map = {
      'LE': 'Lecture',
      'DI': 'Discussion',
      'LA': 'Lab',
      'FI': 'Final Exam',
      'MI': 'Midterm'
    };
    return map[type.toUpperCase()] || type;
  }

  /**
   * Parse time range like "9:00a-9:50a" into start/end times
   */
  parseTimeRange(timeRange) {
    if (!timeRange) return { start: '', end: '' };

    // Handle formats like "9:00a-9:50a" or "8:00a-10:59a"
    const match = timeRange.match(/(\d{1,2}):(\d{2})([ap])m?-?(\d{1,2}):(\d{2})([ap])m?/i);
    
    if (match) {
      const startHour = match[1];
      const startMin = match[2];
      const startPeriod = match[3].toLowerCase();
      const endHour = match[4];
      const endMin = match[5];
      const endPeriod = match[6].toLowerCase();
      
      const start = `${startHour}:${startMin}${startPeriod}m`;
      const end = `${endHour}:${endMin}${endPeriod}m`;
      
      console.log(`      Parsed time: ${start} - ${end}`);
      return { start, end };
    }

    console.log(`      ⚠️ Could not parse time: ${timeRange}`);
    return { start: '', end: '' };
  }

  /**
   * Get parsing statistics for display
   */
  getParsingStats(events) {
    const stats = {
      totalEvents: events.length,
      courses: new Set(),
      sessionTypes: {}
    };

    for (const event of events) {
      stats.courses.add(event.courseCode);
      const type = event.getNormalizedSessionType();
      stats.sessionTypes[type] = (stats.sessionTypes[type] || 0) + 1;
    }

    stats.courseCount = stats.courses.size;
    return stats;
  }
}

// Export singleton instance
export const textParser = new TextParser();