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
  // Lấy Context
  const { section } = useKpiSection();               
  const isMolding = section === "MOLDING";
  const isHybrid = isHybridSection(section);
  const tableName = getTableName(section);

  // Constants & Initializers (MOVED TO TOP FOR TDZ SAFETY)
  const today = () => new Date().toISOString().slice(0,10);
  const firstDayOfMonth = () => {
    const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0,10);
  };
  const pageSize = 100;
  const missingPageSize = 10; 
  
  // ----- 1. State Declarations (All useState Hooks) -----
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo]     = useState(today());
  const [approverId, setApproverId] = useState(""); 
  const [workerId, setWorkerId]     = useState("");
  const [status, setStatus]         = useState("all");
  const [onlyApproved, setOnlyApproved] = useState(false);
  const [category, setCategory]     = useState(""); 
  
  // ----- (SỬA ĐỔI) Tách state cho 2 loại báo cáo -----
  const [filteredRows, setFilteredRows] = useState([]); // Dùng cho bảng chi tiết, chart, top 5
  const [missingReportData, setMissingReportData] = useState([]); // Dùng cho Báo cáo thiếu
  
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false); // <-- (MỚI) State cho nút xuất
  
  const [catOptions, setCatOptions] = useState([]);
  const [missingWorkerId, setMissingWorkerId] = useState("");
  
  const [chartWorker, setChartWorker] = useState("");
  const [teamMode, setTeamMode] = useState("global");
  const [page, setPage] = useState(1);
  const [approverWorkers, setApproverWorkers] = useState([]);
  const [missingPage, setMissingPage] = useState(1); // MOVED UP
  
  // ----- STATE MỚI: Theo dõi ngày được chọn trong UI thống kê thiếu -----
  const [selectedMissingDate, setSelectedMissingDate] = useState(null);


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
    return `${m}/${d}/${y}`; // M/D/YYYY giống file mẫu
  };  
  const fmt = (n, d=2) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString("en-US",{maximumFractionDigits:d}) : "");

  // ----- (SỬA ĐỔI) Các useMemo sau DÙNG 'filteredRows' -----
  const workerOptions = useMemo(() => {
    return Array.from(new Map(filteredRows.map(r => [r.worker_id, r.worker_name || r.worker_id])).entries());
  }, [filteredRows]); 

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / pageSize)), [filteredRows.length]);
  const pageRows = useMemo(() => filteredRows.slice((page-1)*pageSize, page*pageSize), [filteredRows, page]);

  const top5 = useMemo(() => {
    const map = new Map();
    for (const r of filteredRows) {
      const cur = map.get(r.worker_id) || { name: r.worker_name || r.worker_id, total: 0, count: 0 };
      cur.total += Number(r.day_score || 0);
      cur.count += 1;
      map.set(r.worker_id, cur);
    }
    const arr = [...map.entries()].map(([id, v]) => ({
      worker_id: id, worker_name: v.name, total: v.total, avg: v.count ? v.total/v.count : 0, days: v.count
    })).sort((a,b) => b.total - a.total);
    return arr.slice(0, 5);
  }, [filteredRows]);

  const summary = useMemo(() => {
    const n = filteredRows.length;
    const total = filteredRows.reduce((s, r) => s + Number(r.day_score || 0), 0);
    const avg = n ? total / n : 0;
    const viol = filteredRows.reduce((s, r) => s + Number(r.violations || (r.compliance_code && r.compliance_code !== "NONE" ? 1 : 0)), 0);
    const workers = new Set(filteredRows.map(r => r.worker_id)).size;
    return { records: n, total, avg, violations: viol, workers };
  }, [filteredRows]);

  const chartData = useMemo(() => {
    if (!chartWorker) return [];
    const byDateAll = new Map();       
    const byDateApv = new Map();       
    const workerRows = filteredRows.filter(r => r.worker_id === chartWorker);

    const approverField = isMolding ? "approver_msnv" : "approver_id";
    const workerApprover = workerRows[0]?.[approverField] || (approverId || "");

    for (const r of filteredRows) {
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
  }, [filteredRows, chartWorker, teamMode, approverId, isMolding]);
  // ----- (HẾT SỬA ĐỔI) -----


  // ----- BÁO CÁO THIẾU (THEO NHÂN VIÊN) -----
  const allDates = useMemo(() => {
    if (!dateFrom || !dateTo) return [];
    return getAllDatesInRange(dateFrom, dateTo);
  }, [dateFrom, dateTo]);

  // ----- (SỬA ĐỔI) Báo cáo thiếu DÙNG 'missingReportData' -----
  const missingReportFull = useMemo(() => {
    if (!approverWorkers.length || !dateFrom || !dateTo) return [];

    const submittedMap = new Map(); 
    // SỬA ĐỔI: Dùng 'missingReportData'
    for (const r of missingReportData) {
        if (!submittedMap.has(r.worker_id)) {
            submittedMap.set(r.worker_id, new Set());
        }
        submittedMap.get(r.worker_id).add(r.date);
    }
    
    // const allDates = getAllDatesInRange(dateFrom, dateTo); // Đã mang ra ngoài
    
    const report = [];
    approverWorkers.forEach(w => {
        const submittedDates = submittedMap.get(w.msnv) || new Set();
        const missingDates = allDates.filter(d => !submittedDates.has(d));
        
        if (missingDates.length > 0) {
            report.push({
                msnv: w.msnv,
                name: w.full_name,
                approver_msnv: w.approver_msnv, 
                approver_name: w.approver_name, 
                missing: missingDates, // LƯU DƯỚI DẠNG MẢNG
                missingDisplay: missingDates.join(", "), // LƯU DƯỚI DẠNG CHUỖI
                missingCount: missingDates.length,
                totalDays: allDates.length
            });
        }
    });

    return report.sort((a, b) => b.missingCount - a.missingCount); 
  }, [approverWorkers, missingReportData, dateFrom, dateTo, allDates]); // <-- Sửa dependency

  // ----- BÁO CÁO THIẾU (THEO NGÀY) -----
  const summaryByDay = useMemo(() => {
    const totalWorkers = approverWorkers.length;
    if (totalWorkers === 0 || !allDates.length) return [];

    // 1. Tạo Map: date -> list of missing workers
    const missingByDate = new Map();
    // Tận dụng 'missingReportFull' đã tính toán
    for (const workerReport of missingReportFull) {
      // workerReport = { msnv, name, missing: [...], approver_msnv, approver_name }
      for (const date of workerReport.missing) {
        if (!missingByDate.has(date)) missingByDate.set(date, []);
        missingByDate.get(date).push({ 
            msnv: workerReport.msnv, 
            name: workerReport.name,
            approver_msnv: workerReport.approver_msnv, 
            approver_name: workerReport.approver_name  
        });
      }
    }
    
    // 2. Map 'allDates' để tạo report
    return allDates.map(date => {
      const missingList = missingByDate.get(date) || [];
      const missingCount = missingList.length;
      const submittedCount = totalWorkers - missingCount;
      const percentage = totalWorkers > 0 ? (submittedCount / totalWorkers) * 100 : 100;
      
      return {
        date,
        totalWorkers,
        submittedCount,
        missingCount,
        percentage: percentage,
        missingList
      };
    }).sort((a, b) => b.date.localeCompare(a.date)); // Sắp xếp ngày mới nhất lên đầu

  }, [missingReportFull, allDates, approverWorkers.length]); // Bỏ approverId


  const missingTotalPages = useMemo(() => Math.max(1, Math.ceil(missingReportFull.length / missingPageSize)), [missingReportFull.length]);

  const missingReportPaged = useMemo(() => {
    const start = (missingPage - 1) * missingPageSize;
    const end = start + missingPageSize;
    return missingReportFull.slice(start, end);
  }, [missingReportFull, missingPage]);


  // ----- 3. Action Functions (const = () => {}) -----
  
  // ----- (SỬA ĐỔI) runQuery giờ chạy 2 query -----
  async function runQuery() {
    if (!dateFrom || !dateTo) return alert("Chọn khoảng ngày trước khi xem báo cáo.");
    if (new Date(dateFrom) > new Date(dateTo)) return alert("Khoảng ngày không hợp lệ.");

    setLoading(true);

    // === Query 1: Báo cáo chi tiết (Tôn trọng tất cả filter) ===
    let q1 = supabase.from(tableName).select("*").gte("date", dateFrom).lte("date", dateTo);

    q1 = q1.eq("section", section);

    if (status !== "all") q1 = q1.eq("status", status);
    if (onlyApproved)     q1 = q1.eq("status", "approved");
    if (workerId.trim())  q1 = q1.eq("worker_id", workerId.trim());
    
    if (approverId.trim()) {
      const approverCol = isMolding ? "approver_msnv" : "approver_id";
      q1 = q1.eq(approverCol, approverId.trim());
    }
    
    if ((isMolding || isHybrid) && category) q1 = q1.eq("category", category);

    const { data: filteredData, error: filteredError } = await q1
        .order("worker_id", { ascending: true })
        .order("date", { ascending: true });

    if (filteredError) {
        setLoading(false);
        return alert("Lỗi tải dữ liệu chi tiết: " + filteredError.message);
    }
    setFilteredRows(filteredData || []);

    // === Query 2: Báo cáo thiếu (Bỏ qua filter status và workerId) ===
    let q2 = supabase
      .from(tableName)
      .select("worker_id, date") // Chỉ cần 2 cột này
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .eq("section", section);

    if (approverId.trim()) {
      const approverCol = isMolding ? "approver_msnv" : "approver_id";
      q2 = q2.eq(approverCol, approverId.trim());
    }
    // (Bỏ qua category vì không ảnh hưởng đến việc nộp hay không)

    const { data: missingData, error: missingError } = await q2;

    if (missingError) {
      // Không dừng lại, nhưng báo lỗi
      console.error("Lỗi tải dữ liệu báo cáo thiếu:", missingError.message);
      alert("Lỗi tải dữ liệu báo cáo thiếu: " + missingError.message);
      setMissingReportData([]);
    } else {
      setMissingReportData(missingData || []);
    }

    setLoading(false); // Dời xuống cuối
  }
  // ----- (HẾT SỬA ĐỔI runQuery) -----


  // ----- (SỬA ĐỔI) exportXLSX giờ dùng 'filteredRows' -----
  async function exportXLSX() { // <-- THÊM ASYNC
        
        // CÁC HÀM HELPER GIỮ NGUYÊN
        const titleCase = (s) =>
          s ? s.toString().toLowerCase().replace(/^\w/u, (c) => c.toUpperCase()) : "";
        const complianceLabel = (code) => {
          switch ((code || "NONE").toUpperCase()) {
            case "NONE": return "Không vi phạm";
            case "KÝ MẪU ĐẦU CHUYỀN TRƯC KHI SỬ DỤNG":
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
        const parseDate = (iso) => {
            if (!iso) return null; 
            try {
                const parts = iso.split('-');
                if (parts.length === 3) {
                    const y = parseInt(parts[0], 10);
                    const m = parseInt(parts[1], 10) - 1; 
                    const d = parseInt(parts[2], 10);
                    
                    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                        return new Date(y, m, d); 
                    }
                }
            } catch (e) {
            }
            return null; 
        };
        
        // ----- (SỬA ĐỔI) LẤY DATA MỚI TỪ SUPABASE -----
        setExporting(true);
        const tableName = getTableName(section);
        const { data: allData, error } = await supabase
          .from(tableName)
          .select("*")
          .eq("section", section) // Luôn lọc theo section
          .order("date", { ascending: false });
        
        setExporting(false);

        if (error) {
          return alert("Lỗi khi tải toàn bộ dữ liệu: " + error.message);
        }
        if (!allData || !allData.length) {
          return alert("Không có dữ liệu nào trong bảng " + tableName + " để xuất.");
        }
        // ----- (HẾT SỬA ĐỔI) -----
      
        let data;
        if (isMolding) {
          // Logic Export Molding
          data = allData.map((r) => { // Sửa: rows -> allData
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
              "NGÀY LÀM VIỆC": parseDate(r.date) ? { v: parseDate(r.date), t: 'd', z: 'm/d/yyyy' } : null, 
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
              "Người duyệt": r.approver_name || "",
              "Ghi chú duyệt": r.approver_note || "", 
              "Trạng thái": r.status || "pending", // <-- THÊM CỘT NÀY
            };
          });
        } else if (isHybrid) {
          // Logic Export HYBRID (LAMINATION, PREFITTING, BÀO, TÁCH)
          data = allData.map((r) => { // Sửa: rows -> allData
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
              "NGÀY LÀM VIỆC": parseDate(r.date) ? { v: parseDate(r.date), t: 'd', z: 'm/d/yyyy' } : null, 
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
              "Ghi chú duyệt": r.approver_note || "", 
              "Trạng thái": r.status || "pending", // <-- THÊM CỘT NÀY
            };
          });

        } else {
          // Logic Export LEANLINE DC & LEANLINE MOLDED
          data = allData.map((r) => { // Sửa: rows -> allData
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
              "NGÀY LÀM VIỆC": parseDate(r.date) ? { v: parseDate(r.date), t: 'd', z: 'm/d/yyyy' } : null, 
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
              "Line làm việc": r.line || "",
              "Ghi chú duyệt": r.approver_note || "", 
              "Trạng thái": r.status || "pending", // <-- THÊM CỘT NÀY
            };
          });
        }
      
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
      
        XLSX.utils.book_append_sheet(wb, ws, viSection(section));
        // SỬA ĐỔI: Tên file không còn bao gồm ngày tháng
        XLSX.writeFile(wb, `kpi_report_ALL_${section}.xlsx`);
      }
  // ----- (HẾT SỬA ĐỔI exportXLSX) -----


  // ----- (SỬA ĐỔI) HÀM XUẤT EXCEL CHI TIẾT TẤT CẢ NGÀY THIẾU -----
  function exportMissingXLSXFull() {
    if (!missingReportFull.length) return alert("Không có nhân viên nào thiếu KPI để xuất.");
    
    const sectionName = viSection(section);
    const approver = approverId.trim() || "all_section";
    
    const data = missingReportFull.flatMap(r => 
        r.missing.map(date => ({
            "SECTION": sectionName,
            "NGÀY THIẾU KPI": date,
            "MSNV": r.msnv,
            "HỌ VÀ TÊN": r.name,
            "MSNV NGƯỜI DUYỆT": r.approver_msnv,
            "TÊN NGƯỜI DUYỆT": r.approver_name || ""
        }))
    );
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Missing_All_Details"); 
    
    XLSX.writeFile(wb, `kpi_missing_details_all_${sectionName}_${approver}_${dateFrom}_to_${dateTo}.xlsx`);
  }
  // -----------------------------------------------------------------

  // ----- (MỚI) HÀM XUẤT EXCEL THEO NGÀY (CHI TIẾT) -----
  function exportMissingByDateXLSX(date, missingList) {
    if (!missingList || missingList.length === 0) {
      return alert("Không có dữ liệu để xuất.");
    }
    
    const sectionName = viSection(section);

    const data = missingList.map(w => ({
        "SECTION": sectionName,
        "NGÀY THIẾU KPI": date,
        "MSNV": w.msnv,
        "HỌ VÀ TÊN": w.name,
        "MSNV NGƯỜI DUYỆT": w.approver_msnv,
        "TÊN NGƯỜI DUYỆT": w.approver_name || ""
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Missing_${date}`);
    
    XLSX.writeFile(wb, `kpi_missing_list_for_${sectionName}_${date}.xlsx`);
  }
  // ------------------------------------------

  // ----- (MỚI) HÀM XUẤT EXCEL THEO NGÀY (TỔNG HỢP) -----
  function exportMissingSummaryByDay() {
    if (!summaryByDay.length) {
      return alert("Không có dữ liệu thống kê theo ngày để xuất.");
    }
    
    const sectionName = viSection(section);
    const approver = approverId.trim() || "all_section";

    const data = summaryByDay.map(day => ({
      "SECTION": sectionName,
      "NGÀY": day.date,
      "TỔNG NHÂN VIÊN": day.totalWorkers,
      "ĐÃ NỘP": day.submittedCount,
      "CÒN THIẾU": day.missingCount,
      "TỶ LỆ NỘP": day.percentage.toFixed(0) + "%"
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Summary_Missing_by_Day`);
    
    XLSX.writeFile(wb, `kpi_missing_summary_by_day_${sectionName}_${approver}_${dateFrom}_to_${dateTo}.xlsx`);
  }
  // ----------------------------------------------


  // ----- 4. Effects (Triggering data load/reset) -----
  useEffect(() => {
    // Rerun when page/rows change
    setPage(1); 
  }, [filteredRows]); // Sửa: rows -> filteredRows
  
  useEffect(() => {
    // Rerun when approver changes
    setMissingPage(1);
    setSelectedMissingDate(null); // <-- (MỚI) Đóng chi tiết khi đổi bộ lọc
  }, [approverId, dateFrom, dateTo]);
  
  useEffect(() => {
    // Rerun when section changes
    setFilteredRows([]); setMissingReportData([]); // Sửa: rows -> filteredRows, thêm reset state mới
    setCategory(""); setWorkerId(""); setApproverId(""); setStatus("all"); setOnlyApproved(false);
    setMissingWorkerId("");
    setSelectedMissingDate(null); // <-- (MỚI) Đóng chi tiết khi đổi section
    setApproverWorkers([]); // <-- (MỚI) Xóa danh sách NV khi đổi section
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
  
  // ----- (SỬA ĐỔI) Load Workers by Approver HOẶC Section -----
  useEffect(() => {
    const id = approverId.trim();
    const currentSection = section.toUpperCase();

    // SỬA LỖI 1: Tải thêm approver_msnv và approver_name
    let query = supabase.from("users").select("msnv, full_name, approver_msnv, approver_name");

    if (id) {
      // Logic cũ: Nếu có ID người duyệt, lọc theo người duyệt
      const approverCol = "approver_msnv"; // Luôn dùng 'approver_msnv' cho bảng users
      query = query.eq(approverCol, id);
      // Bạn có thể thêm lọc section ở đây nếu muốn
      // query = query.eq("section", currentSection);
    } else {
      // Logic MỚI: Nếu không có ID, lọc theo section hiện tại
      query = query.eq("section", currentSection);
    }

    // Luôn đặt lại danh sách NV trước khi tải
    setApproverWorkers([]); 
    
    query.then(({ data, error }) => {
        if (error) { 
          console.error("Error loading workers:", error); 
          setApproverWorkers([]); // Đảm bảo rỗng nếu có lỗi
          return; 
        }
        setApproverWorkers(data || []);
    });
    
  }, [approverId, section]); // Thay đổi dependency


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
            onChange={e=>setApproverId(e.target.value.trim())} // <-- Thêm .trim()
            placeholder={isMolding ? "VD: 04126 (approver_msnv)" : "VD: 04126 (approver_id)"} />
        </label>

        <label> MSNV nhân viên (Lọc chính/Biểu đồ)
          <input className="input" value={workerId} onChange={e=>setWorkerId(e.target.value.trim())} placeholder="VD: 04126" />
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
          {/* SỬA ĐỔI NÚT XUẤT */}
          <button className="btn" onClick={exportXLSX} disabled={loading || exporting}>
            {exporting ? "Đang xuất..." : "Xuất XLSX (Toàn bộ)"}
          </button>
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

      {/* === BÁO CÁO NHANH THEO NGÀY (SỬA ĐỔI) === */}
      {approverWorkers.length > 0 && (
          <div className="p-4 border rounded bg-white space-y-3">
            {/* ----- SỬA ĐỔI TIÊU ĐỀ VÀ THÊM 2 NÚT XUẤT ----- */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-lg font-semibold">Thống kê gửi KPI theo ngày</h3>
              <div className="flex items-center gap-2">
                <button
                    className="btn btn-sm"
                    onClick={exportMissingSummaryByDay}
                    disabled={!summaryByDay.length}
                    title="Xuất file Excel tổng hợp: Ngày, Tổng NV, Đã nộp, Còn thiếu, Tỷ lệ %"
                >
                    Xuất tổng hợp (theo ngày)
                </button>
                <button 
                    className="btn btn-sm bg-green-600 text-white hover:bg-green-700"
                    onClick={exportMissingXLSXFull}
                    disabled={!missingReportFull.length}
                    title="Xuất file Excel chi tiết: một hàng cho mỗi lượt nhân viên thiếu KPI của tất cả các ngày"
                >
                    Xuất chi tiết (toàn bộ)
                </button>
              </div>
            </div>
            {/* ----- KẾT THÚC SỬA ĐỔI ----- */}

            <div className="max-h-72 overflow-y-auto pr-2 space-y-2">
              {summaryByDay.map(day => (
                <div key={day.date} className="border rounded">
                  <button 
                    className="p-3 w-full flex items-center justify-between hover:bg-gray-50"
                    onClick={() => setSelectedMissingDate(day.date === selectedMissingDate ? null : day.date)}
                  >
                    <div>
                      <span className="font-semibold text-blue-600">{fmtDate(day.date)}</span>
                      <span className="ml-3 text-sm">
                        {/* ================= SỬA 1 (ĐÃ SỬA Ở LẦN TRƯỚC) ================= */}
                        Đã nộp: <b className="text-green-600">{day.submittedCount}/{day.totalWorkers}</b>
                      </span>
                      {/* ================= SỬA 2 (ĐÃ SỬA Ở LẦN TRƯỚC) ================= */}
                      {day.missingCount > 0 && (
                         <span className="ml-3 text-sm">
                           {/* ================= SỬA 3 (ĐÃ SỬA Ở LẦN TRƯỚC) ================= */}
                           Thiếu: <b className="text-red-600">{day.missingCount}</b>
                         </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${day.percentage === 100 ? 'text-green-600' : (day.percentage > 80 ? 'text-yellow-600' : 'text-red-600')}`}>
                        {day.percentage.toFixed(0)}%
                      </span>
                      <span className={`transform transition-transform ${selectedMissingDate === day.date ? 'rotate-90' : 'rotate-0'}`}>
                        {/* Biểu tượng mũi tên (thẩm mỹ) */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </span>
                    </div>
                  </button>
                  
                  {/* Bảng chi tiết (hiện khi click) */}
                  {selectedMissingDate === day.date && day.missingList.length > 0 && (
                    <div className="p-2 bg-gray-50 border-t">
                        {/* ----- NÚT XUẤT EXCEL MỚI ----- */}
                        <button
                            className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700 mb-2"
                            onClick={(e) => {
                                e.stopPropagation(); // Ngăn không cho sự kiện click đóng thẻ chi tiết
                                exportMissingByDateXLSX(day.date, day.missingList);
                            }}
                        >
                            Xuất Excel ({day.missingList.length})
                        </button>
                        {/* ------------------------------- */}
                        
                        <div className="max-h-40 overflow-y-auto">
                          <table className="min-w-full text-xs">
                            <thead className="bg-gray-200 sticky top-0">
                              <tr>
                                <th className="p-1 text-left">MSNV</th>
                                <th className="p-1 text-left">Họ & Tên</th>
                                <th className="p-1 text-left">Người duyệt</th>
                              </tr>
                            </thead>
                            <tbody>
                              {day.missingList.map(w => (
                                <tr key={w.msnv} className="border-b last:border-b-0">
                                  <td className="p-1">{w.msnv}</td>
                                  <td className="p-1">{w.name}</td>
                                  {/* SỬA LỖI 4: Hiển thị Tên, fallback về MSNV */}
                                  <td className="p-1">{w.approver_name || w.approver_msnv || "(N/A)"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                    </div>
                  )}
                  {selectedMissingDate === day.date && day.missingList.length === 0 && (
                     <div className="p-3 bg-gray-50 border-t text-sm text-green-600 font-medium">
                       ✅ Tất cả nhân viên đã nộp đủ.
                     </div>
                  )}
                </div>
              ))}
            </div>
            {/* SỬA ĐỔI: Dùng missingReportData để kiểm tra */}
            {!missingReportData.length && !loading && <p className="text-gray-500">Đang chờ tải dữ liệu KPI chi tiết để kiểm tra.</p>}
          </div>
        )}
      {/* === HẾT PHẦN MỚI === */}


      {/* Tra cứu ngày thiếu KPI (Bảng cũ) (SỬA ĐỔI) */}
      <div className="p-4 border rounded bg-white space-y-3">
        <h3 className="text-lg font-semibold">Tra cứu ngày thiếu KPI theo Nhân viên</h3>
        
        {/* ----- SỬA ĐỔI KHỐI NÀY ----- */}
        {approverWorkers.length === 0 && !loading && (
            <p className="text-gray-500">
                {approverId.trim() 
                    ? "Không tìm thấy nhân viên nào dưới quyền người duyệt này." 
                    : "Không tìm thấy nhân viên nào trong Section này. Vui lòng kiểm tra trang Quản lý User."}
            </p>
        )}
        {/* ----- HẾT SỬA ĐỔI ----- */}


        {approverWorkers.length > 0 && (
            <>
                <div className="flex items-center gap-3">
                    <span className="font-medium">
                        Tổng số NV đang theo dõi (
                        {approverId.trim() ? `của ${approverId}` : `thuộc ${section}`}
                        ): <b>{approverWorkers.length}</b>
                    </span>
                    <span className="font-medium">NV thiếu KPI: <b className="text-red-600">{missingReportFull.length}</b></span>
                    
                    {/* ----- NÚT ĐÃ BỊ DI CHUYỂN LÊN TRÊN ----- */}
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
                                    <td className="p-2 text-wrap max-w-lg text-xs">{r.missingDisplay}</td>
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
        {/* SỬA ĐỔI: Dùng missingReportData để kiểm tra */}
        {!missingReportData.length && approverId.trim() && !loading && <p className="text-gray-500">Đang chờ tải dữ liệu KPI chi tiết để kiểm tra.</p>}
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
          {/* Sửa: rows -> filteredRows */}
          <span>Kết quả: {filteredRows.length} dòng</span>
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
                {pageRows.map((r, i) => ( // Sửa: Dùng pageRows
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
                {!pageRows.length && ( // Sửa: Dùng pageRows
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
                {pageRows.map((r, i) => { // Sửa: Dùng pageRows
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
                {!pageRows.length && ( // Sửa: Dùng pageRows
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
                {pageRows.map((r, i) => ( // Sửa: Dùng pageRows
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
                {!pageRows.length && ( // Sửa: Dùng pageRows
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