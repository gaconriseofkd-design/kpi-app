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

function AdminMain() {
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

  // --- STATE MỚI CHO CHỨC NĂNG XÓA THEO SECTION ---
  const [sectionToDelete, setSectionToDelete] = useState("");
  // ------------------------------------------------
  
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

  // --- HÀM MỚI: XÓA THEO SECTION ---
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
  // ----------------------------------

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Quản lý User</h2>
      
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={addNewRow} disabled={loading}>+ Thêm User mới</button>
        
        <input 
            type="file" 
            accept=".xlsx, .xls" 
            onChange={handleFileUpload} 
            className="hidden" 
            ref={fileRef} 
        />
        <button 
            className="btn bg-green-500 text-white hover:bg-green-600" 
            onClick={() => fileRef.current.click()}
            disabled={loading}
        >
            Tải lên từ Excel (Upsert)
        </button>
        
        <button 
            className="btn bg-indigo-500 text-white hover:bg-indigo-600" 
            onClick={downloadAllUsers} 
            disabled={loading}
        >
            Tải danh sách User ({rows.length})
        </button>
        
        <button className="btn bg-red-500 text-white hover:bg-red-600 ml-auto" onClick={deleteAllUsers} disabled={loading}>
            Xóa TOÀN BỘ User (DANGER)
        </button>
        
        {loading && <span className="text-gray-500">Đang tải/xử lý...</span>}
      </div>
      
      {/* --- GIAO DIỆN XÓA THEO SECTION --- */}
      <div className="bg-red-50 border border-red-200 p-4 rounded-lg mt-2 shadow-sm">
        <h3 className="text-red-700 font-bold text-sm mb-2 flex items-center gap-2">
          ⚠️ Xóa danh sách theo Section (Dọn dẹp trước khi import mới)
        </h3>
        
        <div className="flex flex-wrap items-center gap-3">
          <select 
            className="input border-red-300" 
            value={sectionToDelete} 
            onChange={(e) => setSectionToDelete(e.target.value)}
          >
            <option value="">-- Chọn Section cần xóa --</option>
            <option value="LEANLINE_DC">LEANLINE DC</option>
            <option value="LEANLINE_MOLDED">LEANLINE MOLDED</option>
            <option value="MOLDING">MOLDING</option>
            <option value="LAMINATION">LAMINATION</option>
            <option value="PREFITTING">PREFITTING</option>
            <option value="BÀO">BÀO</option>
            <option value="TÁCH">TÁCH</option>
            <option value="BAO">BAO (Không dấu)</option>
            <option value="TACH">TACH (Không dấu)</option>
          </select>

          <button 
            onClick={handleDeleteBySection} 
            disabled={loading || !sectionToDelete}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm disabled:opacity-50"
          >
            {loading ? "Đang xử lý..." : `Xóa User ${sectionToDelete || ""}`}
          </button>
        </div>
      </div>
      {/* ---------------------------------- */}

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

export default AdminMain;