export function setupImageProcess() {
  const processBtn = document.getElementById('process-btn');
  const resultArea = document.getElementById('result-area');

  // Verify Tesseract is available
  if (typeof window.Tesseract === 'undefined') {
    console.error('Loading Tesseract...');
    // Try to load it dynamically if needed
    import('tesseract.js').then(({ createWorker }) => {
      window.Tesseract = { createWorker };
    }).catch(err => {
      console.error('Failed to load Tesseract:', err);
    });
  }

  processBtn.addEventListener('click', async () => {
    if (!window.uploadedImageUrl) {
      alert('Please upload an image first');
      return;
    }

    try {
      resultArea.textContent = 'Initializing text extraction...';
      
      const worker = await Tesseract.createWorker('eng');
      resultArea.textContent = 'Processing image...';
      
      const { data: { text } } = await worker.recognize(window.uploadedImageUrl);
      await worker.terminate();

      resultArea.innerHTML = `
        <h3>Extracted Text:</h3>
        <div class="extracted-text">
          <pre>${text}</pre>
        </div>
      `;
    } catch (error) {
      console.error('Text extraction failed:', error);
      resultArea.innerHTML = `
        <div class="error-message">
          Failed to extract text: ${error.message}
          <br>
          Please ensure Tesseract is properly loaded and try again.
        </div>
      `;
    }
  });
}