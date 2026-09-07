const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'extracted_mqaa_new.json'), 'utf8'));

// Generate clean JS criteria file
let code = `// Auto-generated from OrthoLite MQAA Checklist New1.xlsx\n\n`;

code += `export const MQAA_NEW_SECTIONS = [\n`;
Object.keys(raw).forEach(key => {
  code += `  { id: "${key}", name: "${key}" },\n`;
});
code += `];\n\n`;

code += `export const MQAA_NEW_CRITERIA = {\n`;

Object.keys(raw).forEach(sectionKey => {
  const sec = raw[sectionKey];
  code += `  "${sectionKey}": {\n`;
  code += `    header: ${JSON.stringify(sec.header)},\n`;
  code += `    footer: ${JSON.stringify(sec.footer)},\n`;
  code += `    items: [\n`;

  sec.criteria.forEach((item, idx) => {
    // Separate Vietnamese and English lines if possible
    let vn = item.lines[0] || item.rawText;
    let en = item.lines.slice(1).join(' ') || '';

    // If only 1 line, check if it has /
    if (!en && vn.includes(' / ')) {
      const parts = vn.split(' / ');
      vn = parts[0].trim();
      en = parts.slice(1).join(' / ').trim();
    }

    code += `      {\n`;
    code += `        index: ${idx + 1},\n`;
    code += `        no: ${JSON.stringify(item.no)},\n`;
    code += `        titleVn: ${JSON.stringify(vn)},\n`;
    code += `        titleEn: ${JSON.stringify(en)},\n`;
    code += `        rawText: ${JSON.stringify(item.rawText)},\n`;
    code += `        maxScore: ${JSON.stringify(item.maxScore)},\n`;
    code += `        isCritical: ${item.isCritical},\n`;
    code += `        defaultAuditScore: ${JSON.stringify(item.defaultAuditScore)},\n`;
    code += `      },\n`;
  });

  code += `    ]\n`;
  code += `  },\n`;
});

code += `};\n`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'data', 'mqaaNewChecklistCriteria.js'), code, 'utf8');
console.log("Successfully written to src/data/mqaaNewChecklistCriteria.js");
