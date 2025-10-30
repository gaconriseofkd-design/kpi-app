// src/pages/AdminPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";

const ALLOWED_ROLES = ["worker", "approver", "admin"];
// 1. Dòng trống mặc định (giữ nguyên)
const emptyRow = { msnv: "", full_name: "", role: "worker", approver_msnv: "", approver_name: "" };

/* Helpers: map tiêu đề Excel → field DB (Giữ nguyên) */
function normalizeHeader(s = "") {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9/& ]+/g, " ")
    .toLowerCase()
    .trim();
}
function mapHeaderToField(h) {
  const n = normalizeHeader(h);
  if (["msnv"].includes(n)) return "msnv";
  if (["ho ten","ho & ten","ho va ten","full_name","hoten","ho ten nhan vien","ho va ten nhan vien"].includes(n))
    return "full_name";
  if (["role","vai tro"].includes(n)) return "role";
  if ([
    "approver msnv","msnv nguoi duyet","msnv duyet",
    "nguoi duyet msnv","ma so nguoi duyet","msnv approver","msnv approve"
  ].includes(n)) return "approver_msnv";
  if ([
    "approver ho ten","approver ho & ten","ten nguoi duyet",
    "ho ten nguoi duyet","ho va ten nguoi duyet",
    "nguoi duyet ho ten","nguoi duyet ho & ten"
  ].includes(n)) return "approver_name";
  return null;
}

/* ───────── Gate đăng nhập (Giữ nguyên) ───────── */
export default function AdminPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("admin_authed") === "1");
  const [pwd, setPwd] = useState("");

  function tryLogin(e) {
    e.preventDefault();
    if (pwd === "davidtu") {
      sessionStorage.setItem("admin_authed", "1");
      setAuthed(true);
    } else {
      alert("Sai mật khẩu.");
    }
  }

  if (!authed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <form onSubmit={tryLogin} className="w-full max-w-sm p-6 rounded-xl shadow bg-white">
          <h2 className="text-xl font-semibold mb-4">Đăng nhập Admin</h2>
          <label className="block mb-2">Mật khẩu</label>
          <input
            type="password"
            className="input w-full"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Nhập mật khẩu"
          />
          <button className="btn btn-primary mt-4 w-full" type="submit">Đăng nhập</button>
        </form>
      </div>
    );
  }

  return <AdminMain />;
}

