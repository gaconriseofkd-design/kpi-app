const XLSX = require('xlsx');
const path = require('path');

const workbook = XLSX.readFile(path.join(__dirname, '..', 'OrthoLite MQAA Checklist New1.xlsx'));

workbook.SheetNames.forEach((sheetName, idx) => {
  const sheet = workbook.Sheets[sheetName];
  const ref = sheet['!ref'];
  const range = XLSX.utils.decode_range(ref || 'A1:A1');
  console.log(`\n=== Sheet ${idx + 1}: ${sheetName} (Range: ${ref}) ===`);
  
  // Find all rows with data
  for (let R = range.s.r; R <= range.e.r; ++R) {
    const bCell = sheet[XLSX.utils.encode_cell({c: 1, r: R})]; // B
    const gCell = sheet[XLSX.utils.encode_cell({c: 6, r: R})]; // G
    const hCell = sheet[XLSX.utils.encode_cell({c: 7, r: R})]; // H
    const iCell = sheet[XLSX.utils.encode_cell({c: 8, r: R})]; // I
    if (bCell || gCell || hCell) {
      console.log(`Row ${R+1}: B="${(bCell?.v || '').toString().slice(0, 35).replace(/\r?\n/g, ' ')}" | G="${gCell?.v ?? ''}" | H="${hCell?.v ?? ''}" | I="${iCell?.v ?? ''}"`);
    }
  }
});
