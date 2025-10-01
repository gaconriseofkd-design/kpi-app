// src/pages/AdminPage.jsx
import { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";

const ALLOWED_ROLES = ["worker", "approver", "admin"];

// Bỏ dấu + thường hoá để map header linh hoạt
function normalizeHeader(s = "") {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9/& ]+/g, " ")
    .toLowerCase()
    .trim();
}

// Map nhiều biến thể tên cột -> field DB
function mapHeaderToField(h) {
  const n = normalizeHeader(h);

  if (["msnv"].includes(n)) return "msnv";
  if (["ho ten","ho & ten","ho va ten","full_name","hoten","ho ten nhan vien","ho va ten nhan vien"].includes(n))
    return "full_name";
  if (["role","vai tro"].includes(n)) return "role";

  // 👇 Thêm đầy đủ biến thể cho người duyệt
  if ([
    "approver msnv",
    "msnv nguoi duyet",
    "msnv duyet",
    "nguoi duyet msnv",
    "ma so nguoi duyet",
    "msnv approver",
    "msnv approve"
  ].includes(n)) return "approver_msnv";

  if ([
    "approver ho ten",
    "approver ho & ten",
    "ten nguoi duyet",
    "ho ten nguoi duyet",
    "ho va ten nguoi duyet",
    "nguoi duyet ho ten",
    "nguoi duyet ho & ten",
  ].includes(n)) return "approver_name";

  return null;
}

const emptyRow = { msnv: "", full_name: "", role: "worker", approver_msnv: "", approver_name: "" };

export default function AdminPage() {
  const [rows, setRows] = useState([emptyRow]);
  const [loading, setLoading] = useState(false);

  // 🔹 Phân trang
  const [page, setPage] = useState(1);
  const pageSize = 100; // đổi nếu muốn
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [rows, totalPages, page]);

  const fileRef = useRef(null);

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase.from("users").select("*").order("id", { ascending: true });
    setLoading(false);
    if (error) return alert("Load users lỗi: " + error.message);
    setRows((data && data.length) ? data : [emptyRow]);
    setPage(1);
  }

  function triggerImport() { fileRef.current?.click(); }

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
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (!raw.length) throw new Error("File rỗng.");

      const headers = raw[0];
      const fieldIdx = {};
      headers.forEach((h, i) => {
        const f = mapHeaderToField(String(h));
        if (f) fieldIdx[i] = f;
      });

      // Cảnh báo nếu thiếu cột quan trọng
      const wanted = ["msnv", "full_name", "role", "approver_msnv", "approver_name"];
      const missing = wanted.filter(k => !Object.values(fieldIdx).includes(k));
      if (missing.length) {
        // Không chặn, chỉ cảnh báo
        console.warn("Thiếu cột:", missing);
      }

      // Parse
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

      // Loại trùng trong file theo MSNV, giữ bản cuối
      const dedup = Array.from(new Map(parsed.map(u => [u.msnv, u])).values());

      // Đếm overlap với DB để báo lại
      const { data: ex, error: e0 } = await supabase.from("users").select("msnv");
      if (e0) throw e0;
      const setEx = new Set((ex || []).map(x => String(x.msnv)));
      const overlap = dedup.reduce((c, u) => c + (setEx.has(u.msnv) ? 1 : 0), 0);

      await upsertInChunks(dedup);
      alert([
        `Nhập & lưu thành công ${dedup.length} dòng.`,
        `- Cập nhật (MSNV trùng với DB): ${overlap}`,
        `- Thêm mới: ${dedup.length - overlap}`,
      ].join("\n"));

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
      .filter(r => r.msnv);

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
    const idx = (page - 1) * pageSize + idxOnPage;
    const r = rows[idx];
    (async () => {
      if (r?.msnv) {
        const { error } = await supabase.from("users").delete().eq("msnv", r.msnv);
        if (error) return alert("Xoá lỗi: " + error.message);
      }
      setRows(prev => prev.filter((_, i) => i !== idx));
    })();
  }

  useEffect(() => { loadUsers(); }, []);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-semibold">Quản lý người dùng & phân quyền</h2>
        <div className="flex gap-2">
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

      {/* Thanh phân trang */}
      <div className="mt-3 flex items-center gap-3">
        <span>Tổng: {rows.length} dòng</span>
        <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹ Trước</button>
        <span>Trang {page}/{totalPages}</span>
        <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Sau ›</button>
      </div>

      {/* Bảng */}
      <div className="mt-4">
        <div className="grid grid-cols-5 gap-2 font-medium mb-2">
          <div>MSNV</div><div>Họ & tên</div><div>Role</div><div>Approver MSNV</div><div>Approver Họ tên</div>
        </div>

        {pageRows.map((r, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2">
            <input value={r.msnv} onChange={e => {
              const v = e.target.value;
              setRows(prev => {
                const idx = (page - 1) * pageSize + i;
                const arr = [...prev]; arr[idx] = { ...arr[idx], msnv: v }; return arr;
              });
            }} placeholder="MSNV" className="input" />

            <input value={r.full_name} onChange={e => {
              const v = e.target.value;
              setRows(prev => {
                const idx = (page - 1) * pageSize + i;
                const arr = [...prev]; arr[idx] = { ...arr[idx], full_name: v }; return arr;
              });
            }} placeholder="Họ & tên" className="input" />

            <select value={r.role} onChange={e => {
              const v = e.target.value;
              setRows(prev => {
                const idx = (page - 1) * pageSize + i;
                const arr = [...prev]; arr[idx] = { ...arr[idx], role: v }; return arr;
              });
            }} className="input">
              {ALLOWED_ROLES.map(x => <option key={x} value={x}>{x}</option>)}
            </select>

            <input value={r.approver_msnv || ""} onChange={e => {
              const v = e.target.value;
              setRows(prev => {
                const idx = (page - 1) * pageSize + i;
                const arr = [...prev]; arr[idx] = { ...arr[idx], approver_msnv: v }; return arr;
              });
            }} placeholder="Approver MSNV" className="input" />

            <div className="flex gap-2">
              <input value={r.approver_name || ""} onChange={e => {
                const v = e.target.value;
                setRows(prev => {
                  const idx = (page - 1) * pageSize + i;
                  const arr = [...prev]; arr[idx] = { ...arr[idx], approver_name: v }; return arr;
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
