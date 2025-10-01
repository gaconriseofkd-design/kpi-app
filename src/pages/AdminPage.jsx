import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient"; // 👈 import client

export default function AdminPage() {
  const emptyRow = { msnv: "", full_name: "", role: "worker", approver_msnv: "", approver_name: "" };
  const [rows, setRows] = useState([emptyRow]);
  const [loading, setLoading] = useState(false);

  // Load danh sách user
  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("id", { ascending: true });
    setLoading(false);

    if (error) {
      alert("Load users lỗi: " + error.message);
      return;
    }
    setRows((data && data.length) ? data : [emptyRow]);
  }

  // Lưu tất cả (upsert theo msnv)
  async function saveAll() {
    const toUpsert = rows
      .map(r => ({
        msnv: (r.msnv || "").trim(),
        full_name: (r.full_name || "").trim(),
        role: r.role || "worker",
        approver_msnv: (r.approver_msnv || "").trim(),
        approver_name: (r.approver_name || "").trim(),
      }))
      .filter(r => r.msnv); // chỉ lưu dòng có MSNV

    if (!toUpsert.length) {
      alert("Chưa có dòng nào có MSNV để lưu.");
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("users")
      .upsert(toUpsert, { onConflict: "msnv" }) // cần unique(msnv)
      .select();
    setLoading(false);

    if (error) {
      alert("Lưu lỗi: " + error.message);
      return;
    }
    alert("Lưu thành công!");
    loadUsers();
  }

  // Xoá 1 dòng trên DB (nếu đã có msnv)
  async function removeRow(idx) {
    const r = rows[idx];
    if (r?.msnv) {
      const { error } = await supabase.from("users").delete().eq("msnv", r.msnv);
      if (error) {
        alert("Xoá lỗi: " + error.message);
        return;
      }
    }
    setRows(prev => prev.filter((_, i) => i !== idx));
  }

  useEffect(() => { loadUsers(); }, []);

  // ... phần JSX table giữ nguyên layout của bạn, ví dụ:
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Quản lý người dùng & phân quyền</h2>
        <button onClick={saveAll} disabled={loading} className="btn btn-primary">
          {loading ? "Đang lưu..." : "Lưu tất cả"}
        </button>
      </div>

      {/* table đơn giản; bạn giữ nguyên UI, chỉ đổi onChange setRows */}
      <div className="mt-4">
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
              <option value="worker">worker</option>
              <option value="approver">approver</option>
              <option value="admin">admin</option>
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
