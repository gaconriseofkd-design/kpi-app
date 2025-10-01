import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Pending() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("kpi_entries")
      .select("*")
      .eq("status", "pending")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return alert("Load lỗi: " + error.message);
    setRows(data || []);
  }

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

  useEffect(() => { load(); }, []);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Danh sách chờ duyệt</h2>
        <button onClick={load} className="btn">{loading ? "Đang tải..." : "Tải lại"}</button>
      </div>

      <div className="mt-4 overflow-auto">
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
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={10} className="p-4 text-center text-gray-500">Chưa có bản ghi chờ duyệt</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
