import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

function fmt(dt) {
  if (!dt) return "";
  try { return new Date(dt).toLocaleString(); } catch { return String(dt); }
}

export default function ApprovePage() {
  const [workerId, setWorkerId] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!workerId.trim()) {
      setRows([]);
      return alert("Nhập MSNV nhân viên để tra cứu.");
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("kpi_entries")
      .select("*")
      .eq("worker_id", workerId.trim())
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return alert("Lỗi tra cứu: " + error.message);
    setRows(data || []);
  }

  function onKey(e) { if (e.key === "Enter") search(); }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-3">Xét duyệt KPI (tra cứu đơn của bạn)</h2>

      <div className="flex gap-2 items-center mb-4">
        <input
          className="input"
          placeholder="Nhập MSNV nhân viên (VD: W001)"
          value={workerId}
          onChange={(e) => setWorkerId(e.target.value)}
          onKeyDown={onKey}
        />
        <button onClick={search} className="btn btn-primary">
          {loading ? "Đang tải..." : "Tìm"}
        </button>
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
              <th className="p-2">Trạng thái</th>
              <th className="p-2">Duyệt lúc</th>
              <th className="p-2">Ghi chú</th>
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
                <td className="p-2">
                  <span className={
                    r.status === "approved" ? "text-green-600" :
                    r.status === "rejected" ? "text-red-600" : "text-yellow-600"
                  }>
                    {r.status}
                  </span>
                </td>
                <td className="p-2">{fmt(r.approved_at)}</td>
                <td className="p-2">{r.approver_note || ""}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={11} className="p-4 text-center text-gray-500">
                {workerId ? "Không có bản ghi." : "Nhập MSNV để tra cứu."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
