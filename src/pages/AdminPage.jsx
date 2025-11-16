// src/pages/AdminPage.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";


// VAI TRÒ HỢP LỆ (LOWERCASE)
const ALLOWED_ROLES = ["worker", "approver", "admin"];

// HÀNG TRỐNG MẶC ĐỊNH - ĐÃ THÊM 'line'
const emptyRow = { msnv: "", full_name: "", section: "", line: "", role: "worker", approver_msnv: "", approver_name: "" };

// HÀM HELPER CHUNG
function normalizeHeader(h) {
  return h.toLowerCase().trim().replace(/ /g, "_").replace(/[^a-z0-9_]/g, "");
}

// HÀM MAPPING HEADER EXCEL SANG TÊN TRƯỜNG DB - ĐÃ THÊM 'line'
function mapHeaderToField(h) {
  const n = normalizeHeader(h);
  if (["msnv"].includes(n)) return "msnv";
  if (["ho_ten", "ho_&_ten", "ho_va_ten", "full_name", "hoten", "ho_ten_nhan_vien", "ho_va_ten_nhan_vien"].includes(n))
    return "full_name";
  if (["section", "khoi", "bo_phan"].includes(n)) return "section";
  
  // ===== ĐÃ THÊM 'line' (Vị trí làm việc) =====
  if (["line", "may_lam_viec", "vi_tri_lam_viec", "vi_tri", "machine", "vtlamviec"].includes(n)) return "line";
  // ==============================================

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
  // Có thể thêm logic chuẩn hóa section ở đây nếu cần thiết
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
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [qWorker, setQWorker] = useState("");
  const [qApprover, setQApprover] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "msnv", direction: "ascending" });
  const fileRef = useRef(null);
  
  const pageSize = 15;
  const [page, setPage] = useState(1);
  
  const loadUsers = async () => {
    setLoading(true);
    try {
      // Đảm bảo select tất cả các cột, bao gồm 'line'
      const { data, error } = await supabase.from("users").select("*").order("msnv", { ascending: true }); 
      if (error) throw error;
      setRows(data || []);
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

  // ===== THÊM: RESET PAGE KHI CÓ THAY ĐỔI TÌM KIẾM =====
  useEffect(() => {
    setPage(1);
  }, [qWorker, qApprover]);
  // =======================================================

  const addNewRow = () => {
    if (rows.length >= 1000) return alert("Giới hạn 1000 dòng hiển thị. Vui lòng lưu bớt hoặc lọc.");
    setRows(prev => [emptyRow, ...prev]);
  };
  
  // SỬA LỖI: Củng cố logic tìm index và thêm kiểm tra null/undefined
  const findIndexInRows = (prevRows, originalObject) => {
    if (!originalObject) return -1;
    // Tìm bằng MSNV nếu có, nếu không thì dùng object reference (cho dòng mới)
    return originalObject.msnv
      ? prevRows.findIndex(item => item.msnv === originalObject.msnv)
      : prevRows.findIndex(item => item === originalObject);
  }
  
  const removeRow = (i) => {
    // Tìm index của row trong `rows` dựa trên `sortedRows` và `pageRows`
    const globalIndexInSorted = (page - 1) * pageSize + i;
    const originalObject = sortedRows[globalIndexInSorted];
    
    // FIX: Thêm kiểm tra
    if (!originalObject) return;
    
    setRows(prev => {
        const idxInRows = findIndexInRows(prev, originalObject);
        if (idxInRows === -1) return prev;
        
        // Dùng slice để xóa (không nên dùng splice)
        return [...prev.slice(0, idxInRows), ...prev.slice(idxInRows + 1)];
    });
  };
  
  const updateRow = (i, key, val) => {
    const globalIndexInSorted = (page - 1) * pageSize + i;
    const originalObject = sortedRows[globalIndexInSorted];
    
    // FIX: Thêm kiểm tra
    if (!originalObject) return;
    
    setRows(prev => {
        const idxInRows = findIndexInRows(prev, originalObject);
        if (idxInRows === -1) return prev;
        
        const arr = [...prev]; 
        
        // Logic chuẩn hóa riêng cho Section và Line
        let normalizedVal = val;
        if (key === "section") {
            normalizedVal = normalizeSection(val);
        } else if (key === "line") { // THÊM CHUẨN HÓA LINE
            normalizedVal = (val || "").trim().toUpperCase();
        }
        
        arr[idxInRows] = { ...arr[idxInRows], [key]: normalizedVal }; 
        return arr;
    });
  };

  const handleApproverMsnvChange = (e, i) => {
    const v = e.target.value;
    const globalIndexInSorted = (page - 1) * pageSize + i;
    const originalObject = sortedRows[globalIndexInSorted];
    
    // FIX: Thêm kiểm tra
    if (!originalObject) return;

    setRows(prev => {
        const idxInRows = findIndexInRows(prev, originalObject);
        if (idxInRows === -1) return prev;
        
        const arr = [...prev]; 
        arr[idxInRows] = { ...arr[idxInRows], approver_msnv: v }; 
        
        // Tự động tìm tên người duyệt nếu MSNV có 5 số
        if (v.length === 5 && !isNaN(Number(v))) {
          setTimeout(async () => {
            const { data } = await supabase.from("users").select("full_name").eq("msnv", v).single();
            if (data && data.full_name) {
              setRows(current => {
                const arr2 = [...current];
                // Phải tìm lại index vì state có thể đã thay đổi
                const idxInRows2 = findIndexInRows(arr2, originalObject); 
                if(idxInRows2 !== -1) { 
                    arr2[idxInRows2] = { ...arr2[idxInRows2], approver_name: data.full_name };
                }
                return arr2;
              });
            }
          }, 100);
        } else if (v.length === 0) {
           // Xóa tên người duyệt nếu MSNV bị xóa
           const arr2 = [...arr];
           if(arr2[idxInRows]) {
               arr2[idxInRows] = { ...arr2[idxInRows], approver_name: "" };
           }
           return arr2;
        }

        return arr;
    });
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
        
        // Xử lý sắp xếp số nếu key là số
        const isNumeric = sortConfig.key === "msnv" || sortConfig.key === "approver_msnv";
        if (isNumeric) {
            const aNum = Number(aVal);
            const bNum = Number(bVal);
            if (aNum < bNum) return sortConfig.direction === "ascending" ? -1 : 1;
            if (aNum > bNum) return sortConfig.direction === "ascending" ? 1 : -1;
            return 0;
        }
        
        // Sắp xếp chuỗi
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
  
  const isNewRow = (r) => !r.msnv_original; // Giả định row mới không có trường này

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
  
  // Lưu ý: Chỉ lấy các trường có thể chỉnh sửa/lưu
  const saving = useMemo(() => {
      // Giả định logic kiểm tra saving ở đây (ví dụ: dùng Set của các index đang lưu)
      // Hiện tại không có state `saving` chi tiết cho từng dòng, nên ta sẽ giữ nguyên logic cũ.
      return new Set(); 
  }, []);

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
    
    // Bắt đầu lưu
    // setSaving(prev => new Set(prev).add(globalIndexInSorted)); // Nếu có state này
    setLoading(true);
    
    // Payload chỉ chứa các trường cần thiết
    const payload = {
        msnv: r.msnv,
        full_name: r.full_name,
        section: r.section,
        line: (r.line || "").trim().toUpperCase(), // Đảm bảo line được chuẩn hóa trước khi lưu
        role: (r.role || "").toLowerCase(),
        approver_msnv: r.approver_msnv || null,
        approver_name: r.approver_name || null,
    };
    
    try {
        const { error } = await supabase.from("users").upsert(payload, { onConflict: "msnv" });
        if (error) throw error;
        alert(`Đã lưu User ${r.msnv}.`);
        loadUsers(); // Tải lại dữ liệu sau khi lưu
    } catch (err) {
        console.error(err);
        alert("Lỗi lưu dữ liệu: " + (err.message || err));
    } finally {
        setLoading(false);
        // setSaving(prev => {
        //     const next = new Set(prev);
        //     next.delete(globalIndexInSorted);
        //     return next;
        // });
    }
  };
  
  const deleteRow = async (i) => {
    const globalIndexInSorted = (page - 1) * pageSize + i;
    const r = sortedRows[globalIndexInSorted];
    if (!r || !r.msnv) {
        // Nếu là dòng mới chưa có MSNV, ta chỉ cần xóa nó khỏi state
        if (!r) return; // Không tìm thấy dòng
        
        // Dùng logic removeRow để xóa dòng mới trong state
        const originalObject = sortedRows[globalIndexInSorted];
        setRows(prev => {
            const idxInRows = findIndexInRows(prev, originalObject);
            if (idxInRows === -1) return prev;
            return [...prev.slice(0, idxInRows), ...prev.slice(idxInRows + 1)];
        });
        return;
    }

    if (!window.confirm(`Bạn có chắc muốn xoá User ${r.msnv} - ${r.full_name}?`)) return;

    setLoading(true);
    try {
        const { error } = await supabase.from("users").delete().eq("msnv", r.msnv);
        if (error) throw error;
        alert(`Đã xoá User ${r.msnv}.`);
        loadUsers(); // Tải lại dữ liệu sau khi xóa
    } catch (err) {
        console.error(err);
        alert("Lỗi xoá dữ liệu: " + (err.message || err));
    } finally {
        setLoading(false);
    }
  };
  
  // Hàm xử lý file Excel
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
        
        // Đọc header và dữ liệu
        const data = XLSX.utils.sheet_to_json(ws);
        
        if (!data || data.length === 0) return alert("File Excel không có dữ liệu.");

        const mappedData = data.map(row => {
          let obj = {};
          let isValidRow = false; // Chỉ cần 1 trong các trường chính có dữ liệu
          Object.keys(row).forEach(key => {
            const field = mapHeaderToField(key);
            if (field) {
              obj[field] = row[key];
              if (field === "msnv" && obj.msnv) isValidRow = true;
            }
          });
          
          if (isValidRow) { // Chuẩn hóa Section và Role sau khi nhập
            obj.section = normalizeSection(obj.section);
            obj.role = (ALLOWED_ROLES.includes((obj.role || "").toLowerCase()) ? obj.role.toLowerCase() : "worker");
            obj.line = (obj.line || "").trim().toUpperCase(); // Chuẩn hóa line
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
                    loadUsers(); // Tải lại sau khi upsert
                });
        }
      } catch (e) {
        alert("Lỗi xử lý file Excel: " + e.message);
      } finally {
        e.target.value = null; // Reset input file
      }
    };
    reader.readAsBinaryString(file);
  };
  
  const deleteAllUsers = async () => {
    if (!window.confirm("CẢNH BÁO: Thao tác này sẽ xoá TOÀN BỘ User khỏi hệ thống (trừ MSNV = 0). Bạn có CHẮC CHẮN không?")) return;
    if (!window.confirm("Xác nhận lần 2: TẤT CẢ dữ liệu User sẽ bị xoá vĩnh viễn.")) return;

    setLoading(true);
    try {
        const { error } = await supabase.from("users").delete().neq("msnv", "0");
        if (error) throw error;
        setRows([]);
        alert("Đã xóa tất cả dữ liệu user.");
    } catch (err) {
        console.error(err);
        alert("Lỗi xóa dữ liệu: " + (err.message || err));
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Quản lý User</h2>
      
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={addNewRow}>+ Thêm User mới</button>
        
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
        >
            Tải lên từ Excel (Upsert)
        </button>
        
        <button className="btn bg-red-500 text-white hover:bg-red-600 ml-auto" onClick={deleteAllUsers} disabled={loading}>
            Xóa TOÀN BỘ User (DANGER)
        </button>
        
        {loading && <span className="text-gray-500">Đang tải/xử lý...</span>}
      </div>

      <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 rounded">
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
              
              {/* ===== CỘT HEADER VỊ TRÍ LÀM VIỆC (LINE) ===== */}
              <th className="p-2 cursor-pointer text-left" onClick={() => requestSort("line")}>Vị trí LV (Line) {getClassNamesFor("line")}</th> 
              {/* ================================= */}
              
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
                  
                  {/* ===== CỘT INPUT VỊ TRÍ LÀM VIỆC (LINE) MỚI ===== */}
                  <td className="p-2">
                    <input 
                      value={r.line || ""} 
                      onChange={e => updateRow(i, "line", e.target.value)} 
                      onBlur={e => updateRow(i, "line", (e.target.value || "").trim().toUpperCase())} // Chuẩn hóa line sang chữ hoa
                      placeholder="Line/Máy" 
                      className="input" 
                    />
                  </td>
                  {/* =================================================== */}
                  
                  <td className="p-2">
                    <select value={r.role} onChange={e => {
                        const v = e.target.value;
                        updateRow(i, "role", v); // Dùng lại updateRow
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
                        onChange={e => updateRow(i, "approver_name", e.target.value)} // Dùng lại updateRow
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
                      disabled={loading} // Bỏ điều kiện isNewRow(r) để xóa dòng mới chưa lưu được
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