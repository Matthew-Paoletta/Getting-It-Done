export function setupImageProcess() {
    console.log('Setting up image processing...');
    
    // Get DOM elements
    const fileInput = document.getElementById('schedule-upload');
    const uploadBtn = document.getElementById('upload-btn');
    const viewImageBtn = document.getElementById('view-image-btn');
    const processBtn = document.getElementById('process-btn');
    const previewArea = document.getElementById('preview-area');
    const uploadStatus = document.getElementById('upload-status');
    const resultArea = document.getElementById('result-area');

    if (!fileInput || !uploadBtn || !viewImageBtn) {
        console.error('Required elements not found');
        return;
    }

    // Upload button handler
    uploadBtn.onclick = function() {
        console.log('Upload button clicked');
        fileInput.click();
    };

    // File input change handler
    fileInput.onchange = function(event) {
        const file = event.target.files[0];
        console.log('File selected:', file?.name);
        
        if (file) {
            window.uploadedImageUrl = URL.createObjectURL(file);
            
            if (uploadStatus) {
                uploadStatus.textContent = `File selected: ${file.name}`;
            }
            
            viewImageBtn.style.display = 'inline-block';
            
            if (processBtn) {
                processBtn.style.display = 'inline-block';
            }
            
            if (previewArea) {
                previewArea.innerHTML = '';
            }
        }
    };

    // View image button handler
    viewImageBtn.onclick = function() {
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

    // Process button handler using OCRAD
    if (processBtn) {
        processBtn.onclick = function() {
            console.log('Process button clicked');
            
            if (!window.uploadedImageUrl) {
                alert('Please upload an image first');
                return;
            }

            if (!resultArea) {
                console.error('Result area not found');
                return;
            }

            // Check if OCRAD is available
            if (typeof OCRAD === 'undefined') {
                resultArea.innerHTML = `
                    <div style="color: red;">
                        OCRAD library not loaded. Please refresh the extension and try again.
                    </div>
                `;
                return;
            }

            resultArea.textContent = 'Processing image with OCRAD...';
            
            // Use setTimeout to make processing non-blocking
            setTimeout(() => {
                try {
                    const img = new Image();
                    img.onload = function() {
                        try {
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            
                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx.drawImage(img, 0, 0);
                            
                            resultArea.textContent = 'Analyzing image...';
                            
                            // Process with OCRAD
                            const text = OCRAD(canvas);
                            
                            resultArea.innerHTML = `
                                <h3>Extracted Text:</h3>
                                <div class="extracted-text" style="background: #f5f5f5; padding: 10px; border-radius: 4px; white-space: pre-wrap; font-family: monospace; max-height: 200px; overflow-y: auto;">${text || 'No text detected'}</div>
                            `;
                            
                        } catch (error) {
                            console.error('OCRAD processing failed:', error);
                            resultArea.innerHTML = `
                                <div style="color: red;">
                                    Processing failed: ${error.message}<br>
                                    Try using a clearer image with black text on white background.
                                </div>
                            `;
                        }
                    };
                    
                    img.onerror = function() {
                        resultArea.innerHTML = `
                            <div style="color: red;">
                                Failed to load image. Please try again.
                            </div>
                        `;
                    };
                    
                    img.src = window.uploadedImageUrl;
                    
                } catch (error) {
                    console.error('Processing failed:', error);
                    resultArea.innerHTML = `
                        <div style="color: red;">
                            Processing failed: ${error.message}
                        </div>
                    `;
                }
            }, 100);
        };
    }
}

function toggleImagePreview() {
    // This function is no longer needed but keeping for compatibility
    const viewImageBtn = document.getElementById('view-image-btn');
    if (viewImageBtn) {
        viewImageBtn.click();
    }
}