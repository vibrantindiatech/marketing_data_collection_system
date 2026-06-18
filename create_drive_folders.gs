/**
 * ╔════════════════════════════════════════════════════════╗
 *  CardCapture — Google Apps Script Folder Creator
 *  Run this ONCE to create all required folders in Drive
 * ╚════════════════════════════════════════════════════════╝
 *
 * HOW TO USE:
 * 1. Go to https://script.google.com/
 * 2. Click "New Project"
 * 3. Delete all existing code
 * 4. Paste THIS entire file
 * 5. Click ▶ Run (or press Ctrl+R)
 * 6. Authorize when asked
 * 7. Check the logs (View → Logs) for confirmation
 */

function createCardCaptureFolders() {
  // ─── Your Drive Folder ID ─────────────────────────────
  var PARENT_FOLDER_ID = '1Kk4ig7PX_GNtM2xnXNBbqMaGUTQ4pBaE';
  
  // ─── Folders to Create ────────────────────────────────
  var foldersToCreate = [
    'Indore',
    'Mumbai',
    'Indore Visiting Cards',
    'Mumbai Visiting Cards'
  ];
  
  // ─── Get Parent Folder ────────────────────────────────
  var parentFolder;
  try {
    parentFolder = DriveApp.getFolderById(PARENT_FOLDER_ID);
    Logger.log('✅ Parent folder found: ' + parentFolder.getName());
  } catch(e) {
    Logger.log('❌ ERROR: Could not find parent folder!');
    Logger.log('Check your folder ID: ' + PARENT_FOLDER_ID);
    Logger.log('Make sure the folder is in YOUR Google Drive (not just shared)');
    return;
  }
  
  // ─── Create Each Folder ───────────────────────────────
  Logger.log('\n🗂️ Creating folders...\n');
  
  var createdFolders = {};
  
  foldersToCreate.forEach(function(folderName) {
    // Check if folder already exists
    var existing = parentFolder.getFoldersByName(folderName);
    
    if (existing.hasNext()) {
      var folder = existing.next();
      Logger.log('📁 Already exists: ' + folderName + ' (ID: ' + folder.getId() + ')');
      createdFolders[folderName] = folder.getId();
    } else {
      var newFolder = parentFolder.createFolder(folderName);
      Logger.log('✅ Created: ' + folderName + ' (ID: ' + newFolder.getId() + ')');
      createdFolders[folderName] = newFolder.getId();
    }
  });
  
  // ─── Summary ──────────────────────────────────────────
  Logger.log('\n════════════════════════════════════');
  Logger.log('✅ ALL FOLDERS READY!');
  Logger.log('════════════════════════════════════\n');
  Logger.log('Your Drive folder structure:');
  Logger.log('📁 Indore/                   → ' + createdFolders['Indore']);
  Logger.log('📁 Mumbai/                   → ' + createdFolders['Mumbai']);
  Logger.log('📁 Indore Visiting Cards/    → ' + createdFolders['Indore Visiting Cards']);
  Logger.log('📁 Mumbai Visiting Cards/    → ' + createdFolders['Mumbai Visiting Cards']);
  Logger.log('\nApp is ready to use once you add your Google Client ID!');
  
  // ─── Also create a confirmation doc in the folder ─────
  try {
    var doc = parentFolder.createFile(
      'CardCapture_Setup_Complete.txt',
      'CardCapture folders created successfully on ' + new Date().toLocaleString() + '\n\n' +
      'Folders created:\n' +
      '- Indore (general photos)\n' +
      '- Mumbai (general photos)\n' +
      '- Indore Visiting Cards\n' +
      '- Mumbai Visiting Cards\n\n' +
      'Parent Folder ID: ' + PARENT_FOLDER_ID
    );
    Logger.log('\n📄 Confirmation file created in your Drive folder!');
  } catch(e) {
    // Not critical
  }
  
  // Show a popup with success
  SpreadsheetApp.getUi && SpreadsheetApp.getUi().alert('✅ All 4 folders created successfully! Check View → Logs for details.');
}
