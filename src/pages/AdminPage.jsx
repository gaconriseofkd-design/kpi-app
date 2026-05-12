// src/pages/AdminPage.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";

// VAI TRÒ HỢP LỆ (LOWERCASE)
const ALLOWED_ROLES = ["worker", "approver", "admin"];
// MẬT KHẨU XOÁ NGUY HIỂM
const DANGER_PASSWORD = "Deplao.1305"; // <-- MẬT KHẨU XOÁ

// HÀNG TRỐNG MẶC ĐỊNH
const emptyRow = { msnv: "", full_name: "", section: "", line: "", role: "worker", approver_msnv: "", approver_name: "" };

// HÀM HELPER CHUNG
function normalizeHeader(h) {
  return h.toLowerCase().trim().replace(/ /g, "_").replace(/[^a-z0-9_]/g, "");
}

// HÀM MAPPING HEADER EXCEL SANG TÊN TRƯỜNG DB
function mapHeaderToField(h) {
  const n = normalizeHeader(h);
  if (["msnv"].includes(n)) return "msnv";
  if (["ho_ten", "ho_&_ten", "ho_va_ten", "full_name", "hoten", "ho_ten_nhan_vien", "ho_va_ten_nhan_vien"].includes(n))
    return "full_name";
  if (["section", "khoi", "bo_phan"].includes(n)) return "section";
  
  if (["line", "may_lam_viec", "vi_tri_lam_viec", "vi_tri", "machine", "vtlamviec"].includes(n)) return "line";

  if (["role", "vai_tro"].includes(n)) return "role";
  if ([
    "approver_msnv", "msnv_nguoi_duyet", "msnv_duyet",
    "nguoi_duyet_msnv", "ma_so_nguoi_duyet", "msnv_approver", "msnv_approve"
  ].includes(n)) return "approver_msnv";
  if ([
    "approver_ho_ten", "approver_ho_&_ten", "ten_nguoi_duyet",
    "ho_ten_nguoi_duyet", "ho_va_ten_nguoi_duyet",
    "nguoi_duyet_ho_ten", "nguoi_duyet_ho_&_ten"
  ].includes(n)) return "approver_name";
  
  return null;
}

function normalizeSection(s) {
  if (!s) return "";
  const upper = s.toUpperCase().trim();
  return upper;
}

async function upsertInChunks(data, chunkSize = 100) {
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const { error } = await supabase.from("users").upsert(chunk, { onConflict: "msnv" });
    if (error) throw error;
  }
}

/* ======================================================================
   USER MANAGER COMPONENT (FORMER ADMINMAIN)
   ====================================================================== */
