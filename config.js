/**
 * ============================================================
 *  CONFIGURATION FILE — Edit these values before using the app
 * ============================================================
 *
 *  HOW TO GET YOUR CREDENTIALS:
 *  1. Go to https://console.cloud.google.com/
 *  2. Create a new project (or select existing)
 *  3. Enable "Google Drive API" and "Google Sheets API"
 *  4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
 *  5. Select "Web Application"
 *  6. Add your app's URL to "Authorized JavaScript origins"
 *     (for local use: http://localhost, file://)
 *  7. Copy the Client ID below
 *
 *  HOW TO GET YOUR DRIVE FOLDER ID:
 *  1. Open your Google Drive shared folder in browser
 *  2. The URL looks like: https://drive.google.com/drive/folders/XXXXXXXXXX
 *  3. Copy the XXXXXXXXXX part — that is your Folder ID
 */

const CONFIG = {
  // ─── Apps Script Web App URL ───────────────────────────────
  // Paste your deployed Web App URL here (from upload_handler.gs)
  // How to get it: Deploy → New Deployment → Web App → Copy URL
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw9IaKUZK9zSUSCxssSNsKjvJFR-H_8TXJraUDBv0iqwpDXumTC9zKguwlp5IK5fniR/exec',

  // (No Google Client ID needed anymore!)
  GOOGLE_CLIENT_ID: '',

  // ─── Parent Drive Folder ID ───────────────────────────────
  // The Google Drive folder where all subfolders will be created
  // Leave empty '' to use My Drive root
  PARENT_FOLDER_ID: '1Kk4ig7PX_GNtM2xnXNBbqMaGUTQ4pBaE',

  // ─── City Folder Names ────────────────────────────────────
  FOLDERS: {
    INDORE_PHOTOS:          'Indore',
    MUMBAI_PHOTOS:          'Mumbai',
    INDORE_VISITING_CARDS:  'Indore Visiting Cards',
    MUMBAI_VISITING_CARDS:  'Mumbai Visiting Cards',
  },

  // ─── Direct Folder IDs (from Drive setup script) ─────────
  // These are already created — app uses them directly (faster!)
  FOLDER_IDS: {
    INDORE_PHOTOS:          '1xVPVYVoIuQWHZ-C07NVpL8XSSVkxXOy-',
    MUMBAI_PHOTOS:          '1LOHbwZhcDaoYz1gGGJaBQKShtgik2GyT',
    INDORE_VISITING_CARDS:  '1zLVi3FF7HIQ_tk7EMxdm51cSvLOhNy5O',
    MUMBAI_VISITING_CARDS:  '1tSHMeCPontKORJrXzNWbVCuUvA2BPe2Q',
  },

  // ─── Excel File Names ─────────────────────────────────────
  EXCEL_FILES: {
    INDORE: 'Indore_Data.xlsx',
    MUMBAI: 'Mumbai_Data.xlsx',
  },

  // ─── Excel Column Headers for Visiting Card Data ──────────
  EXCEL_HEADERS: [
    'Date', 'Time', 'Name', 'Company', 'Phone', 'Email', 'Website'
  ],
};

// DO NOT EDIT BELOW THIS LINE
window.APP_CONFIG = CONFIG;
