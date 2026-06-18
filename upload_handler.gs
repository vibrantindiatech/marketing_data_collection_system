/**
 * CardCapture — Apps Script Web App (Upload Handler)
 * Uses dynamic folder lookup — no hardcoded IDs needed!
 *
 * REDEPLOY STEPS (after pasting this):
 * 1. Deploy → Manage deployments → Edit (pencil icon) → New version → Deploy
 */

// ─── Config ──────────────────────────────────────────────────────
var PARENT_FOLDER_ID = '1Kk4ig7PX_GNtM2xnXNBbqMaGUTQ4pBaE';

var FOLDER_NAMES = {
  INDORE_PHOTOS:         'Indore',
  MUMBAI_PHOTOS:         'Mumbai',
  INDORE_VISITING_CARDS: 'Indore Visiting Cards',
  MUMBAI_VISITING_CARDS: 'Mumbai Visiting Cards',
};

// ─── Folder lookup (dynamic, no hardcoded IDs) ───────────────────
function getCityFolder(city, type) {
  var parentFolder;
  try {
    parentFolder = DriveApp.getFolderById(PARENT_FOLDER_ID);
  } catch (e) {
    throw new Error("Cannot access PARENT_FOLDER_ID: " + PARENT_FOLDER_ID + " - " + e.message);
  }

  var folderName;
  if (city === 'indore') {
    folderName = type === 'visitingCards'
      ? FOLDER_NAMES.INDORE_VISITING_CARDS
      : FOLDER_NAMES.INDORE_PHOTOS;
  } else {
    folderName = type === 'visitingCards'
      ? FOLDER_NAMES.MUMBAI_VISITING_CARDS
      : FOLDER_NAMES.MUMBAI_PHOTOS;
  }

  // Find existing sub-folder
  var iter = parentFolder.getFoldersByName(folderName);
  if (iter.hasNext()) return iter.next();

  // Create if missing
  return parentFolder.createFolder(folderName);
}

// ─── CORS JSON response ──────────────────────────────────────────
function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── GET — health check ──────────────────────────────────────────
function doGet(e) {
  return corsResponse({ status: 'ok', message: 'CardCapture API is running!' });
}

// ─── POST — main handler ─────────────────────────────────────────
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    if (payload.action === 'uploadPhoto') {
      return handlePhotoUpload(payload);
    } else if (payload.action === 'appendExcel') {
      return handleExcelAppend(payload);
    } else if (payload.action === 'getExcelUrl') {
      return handleGetExcelUrl(payload);
    } else if (payload.action === 'replaceExcel') {
      return handleReplaceExcel(payload);
    } else {
      return corsResponse({ status: 'error', message: 'Unknown action: ' + payload.action });
    }
  } catch (err) {
    return corsResponse({ status: 'error', message: err.toString() });
  }
}

// ─── Photo Upload ────────────────────────────────────────────────
function handlePhotoUpload(payload) {
  var city     = (payload.city || 'indore').toLowerCase();
  var type     = payload.type     || 'photos';
  var filename = payload.filename || ('photo_' + Date.now() + '.jpg');
  var mime     = payload.mimeType || 'image/jpeg';
  var b64      = payload.base64Data || '';

  // Strip data URL prefix
  if (b64.indexOf(',') !== -1) b64 = b64.split(',')[1];
  if (!b64) return corsResponse({ status: 'error', message: 'No image data received' });

  var folder = getCityFolder(city, type);
  var blob   = Utilities.newBlob(Utilities.base64Decode(b64), mime, filename);
  var file   = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  Logger.log('✅ Uploaded: ' + filename + ' → ' + folder.getName());

  return corsResponse({
    status:      'ok',
    fileId:      file.getId(),
    fileName:    file.getName(),
    webViewLink: 'https://drive.google.com/file/d/' + file.getId() + '/view',
    folderName:  folder.getName(),
  });
}

// ─── Excel Append ────────────────────────────────────────────────
function handleExcelAppend(payload) {
  var city    = (payload.city || 'indore').toLowerCase();
  var rowData = payload.rowData || {};

  var fileName  = city === 'indore' ? 'Indore_Data' : 'Mumbai_Data';
  var sheetName = city === 'indore' ? 'Indore Visiting Cards' : 'Mumbai Visiting Cards';
  var folder    = getCityFolder(city, 'visitingCards');

  // Find or create spreadsheet
  var files = folder.getFilesByName(fileName);
  var ss;

  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(fileName);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
    var sheet = ss.getActiveSheet();
    sheet.setName(sheetName);
    sheet.appendRow([
      'Date', 'Time', 'Name', 'Company', 'Phone',
      'Email', 'Website', 'Photo Link'
    ]);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var sheet = ss.getSheetByName(sheetName) || ss.getActiveSheet();
  var now   = new Date();
  var tz    = Session.getScriptTimeZone();

  sheet.appendRow([
    Utilities.formatDate(now, tz, 'dd/MM/yyyy'),
    Utilities.formatDate(now, tz, 'HH:mm:ss'),
    rowData.name        || '',
    rowData.company     || '',
    rowData.phone       || '',
    rowData.email       || '',
    rowData.website     || '',
    rowData.photoLink   || '',
  ]);

  Logger.log('✅ Row appended to ' + fileName + ' (' + city + ')');

  return corsResponse({
    status:        'ok',
    spreadsheetId: ss.getId(),
    sheetName:     sheetName,
    rowsTotal:     sheet.getLastRow(),
  });
}

// ─── Get Excel URL ───────────────────────────────────────────────
function handleGetExcelUrl(payload) {
  var city = (payload.city || 'indore').toLowerCase();
  var fileName = city === 'indore' ? 'Indore_Data' : 'Mumbai_Data';
  var folder = getCityFolder(city, 'visitingCards');
  
  var files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    var ss = SpreadsheetApp.open(files.next());
    return corsResponse({
      status: 'ok',
      url: 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx'
    });
  } else {
    return corsResponse({ status: 'error', message: 'No Excel file exists yet for ' + city });
  }
}

// ─── Replace Excel ───────────────────────────────────────────────
function handleReplaceExcel(payload) {
  var city = (payload.city || 'indore').toLowerCase();
  var sheetData = payload.sheetData; // Expecting a 2D array
  
  if (!sheetData || !sheetData.length) {
    return corsResponse({ status: 'error', message: 'No sheetData provided' });
  }

  var fileName  = city === 'indore' ? 'Indore_Data' : 'Mumbai_Data';
  var sheetName = city === 'indore' ? 'Indore Visiting Cards' : 'Mumbai Visiting Cards';
  var folder    = getCityFolder(city, 'visitingCards');

  // Find or create spreadsheet
  var files = folder.getFilesByName(fileName);
  var ss;
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(fileName);
    DriveApp.getFileById(ss.getId()).moveTo(folder);
  }

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Overwrite everything
  sheet.clear();
  sheet.getRange(1, 1, sheetData.length, sheetData[0].length).setValues(sheetData);
  sheet.getRange(1, 1, 1, sheetData[0].length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  return corsResponse({ status: 'ok', message: 'Replaced successfully' });
}
