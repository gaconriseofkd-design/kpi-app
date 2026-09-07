const XLSX = require('xlsx');
const path = require('path');

const workbook = XLSX.readFile(path.join(__dirname, '..', 'OrthoLite MQAA Checklist New1.xlsx'), { cellFormula: true });
const sheet = workbook.Sheets['Raw Material & FGs Warehouse'];

console.log("F20 formula:", sheet['F20'] ? sheet['F20'].f : null, sheet['F20'] ? sheet['F20'].v : null);
console.log("G20 formula:", sheet['G20'] ? sheet['G20'].f : null, sheet['G20'] ? sheet['G20'].v : null);
console.log("H20 formula:", sheet['H20'] ? sheet['H20'].f : null, sheet['H20'] ? sheet['H20'].v : null);

for (let r = 4; r <= 19; r++) {
  console.log(`Row ${r}: B=${sheet['B'+r]?.v?.substring(0, 30)}... | G=${sheet['G'+r]?.v} (${typeof sheet['G'+r]?.v}) | H=${sheet['H'+r]?.v} | I=${sheet['I'+r]?.v}`);
}
