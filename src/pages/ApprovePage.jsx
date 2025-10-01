import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ApprovePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("kpi.kpi_entries")
      .select("*")
      .eq("status", "approved")
      .order("approved_at", { ascending: false });
    setLoading(false);
    if (error) return alert("Load lỗi: " + error.message);
    setRows(data || []);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Đã duyệt</h2>
        <button onClick={load} className="btn">{loading ? "Đang tải..." : "Tải lại"}</button>
      </div>

      <div className="mt-4 overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Ngày</th>
              <th className="p-2">MSNV</th>
              <th className="p-2">Họ tên</th>
              <th className="p-2">KPI</th>
              <th className="p-2">Vi phạm</th>
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
                <td className="p-2 font-semibold">{r.day_score}</td>
                <td className="p-2">{r.violations ?? 0}</td>
                <td className="p-2">{r.approved_at ? new Date(r.approved_at).toLocaleString() : ""}</td>
                <td className="p-2">{r.approver_note || ""}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7} className="p-4 text-center text-gray-500">Chưa có bản ghi đã duyệt</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
