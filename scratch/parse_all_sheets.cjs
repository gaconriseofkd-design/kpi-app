const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const workbook = XLSX.readFile(path.join(__dirname, '..', 'OrthoLite MQAA Checklist New1.xlsx'));

const allData = {};

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const ref = sheet['!ref'];
  const range = XLSX.utils.decode_range(ref || 'A1:A1');

  const rows = [];
  let headerRow = null;
  let footerRow = null;

  for (let R = range.s.r; R <= range.e.r; ++R) {
    const getVal = (col) => {
      const cell = sheet[XLSX.utils.encode_cell({c: col, r: R})];
      return cell ? cell.v : '';
    };

    const b = (getVal(1) || '').toString().trim(); // Column B
    const g = getVal(6); // Column G (Max Score)
    const h = getVal(7); // Column H (Audit Score)
    const i = (getVal(8) || '').toString().trim(); // Column I (Critical)
    const k = (getVal(10) || '').toString().trim(); // Column K (Description)

    // Check if header row (Row 2 usually)
    if (b.includes('Mục tiêu') || b.includes('Objective') || (g && g.toString().includes('Điểm tối đa'))) {
      headerRow = {
        title: b,
        rowNumber: R + 1
      };
      continue;
    }

    // Check if summary / footer row (contains XẾP HẠNG TUÂN THỦ or OVERALL COMPLIANCE)
    const d = (getVal(3) || '').toString().trim();
    if (b.includes('XẾP HẠNG') || d.includes('XẾP HẠNG') || b.includes('OVERALL COMPLIANCE') || d.includes('OVERALL COMPLIANCE') || b.includes('TUÂN THỦ')) {
      footerRow = {
        sectionName: b,
        label: d,
        maxScore: g,
        auditScore: h,
        rowNumber: R + 1
      };
      continue;
    }

    // If it has B or G, let's treat as criterion
    if (b && (g !== '' || i !== '' || b.match(/^\*?\d+\.\d+/))) {
      // Split VN and EN if separated by newline
      const lines = b.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const isCritical = i.toLowerCase() === 'yes';

      // Extract item number if present (e.g. *1.1.1. -> no = "1.1.1")
      const noMatch = b.match(/^\*?(\d+(\.\d+)+)/);
      const no = noMatch ? noMatch[1] : '';

      rows.push({
        rawText: b,
        lines: lines,
        no: no,
        maxScore: g === 'N/A' || g === 'n/a' ? 'N/A' : (typeof g === 'number' ? g : (parseInt(g) || g)),
        isCritical: isCritical,
        defaultAuditScore: (g === 'N/A' || g === 'n/a') ? 'N/A' : '',
        rowNumber: R + 1
      });
    }
  }

  allData[sheetName] = {
    header: headerRow,
    footer: footerRow,
    criteria: rows
  };
});

console.log("Summary of all sheets extracted:");
Object.keys(allData).forEach(name => {
  const d = allData[name];
  console.log(`- [${name}]: ${d.criteria.length} criteria items, Header: ${d.header ? 'Yes' : 'No'}, Footer: ${d.footer ? 'Yes' : 'No'}`);
});

fs.writeFileSync(path.join(__dirname, 'extracted_mqaa_new.json'), JSON.stringify(allData, null, 2), 'utf8');
console.log("Saved to scratch/extracted_mqaa_new.json");