function UserManager() {
  const MAX_HISTORY = 10; 
  
  const [rows, setRows] = useState([]);
  
  // HISTORY STATES
  const [history, setHistory] = useState([[]]); 
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const [qWorker, setQWorker] = useState("");
  const [qApprover, setQApprover] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "msnv", direction: "ascending" });
  const fileRef = useRef(null);
  
  const pageSize = 15;
  const [page, setPage] = useState(1);
  const bulkDeleteRef = useRef(null);
  // --- STATE CHO CHỨC NĂNG XÓA THEO SECTION ---
  const [sectionToDelete, setSectionToDelete] = useState("");
  
  // === START HISTORY MANAGEMENT LOGIC ===
  const pushRowsToHistory = useCallback((newRows) => {
    setHistory(prevHistory => {
        const historySlice = prevHistory.slice(0, historyIndex + 1);
        if (historySlice.length > 0 && historySlice[historySlice.length - 1] === newRows) {
            return prevHistory;
        }
        let updatedHistory = [...historySlice, newRows];
        if (updatedHistory.length > MAX_HISTORY) {
            updatedHistory = updatedHistory.slice(1);
        }
        setHistoryIndex(updatedHistory.length - 1);
        return updatedHistory;
    });
    setRows(newRows);
    setPage(1);
  }, [historyIndex, MAX_HISTORY]);

  const undo = () => {
    if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setRows(history[newIndex]);
        setPage(1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setRows(history[newIndex]);
        setPage(1);
    }
  };
  // === END HISTORY MANAGEMENT LOGIC ===

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("users").select("*").order("msnv", { ascending: true }); 
      if (error) throw error;
      const initialRows = data || [];
      
      setRows(initialRows);
      setHistory([initialRows]);
      setHistoryIndex(0);
      
    } catch (err) {
      console.error(err);
      alert("Lỗi tải dữ liệu: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [qWorker, qApprover]);
  

  const addNewRow = () => {
    if (rows.length >= 1000) return alert("Giới hạn 1000 dòng hiển thị. Vui lòng lưu bớt hoặc lọc.");
    const newRows = [emptyRow, ...rows];
    pushRowsToHistory(newRows);
  };
  
  const findIndexInRows = (prevRows, originalObject) => {
    if (!originalObject) return -1;
    return originalObject.msnv
      ? prevRows.findIndex(item => item.msnv === originalObject.msnv)
      : prevRows.findIndex(item => item === originalObject);
  }
  
  const removeRow = (i) => {
    const globalIndexInSorted = (page - 1) * pageSize + i;
    const originalObject = sortedRows[globalIndexInSorted];
    
    if (!originalObject) return;
    
    const idxInRows = findIndexInRows(rows, originalObject);
    if (idxInRows === -1) return;
    
    const newRows = [...rows.slice(0, idxInRows), ...rows.slice(idxInRows + 1)];
    pushRowsToHistory(newRows);
  };
  
  const updateRow = (i, key, val) => {
    const globalIndexInSorted = (page - 1) * pageSize + i;
    const originalObject = sortedRows[globalIndexInSorted];
    
    if (!originalObject) return;
    
    const idxInRows = findIndexInRows(rows, originalObject);
    if (idxInRows === -1) return;
    
    const newRows = [...rows]; 
    let normalizedVal = val;
    if (key === "section") {
        normalizedVal = normalizeSection(val);
    } else if (key === "line") {
        normalizedVal = (val || "").trim().toUpperCase();
    }
    
    newRows[idxInRows] = { ...newRows[idxInRows], [key]: normalizedVal }; 
    pushRowsToHistory(newRows);
  };

  const handleApproverMsnvChange = (e, i) => {
    const v = e.target.value;
    const globalIndexInSorted = (page - 1) * pageSize + i;
    const originalObject = sortedRows[globalIndexInSorted];
    
    if (!originalObject) return;

    const idxInRows = findIndexInRows(rows, originalObject);
    if (idxInRows === -1) return;
    
    let newRows = [...rows]; 
    newRows[idxInRows] = { ...newRows[idxInRows], approver_msnv: v }; 

    if (v.length === 5 && !isNaN(Number(v))) {
      pushRowsToHistory(newRows);
      setTimeout(async () => {
        const { data } = await supabase.from("users").select("full_name").eq("msnv", v).single();
        if (data && data.full_name) {
          setRows(current => {
            const arr2 = [...current];
            const idxInRows2 = findIndexInRows(arr2, originalObject); 
            if(idxInRows2 !== -1) { 
                arr2[idxInRows2] = { ...arr2[idxInRows2], approver_name: data.full_name };
            }
            setHistory(prevHistory => {
                const historySlice = prevHistory.slice(0, historyIndex + 1); 
                let updatedHistory = [...historySlice, arr2];
                if (updatedHistory.length > MAX_HISTORY) {
                    updatedHistory = updatedHistory.slice(1);
                }
                setHistoryIndex(updatedHistory.length - 1);
                return updatedHistory;
            });
            setPage(1);
            return arr2;
          });
        }
      }, 100);
      return; 

    } else if (v.length === 0) {
       newRows[idxInRows] = { ...newRows[idxInRows], approver_name: "" };
       pushRowsToHistory(newRows);
    } else {
       pushRowsToHistory(newRows);
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const msnvMatch = !qWorker || (r.msnv || "").toLowerCase().includes(qWorker.toLowerCase()) || (r.full_name || "").toLowerCase().includes(qWorker.toLowerCase());
      const approverMatch = !qApprover || (r.approver_msnv || "").toLowerCase().includes(qApprover.toLowerCase()) || (r.approver_name || "").toLowerCase().includes(qApprover.toLowerCase());
      return msnvMatch && approverMatch;
    });
  }, [rows, qWorker, qApprover]);
  
  const sortedRows = useMemo(() => {
    const sortableRows = [...filteredRows];
    if (sortConfig.key) {
      sortableRows.sort((a, b) => {
        const aVal = a[sortConfig.key] || "";
        const bVal = b[sortConfig.key] || "";
        
        const isNumeric = sortConfig.key === "msnv" || sortConfig.key === "approver_msnv";
        if (isNumeric) {
            const aNum = Number(aVal);
            const bNum = Number(bVal);
            if (aNum < bNum) return sortConfig.direction === "ascending" ? -1 : 1;
            if (aNum > bNum) return sortConfig.direction === "ascending" ? 1 : -1;
            return 0;
        }
        
        if (aVal < bVal) return sortConfig.direction === "ascending" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "ascending" ? 1 : -1;
        return 0;
      });
    }
    return sortableRows;
  }, [filteredRows, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pageRows = useMemo(
    () => sortedRows.slice((page - 1) * pageSize, page * pageSize),
    [sortedRows, page]
  );
  
  const isNewRow = (r) => !r.msnv_original; 

  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };
  
  const getClassNamesFor = (key) => {
    if (!sortConfig.key || sortConfig.key !== key) return "";
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
  };
  
  const saving = useMemo(() => { return new Set(); }, []);

  const saveRow = async (i) => {
    const globalIndexInSorted = (page - 1) * pageSize + i;
    const r = sortedRows[globalIndexInSorted];
    if (!r) return;
    
    if (!r.msnv || !r.full_name || !r.section) {
      return alert("MSNV, Họ & tên và Section không được để trống.");
    }
    if (!ALLOWED_ROLES.includes((r.role || "").toLowerCase())) {
      return alert("Vai trò không hợp lệ.");
    }
    
    setLoading(true);
    
    const payload = {
        msnv: r.msnv,
        full_name: r.full_name,
        section: r.section,
        line: (r.line || "").trim().toUpperCase(), 
        role: (r.role || "").toLowerCase(),
        approver_msnv: r.approver_msnv || null,
        approver_name: r.approver_name || null,
    };
    
    try {
        const { error } = await supabase.from("users").upsert(payload, { onConflict: "msnv" });
        if (error) throw error;
        alert(`Đã lưu User ${r.msnv}.`);
        loadUsers(); 
    } catch (err) {
        console.error(err);
        alert("Lỗi lưu dữ liệu: " + (err.message || err));
    } finally {
        setLoading(false);
    }
  };
  
  const deleteRow = async (i) => {
    const globalIndexInSorted = (page - 1) * pageSize + i;
    const r = sortedRows[globalIndexInSorted];
    if (!r || !r.msnv) {
        if (!r) return; 
        removeRow(i); 
        return;
    }

    if (!window.confirm(`Bạn có chắc muốn xoá User ${r.msnv} - ${r.full_name}?`)) return;

    setLoading(true);
    try {
        const { error } = await supabase.from("users").delete().eq("msnv", r.msnv);
        if (error) throw error;
        alert(`Đã xoá User ${r.msnv}.`);
        loadUsers(); 
    } catch (err) {
        console.error(err);
        alert("Lỗi xoá dữ liệu: " + (err.message || err));
    } finally {
        setLoading(false);
    }
  };
  
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (!data || data.length === 0) return alert("File Excel không có dữ liệu.");

        const mappedData = data.map(row => {
          let obj = {};
          let isValidRow = false; 
          Object.keys(row).forEach(key => {
            const field = mapHeaderToField(key);
            if (field) {
              obj[field] = row[key];
              if (field === "msnv" && obj.msnv) isValidRow = true;
            }
          });
          
          if (isValidRow) { 
            obj.section = normalizeSection(obj.section);
            obj.role = (ALLOWED_ROLES.includes((obj.role || "").toLowerCase()) ? obj.role.toLowerCase() : "worker");
            obj.line = (obj.line || "").trim().toUpperCase(); 
            return obj;
          }
          return null;
        }).filter(r => r !== null);

        if (mappedData.length === 0) return alert("Không tìm thấy dữ liệu nhân viên hợp lệ (cột MSNV) trong file.");
        
        if (window.confirm(`Tìm thấy ${mappedData.length} User hợp lệ. Tiếp tục để Tải lên (Upsert) dữ liệu này?`)) {
            setLoading(true);
            upsertInChunks(mappedData)
                .then(() => alert(`Đã tải lên/cập nhật thành công ${mappedData.length} User.`))
                .catch(err => alert("Lỗi tải lên: " + err.message))
                .finally(() => {
                    setLoading(false);
                    loadUsers(); 
                });
        }
      } catch (e) {
        alert("Lỗi xử lý file Excel: " + e.message);
      } finally {
        e.target.value = null; 
      }
    };
    reader.readAsBinaryString(file);
  };
  
  const downloadAllUsers = async () => {
    setLoading(true);
    try {
        const { data, error } = await supabase.from("users").select("*");
        if (error) throw error;

        const users = data || [];

        if (users.length === 0) {
            alert("Không có dữ liệu User để tải về.");
            return;
        }

        const ws = XLSX.utils.json_to_sheet(users);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DanhSachUsers");

        XLSX.writeFile(wb, "DanhSachNhanVien_KPI_Admin.xlsx");
        alert(`Đã tải về ${users.length} User.`);

    } catch (err) {
        console.error(err);
        alert("Lỗi khi tải dữ liệu: " + (err.message || err));
    } finally {
        setLoading(false);
    }
  };
  
  const deleteAllUsers = async () => {
    const password = prompt("Nhập mật khẩu để xác nhận xóa TOÀN BỘ User:");
    if (password !== DANGER_PASSWORD) {
        alert("Mật khẩu không đúng. Thao tác hủy.");
        return;
    }
    
    if (!window.confirm("CẢNH BÁO: Thao tác này sẽ xoá TOÀN BỘ User khỏi hệ thống (trừ MSNV = 0). Bạn có CHẮC CHẮN không?")) return;
    if (!window.confirm("Xác nhận lần 2: TẤT CẢ dữ liệu User sẽ bị xoá vĩnh viễn.")) return;

    setLoading(true);
    try {
        const { error } = await supabase.from("users").delete().neq("msnv", "0");
        if (error) throw error;
        setRows([]);
        alert("Đã xóa tất cả dữ liệu user.");
        loadUsers(); 
    } catch (err) {
        console.error(err);
        alert("Lỗi xóa dữ liệu: " + (err.message || err));
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteBySection = async () => {
    if (!sectionToDelete) {
      return alert("Vui lòng chọn Section cần xóa!");
    }

    const confirmMsg = `CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ nhân viên thuộc section "${sectionToDelete}" không?\n\nHành động này không thể hoàn tác!`;
    if (!window.confirm(confirmMsg)) return;
    
    if (!window.confirm(`Xác nhận lần cuối: Xóa sạch danh sách của "${sectionToDelete}"?`)) return;

    try {
      setLoading(true);
      
      const { error, count } = await supabase
        .from('users')
        .delete({ count: 'exact' }) 
        .eq('section', sectionToDelete);

      if (error) throw error;

      alert(`Đã xóa thành công ${count} nhân viên thuộc section ${sectionToDelete}.`);
      loadUsers();
      
    } catch (err) {
      alert("Lỗi khi xóa: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteByMsnvList = async (msnvs) => {
    if (!msnvs || msnvs.length === 0) return;
    
    const confirmMsg = `CẢNH BÁO: Bạn có chắc chắn muốn xóa ${msnvs.length} nhân viên theo danh sách MSNV vừa tải lên không?`;
    if (!window.confirm(confirmMsg)) return;
    
    setLoading(true);
    let deletedCount = 0;
    const chunkSize = 100;
    
    try {
      for (let i = 0; i < msnvs.length; i += chunkSize) {
        const chunk = msnvs.slice(i, i + chunkSize);
        const { error, count } = await supabase
          .from("users")
          .delete({ count: 'exact' })
          .in("msnv", chunk);
        
        if (error) throw error;
        deletedCount += (count || 0);
      }
      alert(`Đã xóa thành công ${deletedCount}/${msnvs.length} nhân viên.`);
      loadUsers();
    } catch (err) {
      console.error(err);
      alert("Lỗi khi xóa hàng loạt: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDeleteUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) return alert("File Excel không có dữ liệu.");

        const msnvs = data.map(row => {
          let msnvVal = null;
          Object.keys(row).forEach(key => {
            if (mapHeaderToField(key) === "msnv") {
              msnvVal = String(row[key]).trim();
            }
          });
          return msnvVal;
        }).filter(Boolean);

        if (msnvs.length === 0) {
          return alert("Không tìm thấy cột MSNV hợp lệ trong file.");
        }

        deleteByMsnvList(msnvs);
      } catch (err) {
        alert("Lỗi xử lý file: " + err.message);
      } finally {
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };
  const downloadBulkDeleteTemplate = () => {
    const data = [{ msnv: "12345" }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "XoaNhanVien");
    XLSX.writeFile(wb, "Form_Xoa_Nhan_Vien.xlsx");
  };

  const downloadUpsertTemplate = () => {
    const data = [{
      msnv: "12345",
      full_name: "Nguyen Van A",
      section: "PHONG BAN",
      line: "LINE_01",
      role: "worker",
      approver_msnv: "54321",
      approver_name: "Ten Nguoi Duyet"
    }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachNhanVien");
    XLSX.writeFile(wb, "Form_Import_Nhan_Vien.xlsx");
  };

  // --- LOGIC LẤY DANH SÁCH SECTION ĐỘNG ---
  const dynamicSections = useMemo(() => {
    // Lấy tất cả giá trị cột section từ biến 'rows', loại bỏ giá trị trống và trùng lặp
    const sections = rows.map(u => u.section).filter(Boolean);
    return Array.from(new Set(sections)).sort();
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* PHẦN 1: CẬP NHẬT DANH SÁCH */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            📥 Cập nhật danh sách nhân viên
          </h3>
        </div>
        <div className="p-4 flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" onClick={addNewRow} disabled={loading}>
            + Thêm User mới
          </button>
          
          <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileUpload} 
              className="hidden" 
              ref={fileRef} 
          />
          <button 
              className="btn bg-green-600 text-white hover:bg-green-700" 
              onClick={() => fileRef.current.click()}
              disabled={loading}
          >
              Tải lên từ Excel (Upsert)
          </button>
          <button 
              className="btn bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
              onClick={downloadUpsertTemplate}
          >
              Tải file mẫu Import
          </button>
          
          <button 
              className="btn bg-indigo-600 text-white hover:bg-indigo-700" 
              onClick={downloadAllUsers} 
              disabled={loading}
          >
              Tải danh sách User hiện có ({rows.length})
          </button>

          {loading && <span className="text-gray-500 animate-pulse ml-2">Đang xử lý...</span>}
        </div>
      </div>

      {/* PHẦN 2: XÓA DANH SÁCH */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-red-50 px-4 py-3 border-b border-red-100">
          <h3 className="text-lg font-semibold text-red-700 flex items-center gap-2">
            🗑️ Xóa danh sách nhân viên
          </h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Xóa theo Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600">Xóa theo Section:</label>
              <div className="flex gap-2">
                <select 
                  className="input flex-1 border-red-200 focus:ring-red-500" 
                  value={sectionToDelete} 
                  onChange={(e) => setSectionToDelete(e.target.value)}
                >
                  <option value="">-- Chọn Section --</option>
                  {dynamicSections.map((sec) => (
                      <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
                <button 
                  onClick={handleDeleteBySection} 
                  disabled={loading || !sectionToDelete}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 transition-colors"
                >
                  Xóa
                </button>
              </div>
            </div>

            {/* Xóa theo MSNV */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600">Xóa theo danh sách MSNV:</label>
              <div className="flex flex-wrap gap-2">
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={handleBulkDeleteUpload} 
                  className="hidden" 
                  ref={bulkDeleteRef} 
                />
                <button 
                  onClick={() => bulkDeleteRef.current.click()} 
                  disabled={loading}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  Tải file & Xóa
                </button>
                <button 
                  onClick={downloadBulkDeleteTemplate}
                  className="bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 py-2 px-3 rounded text-sm"
                  title="Tải file mẫu xóa"
                >
                  Mẫu file (.xlsx)
                </button>
              </div>
              <p className="text-[10px] text-orange-600 italic">File chỉ cần 1 cột MSNV</p>
            </div>

            {/* Xóa TOÀN BỘ */}
            <div className="flex items-end justify-end">
              <button 
                className="btn bg-red-700 text-white hover:bg-red-800 w-full md:w-auto" 
                onClick={deleteAllUsers} 
                disabled={loading}
              >
                Xóa TOÀN BỘ User (DANGER)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 rounded">
        <div className="flex items-center gap-2">
            <button className="btn" onClick={undo} disabled={historyIndex <= 0}>
                ↩ Hoàn tác
            </button>
            <button className="btn" onClick={redo} disabled={historyIndex >= history.length - 1}>
                Làm lại ↪
            </button>
        </div>
        
        <div className="flex items-center gap-2">
            <label className="font-medium">Lọc theo MSNV/Tên:</label>
            <input 
                value={qWorker} 
                onChange={e => setQWorker(e.target.value)} 
                placeholder="MSNV/Tên nhân viên" 
                className="input"
            />
        </div>
        <div className="flex items-center gap-2">
            <label className="font-medium">Lọc theo Approver:</label>
            <input 
                value={qApprover} 
                onChange={e => setQApprover(e.target.value)} 
                placeholder="MSNV/Tên người duyệt" 
                className="input"
            />
        </div>
        <div className="ml-auto flex items-center gap-3">
            <span>Kết quả: {sortedRows.length} dòng</span>
            <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹ Trước</button>
            <span>Trang {page}/{totalPages}</span>
            <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Sau ›</button>
        </div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-center">STT</th>
              <th className="p-2 cursor-pointer text-left" onClick={() => requestSort("msnv")}>MSNV {getClassNamesFor("msnv")}</th>
              <th className="p-2 cursor-pointer text-left" onClick={() => requestSort("full_name")}>Họ & tên {getClassNamesFor("full_name")}</th>
              <th className="p-2 cursor-pointer text-left" onClick={() => requestSort("section")}>Section {getClassNamesFor("section")}</th>
              
              <th className="p-2 cursor-pointer text-left" onClick={() => requestSort("line")}>Vị trí LV (Line) {getClassNamesFor("line")}</th> 
              
              <th className="p-2 cursor-pointer text-left" onClick={() => requestSort("role")}>Role {getClassNamesFor("role")}</th>
              <th className="p-2 cursor-pointer text-left" onClick={() => requestSort("approver_msnv")}>Approver MSNV {getClassNamesFor("approver_msnv")}</th>
              <th className="p-2 text-left">Approver Tên</th>
              <th className="p-2 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => {
              const globalIndex = (page - 1) * pageSize + i;
              const isUpdating = saving.has(globalIndex);
              
              return (
                <tr key={r.msnv || `new-${i}`} className="border-t">
                  <td className="p-2 text-center text-gray-500">{globalIndex + 1}</td>
                  <td className="p-2">
                    <input 
                      value={r.msnv || ""} 
                      onChange={e => updateRow(i, "msnv", e.target.value)} 
                      placeholder="MSNV" 
                      className="input" 
                      disabled={!isNewRow(r)} 
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      value={r.full_name || ""} 
                      onChange={e => updateRow(i, "full_name", e.target.value)} 
                      placeholder="Họ & tên" 
                      className="input" 
                    />
                  </td>
                  <td className="p-2">
                    <input 
                      value={r.section || ""} 
                      onChange={e => updateRow(i, "section", e.target.value)} 
                      onBlur={e => updateRow(i, "section", normalizeSection(e.target.value))} 
                      placeholder="Section" 
                      className="input" 
                    />
                  </td>
                  
                  <td className="p-2">
                    <input 
                      value={r.line || ""} 
                      onChange={e => updateRow(i, "line", e.target.value)} 
                      onBlur={e => updateRow(i, "line", (e.target.value || "").trim().toUpperCase())} 
                      placeholder="Line/Máy" 
                      className="input" 
                    />
                  </td>
                  
                  <td className="p-2">
                    <select value={r.role} onChange={e => {
                        const v = e.target.value;
                        updateRow(i, "role", v); 
                    }} className="input">
                        {ALLOWED_ROLES.map(x => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <input 
                      value={r.approver_msnv || ""} 
                      onChange={e => handleApproverMsnvChange(e, i)} 
                      placeholder="Approver MSNV" 
                      className="input" 
                    />
                  </td>
                  <td className="p-2">
                    <input 
                        value={r.approver_name || ""} 
                        onChange={e => updateRow(i, "approver_name", e.target.value)} 
                        placeholder="Approver Tên" 
                        className="input" 
                    />
                  </td>
                  <td className="p-2 text-center space-x-2">
                    <button 
                      className="btn bg-blue-500 text-white hover:bg-blue-600" 
                      onClick={() => saveRow(i)} 
                      disabled={loading}
                    >
                      {isUpdating ? "..." : "Lưu"}
                    </button>
                    <button 
                      className="btn bg-red-500 text-white hover:bg-red-600" 
                      onClick={() => deleteRow(i)} 
                      disabled={loading} 
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              );
            })}
            {!pageRows.length && (
                <tr><td colSpan={9} className="p-4 text-center text-gray-500">Không có dữ liệu.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ======================================================================
   MACHINE MANAGER COMPONENT
   ====================================================================== */
function MachineManager() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSection, setSelectedSection] = useState("");

  const loadMachines = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("kpi_machines").select("*").order("section", { ascending: true }).order("machine_name", { ascending: true });
    setLoading(false);
    if (error) console.error(error);
    const rows = data || [];
    setMachines(rows);
    
    // Auto-select first section if none selected
    if (rows.length > 0 && !selectedSection) {
      const firstSection = rows[0].section;
      setSelectedSection(firstSection);
    }
  };

  useEffect(() => {
    loadMachines();
  }, []);

  const sections = useMemo(() => {
    const s = machines.map(m => m.section).filter(Boolean);
    return Array.from(new Set(s)).sort();
  }, [machines]);

  const filteredMachines = useMemo(() => {
    if (!selectedSection) return machines;
    return machines.filter(m => m.section === selectedSection);
  }, [machines, selectedSection]);

  const addRow = () => {
    if (!selectedSection) {
      const newSec = prompt("Nhập tên Section mới:");
      if (!newSec) return;
      setSelectedSection(newSec.toUpperCase());
      setMachines([{ section: newSec.toUpperCase(), machine_name: "", active: true }, ...machines]);
    } else {
      setMachines([{ section: selectedSection, machine_name: "", active: true }, ...machines]);
    }
  };

  const saveRow = async (m, idx) => {
    if (!m.section || !m.machine_name) return alert("Vui lòng nhập đầy đủ Section và Tên Máy.");
    setSaving(true);
    const payload = { section: m.section.toUpperCase(), machine_name: m.machine_name.toUpperCase(), active: !!m.active };
    if (m.id) payload.id = m.id;
    
    const { error } = await supabase.from("kpi_machines").upsert(payload);
    setSaving(false);
    if (error) alert("Lỗi: " + error.message);
    else {
      alert("Đã lưu máy.");
      loadMachines();
    }
  };

  const deleteRow = async (m, idx) => {
    // Tìm index thật trong mảng machines để xóa
    if (!m.id) {
       setMachines(prev => prev.filter(x => x !== m));
       return;
    }
    if (!confirm(`Xoá máy ${m.machine_name} của section ${m.section}?`)) return;
    
    setSaving(true);
    const { error } = await supabase.from("kpi_machines").delete().eq("id", m.id);
    setSaving(false);
    if (error) alert("Lỗi xoá: " + error.message);
    else loadMachines();
  };

  const seedData = async () => {
    if (!confirm("Hệ thống sẽ nạp danh sách máy mặc định vào database. Tiếp tục?")) return;
    const INITIAL_MACHINES = [
      { section: "LAMINATION", machine_name: "Máy dán 1" }, { section: "LAMINATION", machine_name: "Máy dán 2" },
      { section: "LAMINATION", machine_name: "Máy dán 3" }, { section: "LAMINATION", machine_name: "Máy dán 4" },
      { section: "LAMINATION", machine_name: "Máy dán 5" }, { section: "LAMINATION", machine_name: "Máy dán 6" },
      { section: "LAMINATION", machine_name: "Máy dán 7" },
      { section: "PREFITTING", machine_name: "Máy cắt 1" }, { section: "PREFITTING", machine_name: "Máy cắt 2" },
      { section: "PREFITTING", machine_name: "Máy cắt 3" }, { section: "PREFITTING", machine_name: "Máy cắt 4" },
      { section: "PREFITTING", machine_name: "Máy cắt 5" }, { section: "PREFITTING", machine_name: "Máy cắt 6" },
      { section: "BÀO", machine_name: "Máy bào 1" }, { section: "BÀO", machine_name: "Máy bào 2" },
      { section: "BÀO", machine_name: "Máy bào 3" }, { section: "BÀO", machine_name: "Máy bào 4" },
      { section: "TÁCH", machine_name: "Máy tách 1" }, { section: "TÁCH", machine_name: "Máy tách 2" },
      { section: "TÁCH", machine_name: "Máy tách 3" }, { section: "TÁCH", machine_name: "Máy tách 4" },
      { section: "LEANLINE_MOLDED", machine_name: "H1" }, { section: "LEANLINE_MOLDED", machine_name: "H2" },
      { section: "LEANLINE_MOLDED", machine_name: "M1-A" }, { section: "LEANLINE_MOLDED", machine_name: "M1-B" },
      { section: "LEANLINE_MOLDED", machine_name: "M1-C" }, { section: "LEANLINE_MOLDED", machine_name: "M2-A" },
      { section: "LEANLINE_MOLDED", machine_name: "M2-B" }, { section: "LEANLINE_MOLDED", machine_name: "M3-A" },
      { section: "LEANLINE_MOLDED", machine_name: "M3-B" }, { section: "LEANLINE_MOLDED", machine_name: "M4-A" },
      { section: "LEANLINE_MOLDED", machine_name: "M4-B" }, { section: "LEANLINE_MOLDED", machine_name: "M5-B" },
      { section: "LEANLINE_DC", machine_name: "D1A" }, { section: "LEANLINE_DC", machine_name: "D1B" },
      { section: "LEANLINE_DC", machine_name: "D2A" }, { section: "LEANLINE_DC", machine_name: "D2B" },
      { section: "LEANLINE_DC", machine_name: "D3A" }, { section: "LEANLINE_DC", machine_name: "D3B" },
      { section: "LEANLINE_DC", machine_name: "D4A" }, { section: "LEANLINE_DC", machine_name: "D4B" },
      { section: "LEANLINE_DC", machine_name: "H1" }, { section: "LEANLINE_DC", machine_name: "H2" },
    ];
    setSaving(true);
    const { error } = await supabase.from("kpi_machines").upsert(INITIAL_MACHINES, { onConflict: "section,machine_name" });
    setSaving(false);
    if (error) alert("Lỗi nạp dữ liệu: " + error.message);
    else { alert("Đã nạp danh sách máy mặc định."); loadMachines(); }
  };

  const handleAddSection = () => {
    const newSec = prompt("Nhập tên Section mới (VD: MOLDING, LEANLINE_MOLDED...):");
    if (newSec) {
      setSelectedSection(newSec.toUpperCase());
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 border rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="font-bold text-gray-700">Chọn Section:</label>
          <select 
            className="input min-w-[200px]"
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
          >
            <option value="">-- Tất cả --</option>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-sm" onClick={handleAddSection}>+ Thêm Section mới</button>
        </div>
        
        <div className="space-x-2">
          <button className="btn" onClick={seedData} disabled={saving}>🔄 Nạp dữ liệu mặc định</button>
          <button className="btn btn-primary" onClick={addRow} disabled={loading}>+ Thêm máy mới</button>
        </div>
      </div>

      <div className="overflow-auto border rounded-xl bg-white shadow-sm">
        <table className="table w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left w-1/4">Section</th>
              <th className="p-3 text-left">Tên Line / Máy</th>
              <th className="p-3 text-center w-24">Active</th>
              <th className="p-3 text-center w-40">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filteredMachines.map((m, fIdx) => {
               // Tìm index thật trong mảng machines để update state
               const realIdx = machines.findIndex(x => x === m);
               return (
                <tr key={m.id || `new-${fIdx}`} className="border-t hover:bg-gray-50">
                  <td className="p-2 text-gray-500 font-medium">
                    {m.section}
                  </td>
                  <td className="p-2">
                    <input 
                      className="input w-full font-bold text-blue-600" 
                      value={m.machine_name} 
                      placeholder="Nhập tên máy..."
                      onChange={e => setMachines(prev => prev.map((x, i) => i === realIdx ? { ...x, machine_name: e.target.value.toUpperCase() } : x))} 
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input type="checkbox" checked={m.active} onChange={e => setMachines(prev => prev.map((x, i) => i === realIdx ? { ...x, active: e.target.checked } : x))} />
                  </td>
                  <td className="p-2 text-center space-x-2">
                    <button className="btn btn-sm bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100" onClick={() => saveRow(m, realIdx)} disabled={saving}>Lưu</button>
                    <button className="btn btn-sm bg-red-50 text-red-600 border-red-200 hover:bg-red-100" onClick={() => deleteRow(m, realIdx)} disabled={saving}>Xoá</button>
                  </td>
                </tr>
               );
            })}
            {selectedSection && (
              <tr className="border-t bg-gray-50/50">
                <td colSpan={4} className="p-2 text-center">
                  <button 
                    className="text-blue-600 hover:text-blue-800 font-bold flex items-center justify-center gap-2 w-full py-2"
                    onClick={addRow}
                  >
                    <span>+ Thêm máy mới cho {selectedSection}</span>
                  </button>
                </td>
              </tr>
            )}
            {!filteredMachines.length && (
                <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">Không có máy nào trong section này.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ======================================================================
   ADMIN PAGE WRAPPER WITH TABS
   ====================================================================== */
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users"); // "users" or "machines"
  
  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Hệ thống Quản trị</h2>
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button 
             className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             onClick={() => setActiveTab('users')}
          >
             👥 Quản lý Nhân viên
          </button>
          <button 
             className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'machines' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
             onClick={() => setActiveTab('machines')}
          >
             ⚙️ Quản lý Line / Máy
          </button>
        </div>
      </div>
      
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'users' ? <UserManager /> : <MachineManager />}
      </div>
    </div>
  );
}