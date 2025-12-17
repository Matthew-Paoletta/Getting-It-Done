/**
 * TextParser - Parses raw WebReg text (copied from browser) into course events
 * This handles the tab-separated format when users copy/paste from WebReg
 */

import { CourseEvent } from './scheduleParser.js';

export class TextParser {
  constructor() {
    console.log('📝 TextParser initialized');
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
          instructor = field;
          console.log(`        → Instructor`);
        } else if (this.isDaysField(field)) {
          days = field;
          console.log(`        → Days`);
        } else if (this.isTimeRange(field)) {
          timeRange = field;
          console.log(`        → Time range`);
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
        } else if (this.isDaysField(field)) {
          days = field;
        } else if (this.isTimeRange(field)) {
          timeRange = field;
        } else if (this.isBuildingCode(field)) {
          building = field;
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
   */
  isDaysField(field) {
    // Match single days or combinations
    return /^(M|Tu|W|Th|F|Sa|Su)+$/i.test(field?.trim() || '');
  }

  /**
   * Check if field is a time range
   */
  isTimeRange(field) {
    return /\d{1,2}:\d{2}[ap]-?\d{1,2}:\d{2}[ap]/i.test(field || '');
  }

  /**
   * Check if field is a building code (common UCSD buildings)
   */
  isBuildingCode(field) {
    const f = field?.trim().toUpperCase() || '';
    // Common UCSD building codes
    const buildings = ['PETER', 'CENTR', 'WLH', 'YORK', 'SOLIS', 'LEDDN', 'APM', 'HSS', 'CSB', 'EBU3B', 'PCYNH', 'MANDE', 'FAH', 'RWAC', 'MOGU', 'DIB', 'MOS'];
    return buildings.includes(f) || (/^[A-Z]{2,6}$/.test(f) && !['L', 'P', 'NP', 'LE', 'DI', 'LA', 'FI', 'MI', 'TBA'].includes(f));
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