export function setupImageProcess() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProcess);
  } else {
    initializeProcess();
  }
}

function initializeProcess() {
  console.log('Setting up image process...');

  const processBtn = document.getElementById('process-btn');
  const resultArea = document.getElementById('result-area');

  if (!processBtn || !resultArea) {
    console.error('ImageProcess: Required elements not found', {
      processBtn: !!processBtn,
      resultArea: !!resultArea
    });
    return;
  }

  console.log('Found required elements, attaching listener');

  processBtn.addEventListener('click', async () => {
    if (!window.uploadedImageUrl) {
      alert('Please upload an image first');
      return;
    }

    try {
      resultArea.textContent = 'Loading Tesseract...';
      
      // Create worker with explicit paths
      const worker = await Tesseract.createWorker({
        workerPath: chrome.runtime.getURL('lib/worker.min.js'),
        corePath: chrome.runtime.getURL('lib/tesseract-core.wasm'),
        logger: m => {
          console.log('Tesseract progress:', m);
          resultArea.textContent = `Processing: ${m.status} (${(m.progress * 100).toFixed(1)}%)`;
        }
      });

      console.log('Worker created, loading language...');
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      
      console.log('Starting text recognition...');
      const { data: { text } } = await worker.recognize(window.uploadedImageUrl);
      await worker.terminate();

      console.log('Recognition complete');
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
          Failed to extract text: ${error.message}<br>
          Please check the console for details.
        </div>
      `;
    }
  });
}