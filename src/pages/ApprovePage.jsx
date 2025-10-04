import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";

export default function ApprovePage() {
  const { section } = useKpiSection();
  const isMolding = section === "MOLDING";

  const [msnv, setMsnv] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => { setPage(1); }, [msnv, dateFrom, dateTo, section]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page]);

  async function load() {
    const id = msnv.trim();
    if (!id) return alert("Vui lòng nhập MSNV để tra cứu.");

    const table = isMolding ? "kpi_entries_molding" : "kpi_entries";
    let query = supabase.from(table).select("*").eq("worker_id", id);

    if (dateFrom) query = query.gte("date", dateFrom);
    if (dateTo) query = query.lte("date", dateTo);

    setLoading(true);
    const { data, error } = await query.order("date", { ascending: false });
    setLoading(false);

    if (error) return alert(error.message);
    setRows(data || []);
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Tra cứu đơn KPI ({isMolding ? "Molding" : "Leanline"})</h2>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <input
          className="input"
          placeholder="Nhập MSNV nhân viên"
          value={msnv}
          onChange={(e) => setMsnv(e.target.value)}
        />
        <label>Từ:</label>
        <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <label>Đến:</label>
        <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <button className="btn" onClick={load}>{loading ? "Đang tải..." : "Tải dữ liệu"}</button>
      </div>

      <div className="mb-3">
        <span>Tổng {rows.length} bản ghi</span>
        <button className="btn ml-3" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹ Trước</button>
        <span> Trang {page}/{totalPages} </span>
        <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Sau ›</button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100 text-xs uppercase">
            <tr>
              <th>Ngày</th><th>MSNV</th><th>Họ tên</th><th>Ca</th><th>Loại hàng</th>
              <th>Sản lượng/ca</th><th>Q</th><th>P</th><th>KPI</th><th>Trạng thái</th><th>Ghi chú duyệt</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(r => (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td>{r.date}</td>
                <td>{r.worker_id}</td>
                <td>{r.worker_name}</td>
                <td>{r.ca}</td>
                <td>{r.category}</td>
                <td>{r.output}</td>
                <td>{r.q_score}</td>
                <td>{r.p_score}</td>
                <td>{r.day_score}</td>
                <td className={r.status === "approved" ? "text-green-600" : r.status === "rejected" ? "text-red-600" : "text-gray-600"}>
                  {r.status}
                </td>
                <td>{r.approver_note || ""}</td>
              </tr>
            ))}
            {!pageRows.length && (
              <tr><td colSpan={11} className="p-4 text-center text-gray-500">
                {msnv ? "Không có dữ liệu trong khoảng ngày này." : "Nhập MSNV để xem đơn của bạn."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
