// src/pages/ReportPage.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import * as XLSX from "xlsx";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from "recharts";

/* =============== Gate đăng nhập =============== */
export default function ReportPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("rp_authed") === "1");
  const [pwd, setPwd] = useState("");

  function tryLogin(e) {
    e?.preventDefault();
    if (pwd === "davidtu") {
      sessionStorage.setItem("rp_authed", "1");
      setAuthed(true);
    } else {
      alert("Sai mật khẩu.");
    }
  }

  if (!authed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <form onSubmit={tryLogin} className="w-full max-w-sm p-6 rounded-xl shadow bg-white">
          <h2 className="text-xl font-semibold mb-4">Báo cáo KPI</h2>
          <label className="block mb-2">Mật khẩu</label>
          <input
            type="password"
            className="input w-full"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="..."
          />
          <button className="btn btn-primary mt-4 w-full" type="submit">Đăng nhập</button>
        </form>
      </div>
    );
  }

  return <ReportContent />;
}

/* =============== Trang báo cáo =============== */
function ReportContent() {
  // ----- bộ lọc -----
  const [dateFrom, setDateFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [dateTo, setDateTo]     = useState(() => new Date().toISOString().slice(0,10));
  const [approverId, setApproverId] = useState("");
  const [workerId, setWorkerId]     = useState("");
  const [onlyApproved, setOnlyApproved] = useState(true);

  // ----- dữ liệu -----
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // ----- lựa chọn biểu đồ -----
  const workerList = useMemo(
    () => Array.from(new Map(rows.map(r => [r.worker_id, r.worker_name || r.worker_id])).entries()),
    [rows]
  ); // [ [id, name] ]

  const [chartWorker, setChartWorker] = useState("");
  const [teamMode, setTeamMode] = useState("global"); // global|approver

  useEffect(() => {
    // nếu chưa chọn thì auto pick worker đầu tiên trong kết quả
    if (!chartWorker && workerList.length) setChartWorker(workerList[0][0]);
  }, [workerList, chartWorker]);

  async function runQuery() {
    if (!dateFrom || !dateTo) return alert("Chọn khoảng ngày trước khi xem báo cáo.");
    if (new Date(dateFrom) > new Date(dateTo)) return alert("Khoảng ngày không hợp lệ.");

    setLoading(true);
    let q = supabase
      .from("kpi_entries")
      .select("*")
      .gte("date", dateFrom)
      .lte("date", dateTo);

    if (onlyApproved) q = q.eq("status", "approved");
    if (approverId.trim()) q = q.eq("approver_id", approverId.trim());
    if (workerId.trim())   q = q.eq("worker_id", workerId.trim());

    q = q.order("date", { ascending: true }).order("worker_id", { ascending: true });

    const { data, error } = await q;
    setLoading(false);
    if (error) return alert("Lỗi tải dữ liệu: " + error.message);
    setRows(data || []);
  }

  /* ----- Bảng xếp hạng TOP 5 theo tổng điểm ----- */
  const top5 = useMemo(() => {
    const map = new Map(); // worker_id -> { name, total, count, avg }
    for (const r of rows) {
      const cur = map.get(r.worker_id) || { name: r.worker_name || r.worker_id, total: 0, count: 0 };
      cur.total += Number(r.day_score || 0);
      cur.count += 1;
      map.set(r.worker_id, cur);
    }
    const arr = Array.from(map.entries()).map(([id, v]) => ({
      worker_id: id,
      worker_name: v.name,
      total: v.total,
      avg: v.count ? (v.total / v.count) : 0,
      days: v.count,
    }));
    arr.sort((a,b) => b.total - a.total);
    return arr.slice(0, 5);
  }, [rows]);

  /* ----- Số liệu tổng hợp nhanh ----- */
  const summary = useMemo(() => {
    const n = rows.length;
    const total = rows.reduce((s, r) => s + Number(r.day_score || 0), 0);
    const avg = n ? (total / n) : 0;
    const viol = rows.reduce((s, r) => s + Number(r.violations || (r.compliance_code && r.compliance_code !== "NONE" ? 1 : 0)), 0);
    const workers = new Set(rows.map(r => r.worker_id)).size;
    return { records: n, total, avg, violations: viol, workers };
  }, [rows]);

  /* ----- Dữ liệu vẽ chart (nhân viên vs trung bình) ----- */
  const chartData = useMemo(() => {
    if (!chartWorker) return [];
    const byDate = new Map(); // date -> {sum, count}
    const byDateApprover = new Map(); // date -> {sum, count} chỉ tính theo approver tương ứng

    // Tìm approver của worker được chọn (từ data) — nếu không có, dùng approver filter
    const workerRows = rows.filter(r => r.worker_id === chartWorker);
    const workerApprover = workerRows[0]?.approver_id || (approverId || "");

    // gom toàn bộ (global)
    for (const r of rows) {
      const k = r.date;
      const g = byDate.get(k) || { sum: 0, count: 0 };
      g.sum += Number(r.day_score || 0);
      g.count += 1;
      byDate.set(k, g);

      if (!workerApprover) continue;
      if (r.approver_id === workerApprover) {
        const g2 = byDateApprover.get(k) || { sum: 0, count: 0 };
        g2.sum += Number(r.day_score || 0);
        g2.count += 1;
        byDateApprover.set(k, g2);
      }
    }

    const idx = new Map(); // date -> {date, worker, avg}
    for (const r of workerRows) idx.set(r.date, { date: r.date, worker: Number(r.day_score || 0) });

    // baseline
    for (const [d, v] of (teamMode === "approver" && workerApprover ? byDateApprover : byDate)) {
      const row = idx.get(d) || { date: d };
      row.avg = v.count ? (v.sum / v.count) : 0;
      idx.set(d, row);
    }

    // sắp xếp theo ngày
    return Array.from(idx.values()).sort((a,b) => a.date.localeCompare(b.date));
  }, [rows, chartWorker, teamMode, approverId]);

  /* ----- Bảng dữ liệu với phân trang đơn giản ----- */
  const [page, setPage] = useState(1);
  const pageSize = 100;
  useEffect(() => { setPage(1); }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page]
  );

  /* ----- Xuất XLSX ----- */
 
  function exportXLSX() {
    if (!rows.length) return alert("Không có dữ liệu để xuất.");

    // Đảm bảo ID là string để giữ 0 đầu
    const data = rows.map(r => ({
      date: r.date,
      worker_id: String(r.worker_id),       // 👈 string
      worker_name: r.worker_name,
      approver_id: String(r.approver_id),   // 👈 string
      approver_name: r.approver_name,
      line: r.line, ca: r.ca,
      work_hours: r.work_hours,
      stop_hours: r.stop_hours,
      defects: r.defects, oe: r.oe,
      p_score: r.p_score, q_score: r.q_score, day_score: r.day_score,
      overflow: r.overflow, compliance_code: r.compliance_code,
      violations: r.violations, status: r.status,
      approved_at: r.approved_at, created_at: r.created_at, updated_at: r.updated_at,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KPI");
    XLSX.writeFile(wb, `kpi_report_${dateFrom}_to_${dateTo}.xlsx`);
  }


  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-semibold">Báo cáo KPI</h2>

      {/* Bộ lọc */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        <label> Từ ngày
          <input type="date" className="input" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
        </label>
        <label> Đến ngày
          <input type="date" className="input" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
        </label>
        <label> MSNV người duyệt (tuỳ chọn)
          <input className="input" value={approverId} onChange={e=>setApproverId(e.target.value)} placeholder="VD: A101" />
        </label>
        <label> MSNV worker (tuỳ chọn)
          <input className="input" value={workerId} onChange={e=>setWorkerId(e.target.value)} placeholder="VD: W001" />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={onlyApproved} onChange={e=>setOnlyApproved(e.target.checked)} />
          Chỉ xem bản ghi đã duyệt
        </label>
        <div className="flex items-end gap-2">
          <button className="btn btn-primary" onClick={runQuery}>{loading ? "Đang tải..." : "Xem báo cáo"}</button>
          <button className="btn" onClick={exportXLSX} disabled={!rows.length}>Xuất XLSX</button>
        </div>
      </div>

      {/* Summary nhanh */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard title="Số bản ghi" value={summary.records} />
        <SummaryCard title="Điểm tổng" value={summary.total.toFixed(1)} />
        <SummaryCard title="Điểm TB" value={summary.avg.toFixed(2)} />
        <SummaryCard title="Số vi phạm" value={summary.violations} />
        <SummaryCard title="Số nhân viên" value={summary.workers} />
      </div>

      {/* Chart */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            Nhân viên:
            <select className="input" value={chartWorker} onChange={e=>setChartWorker(e.target.value)}>
              {workerList.map(([id, name]) => (
                <option key={id} value={id}>{id} — {name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Baseline:
            <select className="input" value={teamMode} onChange={e=>setTeamMode(e.target.value)}>
              <option value="global">Trung bình toàn bộ</option>
              <option value="approver">Trung bình theo người duyệt</option>
            </select>
          </label>
        </div>

        <div className="w-full h-72 border rounded">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 15]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="worker" name="Điểm NV" stroke="#3b82f6" dot={false} />
                <Line type="monotone" dataKey="avg" name="TB team" stroke="#10b981" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">Chưa có dữ liệu để vẽ</div>
          )}
        </div>
      </div>

      {/* TOP 5 */}
      <div>
        <h3 className="font-semibold mb-2">TOP 5 tổng điểm cao nhất</h3>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">#</th>
                <th className="p-2">MSNV</th>
                <th className="p-2">Họ tên</th>
                <th className="p-2">Số ngày</th>
                <th className="p-2">Điểm tổng</th>
                <th className="p-2">Điểm TB</th>
              </tr>
            </thead>
            <tbody>
              {top5.map((r, i) => (
                <tr key={r.worker_id} className="border-b">
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2">{r.worker_id}</td>
                  <td className="p-2">{r.worker_name}</td>
                  <td className="p-2">{r.days}</td>
                  <td className="p-2">{r.total.toFixed(1)}</td>
                  <td className="p-2">{r.avg.toFixed(2)}</td>
                </tr>
              ))}
              {!top5.length && <tr><td colSpan={6} className="p-4 text-center text-gray-500">Không có dữ liệu</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bảng dữ liệu */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span>Kết quả: {rows.length} dòng</span>
          <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹ Trước</button>
          <span>Trang {page}/{totalPages}</span>
          <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Sau ›</button>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[900px] text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Ngày</th>
                <th className="p-2">MSNV</th>
                <th className="p-2">Họ tên</th>
                <th className="p-2">Người duyệt</th>
                <th className="p-2">Line</th>
                <th className="p-2">Ca</th>
                <th className="p-2">%OE</th>
                <th className="p-2">Phế</th>
                <th className="p-2">P</th>
                <th className="p-2">Q</th>
                <th className="p-2">KPI</th>
                <th className="p-2">Vi phạm</th>
                <th className="p-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={`${r.worker_id}-${r.date}-${i}`} className="border-b">
                  <td className="p-2">{r.date}</td>
                  <td className="p-2">{r.worker_id}</td>
                  <td className="p-2">{r.worker_name}</td>
                  <td className="p-2">{r.approver_id}</td>
                  <td className="p-2">{r.line}</td>
                  <td className="p-2">{r.ca}</td>
                  <td className="p-2">{r.oe}</td>
                  <td className="p-2">{r.defects}</td>
                  <td className="p-2">{r.p_score}</td>
                  <td className="p-2">{r.q_score}</td>
                  <td className="p-2 font-semibold">{r.day_score}</td>
                  <td className="p-2">{r.compliance_code}</td>
                  <td className="p-2">{r.status}</td>
                </tr>
              ))}
              {!pageRows.length && <tr><td colSpan={13} className="p-4 text-center text-gray-500">Chưa có dữ liệu</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div className="p-3 rounded border bg-white">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
