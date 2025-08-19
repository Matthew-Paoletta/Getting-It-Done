export function setupViewImage() {
  const viewImageBtn = document.getElementById('view-image-btn');
  const previewArea = document.getElementById('preview-area');

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

  // Function to show/hide view button
  function toggleViewButton(show) {
    viewImageBtn.style.display = show ? 'block' : 'none';
  }

  return { toggleViewButton };
}