/* ───────── Trang quản lý ───────── */
function AdminMain() {
  const [rows, setRows] = useState([emptyRow]);
  const [loading, setLoading] = useState(false);

  // tìm kiếm
  const [qWorker, setQWorker] = useState("");       
  const [qApprover, setQApprover] = useState("");   
  useEffect(() => { setPage(1); }, [qWorker, qApprover]);

  // phân trang
  const [page, setPage] = useState(1);
  const pageSize = 100;

  // sắp xếp
  const [sortKey, setSortKey] = useState("msnv");
  const [sortDir, setSortDir] = useState("asc"); 
  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  // Import Excel
  const fileRef = useRef(null);
  function triggerImport() { fileRef.current?.click(); }

  // ----------------------------------------------------------------
  // 2. HÀM MỚI: Thêm dòng nhân viên
  // ----------------------------------------------------------------
  function addNewRow() {
    // Thêm một dòng trống mới vào đầu danh sách 'rows'
    setRows(prev => [
      { ...emptyRow }, // Tạo một object emptyRow mới
      ...prev
    ]);
    
    // Xóa bộ lọc
    setQWorker("");
    setQApprover("");
    
    // Reset sắp xếp để đảm bảo dòng mới ở trên cùng
    setSortKey("msnv");
    setSortDir("asc"); 
    
    // Chuyển về trang 1
    setPage(1);
  }
  // ----------------------------------------------------------------

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase.from("users").select("*").order("id", { ascending: true });
    setLoading(false);
    if (error) return alert("Load users lỗi: " + error.message);
    setRows((data && data.length) ? data : [emptyRow]);
    setPage(1);
  }
  useEffect(() => { loadUsers(); }, []);

  async function upsertInChunks(list, size = 500) {
    for (let i = 0; i < list.length; i += size) {
      const chunk = list.slice(i, i + size);
      const { error } = await supabase.from("users").upsert(chunk, { onConflict: "msnv" }).select();
      if (error) throw error;
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      setLoading(true);
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (!raw.length) throw new Error("File rỗng.");

      const headers = raw[0];
      const fieldIdx = {};
      headers.forEach((h, i) => {
        const f = mapHeaderToField(String(h));
        if (f) fieldIdx[i] = f;
      });

      const parsed = [];
      for (let r = 1; r < raw.length; r++) {
        const arr = raw[r];
        if (!arr || !arr.length) continue;
        const obj = { ...emptyRow };
        for (const [idx, field] of Object.entries(fieldIdx)) {
          const v = String(arr[idx] ?? "").trim();
          obj[field] = v;
        }
        if (!obj.msnv) continue;
        obj.role = ALLOWED_ROLES.includes((obj.role || "").toLowerCase()) ? obj.role.toLowerCase() : "worker";
        parsed.push(obj);
      }
      if (!parsed.length) throw new Error("Không có dòng hợp lệ để nhập.");

      const dedup = Array.from(new Map(parsed.map(u => [u.msnv, u])).values());

      await upsertInChunks(dedup);
      alert(`Nhập & lưu thành công ${dedup.length} dòng.`);
      await loadUsers();
    } catch (err) {
      console.error(err);
      alert("Nhập Excel lỗi: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  async function saveAll() {
    const toUpsert = rows
      .map(r => ({
        msnv: (r.msnv || "").trim(),
        full_name: (r.full_name || "").trim(),
        role: (ALLOWED_ROLES.includes((r.role || "").toLowerCase()) ? r.role.toLowerCase() : "worker"),
        approver_msnv: (r.approver_msnv || "").trim(),
        approver_name: (r.approver_name || "").trim(),
      }))
      .filter(r => r.msnv); // Lọc ra những dòng có MSNV (dòng mới phải nhập MSNV)

    if (!toUpsert.length) return alert("Chưa có dòng nào có MSNV để lưu.");

    try {
      setLoading(true);
      await upsertInChunks(toUpsert);
      alert(`Đã lưu ${toUpsert.length} dòng.`);
      await loadUsers();
    } catch (err) {
      console.error(err);
      alert("Lưu lỗi: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  async function deleteAll() {
    if (!confirm("Bạn chắc chắn muốn XÓA TOÀN BỘ danh sách người dùng?")) return;
    try {
      setLoading(true);
      const { error } = await supabase.from("users").delete().gt("id", 0);
      if (error) throw error;
      alert("Đã xoá toàn bộ.");
      setRows([emptyRow]);
      setPage(1);
    } catch (err) {
      console.error(err);
      alert("Xoá toàn bộ lỗi: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  function removeRow(idxOnPage) {
    // SỬA LỖI: Cần tính đúng global index từ `sortedRows` thay vì `rows`
    const globalIndexInSorted = (page - 1) * pageSize + idxOnPage;
    const msnvToRemove = sortedRows[globalIndexInSorted]?.msnv;
    
    (async () => {
      // Nếu dòng này đã có trong DB (có msnv), xóa nó khỏi DB
      if (msnvToRemove) {
        const { error } = await supabase.from("users").delete().eq("msnv", msnvToRemove);
        if (error) return alert("Xoá lỗi: " + error.message);
      }
      
      // Xóa dòng khỏi state `rows` (dù là mới hay cũ)
      // Tìm index thực sự trong `rows` state dựa trên msnv (nếu có)
      // Hoặc nếu là dòng mới (msnv=""), ta cần cách khác.
      
      // Cách đơn giản nhất: Tải lại danh sách
      await loadUsers(); 
      // Hoặc xóa khỏi state:
      // setRows(prev => prev.filter(r => r.msnv !== msnvToRemove));
      // (Chọn loadUsers() để đảm bảo đồng bộ)
    })();
  }

  /* Lọc → Sắp xếp → Phân trang (Giữ nguyên) */
  const filteredRows = useMemo(() => {
    const w = qWorker.trim().toLowerCase();
    const a = qApprover.trim().toLowerCase();
    if (!w && !a) return rows;
    return rows.filter(r => {
      const workerOk = !w || (r.msnv || "").toString().toLowerCase().includes(w);
      const approverOk = !a || (r.approver_msnv || "").toString().toLowerCase().includes(a);
      return workerOk && approverOk;
    });
  }, [rows, qWorker, qApprover]);

  const sortedRows = useMemo(() => {
    const data = [...filteredRows];
    const dir = sortDir === "asc" ? 1 : -1;
    data.sort((a, b) => {
      const va = (a?.[sortKey] ?? "").toString().toLowerCase();
      const vb = (b?.[sortKey] ?? "").toString().toLowerCase();
      if (!isNaN(Number(va)) && !isNaN(Number(vb))) return (Number(va) - Number(vb)) * dir;
      return va.localeCompare(vb, "vi") * dir;
    });
    return data;
  }, [filteredRows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pageRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages, page]);

  const SortHeader = ({ title, k }) => (
    <button
      type="button"
      className="text-left font-medium hover:underline flex items-center gap-1"
      onClick={() => handleSort(k)}
      title="Bấm để sắp xếp"
    >
      {title}
      <span className="text-xs opacity-60">
        {sortKey === k ? (sortDir === "asc" ? "▲" : "▼") : ""}
      </span>
    </button>
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-semibold">Quản lý người dùng & phân quyền</h2>

        {/* Ô tìm kiếm */}
        <div className="flex items-center gap-2">
          <input
            className="input w-40"
            placeholder="Tìm MSNV"
            value={qWorker}
            onChange={(e) => setQWorker(e.target.value)}
          />
          <input
            className="input w-52"
            placeholder="Tìm Approver MSNV"
            value={qApprover}
            onChange={(e) => setQApprover(e.target.value)}
          />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* 3. NÚT MỚI: Thêm nhân viên (đã thêm vào) */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex gap-2">
          <button 
            onClick={addNewRow} 
            disabled={loading} 
            className="btn bg-green-600 text-white hover:bg-green-700"
          >
            + Thêm nhân viên
          </button>
          <button onClick={triggerImport} disabled={loading} className="btn">Nhập Excel</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          <button onClick={saveAll} disabled={loading} className="btn btn-primary">
            {loading ? "Đang xử lý..." : "Lưu tất cả"}
          </button>
          <button onClick={deleteAll} disabled={loading} className="btn bg-red-600 text-white hover:bg-red-700">
            Xoá toàn bộ
          </button>
        </div>
      </div>

      {/* Paging */}
      <div className="mt-3 flex items-center gap-3">
        <span>Kết quả: {sortedRows.length} dòng</span>
        <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹ Trước</button>
        <span>Trang {page}/{totalPages}</span>
        <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Sau ›</button>
      </div>

      {/* Table */}
      <div className="mt-4">
        <div className="grid grid-cols-5 gap-2 mb-2">
          <SortHeader title="MSNV"            k="msnv" />
          <SortHeader title="Họ & tên"        k="full_name" />
          <SortHeader title="Role"            k="role" />
          <SortHeader title="Approver MSNV"   k="approver_msnv" />
          <SortHeader title="Approver Họ tên" k="approver_name" />
        </div>

        {pageRows.map((r, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2">
            <input value={r.msnv} onChange={e => {
              const v = e.target.value;
              // Sửa lỗi: Cần tìm đúng index trong 'rows' để cập nhật
              const globalIndexInSorted = (page - 1) * pageSize + i;
              const originalObject = sortedRows[globalIndexInSorted];
              
              setRows(prev => {
                  // Tìm index của object này trong state `rows` gốc
                  const idxInRows = prev.findIndex(item => item === originalObject);
                  if (idxInRows === -1) return prev; // Không tìm thấy (không nên xảy ra)
                  
                  const arr = [...prev]; 
                  arr[idxInRows] = { ...arr[idxInRows], msnv: v }; 
                  return arr; 
              });
            }} placeholder="MSNV" className="input" />

            <input value={r.full_name} onChange={e => {
              const v = e.target.value;
              const globalIndexInSorted = (page - 1) * pageSize + i;
              const originalObject = sortedRows[globalIndexInSorted];
              setRows(prev => {
                  const idxInRows = prev.findIndex(item => item === originalObject);
                  if (idxInRows === -1) return prev;
                  const arr = [...prev]; 
                  arr[idxInRows] = { ...arr[idxInRows], full_name: v }; 
                  return arr;
              });
            }} placeholder="Họ & tên" className="input" />

            <select value={r.role} onChange={e => {
              const v = e.target.value;
              const globalIndexInSorted = (page - 1) * pageSize + i;
              const originalObject = sortedRows[globalIndexInSorted];
              setRows(prev => {
                  const idxInRows = prev.findIndex(item => item === originalObject);
                  if (idxInRows === -1) return prev;
                  const arr = [...prev]; 
                  arr[idxInRows] = { ...arr[idxInRows], role: v }; 
                  return arr;
              });
            }} className="input">
              {ALLOWED_ROLES.map(x => <option key={x} value={x}>{x}</option>)}
            </select>

            <input value={r.approver_msnv || ""} onChange={e => {
              const v = e.target.value;
              const globalIndexInSorted = (page - 1) * pageSize + i;
              const originalObject = sortedRows[globalIndexInSorted];
              setRows(prev => {
                  const idxInRows = prev.findIndex(item => item === originalObject);
                  if (idxInRows === -1) return prev;
                  const arr = [...prev]; 
                  arr[idxInRows] = { ...arr[idxInRows], approver_msnv: v }; 
                  return arr;
              });
            }} placeholder="Approver MSNV" className="input" />

            <div className="flex gap-2">
              <input value={r.approver_name || ""} onChange={e => {
                const v = e.target.value;
                const globalIndexInSorted = (page - 1) * pageSize + i;
                const originalObject = sortedRows[globalIndexInSorted];
                setRows(prev => {
                    const idxInRows = prev.findIndex(item => item === originalObject);
                    if (idxInRows === -1) return prev;
                    const arr = [...prev]; 
                    arr[idxInRows] = { ...arr[idxInRows], approver_name: v }; 
                    return arr;
                });
              }} placeholder="Approver Họ tên" className="input flex-1" />
              <button onClick={() => removeRow(i)} className="text-red-600">Xoá</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}