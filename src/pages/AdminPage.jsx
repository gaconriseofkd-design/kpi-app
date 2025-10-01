import { useState, useEffect } from "react";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load dữ liệu từ Supabase khi vào trang
  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const resp = await fetch("/api/kpi/users").then(r => r.json());
      if (resp.ok) setUsers(resp.rows);
    } catch (e) {
      console.error("Load users error:", e);
    }
    setLoading(false);
  }

  function addRow() {
    setUsers(u => [...u, { worker_id: "", worker_name: "", role: "worker", approver_id: "", approver_name: "" }]);
  }

  function update(ri, key, val) {
    setUsers(u => u.map((r,i)=> i===ri ? { ...r, [key]: val } : r));
  }

  function removeRow(ri) {
    setUsers(u => u.filter((_,i) => i!==ri));
  }

  async function saveAll() {
    try {
      const resp = await fetch("/api/kpi/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users })
      }).then(r => r.json());

      if (resp.ok) {
        alert("Lưu thành công!");
        setUsers(resp.rows);
      } else {
        alert("Lỗi lưu: " + resp.error);
      }
    } catch (e) {
      alert("Lỗi kết nối: " + e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h2 className="text-xl font-bold">Quản lý người dùng & phân quyền</h2>
        <button className="ml-auto px-3 py-2 rounded bg-green-600 text-white" onClick={saveAll}>
          Lưu tất cả
        </button>
      </div>

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                {["MSNV","Họ & tên","Role","Approver MSNV","Approver Họ tên",""].map((h,i)=>
                  <th key={i} className="text-left px-3 py-2 border-b">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map((r,ri)=>(
                <tr key={ri} className="odd:bg-white even:bg-neutral-50/40">
                  <td><input className="border rounded px-2 py-1 w-32" value={r.worker_id}
                    onChange={e=>update(ri,"worker_id",e.target.value)} /></td>
                  <td><input className="border rounded px-2 py-1 w-40" value={r.worker_name}
                    onChange={e=>update(ri,"worker_name",e.target.value)} /></td>
                  <td>
                    <select className="border rounded px-2 py-1" value={r.role}
                      onChange={e=>update(ri,"role",e.target.value)}>
                      <option value="worker">worker</option>
                      <option value="approver">approver</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td><input className="border rounded px-2 py-1 w-32" value={r.approver_id}
                    onChange={e=>update(ri,"approver_id",e.target.value)} /></td>
                  <td><input className="border rounded px-2 py-1 w-40" value={r.approver_name}
                    onChange={e=>update(ri,"approver_name",e.target.value)} /></td>
                  <td><button className="text-red-600" onClick={()=>removeRow(ri)}>Xóa</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button className="px-3 py-2 rounded bg-white border" onClick={addRow}>
        + Thêm dòng
      </button>
    </div>
  );
}
