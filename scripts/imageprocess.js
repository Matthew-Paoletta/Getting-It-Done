/**
 * Main ImageProcess orchestrator with embedded ImageProcessor
 * Combined: Image OCR + Schedule Processing + UI Logic
 */
import { scheduleParser } from './scheduleParser.js';
import { processAndDisplayEvents, displayError } from './popup.js'; // ← IMPORT FROM POPUP.JS

console.log('🚀 ImageProcess.js loaded');

// ===== EMBEDDED IMAGE PROCESSOR CLASS =====
class ImageProcessor {
  constructor() {
    this.apiKey = 'K87861288988957'; // Free tier key
    this.statusCallback = null;
  }

  setStatusCallback(callback) {
    this.statusCallback = callback;
  }

  updateStatus(message) {
    console.log(`ImageProcessor: ${message}`);
    if (this.statusCallback) {
      this.statusCallback(message);
    }
  }

  validateImage(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please upload a JPEG, PNG, GIF, or BMP image.');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('File too large. Please upload an image smaller than 10MB.');
    }

    return true;
  }

  async convertToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async _sendOCR(base64Image, engine) {
    const formData = new FormData();
    formData.append('language', 'eng');
    formData.append('isTable', 'true');
    formData.append('isCreateSearchablePdf', 'false');
    formData.append('OCREngine', String(engine));
    if (engine === 2) {
      formData.append('scale', 'true');
      formData.append('detectOrientation', 'true');
      formData.append('isOverlayRequired', 'true');
    }
    formData.append('base64Image', base64Image);

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { 'apikey': this.apiKey },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`OCR API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.IsErroredOnProcessing) {
      const errorMessages = Array.isArray(result.ErrorMessage) 
        ? result.ErrorMessage.join('; ') 
        : (result.ErrorMessage || 'Unknown OCR error');
      throw new Error(`OCR processing failed: ${errorMessages}`);
    }

    return result;
  }

  async extractTextFromImage(file) {
    this.updateStatus('🔍 Validating image...');
    this.validateImage(file);

    this.updateStatus('📄 Converting image to base64...');
    const base64Image = await this.convertToBase64(file);

    let result;
    // Try Engine 2 (best accuracy), auto-fallback to Engine 1 if timeout
    try {
      this.updateStatus('🚀 Sending to OCR service (Engine 2)...');
      result = await this._sendOCR(base64Image, 2);
    } catch (err) {
      if (err.message && err.message.includes('E101')) {
        this.updateStatus('⏳ Engine 2 timed out, retrying with faster Engine 1...');
        result = await this._sendOCR(base64Image, 1);
      } else {
        throw err;
      }
    }

    try {
      this.updateStatus('📊 Processing OCR results...');

      const extractedText = result.ParsedResults?.[0]?.ParsedText || '';
      
      // DEBUG: Log the raw OCR output to console
      console.log('=== RAW OCR TEXT ===');
      console.log(extractedText);
      console.log('=== END OCR TEXT ===');
      
      // Check if DI (Discussion) appears anywhere
      if (extractedText.includes('DI') || extractedText.includes('Di')) {
        console.log('✅ Found DI (Discussion) in OCR text');
      } else {
        console.log('⚠️ WARNING: No DI (Discussion) found in OCR text - OCR may be missing rows');
      }
      
      if (!extractedText.trim()) {
        throw new Error('No text could be extracted from the image. Please ensure the image is clear and contains visible text.');
      }

      this.updateStatus(`✅ Successfully extracted ${extractedText.length} characters`);
      
      return {
        success: true,
        text: extractedText.trim(),
        confidence: result.ParsedResults?.[0]?.TextOverlay?.HasOverlay || false,
        metadata: {
          fileSize: file.size,
          fileName: file.name,
          ocrEngine: 'OCR.space',
          processingTime: result.ProcessingTimeInMilliseconds || 0
        }
      };

    } catch (error) {
      this.updateStatus(`❌ OCR failed: ${error.message}`);
      throw new Error(`Failed to extract text from image: ${error.message}`);
    }
  }

  async processWebRegScreenshot(file) {
    this.updateStatus('🎓 Processing WebReg screenshot...');
    
    try {
      const result = await this.extractTextFromImage(file);
      this.updateStatus('✅ WebReg screenshot processed successfully');
      return result;
    } catch (error) {
      console.error('WebReg processing failed:', error);
      throw error;
    }
  }

  cleanText(rawText) {
    return String(rawText)
      .replace(/\t+/g, ' ')  // ← THIS DESTROYS THE TABS!
      .replace(/\s+/g, ' ')  // ← THIS COLLAPSES ALL WHITESPACE
      .trim();
  }
}

// Create singleton instance
const imageProcessor = new ImageProcessor();

// ===== MAIN SETUP FUNCTION =====
export function setupImageProcess() {
  console.log('🚀 Setting up image processing...');
  
  // Get DOM elements
  const uploadBtn = document.getElementById('upload-btn');
  const fileInput = document.getElementById('schedule-upload');
  const uploadArea = document.getElementById('upload-area');
  const fileInfo = document.getElementById('file-info');
  const uploadStatus = document.getElementById('upload-status');
  const processBtn = document.getElementById('process-btn');
  const quarterSelect = document.getElementById('quarter');
  const yearSelect = document.getElementById('year');

  if (!uploadBtn || !fileInput || !processBtn) {
    console.error('❌ Required DOM elements not found:', {
      uploadBtn: !!uploadBtn,
      fileInput: !!fileInput,
      processBtn: !!processBtn,
      quarterSelect: !!quarterSelect,
      yearSelect: !!yearSelect
    });
    return;
  }

  console.log('✅ All DOM elements found');
  
  let selectedFile = null;

  // Set up status callback for image processor
  imageProcessor.setStatusCallback((message) => {
    if (uploadStatus) {
      uploadStatus.textContent = message;
    }
    console.log('📊 Status update:', message);
  });

  // Upload button click handler
  uploadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('🔘 Upload button clicked');
    fileInput.click();
  });

  // Upload area click handler
  if (uploadArea) {
    uploadArea.addEventListener('click', (e) => {
      if (e.target.id !== 'upload-btn') {
        console.log('🔘 Upload area clicked');
        fileInput.click();
      }
    });

    // Drag and drop handlers
    uploadArea.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadArea.classList.add('drag-over');
      console.log('📥 Drag enter');
    });

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadArea.classList.remove('drag-over');
      console.log('📤 Drag leave');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadArea.classList.remove('drag-over');
      console.log('📁 File dropped');

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        
        // Validate it's an image
        if (!file.type.startsWith('image/')) {
          if (uploadStatus) {
            uploadStatus.textContent = '❌ Please drop an image file';
          }
          console.log('❌ Dropped file is not an image:', file.type);
          return;
        }

        // Set the file as selected (same as file input change)
        selectedFile = file;
        
        if (fileInfo) {
          fileInfo.style.display = 'block';
        }
        
        const sizeKB = Math.max(1, Math.round(file.size / 1024));
        if (uploadStatus) {
          uploadStatus.textContent = `✅ Dropped: ${file.name} (${sizeKB} KB)`;
        }
        
        processBtn.style.display = 'inline-flex';
        
        console.log('✅ Dropped file ready for processing:', file.name, `${sizeKB}KB`);
      }
    });
  }

  // File selection handler
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    console.log('📁 File selected:', file?.name || 'none');
    
    if (!file) return;

    selectedFile = file;
    
    if (fileInfo) {
      fileInfo.style.display = 'block';
    }
    
    const sizeKB = Math.max(1, Math.round(file.size / 1024));
    if (uploadStatus) {
      uploadStatus.textContent = `✅ Selected: ${file.name} (${sizeKB} KB)`;
    }
    
    processBtn.style.display = 'inline-flex';
    
    console.log('✅ File ready for processing:', file.name, `${sizeKB}KB`);
  });

  // Process button click handler
  processBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    console.log('🚀 Starting processing...');
    
    const originalText = processBtn.textContent;
    processBtn.disabled = true;
    processBtn.textContent = '⏳ Processing...';

    try {
      // Get quarter and year
      const quarter = quarterSelect?.value || 'Fall';
      const year = yearSelect?.value || '2025';
      
      console.log(`🎓 Processing WebReg schedule for ${quarter} ${year}`);

      // Step 1: Extract text from image
      console.log('Step 1: Image Processing');
      const ocrResult = await imageProcessor.processWebRegScreenshot(selectedFile);
      
      if (!ocrResult.success || !ocrResult.text.trim()) {
        throw new Error('Could not extract text from the image');
      }

      console.log('✅ Text extraction completed');

      // Step 2: Parse the OCR text directly into events
      console.log('Step 2: Parsing OCR text into events...');
      
      const events = scheduleParser.parseTextToEvents(ocrResult.text, quarter, year);
      
      console.log(`📊 Parsed ${events.length} events from OCR`);
      
      // Step 3: Display the results (with review if missing info)
      if (events.length > 0) {
        processAndDisplayEvents(events, quarter, year);
      } else {
        throw new Error('No events could be parsed from the image. Please try a clearer screenshot.');
      }
      
    } catch (error) {
      displayError(error);
      
    } finally {
      processBtn.disabled = false;
      processBtn.textContent = originalText;
    }
  });

  console.log('✅ Image processing setup completed');
}

console.log('✅ ImageProcess.js fully loaded');