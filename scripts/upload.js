export function setupUpload() {
  const uploadBtn = document.getElementById('upload-btn');
  const fileInput = document.getElementById('schedule-upload');
  const uploadStatus = document.getElementById('upload-status');
  const viewImageBtn = document.getElementById('view-image-btn');
  const previewArea = document.getElementById('preview-area');
  
  if (!uploadBtn || !fileInput) {
    console.error('Upload elements not found');
    return;
  }

  // Handle upload button click
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  // Handle file selection
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      window.uploadedImageUrl = URL.createObjectURL(file);
      uploadStatus.textContent = `Selected: ${file.name}`;
      viewImageBtn.style.display = 'block';
      uploadBtn.textContent = "Image Selected";
      document.getElementById('process-btn').style.display = 'block';
    }
  });

  // Handle view button click
  viewImageBtn.addEventListener('click', () => {
    previewArea.innerHTML = '';
    if (window.uploadedImageUrl) {
      const img = document.createElement('img');
      img.src = window.uploadedImageUrl;
      img.alt = 'Schedule Preview';
      img.style.maxWidth = '100%';
      img.style.margin = '10px 0';
      previewArea.appendChild(img);
    }
  });
}
