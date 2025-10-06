// src/pages/ReportPage.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";
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
  const { section } = useKpiSection();               // <<— lấy section hiện tại
  const isMolding = section === "MOLDING";

  const viSection = (s) => {
    const k = (s || "").toUpperCase();
    if (k === "MOLDING") return "Molding";
    if (k === "LEANLINE_DC") return "LL Die cut";
    if (k === "LEANLINE_MOLDED") return "LL Molded";
    return s || "";
  };
  const fmtDate = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return `${m}/${d}/${y}`; // M/D/YYYY giống file mẫu
  };                                            
  // ----- bộ lọc -----
  const today = () => new Date().toISOString().slice(0,10);
  const firstDayOfMonth = () => {
    const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0,10);
  };

  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo]     = useState(today());
  const [approverId, setApproverId] = useState(""); // Leanline: approver_id | Molding: approver_msnv
  const [workerId, setWorkerId]     = useState("");
  const [status, setStatus]         = useState("all"); // all|pending|approved|rejected
  const [onlyApproved, setOnlyApproved] = useState(false);
  const [category, setCategory]     = useState(""); // chỉ dùng cho Molding

  // ----- dữ liệu -----
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // ----- options cho Molding -----
  const [catOptions, setCatOptions] = useState([]);
  useEffect(() => {
    if (!isMolding) { setCatOptions([]); return; }
    supabase
      .from("kpi_rule_productivity")
      .select("category")
      .eq("section", "MOLDING")
      .eq("active", true)
      .then(({ data, error }) => {
        if (error) { console.error(error); return; }
        const opts = [...new Set((data || []).map(r => r.category).filter(Boolean))];
        setCatOptions(opts);
      });
  }, [isMolding]);

  // ----- Load dữ liệu -----
  async function runQuery() {
    if (!dateFrom || !dateTo) return alert("Chọn khoảng ngày trước khi xem báo cáo.");
    if (new Date(dateFrom) > new Date(dateTo)) return alert("Khoảng ngày không hợp lệ.");

    const table = isMolding ? "kpi_entries_molding" : "kpi_entries";
    let q = supabase.from(table).select("*").gte("date", dateFrom).lte("date", dateTo);

    // lọc theo section nếu cột section có trong bảng (cả 2 bảng đều có)
    q = q.eq("section", section);

    if (status !== "all") q = q.eq("status", status);
    if (onlyApproved)     q = q.eq("status", "approved");
    if (workerId.trim())  q = q.eq("worker_id", workerId.trim());
    if (approverId.trim()) {
      q = isMolding ? q.eq("approver_msnv", approverId.trim()) : q.eq("approver_id", approverId.trim());
    }
    if (isMolding && category) q = q.eq("category", category);

    setLoading(true);
    const { data, error } = await q.order("date", { ascending: true }).order("worker_id", { ascending: true });
    setLoading(false);
    if (error) return alert("Lỗi tải dữ liệu: " + error.message);
    setRows(data || []);
  }

  // reset khi đổi section
  useEffect(() => {
    setRows([]); setCategory(""); setWorkerId(""); setApproverId(""); setStatus("all"); setOnlyApproved(false);
  }, [section]);

  /* ---------- worker list cho chart ---------- */
  const workerList = useMemo(
    () => Array.from(new Map(rows.map(r => [r.worker_id, r.worker_name || r.worker_id])).entries()),
    [rows]
  ); // [ [id, name] ]
  const [chartWorker, setChartWorker] = useState("");
  useEffect(() => { if (!chartWorker && workerList.length) setChartWorker(workerList[0][0]); }, [workerList, chartWorker]);

  /* ---------- TOP 5 & summary ---------- */
  const top5 = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const cur = map.get(r.worker_id) || { name: r.worker_name || r.worker_id, total: 0, count: 0 };
      cur.total += Number(r.day_score || 0);
      cur.count += 1;
      map.set(r.worker_id, cur);
    }
    const arr = [...map.entries()].map(([id, v]) => ({
      worker_id: id, worker_name: v.name, total: v.total, avg: v.count ? v.total/v.count : 0, days: v.count
    })).sort((a,b) => b.total - a.total);
    return arr.slice(0, 5);
  }, [rows]);

  const summary = useMemo(() => {
    const n = rows.length;
    const total = rows.reduce((s, r) => s + Number(r.day_score || 0), 0);
    const avg = n ? total / n : 0;
    const viol = rows.reduce((s, r) => s + Number(r.violations || (r.compliance_code && r.compliance_code !== "NONE" ? 1 : 0)), 0);
    const workers = new Set(rows.map(r => r.worker_id)).size;
    return { records: n, total, avg, violations: viol, workers };
  }, [rows]);

  /* ---------- Chart (điểm ngày, baseline TB toàn bộ hoặc theo người duyệt) ---------- */
  const [teamMode, setTeamMode] = useState("global"); // global|approver
  const chartData = useMemo(() => {
    if (!chartWorker) return [];
    const byDateAll = new Map();       // date -> {sum,count}
    const byDateApv = new Map();       // date -> {sum,count}
    const workerRows = rows.filter(r => r.worker_id === chartWorker);

    // tìm approver id field đúng theo bảng
    const approverField = isMolding ? "approver_msnv" : "approver_id";
    const workerApprover = workerRows[0]?.[approverField] || (approverId || "");

    for (const r of rows) {
      const k = r.date;
      const g = byDateAll.get(k) || { sum: 0, count: 0 };
      g.sum += Number(r.day_score || 0);
      g.count += 1;
      byDateAll.set(k, g);

      if (workerApprover && r[approverField] === workerApprover) {
        const g2 = byDateApv.get(k) || { sum: 0, count: 0 };
        g2.sum += Number(r.day_score || 0);
        g2.count += 1;
        byDateApv.set(k, g2);
      }
    }

    const idx = new Map(); // date -> {date, worker, avg}
    for (const r of workerRows) idx.set(r.date, { date: r.date, worker: Number(r.day_score || 0) });

    const base = (teamMode === "approver" && workerApprover) ? byDateApv : byDateAll;
    for (const [d, v] of base) {
      const row = idx.get(d) || { date: d };
      row.avg = v.count ? v.sum / v.count : 0;
      idx.set(d, row);
    }
    return [...idx.values()].sort((a,b) => a.date.localeCompare(b.date));
  }, [rows, chartWorker, teamMode, approverId, isMolding]);

  /* ---------- Paging bảng ---------- */
  const [page, setPage] = useState(1);
  const pageSize = 100;
  useEffect(() => { setPage(1); }, [rows]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(() => rows.slice((page-1)*pageSize, page*pageSize), [rows, page]);

  /* ---------- Export XLSX ---------- */
  function exportXLSX() {
    if (!rows.length) return alert("Không có dữ liệu để xuất.");
    const isMolding = section === "MOLDING";
  
    const titleCase = (s) =>
      s ? s.toString().toLowerCase().replace(/^\w/u, (c) => c.toUpperCase()) : "";
    const complianceLabel = (code) => {
      switch ((code || "NONE").toUpperCase()) {
        case "Không vi phạm": return "Không vi phạm";
        case "Ký mẫu đầu chuyền trước khi sử dụng": return "Ký mẫu đầu chuyền trước khi sử dụng";
        case "Quy định về kiểm tra điều kiện máy trước/trong khi sản xuất":  return "Quy định về kiểm tra điều kiện máy trước/trong khi sản xuất";
        case "Quy định về kiểm tra nguyên liệu trước/trong khi sản xuất":  return "Quy định về kiểm tra nguyên liệu trước/trong khi sản xuất";
        case "Quy định về kiểm tra quy cách/tiêu chuẩn sản phẩm trước/trong khi sản xuất": return "Quy định về kiểm tra quy cách/tiêu chuẩn sản phẩm trước/trong khi sản xuất";
        case "Vi phạm nội quy bộ phận/công ty": return "Vi phạm nội quy bộ phận/công ty";
        default:     return code;
      }
    };
    
  
    let data;
    if (isMolding) {
      data = rows.map((r) => {
        const p = Number(r.p_score || 0);
        const q = Number(r.q_score || 0);
        const day = Number(r.day_score || 0);
        const overflow = Number(r.overflow ?? Math.max(0, p + q - 15));
        const total = day + overflow;
        const hasViolation = (r.compliance_code && r.compliance_code !== "NONE") ? 1 : 0;
  
        // Thứ tự cột đúng yêu cầu, thêm “MSNV người duyệt” TRƯỚC “Người duyệt”
        return {
          "VỊ TRÍ LÀM VIỆC": titleCase(viSection(r.section || "MOLDING")),
          "MSNV": r.worker_id || "",
          "HỌ VÀ TÊN": r.worker_name || "",
          "CA LÀM VIỆC": r.ca || "",
          "NGÀY LÀM VIỆC": fmtDate(r.date),
          "THỜI GIAN LÀM VIỆC": Number(r.working_input ?? 0),
          "Số đôi phế": Number(r.defects ?? 0),
          "Điểm chất lượng": q,
          "Sản lượng/ca": Number(r.output ?? 0),
          "Điểm Sản lượng": p,
          "Tuân thủ": complianceLabel(r.compliance_code),
          "Vi phạm": r.compliance_code && r.compliance_code !== "Không vi phạm" ? 1 : 0,
          "Điểm KPI ngày": day,
          "Điểm dư": overflow,
          "Điểm tổng": total,
          "Loại hàng": r.category || "",
          "Số giờ khuôn chạy thực tế": Number(r.mold_hours ?? 0),
          "Thời gian dừng /24 khuôn (h)": Number(r.downtime ?? 0),
          "MSNV người duyệt": r.approver_msnv || "",
          "Người duyệt": r.approver_name || ""
        };
      });
    } else {
      // Leanline DC & Leanline Molded – đúng header như ảnh bạn gửi
      data = rows.map((r) => {
        const p = Number(r.p_score || 0);
        const q = Number(r.q_score || 0);
        const day = Number(r.day_score || 0);
        const overflow = Number(r.overflow ?? Math.max(0, p + q - 15));
        const totalMonth = day + overflow; // theo file mẫu: 15 + 3 = 18
        const hasViolation = (r.compliance_code && r.compliance_code !== "NONE") ? 1 : 0;
  
        return {
          "VỊ TRÍ LÀM VIỆC": titleCase(viSection(r.section || "")),
          "MSNV": r.worker_id || "",
          "HỌ VÀ TÊN": r.worker_name || "",
          "CA LÀM VIỆC": r.ca || "",
          "NGÀY LÀM VIỆC": fmtDate(r.date),
          "THỜI GIAN LÀM VIỆC": Number(r.working_input ?? r.work_hours ?? 0),
          "Số đôi phế": Number(r.defects ?? 0),
          "Điểm chất lượng": q,
          "%OE": Number(r.oe ?? 0),
          "Điểm sản lượng": p,
          "Tuân thủ": complianceLabel(r.compliance_code),
          "Vi phạm": r.compliance_code && r.compliance_code !== "Không vi phạm" ? 1 : 0,
          "Điểm KPI ngày": day,
          "Điểm dư": overflow,
          "Điểm KPI tổng tháng": totalMonth,
          "THỜI GIAN DOWNTIME": Number(r.downtime ?? 0),
          "MSNV người duyệt": r.approver_id || "",
          "Họ và Tên Người duyệt": r.approver_name || "",
          "Line làm việc": r.line || ""
        };
      });
    }
  
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isMolding ? "Molding" : "Leanline");
    XLSX.writeFile(wb, `kpi_report_${section}_${dateFrom}_to_${dateTo}.xlsx`);
  }

  const fmt = (n, d=2) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString("en-US",{maximumFractionDigits:d}) : "");

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-semibold">Báo cáo KPI – {isMolding ? "Molding" : "Leanline"}</h2>

      {/* Bộ lọc */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        <label> Từ ngày
          <input type="date" className="input" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
        </label>
        <label> Đến ngày
          <input type="date" className="input" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
        </label>

        <label> MSNV người duyệt (tuỳ chọn)
          <input className="input" value={approverId} onChange={e=>setApproverId(e.target.value)} placeholder={isMolding ? "VD: 04126 (approver_msnv)" : "VD: 04126 (approver_id)"} />
        </label>

        <label> MSNV nhân viên (tuỳ chọn)
          <input className="input" value={workerId} onChange={e=>setWorkerId(e.target.value)} placeholder="VD: 04126" />
        </label>

        {isMolding && (
          <label> Loại hàng
            <select className="input" value={category} onChange={e=>setCategory(e.target.value)}>
              <option value="">-- Tất cả --</option>
              {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}

        <label> Trạng thái
          <select className="input" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
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
        <SummaryCard title="Điểm tổng"  value={summary.total.toFixed(1)} />
        <SummaryCard title="Điểm TB"    value={summary.avg.toFixed(2)} />
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
                <Line type="monotone" dataKey="avg"    name="TB baseline" stroke="#10b981" dot={false} />
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

      {/* Bảng dữ liệu chi tiết */}
      <div>
        <div className="mb-2 flex items-center gap-3">
          <span>Kết quả: {rows.length} dòng</span>
          <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹ Trước</button>
          <span>Trang {page}/{totalPages}</span>
          <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Sau ›</button>
        </div>

        <div className="overflow-auto">
          {isMolding ? (
            <table className="min-w-[1050px] text-sm">
              <thead className="bg-gray-100 text-xs uppercase">
                <tr>
                  <th className="p-2 text-center">Ngày</th>
                  <th className="p-2 text-center">MSNV</th>
                  <th className="p-2 text-center">Họ tên</th>
                  <th className="p-2 text-center">Ca</th>
                  <th className="p-2 text-center">Loại hàng</th>
                  <th className="p-2 text-center">Sản lượng/ca</th>
                  <th className="p-2 text-center">P</th>
                  <th className="p-2 text-center">Q</th>
                  <th className="p-2 text-center">KPI</th>
                  <th className="p-2 text-center">Duyệt</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={`${r.worker_id}-${r.date}-${i}`} className="border-b hover:bg-gray-50">
                    <td className="p-2 text-center">{r.date}</td>
                    <td className="p-2 text-center">{r.worker_id}</td>
                    <td className="p-2 text-center">{r.worker_name}</td>
                    <td className="p-2 text-center">{r.ca}</td>
                    <td className="p-2 text-center">{r.category}</td>
                    <td className="p-2 text-center">{fmt(r.output, 0)}</td>
                    <td className="p-2 text-center">{fmt(r.p_score, 2)}</td>
                    <td className="p-2 text-center">{fmt(r.q_score, 2)}</td>
                    <td className="p-2 text-center font-semibold">{fmt(r.day_score, 2)}</td>
                    <td className="p-2 text-center">{r.status}</td>
                  </tr>
                ))}
                {!pageRows.length && (
                  <tr><td colSpan={10} className="p-4 text-center text-gray-500">Không có dữ liệu</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-[1100px] text-sm">
              <thead className="bg-gray-100 text-xs uppercase">
                <tr>
                  <th className="p-2 text-center">Ngày</th>
                  <th className="p-2 text-center">MSNV</th>
                  <th className="p-2 text-center">Họ tên</th>
                  <th className="p-2 text-center">Line</th>
                  <th className="p-2 text-center">Ca</th>
                  <th className="p-2 text-center">%OE</th>
                  <th className="p-2 text-center">Phế</th>
                  <th className="p-2 text-center">P</th>
                  <th className="p-2 text-center">Q</th>
                  <th className="p-2 text-center">KPI</th>
                  <th className="p-2 text-center">Duyệt</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={`${r.worker_id}-${r.date}-${i}`} className="border-b hover:bg-gray-50">
                    <td className="p-2 text-center">{r.date}</td>
                    <td className="p-2 text-center">{r.worker_id}</td>
                    <td className="p-2 text-center">{r.worker_name}</td>
                    <td className="p-2 text-center">{r.line}</td>
                    <td className="p-2 text-center">{r.ca}</td>
                    <td className="p-2 text-center">{fmt(r.oe, 2)}</td>
                    <td className="p-2 text-center">{fmt(r.defects, 0)}</td>
                    <td className="p-2 text-center">{fmt(r.p_score, 2)}</td>
                    <td className="p-2 text-center">{fmt(r.q_score, 2)}</td>
                    <td className="p-2 text-center font-semibold">{fmt(r.day_score, 2)}</td>
                    <td className="p-2 text-center">{r.status}</td>
                  </tr>
                ))}
                {!pageRows.length && (
                  <tr><td colSpan={11} className="p-4 text-center text-gray-500">Không có dữ liệu</td></tr>
                )}
              </tbody>
            </table>
          )}
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
