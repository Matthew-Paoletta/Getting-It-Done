export function setupPreview() {
  const previewBtn = document.getElementById('preview-btn');
  const previewArea = document.getElementById('preview-area');

  previewBtn.addEventListener('click', () => {
    previewArea.innerHTML = '';
    if (window.uploadedImageUrl) {
      const img = document.createElement('img');
      img.src = window.uploadedImageUrl;
      img.alt = 'Schedule Preview';
      img.style.maxWidth = '100%';
      img.style.margin = '10px 0';
      previewArea.appendChild(img);
    } else {
      previewArea.textContent = 'No image uploaded.';
    }
  });
}