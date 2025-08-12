export function setupUpload() {
  const uploadBtn = document.getElementById('upload-btn');
  const fileInput = document.getElementById('schedule-upload');
  window.uploadedImageUrl = null;

  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      window.uploadedImageUrl = URL.createObjectURL(fileInput.files[0]);
      uploadBtn.textContent = "Image Selected";
    }
  });
}