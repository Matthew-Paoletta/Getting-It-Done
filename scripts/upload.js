export function setupUpload() {
  const uploadBtn = document.getElementById('upload-btn');
  const fileInput = document.getElementById('schedule-upload');
  const uploadStatus = document.getElementById('upload-status');
  window.uploadedImageUrl = null;

  // This makes the button open the file browser
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  // Show the file name after selection
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      window.uploadedImageUrl = URL.createObjectURL(fileInput.files[0]);
      uploadBtn.textContent = "Image Selected";
      uploadStatus.textContent = `Selected: ${fileInput.files[0].name}`;
    }
  });
}
