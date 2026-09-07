const XLSX = require('xlsx');
const path = require('path');

const workbook = XLSX.readFile(path.join(__dirname, '..', 'OrthoLite MQAA Checklist New1.xlsx'));
const sheet = workbook.Sheets['Raw Material & FGs Warehouse'];

console.log("Sheet range:", sheet['!ref']);
console.log("Sheet merges:", sheet['!merges']);

// Let's print each cell in rows 2 to 20
const range = XLSX.utils.decode_range(sheet['!ref']);
for (let R = range.s.r; R <= range.e.r; ++R) {
  let rowStr = `Row ${R + 1}: `;
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell_address = XLSX.utils.encode_cell({c: C, r: R});
    const cell = sheet[cell_address];
    if (cell && cell.v !== undefined && cell.v !== '') {
      rowStr += `[${cell_address}=${JSON.stringify(cell.v)}] `;
    }
  }
  console.log(rowStr);
}
