// src/pages/AdminPage.jsx
import { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabaseClient";

const ALLOWED_ROLES = ["worker", "approver", "admin"];

function normalizeHeader(s = "") {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // bỏ dấu
    .replace(/[^a-zA-Z0-9/& ]+/g, " ")
    .toLowerCase()
    .trim();
}

function mapHeaderToField(h) {
  const n = normalizeHeader(h);
  if (["msnv"].includes(n)) return "msnv";
  if (["ho ten","ho & ten","ho va ten","full_name","hoten"].includes(n)) return "full_name";
  if (["role","vai tro"].includes(n)) return "role";
  if (["approver msnv","msnv nguoi duyet","msnv duyet"].includes(n)) return "approver_msnv";
  if (["approver ho ten","approver ho & ten","ten nguoi duyet"].includes(n)) return "approver_name";
  return null;
}

const emptyRow = { msnv: "", full_name: "", role: "worker", approver_msnv: "", approver_name: "" };

export default function AdminPage() {
  const [rows, setRows] = useState([emptyRow]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase.from("users").select("*").order("id", { ascending: true });
    setLoading(false);
    if (error) return alert("Load users lỗi: " + error.message);
    setRows((data && data.length) ? data : [emptyRow]);
  }

  function triggerImport() {
    fileRef.current?.click();
  }

  // Upsert theo chunks để tránh payload lớn
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

      // 1) Đọc file
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

      // Cần tối thiểu 2 cột
      const required = ["msnv", "full_name"];
      const haveAll = required.every(req => Object.values(fieldIdx).includes(req));
      if (!haveAll) throw new Error("Thiếu cột bắt buộc (ít nhất MSNV và Họ & tên).");

      // 2) Parse dòng
      const parsed = [];
      for (let r = 1; r < raw.length; r++) {
        const rowArr = raw[r];
        if (!rowArr || !rowArr.length) continue;

        const obj = { ...emptyRow };
        for (const [idx, field] of Object.entries(fieldIdx)) {
          const v = String(rowArr[idx] ?? "").trim();
          obj[field] = v;
        }
        if (!obj.msnv) continue;
        obj.role = ALLOWED_ROLES.includes((obj.role || "").toLowerCase()) ? obj.role.toLowerCase() : "worker";
        parsed.push(obj);
      }
      if (!parsed.length) throw new Error("Không có dòng hợp lệ để nhập.");

      // 3) Loại trùng trong chính file (giữ bản cuối)
      const mapByMSNV = new Map();
      parsed.forEach(u => mapByMSNV.set(u.msnv, u));
      const dedup = Array.from(mapByMSNV.values());
      const dupInFile = parsed.length - dedup.length;

      // 4) Lấy MSNV hiện có trong DB để tính overlap
      const { data: existing, error: e0 } = await supabase.from("users").select("msnv");
      if (e0) throw e0;
      const existingSet = new Set((existing || []).map(x => String(x.msnv)));

      const overlapWithDB = dedup.reduce((cnt, u) => cnt + (existingSet.has(u.msnv) ? 1 : 0), 0);
      const willInsert = dedup.length - overlapWithDB;

      // 5) Upsert
      await upsertInChunks(dedup);

      alert(
        [
          `Nhập & lưu thành công ${dedup.length} dòng.`,
          `- Trùng trong file (đã gộp): ${dupInFile}`,
          `- Trùng với DB (đã cập nhật): ${overlapWithDB}`,
          `- Mới thêm: ${willInsert}`,
        ].join("\n")
      );

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

      // Đếm trùng với DB (để báo cáo)
      const { data: existing, error: e0 } = await supabase.from("users").select("msnv");
      if (e0) throw e0;
      const existingSet = new Set((existing || []).map(x => String(x.msnv)));
      const overlapWithDB = toUpsert.reduce((cnt, u) => cnt + (existingSet.has(u.msnv) ? 1 : 0), 0);
      const willInsert = toUpsert.length - overlapWithDB;

      await upsertInChunks(toUpsert);
      alert(`Đã lưu ${toUpsert.length} dòng (cập nhật: ${overlapWithDB}, thêm mới: ${willInsert}).`);
      await loadUsers();
    } catch (err) {
      console.error(err);
      alert("Lưu lỗi: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  async function removeRow(idx) {
    const r = rows[idx];
    if (r?.msnv) {
      const { error } = await supabase.from("users").delete().eq("msnv", r.msnv);
      if (error) return alert("Xoá lỗi: " + error.message);
    }
    setRows(prev => prev.filter((_, i) => i !== idx));
  }

  // ❗ XÓA TOÀN BỘ
  async function deleteAll() {
    if (!confirm("Bạn chắc chắn muốn XÓA TOÀN BỘ danh sách người dùng?")) return;
    try {
      setLoading(true);
      const { error } = await supabase.from("users").delete().gt("id", 0); // xóa mọi dòng có id > 0
      if (error) throw error;
      alert("Đã xoá toàn bộ.");
      setRows([emptyRow]);
    } catch (err) {
      console.error(err);
      alert("Xoá toàn bộ lỗi: " + (err.message || err));
    } finally {
      setLoading(false);
    }
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

      <div className="mt-4">
        <div className="grid grid-cols-5 gap-2 font-medium mb-2">
          <div>MSNV</div><div>Họ & tên</div><div>Role</div><div>Approver MSNV</div><div>Approver Họ tên</div>
        </div>

        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2">
            <input value={r.msnv} onChange={e => {
              const v = e.target.value; setRows(p => p.map((x, idx) => idx===i ? {...x, msnv:v} : x));
            }} placeholder="MSNV" className="input" />
            <input value={r.full_name} onChange={e => {
              const v = e.target.value; setRows(p => p.map((x, idx) => idx===i ? {...x, full_name:v} : x));
            }} placeholder="Họ & tên" className="input" />
            <select value={r.role} onChange={e => {
              const v = e.target.value; setRows(p => p.map((x, idx) => idx===i ? {...x, role:v} : x));
            }} className="input">
              {ALLOWED_ROLES.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <input value={r.approver_msnv} onChange={e => {
              const v = e.target.value; setRows(p => p.map((x, idx) => idx===i ? {...x, approver_msnv:v} : x));
            }} placeholder="Approver MSNV" className="input" />
            <div className="flex gap-2">
              <input value={r.approver_name} onChange={e => {
                const v = e.target.value; setRows(p => p.map((x, idx) => idx===i ? {...x, approver_name:v} : x));
              }} placeholder="Approver Họ tên" className="input flex-1" />
              <button onClick={() => removeRow(i)} className="text-red-500">Xoá</button>
            </div>
          </div>
        ))}

        <button onClick={() => setRows(p => [...p, { ...emptyRow }])} className="btn mt-2">
          + Thêm dòng
        </button>
      </div>
    </div>
  );
}
