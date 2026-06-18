/**
 * drive.js — Google Drive via Apps Script Web App
 * No OAuth Client ID needed — all uploads go through the deployed Web App
 */

const DriveAPI = (() => {

  // ─── Get Web App URL from config ──────────────────────────
  function getScriptUrl() {
    return window.APP_CONFIG.APPS_SCRIPT_URL || '';
  }

  function isConfigured() {
    const url = getScriptUrl();
    return url && url !== 'YOUR_APPS_SCRIPT_URL_HERE';
  }

  // ─── Convert Blob → base64 string ─────────────────────────
  async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result); // includes data:... prefix
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ─── Generic POST to Apps Script ──────────────────────────
  async function appsScriptPost(payload) {
    const url = getScriptUrl();
    if (!url) throw new Error('Apps Script URL not configured in config.js');

    const resp = await fetch(url, {
      method:  'POST',
      // Apps Script web apps require text/plain for CORS (no preflight)
      headers: { 'Content-Type': 'text/plain' },
      body:    JSON.stringify(payload),
    });

    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); }
    catch (e) { throw new Error('Invalid response from Apps Script: ' + text); }

    if (data.status !== 'ok') {
      throw new Error('Apps Script error: ' + (data.message || JSON.stringify(data)));
    }
    return data;
  }

  // ─── Upload a photo (Blob) to Drive ───────────────────────
  // city: 'indore' | 'mumbai'
  // type: 'photos' | 'visitingCards'
  async function storePhoto(blob, city, type, filename) {
    const base64Data = await blobToBase64(blob);
    return await appsScriptPost({
      action:    'uploadPhoto',
      city,
      type,
      filename,
      base64Data,
      mimeType:  blob.type || 'image/jpeg',
    });
  }

  // ─── Append a row to the city Excel/Sheet in Drive ────────
  // rowData: { name, designation, company, phone, email, address, website, notes, photoLink }
  async function appendToExcel(city, rowData) {
    return await appsScriptPost({
      action: 'appendExcel',
      city,
      rowData,
    });
  }

  // ─── Get Direct Excel Download URL ──────────────────────────
  async function getExcelUrl(city) {
    const data = await appsScriptPost({ action: 'getExcelUrl', city });
    return data.url;
  }

  // ─── Replace Entire Excel Sheet ─────────────────────────────
  // sheetData is a 2D array of rows
  async function replaceExcelData(city, sheetData) {
    return await appsScriptPost({
      action: 'replaceExcel',
      city,
      sheetData
    });
  }

  // ─── signIn / ensureAuth stubs (not needed anymore) ────────
  async function signIn() { /* no-op */ }
  async function ensureAuth() { /* no-op */ }

  return { signIn, ensureAuth, storePhoto, appendToExcel, isConfigured, getExcelUrl, replaceExcelData };
})();

window.DriveAPI = DriveAPI;
