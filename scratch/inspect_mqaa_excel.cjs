const XLSX = require('xlsx');
const path = require('path');

const workbook = XLSX.readFile(path.join(__dirname, '..', 'OrthoLite MQAA Checklist New1.xlsx'));
console.log("Sheet names:", workbook.SheetNames);

const firstSheetName = workbook.SheetNames[0];
console.log("\nInspecting first sheet:", firstSheetName);
const sheet = workbook.Sheets[firstSheetName];
const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log(`Total rows: ${rawData.length}`);
for (let i = 0; i < Math.min(30, rawData.length); i++) {
  console.log(`Row ${i + 1}:`, JSON.stringify(rawData[i]));
}
