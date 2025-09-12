// Import the new schedule parser
import { parseScheduleData, convertToCalendarEvents, debugParseResults } from './scheduleParser.js';
// Import Google Calendar API
import { googleCalendarAPI } from './googleCalendar.js';

// OCR-powered text extraction for Chrome extension
export function setupImageProcess() {
    console.log('Setting up OCR-powered image processing...');
    
    const fileInput = document.getElementById('schedule-upload');
    const uploadBtn = document.getElementById('upload-btn');
    const viewImageBtn = document.getElementById('view-image-btn');
    const processBtn = document.getElementById('process-btn');
    const previewArea = document.getElementById('preview-area');
    const uploadStatus = document.getElementById('upload-status');
    const resultArea = document.getElementById('result-area');

    if (!fileInput || !uploadBtn || !viewImageBtn || !processBtn) {
        console.error('Required elements not found');
        return;
    }

    console.log('All elements found, setting up event listeners...');

    // Upload button handler
    uploadBtn.onclick = function(e) {
        e.preventDefault();
        console.log('Upload button clicked');
        fileInput.click();
    };

    // File input change handler
    fileInput.onchange = function(event) {
        const file = event.target.files[0];
        console.log('File selected:', file?.name);
        
        if (file) {
            window.uploadedImageFile = file;
            window.uploadedImageUrl = URL.createObjectURL(file);
            
            if (uploadStatus) {
                uploadStatus.textContent = `File selected: ${file.name}`;
            }
            
            viewImageBtn.style.display = 'inline-block';
            processBtn.style.display = 'inline-block';
            
            if (previewArea) {
                previewArea.innerHTML = '';
                viewImageBtn.textContent = 'View Image';
            }
        }
    };

    // View image button handler
    viewImageBtn.onclick = function(e) {
        e.preventDefault();
        console.log('View image button clicked');
        
        if (!window.uploadedImageUrl) {
            alert('No image uploaded');
            return;
        }

        if (previewArea.innerHTML === '') {
            const img = document.createElement('img');
            img.src = window.uploadedImageUrl;
            img.alt = 'Schedule Preview';
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.marginTop = '10px';
            img.style.border = '1px solid #ddd';
            img.style.borderRadius = '4px';
            
            previewArea.appendChild(img);
            viewImageBtn.textContent = 'Hide Image';
        } else {
            previewArea.innerHTML = '';
            viewImageBtn.textContent = 'View Image';
        }
    };

    // Process button with OCR API
    processBtn.onclick = async function(e) {
        e.preventDefault();
        console.log('Process button clicked');
        
        if (!window.uploadedImageFile) {
            alert('Please upload an image first');
            return;
        }

        try {
            resultArea.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 18px; margin-bottom: 10px;">🔍 Extracting Text from Schedule...</div>
                    <div id="ocr-progress" style="color: #666;">Uploading to OCR service...</div>
                </div>
            `;
            
            console.log('Starting OCR processing...');
            
            // Extract text using OCR API
            const extractedText = await extractTextUsingOCRAPI(window.uploadedImageFile);
            
            console.log('OCR completed, extracted text:', extractedText);
            
            // Parse the extracted text into course data
            const courseData = parseScheduleText(extractedText);
            
            // Display results with course information
            displayScheduleResults(extractedText, courseData);
            
        } catch (error) {
            console.error('OCR processing failed:', error);
            resultArea.innerHTML = `
                <div style="color: red; padding: 15px; background: #fff5f5; border: 1px solid #ffdddd; border-radius: 4px;">
                    <h3>❌ OCR Processing Failed</h3>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>Possible solutions:</strong></p>
                    <ul style="text-align: left; margin: 10px 0;">
                        <li>Check your internet connection</li>
                        <li>Try with a clearer, higher resolution image</li>
                        <li>Ensure the image has good contrast (dark text on light background)</li>
                        <li>Make sure the image is not corrupted</li>
                    </ul>
                    <button onclick="location.reload()" style="background: #f44336; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                        Try Again
                    </button>
                </div>
            `;
        }
    };
}

// Extract text using OCR.space API
async function extractTextUsingOCRAPI(imageFile) {
    const progressElement = document.getElementById('ocr-progress');
    
    // Convert image to base64
    const base64Image = await convertToBase64(imageFile);
    
    if (progressElement) {
        progressElement.textContent = 'Processing image with OCR engine...';
    }
    
    // OCR.space API configuration
    const apiKey = 'K87899142388957'; // Free tier API key - replace with your own
    const apiUrl = 'https://api.ocr.space/parse/image';
    
    const formData = new FormData();
    formData.append('apikey', apiKey);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'false');
    formData.append('isCreateSearchablePdf', 'false');
    formData.append('isSearchablePdfHideTextLayer', 'false');
    formData.append('scale', 'true');
    formData.append('isTable', 'true'); // Better for schedule tables
    formData.append('OCREngine', '2'); // Use OCR Engine 2 for better accuracy
    formData.append('base64Image', base64Image);
    
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`OCR API request failed: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (progressElement) {
            progressElement.textContent = 'Processing OCR results...';
        }
        
        console.log('OCR API Response:', result);
        
        if (result.OCRExitCode === 1 && result.ParsedResults && result.ParsedResults.length > 0) {
            const extractedText = result.ParsedResults[0].ParsedText;
            
            if (!extractedText || extractedText.trim().length === 0) {
                throw new Error('No text was detected in the image. Please try with a clearer image.');
            }
            
            return extractedText;
        } else {
            const errorMsg = result.ErrorMessage && result.ErrorMessage[0] 
                ? result.ErrorMessage[0] 
                : 'Unknown OCR processing error';
            throw new Error(`OCR processing failed: ${errorMsg}`);
        }
        
    } catch (error) {
        console.error('OCR API Error:', error);
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Network error: Please check your internet connection and try again.');
        }
        
        throw error;
    }
}

