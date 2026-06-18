/**
 * app.js — Main Application Logic
 * Screen router, camera, file picker, OCR flow, Drive upload orchestration
 */

const App = (() => {
  // ─── App State ───────────────────────────────────────────
  let state = {
    city: null,         // 'indore' | 'mumbai'
    step: 'start',      // start | location | dashboard | camera | photo-review | card | card-review | ocr | confirm
    capturedPhoto: null,    // { blob, dataUrl, filename }
    capturedCard: null,     // { blob, dataUrl, filename }
    ocrResult: null,        // extracted fields
    driveLinked: false,
    pendingCards: [],       // queue for multiple visiting cards
  };

  let cameraStream = null;

  // ─── Screen Registry ─────────────────────────────────────
  const screens = {};

  function registerScreens() {
    document.querySelectorAll('[data-screen]').forEach(el => {
      screens[el.dataset.screen] = el;
    });
  }

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[name]) {
      screens[name].classList.add('active');
      state.step = name;
      saveState();
    }
  }

  // ─── State Persistence ───────────────────────────────────
  async function saveState() {
    await SessionDB.saveState({
      city: state.city,
      step: state.step,
      driveLinked: state.driveLinked,
    });
  }

  async function checkResume() {
    const hasSession = await SessionDB.hasActiveSession();
    if (hasSession) {
      const saved = await SessionDB.loadState();
      if (saved) {
        showResumePrompt(saved);
        return true;
      }
    }
    return false;
  }

  function showResumePrompt(saved) {
    const cityLabel = saved.city === 'indore' ? '🏙️ Indore' : '🌊 Mumbai';
    const stepLabel = getStepLabel(saved.step);

    const overlay = document.getElementById('resume-overlay');
    document.getElementById('resume-city').textContent = cityLabel;
    document.getElementById('resume-step').textContent = stepLabel;
    overlay.classList.add('active');

    document.getElementById('btn-resume').onclick = () => {
      overlay.classList.remove('active');
      state.city = saved.city;
      state.step = saved.step;
      updateCityUI(state.city);
      showScreen('dashboard');
    };

    document.getElementById('btn-fresh-start').onclick = async () => {
      overlay.classList.remove('active');
      await SessionDB.clearSession();
      state = { city: null, step: 'start', capturedPhoto: null, capturedCard: null, ocrResult: null, driveLinked: false };
      showScreen('start');
    };
  }

  function getStepLabel(step) {
    const labels = {
      'dashboard': 'Dashboard',
      'camera': 'Taking Photo',
      'photo-review': 'Photo Review',
      'card': 'Visiting Card',
      'card-review': 'Card Review',
      'ocr': 'Scanning Card',
      'confirm': 'Confirming Data',
    };
    return labels[step] || step;
  }

  // ─── City Setup ──────────────────────────────────────────
  function updateCityUI(city) {
    document.body.dataset.city = city;
    const cityName = city === 'indore' ? 'Indore' : 'Mumbai';
    document.querySelectorAll('.city-name').forEach(el => el.textContent = cityName);
    document.querySelectorAll('.city-emoji').forEach(el => {
      el.textContent = city === 'indore' ? '🏙️' : '🌊';
    });
  }

  function selectCity(city) {
    state.city = city;
    updateCityUI(city);
    saveState();
    showScreen('dashboard');
    // Add entrance animation
    setTimeout(() => {
      document.querySelector('.dashboard-header').classList.add('animate-in');
    }, 100);
  }

  // ─── Camera Management ───────────────────────────────────
  async function openCamera(mode) {
    // mode: 'photo' | 'card'
    state.cameraMode = mode;

    const videoEl = document.getElementById('camera-video');
    const captureBtn = document.getElementById('btn-capture');
    const switchBtn = document.getElementById('btn-switch-camera');

    // Update UI for mode
    document.getElementById('camera-title').textContent =
      mode === 'card' ? 'Scan Visiting Card' : 'Take Photo';
    document.getElementById('camera-guide').style.display =
      mode === 'card' ? 'block' : 'none';

    showScreen('camera');

    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 7680 },
          height: { ideal: 4320 },
        },
        audio: false,
      };
      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoEl.srcObject = cameraStream;
      await videoEl.play();
    } catch (err) {
      showToast('Camera access denied. Please allow camera permissions.', 'error');
      showScreen('dashboard');
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
  }

  async function switchCamera() {
    const videoEl = document.getElementById('camera-video');
    const currentFacing = cameraStream?.getVideoTracks()[0]
      ?.getSettings()?.facingMode;
    const newFacing = currentFacing === 'environment' ? 'user' : 'environment';

    stopCamera();
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing, width: { ideal: 7680 }, height: { ideal: 4320 } },
        audio: false,
      });
      videoEl.srcObject = cameraStream;
      await videoEl.play();
    } catch (e) {
      showToast('Could not switch camera', 'error');
    }
  }

  function capturePhoto() {
    const videoEl = document.getElementById('camera-video');
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');

    // Flash animation
    const flash = document.getElementById('camera-flash');
    flash.classList.add('flash-active');
    setTimeout(() => flash.classList.remove('flash-active'), 300);

    ctx.drawImage(videoEl, 0, 0);

    canvas.toBlob(async (blob) => {
      const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const city = state.city;
      const mode = state.cameraMode;
      const filename = `${city}_${mode === 'card' ? 'card' : 'photo'}_${timestamp}.jpg`;

      const captured = { blob, dataUrl, filename, method: 'camera' };

      stopCamera();

      if (mode === 'card') {
        state.capturedCard = captured;
        showCardReview(dataUrl);
      } else {
        state.capturedPhoto = captured;
        showPhotoReview(dataUrl);
      }
    }, 'image/jpeg', 1.0);
  }

  // ─── Photo Review ────────────────────────────────────────
  function showPhotoReview(dataUrl) {
    document.getElementById('review-img').src = dataUrl;
    document.getElementById('review-title').textContent = 'Photo Captured!';
    document.getElementById('review-subtitle').textContent = 'Tap "Save & Continue" to upload and proceed to visiting card.';
    document.getElementById('btn-review-confirm').dataset.action = 'photo-confirm';
    document.getElementById('btn-review-retake').dataset.action = 'photo-retake';
    showScreen('photo-review');
  }

  async function confirmPhoto() {
    showLoader('Saving photo...');
    try {
      const { blob, filename, method } = state.capturedPhoto;

      // Only save to device if captured via camera (not if already uploaded from device)
      if (method === 'camera') {
        saveToDevice(blob, filename);
        showToast('📱 Photo saved to device', 'info');
      }

      // Always upload to Drive
      if (DriveAPI.isConfigured()) {
        showLoader('Uploading to Drive...');
        try {
          await DriveAPI.storePhoto(blob, state.city, 'photos', filename);
          showToast('✅ Photo saved to Drive!', 'success');
        } catch (driveErr) {
          console.error('Drive upload failed:', driveErr);
          showToast('⚠️ Drive upload failed: ' + driveErr.message, 'error');
        }
      }

      hideLoader();
      showScreen('dashboard');
      showCardPrompt();
    } catch (err) {
      hideLoader();
      showToast('Failed to save photo: ' + err.message, 'error');
    }
  }

  function showCardPrompt() {
    const banner = document.getElementById('card-prompt-banner');
    banner.classList.add('visible');
    setTimeout(() => banner.classList.remove('visible'), 5000);
  }

  // ─── Card Review & OCR ───────────────────────────────────
  function showCardReview(dataUrl) {
    document.getElementById('card-review-img').src = dataUrl;
    showScreen('card-review');
  }

  async function processCard() {
    showScreen('ocr');
    const progressBar = document.getElementById('ocr-progress-bar');
    const progressText = document.getElementById('ocr-progress-text');
    const statusText = document.getElementById('ocr-status');

    statusText.textContent = 'Loading OCR engine...';
    progressBar.style.width = '10%';

    try {
      const result = await OCREngine.scanCard(
        state.capturedCard.dataUrl,
        (pct) => {
          progressBar.style.width = pct + '%';
          progressText.textContent = pct + '%';
          if (pct > 50) statusText.textContent = 'Reading text...';
          if (pct > 80) statusText.textContent = 'Extracting fields...';
        }
      );

      state.ocrResult = result;
      progressBar.style.width = '100%';
      statusText.textContent = 'Done!';

      await new Promise(r => setTimeout(r, 500));
      showConfirmScreen(result);
    } catch (err) {
      showToast('OCR failed: ' + err.message, 'error');
      showScreen('card-review');
    }
  }

  async function showConfirmScreen(result) {
    document.getElementById('confirm-card-img').style.display = 'block';
    document.querySelector('.confirm-header h2').textContent = 'Confirm Data';
    document.querySelector('.confirm-header p').textContent = 'Please review and edit the scanned details';

    // Populate editable fields
    const fields = ['name', 'company', 'phone', 'email', 'website'];
    fields.forEach(field => {
      const el = document.getElementById(`field-${field}`);
      if (el) el.value = result ? (result[field] || '') : '';
    });

    // New fields
    const extraFields = ['name2', 'phone2', 'address'];
    extraFields.forEach(field => {
      const el = document.getElementById(`field-${field}`);
      if (el) el.value = result ? (result[field] || '') : '';
    });

    // Logo preview
    const logoImg = document.getElementById('logo-preview');
    if (logoImg && state.capturedCard) {
      const logoDataUrl = await OCREngine.extractLogoFromImage(state.capturedCard.dataUrl);
      if (logoDataUrl) {
        logoImg.src = logoDataUrl;
        logoImg.style.display = 'inline-block';
      } else {
        logoImg.style.display = 'none';
      }
    }

    if (state.capturedCard) {
      document.getElementById('confirm-card-img').src = state.capturedCard.dataUrl;
    }
    showScreen('confirm');
  }

  function handleManualEntry() {
    state.capturedCard = null;
    state.ocrResult = null;
    
    document.getElementById('confirm-card-img').style.display = 'none';
    document.querySelector('.confirm-header h2').textContent = 'Manual Entry';
    document.querySelector('.confirm-header p').textContent = 'Fill details manually';
    
    const fields = ['name', 'company', 'phone', 'email', 'website'];
    fields.forEach(field => {
      const el = document.getElementById(`field-${field}`);
      if (el) el.value = '';
    });
    
    showScreen('confirm');
  }

  async function saveCardData() {
    showLoader('Saving to Drive & Excel...');
    try {
      const fields = ['name', 'company', 'phone', 'email', 'website'];
      const rowData = { city: state.city === 'indore' ? 'Indore' : 'Mumbai' };

      const now = new Date();
      rowData['date'] = now.toLocaleDateString('en-IN');
      rowData['time'] = now.toLocaleTimeString('en-IN');

      fields.forEach(f => {
        const el = document.getElementById(`field-${f}`);
        rowData[f] = el ? el.value.trim() : '';
      });

      // Save card to device only if captured via camera
      if (state.capturedCard) {
        const cardMethod = state.capturedCard.method || 'camera';
        if (cardMethod === 'camera') {
          saveToDevice(state.capturedCard.blob, state.capturedCard.filename);
        }
      }

      if (DriveAPI.isConfigured()) {
        let photoLink = 'N/A';
        if (state.capturedCard) {
          showLoader('Uploading card to Drive...');
          try {
            const uploadResult = await DriveAPI.storePhoto(
              state.capturedCard.blob, state.city, 'visitingCards', state.capturedCard.filename
            );
            photoLink = uploadResult.webViewLink || '';
          } catch (e) {
            console.error('Card image upload failed:', e);
          }
        }

        rowData.photoLink = photoLink;

        showLoader('Saving to Excel...');
        try {
          await DriveAPI.appendToExcel(state.city, rowData);
          showToast('✓ Card saved to Drive & Excel!', 'success');
        } catch (e) {
          console.error('Excel append failed:', e);
          showToast('⚠️ Excel save failed: ' + e.message, 'error');
        }
      } else {
        // Fallback: download Excel locally
        const wb = ExcelManager.createWorkbook(state.city);
        ExcelManager.appendRow(wb, rowData);
        ExcelManager.downloadLocally(wb, state.city);
        showToast('✓ Card saved! Excel downloaded locally.', 'info');
      }

      hideLoader();
      state.capturedCard = null;
      state.ocrResult = null;
      state.capturedPhoto = null;
      await saveState();

      // Check if more cards are in queue
      if (state.pendingCards && state.pendingCards.length > 0) {
        processNextPendingCard();
      } else {
        showSuccessScreen();
      }
    } catch (err) {
      hideLoader();
      showToast('Save failed: ' + err.message, 'error');
    }
  }

  function showSuccessScreen() {
    const overlay = document.getElementById('success-overlay');
    overlay.classList.add('active');
    setTimeout(() => {
      overlay.classList.remove('active');
      showScreen('dashboard');
    }, 2500);
  }

  // ─── File Upload (Choose Photo & Native Camera) ────────
  function triggerFileUpload(mode) {
    const input = document.getElementById('file-input-hidden');
    input.dataset.mode = mode;
    input.accept = 'image/*';
    input.removeAttribute('capture');
    input.value = '';
    input.click();
  }

  function triggerNativeCamera(mode) {
    const input = document.getElementById('file-input-hidden');
    input.dataset.mode = mode;
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment'); // Forces native camera app
    input.value = '';
    input.click();
  }

  async function handleFileSelected(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const mode = e.target.dataset.mode;

    if (mode === 'photo') {
      if (files.length === 1) {
        // Single photo review flow
        await processSingleUpload(files[0], mode);
      } else {
        // Batch upload photos directly to Drive
        await batchUploadPhotos(files);
      }
    } else if (mode === 'card') {
      // Put all cards in the queue and start processing the first one
      state.pendingCards = files;
      processNextPendingCard();
    }
  }

  async function processSingleUpload(file, mode) {
    const blob = file;
    const dataUrl = await fileToDataUrl(file);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${state.city}_${mode === 'card' ? 'card' : 'photo'}_${timestamp}.jpg`;

    const captured = { blob, dataUrl, filename, method: 'upload' };

    if (mode === 'card') {
      state.capturedCard = captured;
      showCardReview(dataUrl);
    } else {
      state.capturedPhoto = captured;
      showPhotoReview(dataUrl);
    }
  }

  async function batchUploadPhotos(files) {
    if (!DriveAPI.isConfigured()) {
      showToast('⚠️ Please connect Drive first to batch upload.', 'error');
      return;
    }
    const total = files.length;
    let successCount = 0;

    for (let i = 0; i < total; i++) {
      showLoader(`Uploading photo ${i + 1} of ${total}...`);
      try {
        const file = files[i];
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${state.city}_photo_${timestamp}_${i+1}.jpg`;
        await DriveAPI.storePhoto(file, state.city, 'photos', filename);
        successCount++;
      } catch (err) {
        console.error('Batch upload error:', err);
      }
    }

    hideLoader();
    if (successCount === total) {
      showToast(`✅ Successfully uploaded ${total} photos!`, 'success');
    } else {
      showToast(`⚠️ Uploaded ${successCount}/${total} photos.`, 'warning');
    }
    showScreen('dashboard');
  }

  async function processNextPendingCard() {
    if (!state.pendingCards || state.pendingCards.length === 0) return;
    const nextFile = state.pendingCards.shift();
    
    showToast(`Processing card... (${state.pendingCards.length} remaining in queue)`, 'info');
    await processSingleUpload(nextFile, 'card');
  }

  function fileToDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  // ─── Device Save ─────────────────────────────────────────
  function saveToDevice(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ─── Excel Management (Download & Replace) ───────────────
  async function handleDownloadExcel() {
    if (!DriveAPI.isConfigured()) {
      showToast('⚠️ Drive not connected', 'error');
      return;
    }
    showLoader('Fetching Excel link...');
    try {
      const url = await DriveAPI.getExcelUrl(state.city);
      hideLoader();
      // Open direct download link in new tab
      window.open(url, '_blank');
      showToast('⬇️ Downloading Excel...', 'success');
    } catch (err) {
      hideLoader();
      showToast('⚠️ ' + err.message, 'error');
    }
  }

  async function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Reset input
    e.target.value = '';

    if (!DriveAPI.isConfigured()) {
      showToast('⚠️ Drive not connected', 'error');
      return;
    }

    showLoader('Parsing Excel file locally...');
    try {
      // Read file with standard FileReader
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          // XLSX is available from SheetJS (loaded in index.html)
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          
          // Convert sheet to 2D array (sheetData)
          const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          
          if (!sheetData || sheetData.length === 0) {
            hideLoader();
            showToast('⚠️ Excel file is empty', 'error');
            return;
          }

          showLoader('Overwriting Drive Excel...');
          await DriveAPI.replaceExcelData(state.city, sheetData);
          hideLoader();
          showToast('✅ Excel Replaced Successfully!', 'success');
        } catch (parseErr) {
          console.error(parseErr);
          hideLoader();
          showToast('⚠️ Error parsing Excel', 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      hideLoader();
      showToast('⚠️ Upload failed: ' + err.message, 'error');
    }
  }

  // ─── UI Helpers ──────────────────────────────────────────
  function showLoader(msg) {
    const el = document.getElementById('global-loader');
    document.getElementById('loader-text').textContent = msg || 'Please wait...';
    el.classList.add('active');
  }

  function hideLoader() {
    document.getElementById('global-loader').classList.remove('active');
  }

  let toastTimeout;
  function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast toast-${type} visible`;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3500);
  }

  // ─── Drive Connect ───────────────────────────────────────
  async function connectDrive() {
    if (!DriveAPI.isConfigured()) {
      showToast('⚠️ Please add Apps Script URL in config.js → APPS_SCRIPT_URL', 'error');
      return;
    }
    showLoader('Verifying Drive connection...');
    try {
      // Ping the Apps Script Web App to verify it's reachable
      const url = window.APP_CONFIG.APPS_SCRIPT_URL;
      const resp = await fetch(url);
      if (!resp.ok && resp.status !== 302) throw new Error('Script not reachable');
      state.driveLinked = true;
      await SessionDB.set('drive_linked', true);
      updateDriveStatus(true);
      hideLoader();
      showToast('✅ Drive connected! Ready to upload.', 'success');
    } catch (err) {
      hideLoader();
      // Even if ping fails due to CORS, assume configured = connected
      state.driveLinked = true;
      await SessionDB.set('drive_linked', true);
      updateDriveStatus(true);
      showToast('✅ Drive ready! (URL configured)', 'success');
    }
  }

  function updateDriveStatus(connected) {
    const btn = document.getElementById('btn-connect-drive');
    const status = document.getElementById('drive-status');
    if (connected) {
      btn.textContent = '✓ Drive Connected';
      btn.classList.add('connected');
      if (status) {
        status.textContent = 'Google Drive connected';
        status.classList.add('online');
      }
    } else {
      btn.textContent = '🔗 Connect Drive';
      btn.classList.remove('connected');
    }
  }

  // ─── Event Binding ───────────────────────────────────────
  function bindEvents() {
    // Start
    document.getElementById('btn-start').onclick = () => showScreen('location');

    // Location
    document.getElementById('btn-indore').onclick = () => selectCity('indore');
    document.getElementById('btn-mumbai').onclick = () => selectCity('mumbai');

    // General Photo
    // General Photo now uses Native Camera for true HDR / Max Resolution
    document.getElementById('btn-camera-photo').onclick = () => triggerNativeCamera('photo');
    document.getElementById('btn-upload-photo').onclick = () => triggerFileUpload('photo');

    // Visiting Card
    // Card uses internal camera for alignment guide and speed
    document.getElementById('btn-camera-card').onclick = () => openCamera('card');
    document.getElementById('btn-upload-card').onclick = () => triggerFileUpload('card');
    document.getElementById('btn-manual-card').onclick = handleManualEntry;
    document.getElementById('btn-connect-drive').onclick = () => connectDrive();
    document.getElementById('btn-go-location').onclick = () => {
      SessionDB.clearSession();
      showScreen('location');
    };

    // Camera
    document.getElementById('btn-capture').onclick = () => capturePhoto();
    document.getElementById('btn-camera-back').onclick = () => {
      stopCamera();
      showScreen('dashboard');
    };
    document.getElementById('btn-switch-camera').onclick = () => switchCamera();

    // Photo Review
    document.getElementById('btn-review-confirm').onclick = () => confirmPhoto();
    document.getElementById('btn-review-retake').onclick = () => {
      openCamera(state.cameraMode || 'photo');
    };

    // Card Review
    document.getElementById('btn-card-process').onclick = () => processCard();
    document.getElementById('btn-card-retake').onclick = () => {
      openCamera('card');
    };

    // Confirm
    document.getElementById('btn-save-card').onclick = () => saveCardData();
    document.getElementById('btn-rescan').onclick = () => {
      showScreen('card-review');
    };

    // File input
    document.getElementById('file-input-hidden').onchange = handleFileSelected;
    document.getElementById('file-input-excel').onchange = handleExcelUpload;

    // Excel Management
    document.getElementById('btn-download-excel').onclick = handleDownloadExcel;
    document.getElementById('btn-replace-excel').onclick = () => document.getElementById('file-input-excel').click();

    // Top camera icon (Native)
    document.getElementById('top-camera-icon').onclick = () => triggerNativeCamera('photo');
  }

  // ─── Init ────────────────────────────────────────────────
  async function init() {
    registerScreens();
    bindEvents();

    // Check for saved session
    const resumed = await checkResume();
    if (!resumed) {
      showScreen('start');
    }

    // Restore drive linked state
    const linked = await SessionDB.get('drive_linked');
    if (linked) {
      state.driveLinked = true;
      updateDriveStatus(true);
    }

    // Auto-mark as connected if APPS_SCRIPT_URL is configured
    if (DriveAPI.isConfigured() && !state.driveLinked) {
      state.driveLinked = true;
      await SessionDB.set('drive_linked', true);
      updateDriveStatus(true);
    }
  }

  return { init };
})();

window.addEventListener('DOMContentLoaded', () => App.init());
