/**
 * excel.js — Excel Management using SheetJS
 * Creates and updates city-specific Excel workbooks
 */

const ExcelManager = (() => {
  const SHEET_NAME = 'Visiting Cards';

  function createWorkbook(city) {
    const wb = XLSX.utils.book_new();
    const headers = window.APP_CONFIG.EXCEL_HEADERS;
    const ws = XLSX.utils.aoa_to_sheet([headers]);

    // Style header row
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[addr]) continue;
      ws[addr].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: city === 'indore' ? '6C3483' : '0E6655' } },
        alignment: { horizontal: 'center' },
      };
    }

    // Column widths
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }));

    XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
    return wb;
  }

  function parseWorkbook(arrayBuffer) {
    return XLSX.read(arrayBuffer, { type: 'array' });
  }

  function appendRow(wb, rowData) {
    const ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]];
    const headers = window.APP_CONFIG.EXCEL_HEADERS;

    // Build row in header order
    const row = headers.map(h => {
      const key = h.toLowerCase();
      return rowData[key] || rowData[h] || '';
    });

    XLSX.utils.sheet_add_aoa(ws, [row], { origin: -1 }); // append to end
    return wb;
  }

  function exportWorkbook(wb) {
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }

  function downloadLocally(wb, city) {
    const filename = city === 'indore'
      ? window.APP_CONFIG.EXCEL_FILES.INDORE
      : window.APP_CONFIG.EXCEL_FILES.MUMBAI;
    XLSX.writeFile(wb, filename);
  }

  return { createWorkbook, parseWorkbook, appendRow, exportWorkbook, downloadLocally };
})();

window.ExcelManager = ExcelManager;