// Convert image file to base64
function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result.split(',')[1]; // Remove data:image/jpeg;base64, prefix
            resolve(`data:${file.type};base64,${base64String}`);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Parse extracted text into course data
function parseScheduleText(text) {
    console.log('Using advanced schedule parser...');
    
    // Use the new advanced parser
    const courses = parseScheduleData(text);
    
    // Debug output
    debugParseResults(courses);
    
    return courses;
}

// Display schedule results
function displayScheduleResults(rawText, courseData) {
    const resultArea = document.getElementById('result-area');
    
    // Convert courses to calendar events
    const quarterInput = document.getElementById('quarter');
    const yearInput = document.getElementById('year');
    const quarter = quarterInput ? quarterInput.value : 'Fall';
    const year = yearInput ? yearInput.value : '2025';
    
    const calendarEvents = convertToCalendarEvents(courseData, quarter, year);
    
    let courseHtml = '';
    if (courseData.length > 0) {
        courseHtml = `
            <h3>📚 Detected Courses (${courseData.length}):</h3>
            <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 10px 0;">
                ${courseData.map((course, index) => `
                    <div style="background: white; padding: 12px; margin: 8px 0; border-radius: 6px; border-left: 4px solid #4CAF50;">
                        <div style="font-weight: bold; color: #2196F3; font-size: 16px; margin-bottom: 8px;">
                            ${course.code}: ${course.title}
                        </div>
                        ${course.sessions.map(session => `
                            <div style="margin: 6px 0; padding: 8px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid ${getSessionColor(session.type)};">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-weight: 500; color: #333;">
                                        ${getSessionTypeIcon(session.type)} ${getSessionTypeName(session.type)} 
                                        ${session.sectionCode ? `(${session.sectionCode})` : ''}
                                    </span>
                                    ${session.days && session.startTime ? `
                                        <span style="color: #666; font-size: 14px;">
                                            ⏰ ${session.days} ${session.startTime}-${session.endTime}
                                        </span>
                                    ` : ''}
                                </div>
                                ${session.building && session.room ? `<div style="color: #666; font-size: 14px;">📍 ${session.building} ${session.room}</div>` : ''}
                                ${session.instructor ? `<div style="color: #666; font-size: 14px;">👨‍🏫 ${session.instructor}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Show calendar events summary
    const eventsHtml = `
        <h3>📅 Calendar Events (${calendarEvents.length}):</h3>
        <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 10px 0;">
            ${calendarEvents.map(event => `
                <div style="background: white; padding: 10px; margin: 6px 0; border-radius: 4px; border-left: 3px solid ${getSessionColor(event.sessionType)};">
                    <div style="font-weight: 500;">${event.summary}</div>
                    <div style="color: #666; font-size: 14px;">
                        ⏰ ${event.days} ${event.startTime}-${event.endTime} 
                        ${event.location ? `📍 ${event.location}` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    resultArea.innerHTML = `
        <div style="margin-top: 20px;">
            <h2 style="color: #4CAF50;">✅ Schedule Parsed Successfully!</h2>
            
            ${courseHtml}
            
            ${eventsHtml}
            
            <div style="margin: 20px 0;">
                <button id="create-calendar-btn" style="background: #4285f4; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; margin-right: 10px;">
                    🗓️ Create Google Calendar Events (${calendarEvents.length})
                </button>
                <button id="copy-events-btn" style="background: #34A853; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    📋 Copy Event Data
                </button>
            </div>
            
            <details style="margin-top: 20px;">
                <summary style="cursor: pointer; font-weight: bold; padding: 8px; background: #f5f5f5; border-radius: 4px;">
                    📄 View Raw Extracted Text
                </summary>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 4px; white-space: pre-wrap; font-family: monospace; max-height: 300px; overflow-y: auto; border: 1px solid #ddd; margin-top: 10px;">${rawText}</div>
            </details>
        </div>
    `;
    
    // Add button event listeners
    const createCalendarBtn = document.getElementById('create-calendar-btn');
    const copyEventsBtn = document.getElementById('copy-events-btn');
    
    if (createCalendarBtn) {
        createCalendarBtn.onclick = function() {
            createGoogleCalendarEvents(calendarEvents);
        };
    }
    
    if (copyEventsBtn) {
        copyEventsBtn.onclick = function() {
            const eventText = calendarEvents.map(event => 
                `${event.summary}\n${event.days} ${event.startTime}-${event.endTime}\n${event.description}\n`
            ).join('\n');
            
            navigator.clipboard.writeText(eventText).then(() => {
                copyEventsBtn.innerHTML = '✅ Copied!';
                setTimeout(() => {
                    copyEventsBtn.innerHTML = '📋 Copy Event Data';
                }, 2000);
            });
        };
    }
}

// Create Google Calendar link from course data
async function createGoogleCalendarEvents(events) {
    if (events.length === 0) {
        alert('No calendar events to create. Please try with a clearer schedule image.');
        return;
    }
    
    const resultArea = document.getElementById('result-area');
    
    // Show authentication and creation progress
    resultArea.innerHTML += `
        <div id="calendar-progress" style="margin-top: 20px; padding: 15px; background: #e3f2fd; border: 1px solid #2196F3; border-radius: 8px;">
            <h3 style="color: #1976D2;">🔐 Authenticating with Google Calendar...</h3>
            <div id="progress-status" style="color: #666;">Requesting permission to access your Google Calendar...</div>
            <div id="progress-bar" style="background: #ddd; height: 20px; border-radius: 10px; margin: 10px 0; overflow: hidden;">
                <div id="progress-fill" style="background: #4CAF50; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
            </div>
            <div id="progress-details" style="font-size: 14px; color: #666;"></div>
        </div>
    `;
    
    const progressStatus = document.getElementById('progress-status');
    const progressFill = document.getElementById('progress-fill');
    const progressDetails = document.getElementById('progress-details');
    
    try {
        // Authenticate with Google
        progressStatus.textContent = 'Connecting to Google Calendar...';
        await googleCalendarAPI.authenticate();
        
        progressStatus.textContent = 'Creating calendar events...';
        progressFill.style.width = '10%';
        
        // Create events with progress tracking
        const results = await googleCalendarAPI.createMultipleEvents(events, 'primary', (progress) => {
            const percentage = Math.round((progress.current / progress.total) * 90) + 10; // 10-100%
            progressFill.style.width = `${percentage}%`;
            progressDetails.textContent = `Creating event ${progress.current} of ${progress.total}: ${progress.eventName}`;
        });
        
        // Show results
        progressFill.style.width = '100%';
        progressStatus.textContent = '✅ Calendar events created successfully!';
        
        // Display detailed results
        document.getElementById('calendar-progress').innerHTML = `
            <h3 style="color: #2E7D32;">🎉 Calendar Events Created Successfully!</h3>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                    <div style="text-align: center; flex: 1;">
                        <div style="font-size: 24px; font-weight: bold; color: #4CAF50;">${results.created.length}</div>
                        <div style="color: #666;">Created</div>
                    </div>
                    <div style="text-align: center; flex: 1;">
                        <div style="font-size: 24px; font-weight: bold; color: ${results.failed.length > 0 ? '#f44336' : '#666'}">${results.failed.length}</div>
                        <div style="color: #666;">Failed</div>
                    </div>
                    <div style="text-align: center; flex: 1;">
                        <div style="font-size: 24px; font-weight: bold; color: #2196F3;">${results.total}</div>
                        <div style="color: #666;">Total</div>
                    </div>
                </div>
                
                ${results.created.length > 0 ? `
                    <h4 style="color: #4CAF50; margin-top: 20px;">✅ Successfully Created Events:</h4>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${results.created.map(result => `
                            <div style="padding: 8px; margin: 4px 0; background: #f0f8ff; border-left: 3px solid #4CAF50; border-radius: 4px;">
                                <strong>${result.created.summary}</strong><br>
                                <span style="color: #666; font-size: 14px;">
                                    📅 ${result.original.days} ${result.original.startTime}-${result.original.endTime}
                                    ${result.original.location ? `📍 ${result.original.location}` : ''}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                ${results.failed.length > 0 ? `
                    <h4 style="color: #f44336; margin-top: 20px;">❌ Failed to Create:</h4>
                    <div style="max-height: 150px; overflow-y: auto;">
                        ${results.failed.map(result => `
                            <div style="padding: 8px; margin: 4px 0; background: #fff5f5; border-left: 3px solid #f44336; border-radius: 4px;">
                                <strong>${result.original.courseCode} - ${result.original.sessionType}</strong><br>
                                <span style="color: #f44336; font-size: 12px;">${result.error}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            
            <div style="margin-top: 15px; text-align: center;">
                <button onclick="window.open('https://calendar.google.com/calendar/u/0/r/week', '_blank')" 
                        style="background: #4285f4; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; margin-right: 10px;">
                    📅 Open Google Calendar
                </button>
                <button id="create-more-btn" style="background: #34A853; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">
                    ➕ Create More Events
                </button>
            </div>
        `;
        
        // Add create more button functionality
        document.getElementById('create-more-btn').onclick = function() {
            location.reload();
        };
        
    } catch (error) {
        console.error('Calendar creation failed:', error);
        document.getElementById('calendar-progress').innerHTML = `
            <h3 style="color: #f44336;">❌ Calendar Creation Failed</h3>
            <div style="background: #fff5f5; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <p><strong>Error:</strong> ${error.message}</p>
                <p><strong>Possible solutions:</strong></p>
                <ul style="text-align: left; margin: 10px 0;">
                    <li>Make sure you're logged into your Google account</li>
                    <li>Check if you granted calendar permissions</li>
                    <li>Try refreshing the extension and trying again</li>
                    <li>Verify your internet connection</li>
                </ul>
                <button onclick="location.reload()" style="background: #f44336; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Helper functions for UI
function getSessionColor(type) {
    const colors = {
        'LE': '#2196F3',      // Blue for lectures
        'Lecture': '#2196F3',
        'DI': '#4CAF50',      // Green for discussions
        'Discussion': '#4CAF50',
        'LA': '#FF9800',      // Orange for labs
        'Lab': '#FF9800',
        'FI': '#F44336'       // Red for finals
    };
    return colors[type] || '#666';
}

function getSessionTypeIcon(type) {
    const icons = {
        'LE': '🎓',
        'DI': '💭',
        'LA': '🧪',
        'FI': '📝'
    };
    return icons[type] || '📚';
}

function getSessionTypeName(type) {
    const names = {
        'LE': 'Lecture',
        'DI': 'Discussion',
        'LA': 'Lab',
        'FI': 'Final Exam'
    };
    return names[type] || type;
}