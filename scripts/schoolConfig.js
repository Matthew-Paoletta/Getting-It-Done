/**
 * School Configuration - Buildings and Location Data
 * Easy to update for different schools
 */

// ===== UCSD BUILDINGS =====
export const UCSD_BUILDINGS = [
  // Main Lecture Halls
  { code: 'CENTR', name: 'Center Hall' },
  { code: 'LEDDN', name: 'Ledden Auditorium' },
  { code: 'YORK', name: 'York Hall' },
  { code: 'PCYNH', name: 'Price Center Theater' },
  { code: 'PETER', name: 'Peterson Hall' },
  { code: 'WLH', name: 'Warren Lecture Hall' },
  { code: 'SOLIS', name: 'Solis Hall' },
  { code: 'PODEM', name: 'Podemos' },
  { code: 'MOS', name: 'Mosaic' },
  
  // Engineering/CSE Buildings
  { code: 'CSB', name: 'Cognitive Science Building' },
  { code: 'EBU3B', name: 'Engineering Building Unit 3B (CSE)' },
  { code: 'EBU1', name: 'Engineering Building Unit 1' },
  { code: 'EBU2', name: 'Engineering Building Unit 2' },
  { code: 'JWMMC', name: 'Jacobs Hall (JSOE)' },
  { code: 'SME', name: 'Structural & Materials Engineering' },
  { code: 'MANDE', name: 'Mandeville Center' },
  
  // Science Buildings
  { code: 'MAYER', name: 'Mayer Hall' },
  { code: 'UREY', name: 'Urey Hall' },
  { code: 'BONNER', name: 'Bonner Hall' },
  { code: 'NSB', name: 'Natural Sciences Building' },
  { code: 'PACIF', name: 'Pacific Hall' },
  { code: 'MYR-A', name: 'Mayer Hall Addition' },
  
  // Arts & Humanities
  { code: 'HSS', name: 'Humanities & Social Sciences' },
  { code: 'MANDE', name: 'Mandeville Center' },
  { code: 'GALB', name: 'Galbraith Hall' },
  { code: 'SEQUO', name: 'Sequoyah Hall' },
  { code: 'CRAWF', name: 'Crawford Hall' },
  
  // Medical/Biology
  { code: 'BSB', name: 'Biomedical Sciences Building' },
  { code: 'CMME', name: 'Center for Molecular Medicine East' },
  { code: 'CMMW', name: 'Center for Molecular Medicine West' },
  { code: 'MTF', name: 'Medical Teaching Facility' },
  { code: 'LSRI', name: 'Leichtag Family Foundation Biomedical Research' },
  
  // College Specific
  { code: 'APM', name: 'Applied Physics & Mathematics' },
  { code: 'RCLAS', name: 'Revelle College Classroom Building' },
  { code: 'GAL', name: 'Galbraith Hall' },  
  { code: 'RWAC', name: 'Ridge Walk Academic Complex' },
  { code: 'COA', name: 'Center for Optimal Algebra' },
  
  // Other Common Buildings
  { code: 'PRICE', name: 'Price Center' },
  { code: 'CPMC', name: 'Conrad Prebys Music Center' },
  { code: 'DANCE', name: 'Dance Studio' },
  { code: 'GYM', name: 'Main Gym' },
  { code: 'RBC', name: 'Robinson Building' },
  { code: 'OTRSN', name: 'Otterson Hall' },
  { code: 'ERCA', name: 'Eleanor Roosevelt College' },
  { code: 'DIB', name: 'Design & Innovation Building' },
  { code: 'FAH', name: 'Franklin Antonio Hall' },
  
  // Generic/TBA
  { code: 'TBA', name: 'To Be Announced' },
  { code: 'REMOTE', name: 'Remote/Online' }
];

// ===== TIME OPTIONS =====
export const TIME_OPTIONS = [];

// Generate times from 7:00am to 10:00pm in 10-minute increments
for (let hour = 7; hour <= 22; hour++) {
  for (let minute = 0; minute < 60; minute += 10) {
    const h12 = hour % 12 || 12;
    const suffix = hour >= 12 ? 'p' : 'a';
    const minStr = minute.toString().padStart(2, '0');
    const display = `${h12}:${minStr}${suffix}m`;
    const value = `${h12}:${minStr}${suffix}`;
    TIME_OPTIONS.push({ value, display });
  }
}

// ===== SESSION TYPES =====
export const SESSION_TYPES = [
  { value: 'Lecture', display: '📚 Lecture (LE)', color: '#3366ff' },
  { value: 'Discussion', display: '💬 Discussion (DI)', color: '#22aa88' },
  { value: 'Lab', display: '🔬 Lab (LA)', color: '#cc6600' },
  { value: 'Midterm', display: '📝 Midterm (MI)', color: '#e91e63' },
  { value: 'Final Exam', display: '🎯 Final Exam (FI)', color: '#8a5cf0' },
  { value: 'Seminar', display: '🎤 Seminar (SE)', color: '#607d8b' },
  { value: 'Tutorial', display: '📖 Tutorial (TU)', color: '#009688' },
  { value: 'Studio', display: '🎨 Studio (ST)', color: '#ff5722' }
];

// ===== DAYS OF WEEK =====
export const DAYS_OF_WEEK = [
  { value: 'M', display: 'Monday', short: 'Mon' },
  { value: 'Tu', display: 'Tuesday', short: 'Tue' },
  { value: 'W', display: 'Wednesday', short: 'Wed' },
  { value: 'Th', display: 'Thursday', short: 'Thu' },
  { value: 'F', display: 'Friday', short: 'Fri' },
  { value: 'Sa', display: 'Saturday', short: 'Sat' },
  { value: 'Su', display: 'Sunday', short: 'Sun' }
];

// ===== HELPER FUNCTIONS =====
export function getBuildingName(code) {
  const building = UCSD_BUILDINGS.find(b => b.code === code);
  return building ? building.name : code;
}

export function getSessionTypeInfo(type) {
  return SESSION_TYPES.find(s => s.value === type) || SESSION_TYPES[0];
}

/**
 * Convert a location string to a Google Maps-friendly format
 * "PETER 108" -> "Peterson Hall 108, UC San Diego, La Jolla, CA"
 * This helps Google Calendar auto-recognize UCSD buildings
 */
export function getGoogleMapsLocation(location, buildingCode, room) {
  // Handle TBA/Remote
  if (!location || location === 'TBA' || location.toUpperCase() === 'REMOTE') {
    return location || 'TBA';
  }
  
  // Try to find the building
  let building = null;
  
  // First try the explicit building code
  if (buildingCode) {
    building = UCSD_BUILDINGS.find(b => b.code.toUpperCase() === buildingCode.toUpperCase());
  }
  
  // If not found, try to extract building code from location string
  if (!building && location) {
    const parts = location.split(/\s+/);
    if (parts.length > 0) {
      building = UCSD_BUILDINGS.find(b => b.code.toUpperCase() === parts[0].toUpperCase());
    }
  }
  
  if (building && building.code !== 'TBA' && building.code !== 'REMOTE') {
    // Format: "Building Name Room#, UC San Diego, La Jolla, CA"
    const roomPart = room || (location ? location.replace(building.code, '').trim() : '');
    const roomStr = roomPart ? ` ${roomPart}` : '';
    return `${building.name}${roomStr}, UC San Diego, La Jolla, CA`;
  }
  
  // Fallback: just append UCSD to help Google Maps
  return `${location}, UC San Diego, La Jolla, CA`;
}

// ===== CURRENT SCHOOL CONFIG =====
export const CURRENT_SCHOOL_BUILDINGS = UCSD_BUILDINGS;

