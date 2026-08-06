// src/lib/fileExport.js
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function saveExcelJS(buffer, filename) {
  if (window.pywebview) {
    const b64 = arrayBufferToBase64(buffer);
    window.pywebview.api.save_file(b64, filename).then(actualName => {
      if (actualName) {
        alert(`✅ Đã lưu vào Downloads: 📄 ${actualName}`);
      } else {
        alert(`❌ Lỗi lưu file: ${filename}`);
      }
    });
  } else {
    saveAs(new Blob([buffer]), filename);
  }
}

export function saveExcelXLSX(wb, filename) {
  if (window.pywebview) {
    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    window.pywebview.api.save_file(b64, filename).then(actualName => {
      if (actualName) {
        alert(`✅ Đã lưu vào Downloads: 📄 ${actualName}`);
      } else {
        alert(`❌ Lỗi lưu file: ${filename}`);
      }
    });
  } else {
    XLSX.writeFile(wb, filename);
  }
}

export function saveCSV(csvString, filename) {
  if (window.pywebview) {
    const b64 = btoa(unescape(encodeURIComponent(csvString)));
    window.pywebview.api.save_file(b64, filename).then(actualName => {
      if (actualName) {
        alert(`✅ Đã lưu vào Downloads: 📄 ${actualName}`);
      } else {
        alert(`❌ Lỗi lưu file: ${filename}`);
      }
    });
  } else {
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
