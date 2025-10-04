import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";

export default function ApprovePage() {
  const { section } = useKpiSection();
  const isMolding = section === "MOLDING";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    const table = isMolding ? "kpi_entries_molding" : "kpi_entries";
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("status", "pending")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    setLoading(false);
    if (error) return alert(error.message);
    setRows(data || []);
  }
  useEffect(() => { load(); }, [section]);

  async function approve(row) {
    const note = prompt("Ghi chú (tuỳ chọn):", "");
    const violations = row?.compliance_code === "NONE" ? 0 : 1;
    const table = isMolding ? "kpi_entries_molding" : "kpi_entries";
    const { error } = await supabase
      .from(table)
      .update({ status: "approved", violations, approver_note: note || null, approved_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return alert("Duyệt lỗi: " + error.message);
    load();
  }

  async function reject(row) {
    const note = prompt("Lý do từ chối:", "");
    const table = isMolding ? "kpi_entries_molding" : "kpi_entries";
    const { error } = await supabase
      .from(table)
      .update({ status: "rejected", approver_note: note || null, approved_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return alert("Từ chối lỗi: " + error.message);
    load();
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Tra cứu đơn KPI ({isMolding ? "Molding" : "Leanline"})</h2>
        <button className="btn" onClick={load}>{loading ? "Đang tải..." : "Tải lại"}</button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100 text-xs uppercase">
            {isMolding ? (
              <tr>
                <th>MSNV</th>
                <th>Họ tên</th>
                <th>Người duyệt</th>
                <th>Ngày</th>
                <th>Ca</th>
                <th>Loại hàng</th>
                <th>Giờ nhập</th>
                <th>Giờ thực tế</th>
                <th>Giờ chính xác</th>
                <th>Khuôn chạy</th>
                <th>Downtime</th>
                <th>Sản lượng/ca</th>
                <th>Phế</th>
                <th>Q</th>
                <th>P</th>
                <th>KPI ngày</th>
                <th>Dư</th>
                <th>Tuân thủ</th>
                <th style={{width:120}}>Thao tác</th>
              </tr>
            ) : (
              <tr>
                <th>MSNV</th>
                <th>Họ tên</th>
                <th>Ngày</th>
                <th>Ca</th>
                <th>%OE</th>
                <th>Điểm NS</th>
                <th>Điểm CL</th>
                <th>KPI ngày</th>
                <th>Tuân thủ</th>
                <th style={{width:120}}>Thao tác</th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={22} className="text-center p-4">Không có dữ liệu</td></tr>
            )}
            {rows.map((r) => isMolding ? (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td>{r.worker_id}</td>
                <td>{r.worker_name}</td>
                <td>{r.approver_name}</td>
                <td>{r.date}</td>
                <td>{r.ca}</td>
                <td>{r.category}</td>
                <td>{r.working_input}</td>
                <td>{r.working_real}</td>
                <td>{r.working_exact}</td>
                <td>{r.mold_hours}</td>
                <td>{r.downtime}</td>
                <td>{r.output}</td>
                <td>{r.defects}</td>
                <td>{r.q_score}</td>
                <td>{r.p_score}</td>
                <td>{r.day_score}</td>
                <td>{r.overflow}</td>
                <td>{r.compliance_code}</td>
                <td className="space-x-2">
                  <button className="btn btn-primary btn-sm" onClick={() => approve(r)}>Duyệt</button>
                  <button className="btn bg-red-600 text-white hover:bg-red-700 btn-sm" onClick={() => reject(r)}>Từ chối</button>
                </td>
              </tr>
            ) : (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td>{r.msnv || r.worker_id}</td>
                <td>{r.hoten || r.worker_name}</td>
                <td>{r.work_date || r.date}</td>
                <td>{r.shift || r.ca}</td>
                <td>{r.oe}</td>
                <td>{r.productivity || r.p_score}</td>
                <td>{r.quality || r.q_score}</td>
                <td>{r.total_score || r.day_score}</td>
                <td>{r.compliance || r.compliance_code}</td>
                <td className="space-x-2">
                  <button className="btn btn-primary btn-sm" onClick={() => approve(r)}>Duyệt</button>
                  <button className="btn bg-red-600 text-white hover:bg-red-700 btn-sm" onClick={() => reject(r)}>Từ chối</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
