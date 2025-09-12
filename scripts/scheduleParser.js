// Advanced schedule parsing for extracting individual class sessions
export function parseScheduleData(rawText) {
    console.log('Parsing schedule data...');
    
    const courses = [];
    const lines = rawText.split('\n').filter(line => line.trim().length > 0);
    
    let currentCourse = null;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Look for main course headers (e.g., "CSE 151A", "DSC 40A")
        const courseMatch = line.match(/^([A-Z]{2,4}\s+\d+[A-Z]?)\s+(.+?)(?:\s+([AB]\d{2}|\d{3}))?\s+(LE|DI|LA|FI)/);
        
        if (courseMatch) {
            const courseCode = courseMatch[1];
            const courseTitle = courseMatch[2];
            const sectionCode = courseMatch[3] || '';
            const sessionType = courseMatch[4];
            
            // If this is a new course (different course code)
            if (!currentCourse || currentCourse.code !== courseCode) {
                // Save previous course if exists
                if (currentCourse) {
                    courses.push(currentCourse);
                }
                
                // Start new course
                currentCourse = {
                    code: courseCode,
                    title: cleanCourseTitle(courseTitle),
                    sessions: []
                };
            }
            
            // Parse the rest of the line for session details
            const sessionData = parseSessionLine(line, sessionType);
            if (sessionData) {
                currentCourse.sessions.push({
                    type: sessionType,
                    sectionCode: sectionCode,
                    ...sessionData
                });
            }
        }
        // Look for additional session lines (DI, LA, FI on separate lines)
        else if (line.match(/^\s*([AB]\d{2}|\w+)\s+(DI|LA|FI)/)) {
            const sessionMatch = line.match(/^\s*([AB]\d{2}|\w+)?\s+(DI|LA|FI)\s+(.+)/);
            if (sessionMatch && currentCourse) {
                const sectionCode = sessionMatch[1] || '';
                const sessionType = sessionMatch[2];
                const sessionDetails = sessionMatch[3];
                
                const sessionData = parseSessionDetails(sessionDetails);
                if (sessionData) {
                    currentCourse.sessions.push({
                        type: sessionType,
                        sectionCode: sectionCode,
                        ...sessionData
                    });
                }
            }
        }
        // Look for standalone session information
        else if (currentCourse && line.match(/(MWF|MW|TuTh|M|Tu|W|Th|F|Sa|Su).+\d+:\d+[ap]-\d+:\d+[ap]/)) {
            const sessionData = parseSessionDetails(line);
            if (sessionData && currentCourse.sessions.length > 0) {
                // Add to the last session if it doesn't have time info
                const lastSession = currentCourse.sessions[currentCourse.sessions.length - 1];
                if (!lastSession.days || !lastSession.time) {
                    Object.assign(lastSession, sessionData);
                }
            }
        }
    }
    
    // Add the last course
    if (currentCourse) {
        courses.push(currentCourse);
    }
    
    return courses;
}

// Parse a complete session line
function parseSessionLine(line, sessionType) {
    // Extract instructor
    const instructorMatch = line.match(/([A-Z][a-z]+,\s*[A-Z][a-z]+)/);
    const instructor = instructorMatch ? instructorMatch[1] : '';
    
    // Extract days and time
    const dayTimeMatch = line.match(/(MWF|MW|TuTh|M|Tu|W|Th|F|Sa|Su)\s+(\d+:\d+[ap])-(\d+:\d+[ap])/);
    
    // Extract location
    const locationMatch = line.match(/([A-Z]{2,6})\s+(\d+)/);
    const building = locationMatch ? locationMatch[1] : '';
    const room = locationMatch ? locationMatch[2] : '';
    
    // Extract units
    const unitsMatch = line.match(/(\d\.\d{2})/);
    const units = unitsMatch ? parseFloat(unitsMatch[1]) : 0;
    
    return {
        instructor,
        days: dayTimeMatch ? dayTimeMatch[1] : '',
        startTime: dayTimeMatch ? dayTimeMatch[2] : '',
        endTime: dayTimeMatch ? dayTimeMatch[3] : '',
        building,
        room,
        units,
        rawLine: line
    };
}

