const XLSX = require('xlsx');
const path = require('path');

const workbook = XLSX.readFile(path.join(__dirname, '..', 'OrthoLite MQAA Checklist New1.xlsx'));

['Lean line DC', 'Lean line Molded'].forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  console.log(`\n=== Inspection of: ${sheetName} ===`);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    const getVal = (col) => sheet[XLSX.utils.encode_cell({c: col, r: R})]?.v ?? '';
    const b = getVal(1);
    const g = getVal(6);
    const h = getVal(7);
    const i = getVal(8);
    if (g === 'N/A' || h === 'N/A' || (typeof g === 'string' && g.toLowerCase().includes('n/a'))) {
      console.log(`Row ${R+1}: G="${g}", H="${h}", I="${i}", B="${b.toString().slice(0, 40)}"`);
    }
  }
});
