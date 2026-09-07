const XLSX = require('xlsx');
const path = require('path');

const workbook = XLSX.readFile(path.join(__dirname, '..', 'OrthoLite MQAA Checklist New1.xlsx'));
const sheet = workbook.Sheets['Raw Material & FGs Warehouse'];

const range = XLSX.utils.decode_range(sheet['!ref']);
console.log("=== RAW MATERIAL & FGS WAREHOUSE DETAILS ===");
for (let R = range.s.r; R <= range.e.r; ++R) {
  const getVal = (col) => {
    const cell = sheet[XLSX.utils.encode_cell({c: col, r: R})];
    return cell ? cell.v : '';
  };
  const b = getVal(1);
  const d = getVal(3);
  const f = getVal(5);
  const g = getVal(6);
  const h = getVal(7);
  const i = getVal(8);
  const j = getVal(9);
  const k = getVal(10);

  if (b || g || h || i || k) {
    console.log(`[Row ${R+1}]`);
    console.log(`  B: ${JSON.stringify(b)}`);
    if (d) console.log(`  D: ${JSON.stringify(d)}`);
    if (f) console.log(`  F: ${JSON.stringify(f)}`);
    console.log(`  G (Max Score): ${JSON.stringify(g)}`);
    console.log(`  H (Audit Score): ${JSON.stringify(h)}`);
    console.log(`  I (Critical): ${JSON.stringify(i)}`);
    console.log(`  J (Images): ${JSON.stringify(j)}`);
    console.log(`  K (Description): ${JSON.stringify(k)}`);
  }
}
