// src/pages/ReportPage.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";
import * as XLSX from "xlsx";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from "recharts";

/* =============== Helper Logic =============== */
const HYBRID_SECTIONS = ["LAMINATION", "PREFITTING", "BÀO", "TÁCH"];
const isHybridSection = (s) => HYBRID_SECTIONS.includes(s);

function getTableName(s) {
  const sectionKey = (s || "").toUpperCase();
  if (sectionKey === "MOLDING") return "kpi_entries_molding";
  if (isHybridSection(sectionKey)) return "kpi_lps_entries"; // FIX: Tên bảng viết thường
  return "kpi_entries"; // Leanline DC & Leanline Molded
}

/** Helper: Tạo danh sách tất cả các ngày trong khoảng */
function getAllDatesInRange(start, end) {
  const dates = [];
  let currentDate = new Date(start);
  const endDate = new Date(end);
  
  while (currentDate <= endDate) {
    dates.push(currentDate.toISOString().slice(0, 10));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
}

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
  const { section } = useKpiSection();               
  const isMolding = section === "MOLDING";
  const isHybrid = isHybridSection(section);
  const tableName = getTableName(section);

  const today = () => new Date().toISOString().slice(0,10);
  const firstDayOfMonth = () => {
    const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0,10);
  };
  
  // ----- 1. State Declarations -----
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo]     = useState(today());
  const [approverId, setApproverId] = useState(""); 
  const [workerId, setWorkerId]     = useState("");
  const [status, setStatus]         = useState("all");
  const [onlyApproved, setOnlyApproved] = useState(false);
  const [category, setCategory]     = useState(""); 
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [catOptions, setCatOptions] = useState([]);
  const [missingPage, setMissingPage] = useState(1);
  
  // States liên quan đến Chart/Table
  const [chartWorker, setChartWorker] = useState("");
  const [teamMode, setTeamMode] = useState("global");
  const [page, setPage] = useState(1);
  const [approverWorkers, setApproverWorkers] = useState([]); // DANH SÁCH NV DƯỚI QUYỀN
  const pageSize = 100;
  const missingPageSize = 10; // Kích thước trang cho Báo cáo thiếu KPI


  // ----- 2. Helpers & Derived States (useMemo Hooks) -----
  const viSection = (s) => {
    const k = (s || "").toUpperCase();
    if (k === "MOLDING") return "Molding";
    if (k === "LAMINATION") return "Lamination";
    if (k === "PREFITTING") return "Prefitting";
    if (k === "BÀO") return "Bào";
    if (k === "TÁCH") return "Tách";
    if (k === "LEANLINE_DC") return "LL Die cut";
    if (k === "LEANLINE_MOLDED") return "LL Molded";
    return s || "";
  };
  const fmtDate = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    return `${m}/${d}/${y}`;
  };  
  const fmt = (n, d=2) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString("en-US",{maximumFractionDigits:d}) : "");

  const workerOptions = useMemo(() => {
    return Array.from(new Map(rows.map(r => [r.worker_id, r.worker_name || r.worker_id])).entries());
  }, [rows]); 

  const totalPages = useMemo(() => Math.max(1, Math.ceil(rows.length / pageSize)), [rows.length]);
  const pageRows = useMemo(() => rows.slice((page-1)*pageSize, page*pageSize), [rows, page]);

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

  const chartData = useMemo(() => {
    if (!chartWorker) return [];
    const byDateAll = new Map();       
    const byDateApv = new Map();       
    const workerRows = rows.filter(r => r.worker_id === chartWorker);

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

    const idx = new Map(); 
    for (const r of workerRows) idx.set(r.date, { date: r.date, worker: Number(r.day_score || 0) });

    const base = (teamMode === "approver" && workerApprover) ? byDateApv : byDateAll;
    for (const [d, v] of base) {
      const row = idx.get(d) || { date: d };
      row.avg = v.count ? v.sum / v.count : 0;
      idx.set(d, row);
    }
    return [...idx.values()].sort((a,b) => a.date.localeCompare(b.date));
  }, [rows, chartWorker, teamMode, approverId, isMolding]);
  
  const missingReportFull = useMemo(() => {
    // FIX: LOẠI BỎ ĐIỀU KIỆN || !rows.length 
    if (!approverWorkers.length || !dateFrom || !dateTo) return [];

    const submittedMap = new Map(); 
    // Lấp đầy submittedMap. Nếu rows rỗng, map này cũng rỗng, là đúng.
    for (const r of rows) {
        if (!submittedMap.has(r.worker_id)) {
            submittedMap.set(r.worker_id, new Set());
        }
        submittedMap.get(r.worker_id).add(r.date);
    }
    
    const allDates = getAllDatesInRange(dateFrom, dateTo);
    
    const report = [];
    approverWorkers.forEach(w => {
        const submittedDates = submittedMap.get(w.msnv) || new Set();
        const missingDates = allDates.filter(d => !submittedDates.has(d));
        
        if (missingDates.length > 0) {
            report.push({
                msnv: w.msnv,
                name: w.full_name,
                missing: missingDates.join(", "),
                missingCount: missingDates.length,
                totalDays: allDates.length
            });
        }
    });

    return report.sort((a, b) => b.missingCount - a.missingCount); // Sắp xếp giảm dần theo số ngày thiếu
  }, [approverWorkers, rows, dateFrom, dateTo]);

  const missingReportPaged = useMemo(() => {
    const start = (missingPage - 1) * missingPageSize;
    const end = start + missingPageSize;
    return missingReportFull.slice(start, end);
  }, [missingReportFull, missingPage]);

  const missingTotalPages = useMemo(() => Math.max(1, Math.ceil(missingReportFull.length / missingPageSize)), [missingReportFull.length]);


  // ----- 3. Effects & Data Fetching (useEffect Hooks) -----
  useEffect(() => {
    // 1. Load Category Options
    if (!isMolding && !isHybrid) { setCatOptions([]); setCategory(""); return; }
    
    supabase
      .from("kpi_rule_productivity")
      .select("category")
      .eq("section", section.toUpperCase()) 
      .eq("active", true)
      .then(({ data, error }) => {
        if (error) { console.error(error); return; }
        const opts = [...new Set((data || []).map(r => r.category).filter(Boolean))];
        setCatOptions(opts.sort());
      });
  }, [section, isMolding, isHybrid]);
  
  useEffect(() => {
    // 2. Load Workers by Approver (for Missing KPI Report)
    const id = approverId.trim();
    if (!id) { setApproverWorkers([]); return; }

    const approverCol = isMolding ? "approver_msnv" : "approver_id";

    supabase.from("users")
        .select("msnv, full_name")
        .eq(approverCol, id)
        .then(({ data, error }) => {
            if (error) { console.error("Error loading approver workers:", error); return; }
            setApproverWorkers(data || []);
        });
  }, [approverId, isMolding]);

  useEffect(() => { if (!chartWorker && workerOptions.length) setChartWorker(workerOptions[0]?.[0] || ""); }, [workerOptions]);
  
  useEffect(() => { setPage(1); setMissingPage(1); }, [rows]);
  
  useEffect(() => {
    setRows([]); setCategory(""); setWorkerId(""); setApproverId(""); setStatus("all"); setOnlyApproved(false);
    setMissingPage(1);
  }, [section]);
  
  useEffect(() => { setMissingPage(1); }, [approverId, dateFrom, dateTo]);

  // ----- Load dữ liệu Function -----
  async function runQuery() {
    if (!dateFrom || !dateTo) return alert("Chọn khoảng ngày trước khi xem báo cáo.");
    if (new Date(dateFrom) > new Date(dateTo)) return alert("Khoảng ngày không hợp lệ.");

    let q = supabase.from(tableName).select("*").gte("date", dateFrom).lte("date", dateTo);

    q = q.eq("section", section);

    if (status !== "all") q = q.eq("status", status);
    if (onlyApproved)     q = q.eq("status", "approved");
    if (workerId.trim())  q = q.eq("worker_id", workerId.trim());
    
    if (approverId.trim()) {
      const approverCol = isMolding ? "approver_msnv" : "approver_id";
      q = q.eq(approverCol, approverId.trim());
      
      // Nếu có MSNV người duyệt, chúng ta không dùng workerId cho việc lọc rows, 
      // mà dùng để lọc biểu đồ/tổng hợp sau này. Tuy nhiên, nếu workerId là null, ta không nên lọc
      // Nếu workerId có giá trị, nó sẽ tự động lọc rows, giữ lại tính năng lọc đơn
    }
    
    if ((isMolding || isHybrid) && category) q = q.eq("category", category);

    setLoading(true);
    const { data, error } = await q.order("worker_id", { ascending: true }).order("date", { ascending: true });
    setLoading(false);
    if (error) return alert("Lỗi tải dữ liệu: " + error.message);
    setRows(data || []);
  }

  // ----- Export XLSX Function -----
  function exportXLSX() {
    if (!rows.length) return alert("Không có dữ liệu để xuất.");
  
    const titleCase = (s) =>
      s ? s.toString().toLowerCase().replace(/^\w/u, (c) => c.toUpperCase()) : "";
    const complianceLabel = (code) => {
      switch ((code || "NONE").toUpperCase()) {
        case "NONE": return "Không vi phạm";
        case "KÝ MẪU ĐẦU CHUYỀN TRƯỚC KHI SỬ DỤNG":
        case "LATE": return "Ký mẫu đầu chuyền trước khi sử dụng";
        case "QUY ĐỊNH VỀ KIỂM TRA ĐIỀU KIỆN MÁY TRƯỚC/TRONG KHI SẢN XUẤT":
        case "PPE":  return "Quy định về kiểm tra điều kiện máy trước/trong khi sản xuất";
        case "QUY ĐỊNH VỀ KIỂM TRA NGUYÊN LIỆU TRƯỚC/TRONG KHI SẢN XUẤT":
        case "MAT":  return "Quy định về kiểm tra nguyên liệu trước/trong khi sản xuất";
        case "QUY ĐỊNH VỀ KIỂM TRA QUY CÁCH/TIÊU CHUẨN SẢN PHẨM TRƯỚC/TRONG KHI SẢN XUẤT":
        case "SPEC": return "Quy định về kiểm tra quy cách/tiêu chuẩn sản phẩm trước/trong khi sản xuất";
        case "VI PHẠM NỘI QUY BỘ PHẬN/CÔNG TY":
        case "RULE": return "Vi phạm nội quy bộ phận/công ty";
        default:     return code;
      }
    };
    
  
    let data;
    if (isMolding) {
      // Logic Export Molding
      data = rows.map((r) => {
        const p = Number(r.p_score || 0);
        const q = Number(r.q_score || 0);
        const day = Number(r.day_score || 0);
        const overflow = Number(r.overflow ?? Math.max(0, p + q - 15));
        const total = day + overflow;
  
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
          "Vi phạm": r.violations || (r.compliance_code && r.compliance_code !== "NONE" ? 1 : 0),
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
    } else if (isHybrid) {
      // Logic Export HYBRID (LAMINATION, PREFITTING, BÀO, TÁCH)
      data = rows.map((r) => {
        const p = Number(r.p_score || 0);
        const q = Number(r.q_score || 0);
        const day = Number(r.day_score || 0);
        const overflow = Number(r.overflow ?? Math.max(0, p + q - 15));
        const exactHours = Math.max(0, Number(r.working_real || 0) - Number(r.stop_hours || 0));
        const prodRate = exactHours > 0 ? Number(r.output || 0) / exactHours : 0;
  
        return {
          "VỊ TRÍ LÀM VIỆC": titleCase(viSection(r.section || "")),
          "MSNV": r.worker_id || "",
          "HỌ VÀ TÊN": r.worker_name || "",
          "CA LÀM VIỆC": r.ca || "",
          "NGÀY LÀM VIỆC": fmtDate(r.date),
          "THỜI GIAN LÀM VIỆC (Nhập)": Number(r.work_hours ?? 0),
          "THỜI GIAN THỰC TẾ (Quy đổi)": Number(r.working_real ?? 0),
          "THỜI GIAN CHÍNH XÁC": exactHours,
          "Số đôi phế": Number(r.defects ?? 0),
          "Điểm chất lượng": q,
          "Sản lượng (Output)": Number(r.output ?? 0),
          "Tỷ lệ Năng suất": Number(prodRate),
          "Loại năng suất": r.category || "",
          "Điểm Sản lượng": p,
          "Tuân thủ": complianceLabel(r.compliance_code),
          "Vi phạm": r.violations || (r.compliance_code && r.compliance_code !== "NONE" ? 1 : 0),
          "Điểm KPI ngày": day,
          "Điểm dư": overflow,
          "MSNV người duyệt": r.approver_id || "",
          "Họ và Tên Người duyệt": r.approver_name || "",
          "Máy làm việc": r.line || "",
          "THỜI GIAN DỪNG MÁY": Number(r.stop_hours ?? 0),
        };
      });

    } else {
      // Logic Export LEANLINE DC & LEANLINE MOLDED
      data = rows.map((r) => {
        const p = Number(r.p_score || 0);
        const q = Number(r.q_score || 0);
        const day = Number(r.day_score || 0);
        const overflow = Number(r.overflow ?? Math.max(0, p + q - 15));
        const totalMonth = day + overflow;
  
        return {
          "VỊ TRÍ LÀM VIỆC": titleCase(viSection(r.section || "")),
          "MSNV": r.worker_id || "",
          "HỌ VÀ TÊN": r.worker_name || "",
          "CA LÀM VIỆC": r.ca || "",
          "NGÀY LÀM VIỆC": fmtDate(r.date),
          "THỜI GIAN LÀM VIỆC": Number(r.work_hours ?? 0),
          "Số đôi phế": Number(r.defects ?? 0),
          "Điểm chất lượng": q,
          "%OE": Number(r.oe ?? 0),
          "Điểm sản lượng": p,
          "Tuân thủ": complianceLabel(r.compliance_code),
          "Vi phạm": r.violations || (r.compliance_code && r.compliance_code !== "NONE" ? 1 : 0),
          "Điểm KPI ngày": day,
          "Điểm dư": overflow,
          "Điểm KPI tổng tháng": totalMonth,
          "THỜI GIAN DOWNTIME": Number(r.stop_hours ?? 0),
          "MSNV người duyệt": r.approver_id || "",
          "Họ và Tên Người duyệt": r.approver_name || "",
          "Line làm việc": r.line || ""
        };
      });
    }
  
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, viSection(section));
    XLSX.writeFile(wb, `kpi_report_${section}_${dateFrom}_to_${dateTo}.xlsx`);
  }

  function exportMissingXLSXFull() {
    if (!missingReportFull.length) return alert("Không có nhân viên nào thiếu KPI để xuất.");
    
    // Xuất tổng hợp tất cả ngày thiếu của tất cả nhân viên thiếu KPI
    const data = missingReportFull.flatMap(r => 
        r.missing.map(date => ({
            "SECTION": viSection(section),
            "MSNV": r.msnv,
            "HỌ VÀ TÊN": r.name,
            "NGÀY THIẾU KPI": date,
            "NGÀY BẮT ĐẦU LỌC": dateFrom,
            "NGÀY KẾT THÚC LỌC": dateTo
        }))
    );
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KPI_Missing_Dates");
    
    XLSX.writeFile(wb, `kpi_missing_full_${section}_${approverId}_${dateFrom}_to_${dateTo}.xlsx`);
  }


  // ----- 4. Effects (Triggering data load/reset) -----
  useEffect(() => {
    // Rerun when page/rows change
    setPage(1); 
  }, [rows]);
  
  useEffect(() => {
    // Rerun when approver changes
    setMissingPage(1);
  }, [approverId, dateFrom, dateTo]);
  
  useEffect(() => {
    // Rerun when section changes
    setRows([]); setCategory(""); setWorkerId(""); setApproverId(""); setStatus("all"); setOnlyApproved(false);
  }, [section]);
  
  // Reruns when workerOptions changes (used for chart default)
  useEffect(() => { if (!chartWorker && workerOptions.length) setChartWorker(workerOptions[0]?.[0] || ""); }, [workerOptions]);
  
  // Reruns when workerOptions changes (used for category dropdown)
  useEffect(() => {
    if (!isMolding && !isHybrid) { setCatOptions([]); setCategory(""); return; }
    
    supabase
      .from("kpi_rule_productivity")
      .select("category")
      .eq("section", section.toUpperCase()) 
      .eq("active", true)
      .then(({ data, error }) => {
        if (error) { console.error(error); return; }
        const opts = [...new Set((data || []).map(r => r.category).filter(Boolean))];
        setCatOptions(opts.sort());
      });
  }, [section, isMolding, isHybrid]);
  
  // Load Workers by Approver (for Missing KPI Report)
  useEffect(() => {
    const id = approverId.trim();
    if (!id) { setApproverWorkers([]); return; }

    const approverCol = isMolding ? "approver_msnv" : "approver_id";

    supabase.from("users")
        .select("msnv, full_name")
        .eq(approverCol, id)
        .then(({ data, error }) => {
            if (error) { console.error("Error loading approver workers:", error); return; }
            setApproverWorkers(data || []);
        });
  }, [approverId, isMolding]);


  // --- JSX Rendering Starts Here ---
  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-semibold">Báo cáo KPI – {viSection(section)}</h2>

      {/* Bộ lọc */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        <label> Từ ngày
          <input type="date" className="input" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
        </label>
        <label> Đến ngày
          <input type="date" className="input" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
        </label>

        <label> MSNV người duyệt (tuỳ chọn)
          <input 
            className="input" 
            value={approverId} 
            onChange={e=>setApproverId(e.target.value)} 
            placeholder={isMolding ? "VD: 04126 (approver_msnv)" : "VD: 04126 (approver_id)"} />
        </label>

        <label> MSNV nhân viên (Lọc chính/Biểu đồ)
          <input className="input" value={workerId} onChange={e=>setWorkerId(e.target.value)} placeholder="VD: 04126" />
        </label>

        {(isMolding || isHybrid) && ( // Category cho Molding và Hybrid
          <label> Loại hàng/năng suất
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

      {/* Tra cứu ngày thiếu KPI */}
      <div className="p-4 border rounded bg-white space-y-3">
        <h3 className="text-lg font-semibold">Tra cứu ngày thiếu KPI theo Người duyệt</h3>
        
        {!approverId.trim() && <p className="text-gray-500">Vui lòng nhập MSNV Người duyệt để tra cứu.</p>}
        {approverId.trim() && approverWorkers.length === 0 && !loading && <p className="text-red-500">Không tìm thấy nhân viên nào dưới quyền người duyệt này.</p>}

        {approverWorkers.length > 0 && (
            <>
                <div className="flex items-center gap-3">
                    <span className="font-medium">Tổng số NV cần theo dõi: <b>{approverWorkers.length}</b></span>
                    <span className="font-medium">NV thiếu KPI: <b className="text-red-600">{missingReportFull.length}</b></span>
                    <button 
                        className="btn ml-auto" 
                        onClick={exportMissingXLSXFull} 
                        disabled={!missingReportFull.length}
                    >
                        Xuất XLSX (Tổng hợp)
                    </button>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border">
                        <thead className="bg-gray-100 text-xs uppercase">
                            <tr>
                                <th className="p-2 text-left">MSNV</th>
                                <th className="p-2 text-left">Họ & tên</th>
                                <th className="p-2 text-center">Thiếu / Tổng ngày</th>
                                <th className="p-2 text-left">Những ngày thiếu KPI</th>
                            </tr>
                        </thead>
                        <tbody>
                            {missingReportPaged.map(r => (
                                <tr key={r.msnv} className="border-b hover:bg-gray-50">
                                    <td className="p-2">{r.msnv}</td>
                                    <td className="p-2">{r.name}</td>
                                    <td className={`p-2 text-center font-semibold ${r.missingCount > 0 ? 'text-red-600' : ''}`}>
                                        {r.missingCount}/{r.totalDays}
                                    </td>
                                    <td className="p-2 text-wrap max-w-lg text-xs">{r.missing}</td>
                                </tr>
                            ))}
                            {!missingReportPaged.length && <tr><td colSpan={4} className="p-4 text-center text-gray-500">Tất cả nhân viên đã gửi đủ KPI hoặc không có dữ liệu KPI trong khoảng ngày này.</td></tr>}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {missingTotalPages > 1 && (
                    <div className="flex justify-center items-center gap-3 mt-3">
                        <button className="btn" onClick={() => setMissingPage(p => Math.max(1, p - 1))} disabled={missingPage <= 1}>‹ Trước</button>
                        <span>Trang {missingPage}/{missingTotalPages}</span>
                        <button className="btn" onClick={() => setMissingPage(p => Math.min(missingTotalPages, p + 1))} disabled={missingPage >= missingTotalPages}>Sau ›</button>
                    </div>
                )}
            </>
        )}
        {!rows.length && approverId.trim() && <p className="text-gray-500">Đang chờ tải dữ liệu KPI chi tiết để kiểm tra.</p>}
      </div>

      {/* Chart */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            Nhân viên:
            <select className="input" value={chartWorker} onChange={e=>setChartWorker(e.target.value)}>
              {workerOptions.map(([id, name]) => (
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
          {isMolding && (
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
          )}

          {isHybrid && ( // Bảng cho Hybrid Sections
            <table className="min-w-[1300px] text-sm">
              <thead className="bg-gray-100 text-xs uppercase">
                <tr>
                  <th className="p-2 text-center">Ngày</th>
                  <th className="p-2 text-center">MSNV</th>
                  <th className="p-2 text-center">Họ tên</th>
                  <th className="p-2 text-center">Máy</th>
                  <th className="p-2 text-center">Ca</th>
                  <th className="p-2 text-center">Giờ LV (QĐ)</th>
                  <th className="p-2 text-center">Giờ Dừng</th>
                  <th className="p-2 text-center">Loại NS</th>
                  <th className="p-2 text-center">Output</th>
                  <th className="p-2 text-center">Tỷ lệ NS</th>
                  <th className="p-2 text-center">Phế</th>
                  <th className="p-2 text-center">Q</th>
                  <th className="p-2 text-center">P</th>
                  <th className="p-2 text-center">KPI</th>
                  <th className="p-2 text-center">Duyệt</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => {
                  const exactHours = Math.max(0, Number(r.working_real || 0) - Number(r.stop_hours || 0));
                  const prodRate = exactHours > 0 ? Number(r.output || 0) / exactHours : 0;
                  return (
                    <tr key={`${r.worker_id}-${r.date}-${i}`} className="border-b hover:bg-gray-50">
                      <td className="p-2 text-center">{r.date}</td>
                      <td className="p-2 text-center">{r.worker_id}</td>
                      <td className="p-2 text-center">{r.worker_name}</td>
                      <td className="p-2 text-center">{r.line}</td>
                      <td className="p-2 text-center">{r.ca}</td>
                      <td className="p-2 text-center">{fmt(r.working_real, 2)}</td>
                      <td className="p-2 text-center">{fmt(r.stop_hours, 2)}</td>
                      <td className="p-2 text-center">{r.category}</td>
                      <td className="p-2 text-center">{fmt(r.output, 0)}</td>
                      <td className="p-2 text-center">{fmt(prodRate, 2)}</td>
                      <td className="p-2 text-center">{fmt(r.defects, 0)}</td>
                      <td className="p-2 text-center">{fmt(r.q_score, 2)}</td>
                      <td className="p-2 text-center">{fmt(r.p_score, 2)}</td>
                      <td className="p-2 text-center font-semibold">{fmt(r.day_score, 2)}</td>
                      <td className="p-2 text-center">{r.status}</td>
                    </tr>
                  );
                })}
                {!pageRows.length && (
                  <tr><td colSpan={15} className="p-4 text-center text-gray-500">Không có dữ liệu</td></tr>
                )}
              </tbody>
            </table>
          )}

          {!isMolding && !isHybrid && (
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