// Parse session details from a line
function parseSessionDetails(details) {
    // Extract days and time
    const dayTimeMatch = details.match(/(MWF|MW|TuTh|M|Tu|W|Th|F|Sa|Su)\s+(\d+:\d+[ap])-(\d+:\d+[ap])/);
    
    // Extract location
    const locationMatch = details.match(/([A-Z]{2,6})\s+(\d+)/);
    
    // Handle final exam dates
    const finalDateMatch = details.match(/([MTWFS])\s+(\d{1,2}\/\d{1,2}\/\d{4})/);
    
    if (dayTimeMatch) {
        return {
            days: dayTimeMatch[1],
            startTime: dayTimeMatch[2],
            endTime: dayTimeMatch[3],
            building: locationMatch ? locationMatch[1] : '',
            room: locationMatch ? locationMatch[2] : '',
            finalDate: finalDateMatch ? finalDateMatch[2] : '',
            rawLine: details
        };
    }
    
    return null;
}

// Clean up course titles
function cleanCourseTitle(title) {
    // Remove common prefixes and suffixes that might interfere
    return title
        .replace(/^(ML:\s*|Theor\s+|Introduction\s+to\s+)/i, '')
        .replace(/\s+(I|II|III|IV)$/, ' $1')
        .trim();
}

// Convert parsed courses to calendar events
export function convertToCalendarEvents(courses, quarter = 'Fall', year = '2025') {
    const events = [];
    
    courses.forEach(course => {
        course.sessions.forEach(session => {
            // Skip final exams for now (they need special date handling)
            if (session.type === 'FI') return;
            
            // Only process sessions with valid time and day information
            if (!session.days || !session.startTime || !session.endTime) return;
            
            const event = {
                courseCode: course.code,
                courseTitle: course.title,
                sessionType: getSessionTypeName(session.type),
                sectionCode: session.sectionCode,
                instructor: session.instructor || '',
                days: session.days,
                startTime: session.startTime,
                endTime: session.endTime,
                location: session.building && session.room ? `${session.building} ${session.room}` : '',
                units: session.units || 0,
                
                // Calendar specific fields
                summary: `${course.code} - ${getSessionTypeName(session.type)}`,
                description: `Course: ${course.title}\nInstructor: ${session.instructor}\nSection: ${session.sectionCode}\nLocation: ${session.building} ${session.room}`,
                quarter,
                year
            };
            
            events.push(event);
        });
    });
    
    return events;
}

// Get human-readable session type names
function getSessionTypeName(type) {
    const typeNames = {
        'LE': 'Lecture',
        'DI': 'Discussion',
        'LA': 'Lab',
        'FI': 'Final Exam'
    };
    
    return typeNames[type] || type;
}

// Get academic calendar dates for the quarter
export function getQuarterDates(quarter, year) {
    // UCSD quarter dates (approximate - you may need to adjust)
    const quarterDates = {
        'Fall': {
            start: `09/26/${year}`,
            end: `12/13/${year}`,
            finals: `12/14/${year}` // Finals week start
        },
        'Winter': {
            start: `01/08/${year}`,
            end: `03/21/${year}`,
            finals: `03/22/${year}`
        },
        'Spring': {
            start: `03/31/${year}`,
            end: `06/13/${year}`,
            finals: `06/14/${year}`
        },
        'Summer Session 1': {
            start: `06/24/${year}`,
            end: `08/02/${year}`,
            finals: `08/03/${year}`
        },
        'Summer Session 2': {
            start: `08/05/${year}`,
            end: `09/13/${year}`,
            finals: `09/14/${year}`
        }
    };
    
    return quarterDates[quarter] || quarterDates['Fall'];
}

// Debug function to show parsing results
export function debugParseResults(courses) {
    console.log('=== PARSED COURSES ===');
    courses.forEach(course => {
        console.log(`\n📚 ${course.code}: ${course.title}`);
        course.sessions.forEach(session => {
            console.log(`  ${getSessionTypeName(session.type)} (${session.sectionCode}): ${session.days} ${session.startTime}-${session.endTime} @ ${session.building} ${session.room}`);
            if (session.instructor) console.log(`    👨‍🏫 ${session.instructor}`);
        });
    });
    console.log('=====================');
}