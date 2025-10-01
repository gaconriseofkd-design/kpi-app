// src/pages/AdminPage.jsx
import { useEffect, useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";

const ALLOWED_ROLES = ["worker", "approver", "admin"];

// ====== helpers: normalize + map header ======
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

const emptyRow = { msnv: "", full_name: "", role: "worker", approver_msnv: "", approver_name: "" };

export default function AdminPage() {
  // ====== simple password gate ======
  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState("");
  useEffect(() => {
    if (sessionStorage.getItem("admin_authed") === "1") setAuthed(true);
  }, []);
  function tryLogin(e) {
    e.preventDefault();
    if (pwd === "davidtu") {
      setAuthed(true);
      sessionStorage.setItem("admin_authed", "1");
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

  // ====== main state ======
  const [rows, setRows] = useState([emptyRow]);
  const [loading, setLoading] = useState(false);

  // paging
  const [page, setPage] = useState(1);
  const pageSize = 100;

  // sorting
  const [sortKey, setSortKey] = useState("msnv");
  const [sortDir, setSortDir] = useState("asc"); // asc|desc
  function handleSort(key) {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  // file input
  const fileRef = useRef(null);
  function triggerImport() { fileRef.current?.click(); }

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase.from("users").select("*").order("id", { ascending: true });
    setLoading(false);
    if (error) return alert("Load users lỗi: " + error.message);
    setRows((data && data.length) ? data : [emptyRow]);
    setPage(1);
  }

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

      // dedupe by msnv (keep last)
      const dedup = Array.from(new Map(parsed.map(u => [u.msnv, u])).values());

      const { data: ex, error: e0 } = await supabase.from("users").select("msnv");
      if (e0) throw e0;
      const exSet = new Set((ex || []).map(x => String(x.msnv)));
      const overlapped = dedup.reduce((c, u) => c + (exSet.has(u.msnv) ? 1 : 0), 0);

      await upsertInChunks(dedup);
      alert([
        `Nhập & lưu thành công ${dedup.length} dòng.`,
        `- Cập nhật (MSNV trùng): ${overlapped}`,
        `- Thêm mới: ${dedup.length - overlapped}`
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

  // ====== sort + paginate (áp dụng sort trên toàn bộ, rồi mới cắt trang) ======
  const sortedRows = useMemo(() => {
    const data = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;
    data.sort((a, b) => {
      const va = (a?.[sortKey] ?? "").toString().toLowerCase();
      const vb = (b?.[sortKey] ?? "").toString().toLowerCase();
      if (!isNaN(Number(va)) && !isNaN(Number(vb))) {
        return (Number(va) - Number(vb)) * dir;
      }
      return va.localeCompare(vb, "vi") * dir;
    });
    return data;
  }, [rows, sortKey, sortDir]);

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

      {/* Paging */}
      <div className="mt-3 flex items-center gap-3">
        <span>Tổng: {sortedRows.length} dòng</span>
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
