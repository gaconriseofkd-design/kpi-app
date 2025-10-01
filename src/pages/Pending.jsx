import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function fmt(dt) {
  if (!dt) return "";
  try { return new Date(dt).toLocaleString(); } catch { return String(dt); }
}

export default function Pending() {
  const [approverId, setApproverId] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!approverId.trim()) {
      setRows([]);
      return alert("Nhập MSNV người duyệt để xem các đơn chờ duyệt.");
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("kpi_entries")
      .select("*")
      .eq("status", "pending")
      .eq("approver_id", approverId.trim())
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return alert("Lỗi tải danh sách: " + error.message);
    setRows(data || []);
  }

  function onKey(e) { if (e.key === "Enter") load(); }

  async function approve(row) {
    const note = prompt("Ghi chú (tuỳ chọn):", "");
    const violations = row?.compliance_code === "NONE" ? 0 : 1;
    const { error } = await supabase
      .from("kpi_entries")
      .update({
        status: "approved",
        violations,
        approver_note: note || null,
        approved_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return alert("Duyệt lỗi: " + error.message);
    await load();
  }

  async function reject(row) {
    const note = prompt("Lý do từ chối:", "");
    const { error } = await supabase
      .from("kpi_entries")
      .update({
        status: "rejected",
        approver_note: note || null,
        approved_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return alert("Từ chối lỗi: " + error.message);
    await load();
  }

  // Nếu muốn tự load theo approverId đang có, bật đoạn dưới:
  // useEffect(() => { if (approverId.trim()) load(); }, [approverId]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-3">Chờ duyệt KPI (lọc theo MSNV người duyệt)</h2>

      <div className="flex gap-2 items-center mb-4">
        <input
          className="input"
          placeholder="Nhập MSNV người duyệt (VD: A101)"
          value={approverId}
          onChange={(e) => setApproverId(e.target.value)}
          onKeyDown={onKey}
        />
        <button onClick={load} className="btn">{loading ? "Đang tải..." : "Tải danh sách"}</button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Ngày</th>
              <th className="p-2">MSNV</th>
              <th className="p-2">Họ tên</th>
              <th className="p-2">%OE</th>
              <th className="p-2">Phế</th>
              <th className="p-2">P</th>
              <th className="p-2">Q</th>
              <th className="p-2">KPI</th>
              <th className="p-2">Vi phạm</th>
              <th className="p-2">Thao tác</th>
              <th className="p-2">Ghi chú duyệt</th>
              <th className="p-2">Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b">
                <td className="p-2">{r.date}</td>
                <td className="p-2">{r.worker_id}</td>
                <td className="p-2">{r.worker_name}</td>
                <td className="p-2">{r.oe}</td>
                <td className="p-2">{r.defects}</td>
                <td className="p-2">{r.p_score}</td>
                <td className="p-2">{r.q_score}</td>
                <td className="p-2 font-semibold">{r.day_score}</td>
                <td className="p-2">{r.compliance_code}</td>
                <td className="p-2 flex gap-2">
                  <button onClick={() => approve(r)} className="btn btn-primary">Duyệt</button>
                  <button onClick={() => reject(r)} className="btn bg-red-600 text-white hover:bg-red-700">Từ chối</button>
                </td>
                <td className="p-2">{r.approver_note || ""}</td>
                <td className="p-2">{fmt(r.updated_at || r.created_at)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={12} className="p-4 text-center text-gray-500">
                {approverId ? "Không có bản ghi chờ duyệt." : "Nhập MSNV người duyệt để xem danh sách."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
