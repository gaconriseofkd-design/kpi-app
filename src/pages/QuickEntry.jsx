// src/pages/QuickEntry.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";
import { scoreByQuality } from "../lib/scoring";
import ApproverModeHybrid from "./QuickEntryLPS";

/* ===== Helpers ===== */
const COMPLIANCE_OPTIONS = [
  { value: "NONE", label: "Không vi phạm" },
  { value: "Ký mẫu đầu chuyền trước khi sử dụng", label: "Ký mẫu đầu chuyền trước khi sử dụng" },
  { value: "Quy định về kiểm tra điều kiện máy trước/trong khi sản xuất", label: "Quy định về kiểm tra điều kiện máy trước/trong khi sản xuất" },
  { value: "Quy định về kiểm tra nguyên liệu trước/trong khi sản xuất", label: "Quy định về kiểm tra nguyên liệu trước/trong khi sản xuất" },
  { value: "Quy định về kiểm tra quy cách/tiêu chuẩn sản phẩm trước/trong khi sản xuất", label: "Quy định về kiểm tra quy cách/tiêu chuẩn sản phẩm trước/trong khi sản xuất" },
  { value: "Lỗi chặt", label: "Lỗi chặt" },
  { value: "Lỗi in", label: "Lỗi in" },
  { value: "Lỗi đóng gói", label: "Lỗi đóng gói" },
  { value: "Lỗi MQAA", label: "Lỗi MQAA" },
  { value: "Vi phạm nội quy bộ phận/công ty", label: "Vi phạm nội quy bộ phận/công ty" },
];

const MOLDED_COMPLIANCE_OPTIONS = [
  "Đóng gói sai thiếu ( theo đôi)",
  "Đóng dư, ghi số thiếu sai/ không ghi số thiếu",
  "Dán nhầm tem size run",
  "Không in logo",
  "Chặt sai dao",
  "In sai logo/ in sai phân đoạn",
  "Chặt in đóng gói sai yêu cầu đối với chỉ lệnh",
  "Lỗi in khác",
  "Lỗi đóng gói khác",
  "Phàn nàn Khách hàng",
  "Vi phạm Tuân thủ khác..."
];

const SEVERE_ERRORS = [
  "Không in logo",
  "Chặt sai dao",
  "In sai logo/ in sai phân đoạn",
  "Chặt in đóng gói sai yêu cầu đối với chỉ lệnh"
];

const HYBRID_SECTIONS = ["LAMINATION", "PREFITTING", "BÀO", "TÁCH"];
const isHybridSection = (sectionKey) => HYBRID_SECTIONS.includes(sectionKey);
const cx = (...a) => a.filter(Boolean).join(" ");
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const getMoldedCategoryFromLine = (line) => {
  if (line === 'M4' || line === 'M5' || line === 'H1') return 'M4 & M5 %OE';

  if (line === 'M1' || line === 'M2' || line === 'M3') return 'M1 M2 M3 %OE';
  return '';
};
// 1. Hàm helper để tách lấy mã line chuẩn (Đặt bên ngoài Component)
const extractStandardLine = (rawLine) => {
  if (!rawLine) return "D1A";
  const standardLines = ["D1A", "D1B", "D2A", "D2B", "D3A", "D3B", "H1", "H2"];
  const found = standardLines.find(std =>
    rawLine.toUpperCase().includes(std.toUpperCase())
  );
  return found || "D1A";
};

function scoreByProductivityLeanlineQuick(oe, allRules, section, line) {
  const val = Number(oe ?? 0);
  let rules = [];
  let category = '';
  if (section === "LEANLINE_MOLDED") {
    category = getMoldedCategoryFromLine(line);
    rules = (allRules || [])
      .filter(r => r.active !== false && r.category === category)
      .sort((a, b) => Number(b.threshold) - Number(a.threshold));
  } else {
    rules = (allRules || [])
      .filter(r => r.active !== false && !r.category)
      .sort((a, b) => Number(b.threshold) - Number(a.threshold));
  }
  for (const r of rules) {
    if (val >= Number(r.threshold)) return Number(r.score || 0);
  }
  return 0;
}
const LEANLINE_MACHINES = {
  "LEANLINE_MOLDED": ["M1", "M2", "M3", "M4", "M5"],
  "LEANLINE_DC": ["D1A", "D1B", "D2A", "D2B", "D3A", "D3B", "D4A", "D4B", "H1", "H2"],
  "DEFAULT": ["D1A", "D1B", "D2A", "D2B", "D3A", "D3B", "D4A", "D4B", "H1", "H2"],
}
const getLeanlineMachines = (section) => LEANLINE_MACHINES[section] || LEANLINE_MACHINES.DEFAULT;

/**
 * Helper tính toán cho Leanline
 */
function calculateScoresLeanlineQuick(oe, defects, rules, sec, line, compliance, compliancePairs) {
  let q = scoreByQuality(defects);

  // Logic tính điểm Tuân thủ mới cho LEANLINE_MOLDED
  if (sec === "LEANLINE_MOLDED" && compliance && compliance !== "NONE") {

    // 1. Phàn nàn Khách hàng -> Trừ 8 điểm
    if (compliance === "Phàn nàn Khách hàng") {
      q = q - 8;
    }
    // 2. Vi phạm Tuân thủ khác -> Trừ 2 điểm
    else if (compliance === "Vi phạm Tuân thủ khác...") {
      q = q - 2;
    }
    // 3. Các lỗi còn lại -> Tính theo số đôi
    else {
      const pairs = Number(compliancePairs || 0);
      if (pairs > 0) {
        if (SEVERE_ERRORS.includes(compliance)) {
          // Nhóm A: Nghiêm trọng (1 đôi -> 4đ, >=2 đôi -> 0đ)
          if (pairs === 1) q = 4;
          else q = 0;
        } else {
          // Nhóm B: Lỗi thường (làm tròn chẵn, trừ điểm)
          const effPairs = Math.ceil(pairs / 2) * 2;
          q = q - effPairs;
        }
      }
    }
  }
  // Đảm bảo không âm
  if (q < 0) q = 0;

  const p = scoreByProductivityLeanlineQuick(oe, rules, sec, line);
  const total = q + p;

  // !!! QUAN TRỌNG: Trả về key là "day_score" để đồng nhất với database !!!
  return { qScore: q, pScore: p, day_score: Math.min(15, total), rawTotal: total };
}


function calcWorkingReal(shift, inputHours) {
  const h = Number(inputHours || 0);
  if (h < 8) return h;
  const BASE_BY_SHIFT = { "Ca 1": 7.17, "Ca 2": 7.17, "Ca 3": 6.92, "Ca HC": 6.67 };
  const base = BASE_BY_SHIFT[shift] ?? 7.17;
  if (h < 9) return base;
  const extra = h - 8;
  const adj = extra >= 2 ? extra - 0.5 : extra;
  return base + adj;
}

function calculateScoresMolding({ shift, working_input, mold_hours, output, defects, category }, rules) {
  const workingReal = calcWorkingReal(shift, working_input);
  let dt = (Number(workingReal) * 24 - Number(mold_hours || 0)) / 24;
  // Cap lại logic
  if (dt > 1) dt = 1;
  if (dt < 0) dt = 0;

  const workingExact = Math.max(0, Number(workingReal) - dt);

  // Q Score
  const q = scoreByQuality(defects);

  // P Score
  let p = 0;
  const prod = workingExact > 0 ? Number(output || 0) / workingExact : 0;

  if (category && prod > 0) {
    const relevantRules = (rules || [])
      .filter(r => r.category === category && r.active !== false)
      .sort((a, b) => Number(b.threshold) - Number(a.threshold));

    for (const r of relevantRules) {
      if (prod >= Number(r.threshold)) {
        p = Number(r.score);
        break;
      }
    }
  }

  const total = p + q;

  // Return all needed fields
  return {
    q_score: q,
    p_score: p,
    day_score: Math.min(15, total),
    rawTotal: total,
    working_real: Number(workingReal.toFixed(2)),
    working_exact: Number(workingExact.toFixed(2)),
    downtime: Number(dt.toFixed(2)),
    prodRate: prod
  };
}

/* ===== Main ===== */
export default function QuickEntry() {
  const { section } = useKpiSection();
  const isMolding = section === "MOLDING";
  const isHybrid = isHybridSection(section);
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("quick_authed") === "1");
  const [pwd, setPwd] = useState("");
  function tryLogin(e) {
    e?.preventDefault();
    if (pwd === "davidtu") {
      sessionStorage.setItem("quick_authed", "1");
      setAuthed(true);
    } else alert("Sai mật khẩu.");
  }
  if (!authed) {
    return <LoginForm pwd={pwd} setPwd={setPwd} tryLogin={tryLogin} />;
  }
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Nhập KPI nhanh ({section})</h2>
      </div>
      {isMolding ? (
        <ApproverModeMolding section={section} />
      ) : isHybrid ? (
        <ApproverModeHybrid section={section} />
      ) : (
        <ApproverModeLeanline section={section} />
      )
      }
    </div>
  );
}
function LoginForm({ pwd, setPwd, tryLogin }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <form onSubmit={tryLogin} className="w-full max-w-sm p-6 rounded-xl shadow bg-white">
        <h2 className="text-xl font-semibold mb-4">Nhập KPI nhanh</h2>
        <input
          className="input w-full"
          placeholder="Mật khẩu"
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
        />
        <button className="btn btn-primary w-full mt-4">Đăng nhập</button>
      </form>
    </div>
  );
}

/* ======================================================================
   APPROVER MODE — LEANLINE

   APPROVER MODE — LEANLINE (FIXED: PHÂN CHIA LINE THEO SECTION)
   ====================================================================== */
/* ======================================================================
   APPROVER MODE — LEANLINE (FIXED: PHÂN TÁCH LINE THEO SECTION & TỰ ĐỘNG GÁN)
   ====================================================================== */
function ApproverModeLeanline({ section }) {
  const [step, setStep] = useState(1);
  const [prodRules, setProdRules] = useState([]);
  const [approverIdInput, setApproverIdInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [searchAllSections, setSearchAllSections] = useState(false);

  const [reviewRows, setReviewRows] = useState([]);
  const [selReview, setSelReview] = useState(() => new Set());

  // States Template
  const today = new Date().toISOString().slice(0, 10);
  const [tplDate, setTplDate] = useState(today);
  const [tplShift, setTplShift] = useState("Ca 1");
  const [tplWorkHours, setTplWorkHours] = useState(8);
  const [tplStopHours, setTplStopHours] = useState(0);
  const [tplOE, setTplOE] = useState(100);
  const [tplDefects, setTplDefects] = useState(0);
  const [tplCompliance, setTplCompliance] = useState("NONE");
  const [tplCompliancePairs, setTplCompliancePairs] = useState(0);

  // 1. ĐỊNH NGHĨA DANH SÁCH LINE CHUẨN DỰA TRÊN SECTION
  const currentMachines = useMemo(() => {
    if (section === "LEANLINE_MOLDED") {
      return ["M1", "M2", "M3", "M4", "M5", "H1"];
    }
    // Cho LEANLINE_DC
    return ["D1A", "D1B", "D2A", "D2B", "D3A", "D3B", "D4A", "D4B", "H1", "H2"];
  }, [section]);

  const [tplLine, setTplLine] = useState(currentMachines[0]);

  // Cập nhật lại tplLine khi người dùng đổi Section
  useEffect(() => {
    setTplLine(currentMachines[0]);
  }, [currentMachines]);

  const [saving, setSaving] = useState(false);
  const pageSize = 50;
  const [page, setPage] = useState(1);
  const selectedIds = useMemo(() => new Set(selectedWorkers.map(w => w.msnv)), [selectedWorkers]);

  const [lineFilter, setLineFilter] = useState("");

  // 2. HÀM TÁCH LINE CHUẨN (Thông minh theo danh sách máy của section)
  const extractStandardLine = (rawLine) => {
    if (!rawLine) return currentMachines[0];
    const upperRaw = rawLine.toUpperCase();
    const found = currentMachines.find(std => upperRaw.includes(std.toUpperCase()));
    return found || currentMachines[0];
  };

  const availableLines = useMemo(() => {
    const lines = new Set(searchResults.map(w => w.line).filter(Boolean));
    return Array.from(lines).sort();
  }, [searchResults]);

  const filteredSearchResults = useMemo(() => {
    if (!lineFilter) return searchResults;
    return searchResults.filter(w => w.line === lineFilter);
  }, [searchResults, lineFilter]);

  const calculateScores = (oe, defects, rules, sec, line, compl, pairs) => {
    return calculateScoresLeanlineQuick(oe, defects, rules, sec, line, compl, pairs);
  };

  const previewScores = useMemo(() =>
    calculateScores(tplOE, tplDefects, prodRules, section, tplLine, tplCompliance, tplCompliancePairs),
    [tplOE, tplDefects, prodRules, section, tplLine, tplCompliance, tplCompliancePairs]
  );

  const tplQ = previewScores.qScore;
  const tplP = previewScores.pScore;
  const tplKPI = previewScores.day_score;

  const totalPages = Math.max(1, Math.ceil(reviewRows.length / pageSize));
  const pageRows = useMemo(
    () => reviewRows.slice((page - 1) * pageSize, page * pageSize),
    [reviewRows, page]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("kpi_rule_productivity")
        .select("*").eq("active", true).eq("section", section)
        .order("threshold", { ascending: false });
      if (!cancelled) {
        if (error) console.error("Load rules error:", error);
        setProdRules(data || []);
      }
    })();
    return () => { cancelled = true; };
  }, [section]);

  useEffect(() => setPage(1), [reviewRows.length]);

  // --- HÀM THÊM/XOÁ NHÂN VIÊN ---
  async function searchByApprover() {
    const q = approverIdInput.trim();
    if (!q) return alert("Nhập Tên hoặc MSNV người duyệt.");
    setLoadingSearch(true);
    let query;
    if (isNaN(Number(q))) {
      query = supabase.from("users").select("msnv, full_name, section, line, approver_msnv, approver_name").ilike("approver_name", `%${q}%`);
    } else {
      query = supabase.from("users").select("msnv, full_name, section, line, approver_msnv, approver_name").eq("approver_msnv", q);
    }
    if (!searchAllSections) query = query.eq("section", section);
    const { data, error } = await query.limit(1000);
    setLoadingSearch(false);
    if (error) return alert("Lỗi tải nhân viên: " + error.message);
    setSearchResults(data || []);
    setSearchInput(""); setLineFilter("");
  }

  async function searchGlobal() {
    const q = searchInput.trim();
    if (!q) return alert("Nhập Tên hoặc MSNV nhân viên.");
    setLoadingSearch(true);
    let query;
    if (isNaN(Number(q))) {
      query = supabase.from("users").select("msnv, full_name, section, line, approver_msnv, approver_name").ilike("full_name", `%${q}%`);
    } else {
      query = supabase.from("users").select("msnv, full_name, section, line, approver_msnv, approver_name").eq("msnv", q);
    }
    if (!searchAllSections) query = query.eq("section", section);
    const { data, error } = await query.limit(50);
    setLoadingSearch(false);
    if (error) return alert("Lỗi tìm nhân viên: " + error.message);
    setSearchResults(data || []);
    setApproverIdInput(""); setLineFilter("");
  }

  function addWorker(worker) {
    setSelectedWorkers(prev => prev.find(w => w.msnv === worker.msnv) ? prev : [worker, ...prev]);
  }

  function removeWorker(msnv) {
    setSelectedWorkers(prev => prev.filter(w => w.msnv !== msnv));
  }

  // ĐÃ THÊM LẠI HÀM NÀY ĐỂ FIX LỖI
  function removeAllWorkers() {
    if (window.confirm(`Bạn có chắc muốn xoá ${selectedWorkers.length} nhân viên đã chọn?`)) {
      setSelectedWorkers([]);
    }
  }

  // 3. LOGIC CHUYỂN BƯỚC: Gán Line từ Filter
  function proceedToTemplate() {
    const requiredRulesLoaded = section === "LEANLINE_MOLDED" || prodRules.length > 0;
    if (!requiredRulesLoaded) return alert("Không thể tải Rule tính điểm sản lượng.");
    if (!selectedWorkers.length) return alert("Chưa chọn nhân viên nào.");

    if (lineFilter) {
      const standardLine = extractStandardLine(lineFilter);
      setTplLine(standardLine);
    } else {
      setTplLine(currentMachines[0]);
    }
    setStep(2);
  }

  function buildReviewRows() {
    if (tplDate > today) return alert("Không thể chọn ngày trong tương lai.");
    if (!selectedWorkers.length) return alert("Chưa chọn nhân viên.");

    const rows = selectedWorkers.map((w) => {
      const scores = calculateScores(tplOE, tplDefects, prodRules, section, tplLine, tplCompliance, tplCompliancePairs);
      return {
        section, work_date: tplDate, shift: tplShift, msnv: w.msnv, hoten: w.full_name,
        approver_id: w.approver_msnv || approverIdInput, approver_name: w.approver_name,
        line: tplLine,
        work_hours: toNum(tplWorkHours), downtime: toNum(tplStopHours),
        oe: toNum(tplOE), defects: toNum(tplDefects),
        compliance: tplCompliance, compliance_pairs: toNum(tplCompliancePairs),
        q_score: scores.qScore, p_score: scores.pScore,
        total_score: scores.day_score, status: "approved", approver_note: "",
      }
    });
    setReviewRows(rows);
    setSelReview(new Set(rows.map((_, i) => i)));
    setStep(3);
    setPage(1);
  }



  function updateRow(i, key, val) {
    if (key === "work_date" && val > today) return alert("Không thể chọn ngày trong tương lai.");
    setReviewRows((old) => {
      const arr = [...old];
      const r0 = arr[i] || {};
      let r = { ...r0 };
      if (["compliance", "line", "shift", "work_date", "approver_note"].includes(key)) {
        r[key] = val;
        if (key === "compliance" && (val === "NONE" || val === "Phàn nàn Khách hàng" || val === "Vi phạm Tuân thủ khác...")) r.compliance_pairs = 0;
      } else {
        r[key] = toNum(val, 0);
      }
      const sc = calculateScores(r.oe, r.defects, prodRules, section, r.line, r.compliance, r.compliance_pairs);
      arr[i] = { ...r, q_score: sc.qScore, p_score: sc.pScore, total_score: sc.day_score };
      return arr;
    });
  }

  function toggleAllReviewOnPage() {
    setSelReview((prev) => {
      const next = new Set(prev);
      const start = (page - 1) * pageSize;
      const allOnPage = pageRows.length > 0 && pageRows.every((_, idx) => next.has(start + idx));
      if (allOnPage) pageRows.forEach((_, idx) => next.delete(start + idx));
      else pageRows.forEach((_, idx) => next.add(start + idx));
      return next;
    });
  }

  async function saveBatch() {
    const idxs = Array.from(selReview).sort((a, b) => a - b);
    if (!idxs.length) return alert("Chưa chọn dòng để lưu.");
    setSaving(true);
    const list = idxs.map((i) => reviewRows[i]);
    const now = new Date().toISOString();

    const payload = list.map((r) => {
      const rawScores = calculateScores(r.oe, r.defects, prodRules, section, r.line, r.compliance, r.compliance_pairs);
      const overflow = Math.max(0, rawScores.rawTotal - 15);
      return {
        date: r.work_date,
        ca: r.shift,
        worker_id: r.msnv,
        worker_name: r.hoten,
        approver_id: r.approver_id,
        approver_name: r.approver_name,
        line: r.line,
        work_hours: r.work_hours,
        stop_hours: r.downtime,
        oe: r.oe,
        defects: r.defects,

        compliance_code: r.compliance,
        compliance_pairs: (section === "LEANLINE_MOLDED" && r.compliance !== "Phàn nàn Khách hàng" && r.compliance !== "Vi phạm Tuân thủ khác...") ? toNum(r.compliance_pairs) : 0,

        section,
        status: "approved",
        created_at: now,
        approved_at: now,
        approver_note: r.approver_note || null,
        p_score: rawScores.pScore,
        q_score: rawScores.qScore,

        // CHỖ QUAN TRỌNG NHẤT: Lấy đúng key day_score
        day_score: rawScores.day_score ?? 0,

        overflow
      };
    });

    const { error } = await supabase
      .from("kpi_entries")
      .upsert(payload, { onConflict: "worker_id,date,section" });

    setSaving(false);
    if (error) return alert("Lỗi lưu: " + error.message);
    alert(`Đã lưu ${payload.length} dòng.`);

    const savedIdxSet = new Set(idxs);
    setReviewRows(prev => prev.filter((_, i) => !savedIdxSet.has(i)));
    setSelReview(new Set());
    if (reviewRows.length - idxs.length === 0) {
      setStep(1);
    }
  }

  function resetToStep1() {
    setStep(1); setSelectedWorkers([]); setSearchResults([]); setReviewRows([]); setSelReview(new Set());
    setSearchInput(""); setApproverIdInput(""); setLineFilter("");
  }

  /* UI */
  const globalIndex = (idx) => (page - 1) * pageSize + idx;

  return (
    <>
      {step === 1 && (
        <>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-1/2 p-4 border rounded bg-white shadow-sm">
                <h3 className="font-bold mb-2 text-blue-700">Tìm & Thêm Nhân viên ({selectedWorkers.length})</h3>
                <div className="space-y-2 pb-2 border-b">
                  <label className="text-sm font-medium">Tìm theo Người duyệt:</label>
                  <form onSubmit={(e) => { e.preventDefault(); searchByApprover(); }} className="flex gap-2">
                    <input className="input flex-1" placeholder="Nhập ID/Tên người duyệt" value={approverIdInput} onChange={(e) => setApproverIdInput(e.target.value)} disabled={loadingSearch} />
                    <button type="submit" className="btn btn-primary" disabled={loadingSearch}>{loadingSearch ? "..." : "Tìm"}</button>
                  </form>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="searchAllSections" checked={searchAllSections} onChange={e => setSearchAllSections(e.target.checked)} />
                    <label htmlFor="searchAllSections" className="text-sm">Tìm kiếm User ở tất cả các Section</label>
                  </div>
                </div>
                <div className="space-y-2 mt-2">
                  <label className="text-sm font-medium">Tìm nhân viên lẻ:</label>
                  <form onSubmit={(e) => { e.preventDefault(); searchGlobal(); }} className="flex gap-2">
                    <input className="input flex-1" placeholder="Nhập ID/Tên NV" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} disabled={loadingSearch} />
                    <button type="submit" className="btn" disabled={loadingSearch}>Tìm</button>
                  </form>
                </div>
              </div>

              <div className="w-1/2 p-4 border rounded bg-gray-50 flex flex-col h-[500px]">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-gray-700">Kết quả tìm kiếm ({filteredSearchResults.length})</h3>
                  <select
                    className="input text-sm py-1 px-2 w-32"
                    value={lineFilter}
                    onChange={(e) => setLineFilter(e.target.value)}
                  >
                    <option value="">Tất cả Line</option>
                    {availableLines && availableLines.filter(l => l).map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 mb-2">
                  <button
                    className="btn btn-sm bg-blue-600 text-white"
                    onClick={() => {
                      const newWorkers = filteredSearchResults.filter(w => !selectedIds.has(w.msnv));
                      if (newWorkers.length === 0) return;
                      setSelectedWorkers(prev => [...newWorkers, ...prev]);
                    }}
                    disabled={!filteredSearchResults.length}
                  >
                    + Thêm tất cả ({filteredSearchResults.length})
                  </button>
                </div>
                <div className="flex-1 overflow-auto bg-white border rounded">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="p-2 text-left">MSNV</th>
                        <th className="p-2 text-left">Tên</th>
                        <th className="p-2 text-left">Line</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSearchResults.map(w => {
                        const isSelected = selectedIds.has(w.msnv);
                        return (
                          <tr key={w.msnv} className={`border-b ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                            <td className="p-2">{w.msnv}</td>
                            <td className="p-2 truncate max-w-[120px]" title={w.full_name}>{w.full_name}</td>
                            <td className="p-2">{w.line}</td>
                            <td className="p-2 text-right">
                              <button className="btn btn-xs" onClick={() => addWorker(w)} disabled={isSelected}>
                                {isSelected ? "Đã chọn" : "+"}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Danh sách đã chọn */}
            <div className="border rounded p-4 bg-white">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold">Danh sách đã chọn ({selectedWorkers.length})</h3>
                <button className="text-red-600 text-sm hover:underline" onClick={removeAllWorkers}>Xoá tất cả</button>
              </div>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-auto">
                {selectedWorkers.map(w => (
                  <div key={w.msnv} className="badge badge-lg gap-2 pr-1">
                    {w.msnv} - {w.full_name}
                    <button className="btn btn-circle btn-xs text-white bg-gray-400 hover:bg-gray-600 border-none" onClick={() => removeWorker(w.msnv)}>x</button>
                  </div>
                ))}
                {!selectedWorkers.length && <span className="text-gray-400 italic">Chưa chọn nhân viên nào</span>}
              </div>
              <div className="mt-4 flex justify-end">
                <button className="btn btn-primary" onClick={proceedToTemplate} disabled={!selectedWorkers.length}>
                  Tiếp tục nhập liệu ({selectedWorkers.length}) ›
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-blue-50 p-4 rounded-lg">
            <div><label>Ngày</label><input type="date" className="input" value={tplDate} onChange={e => setTplDate(e.target.value)} max={today} /></div>
            <div><label>Ca</label><select className="input" value={tplShift} onChange={(e) => setTplShift(e.target.value)}><option value="Ca 1">Ca 1</option><option value="Ca 2">Ca 2</option><option value="Ca 3">Ca 3</option><option value="Ca HC">Ca HC</option></select></div>
            <div><label>Máy làm việc</label><select className="input" value={tplLine} onChange={(e) => setTplLine(e.target.value)}>{currentMachines.map(m => (<option key={m} value={m}>{m}</option>))}</select></div>
            <div><label>Giờ làm việc</label><input type="number" step="0.1" className="input" value={tplWorkHours} onChange={(e) => setTplWorkHours(e.target.value)} /></div>
            <div><label>Giờ dừng máy</label><input type="number" step="0.1" className="input" value={tplStopHours} onChange={(e) => setTplStopHours(e.target.value)} /></div>
            <div><label>%OE</label><input type="number" step="1" className="input" value={tplOE} onChange={(e) => setTplOE(e.target.value)} /></div>
            <div><label>Số đôi phế</label><input type="number" step="0.5" className="input" value={tplDefects} onChange={(e) => setTplDefects(e.target.value)} /></div>

            <div className="md:col-span-2 flex gap-2">
              <div className="flex-1">
                <label>Tuân thủ</label>
                <select className="input w-full" value={tplCompliance} onChange={(e) => setTplCompliance(e.target.value)}>
                  <option value="NONE">Không vi phạm</option>
                  {section === "LEANLINE_MOLDED"
                    ? MOLDED_COMPLIANCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)
                    : COMPLIANCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)
                  }
                </select>
              </div>
              {/* INPUT SỐ ĐÔI VI PHẠM TRONG TEMPLATE */}
              {section === "LEANLINE_MOLDED" && tplCompliance !== "NONE" && tplCompliance !== "Phàn nàn Khách hàng" && tplCompliance !== "Vi phạm Tuân thủ khác..." && (
                <div className="w-24">
                  <label className="text-red-600 font-bold">Số đôi</label>
                  <input
                    type="number"
                    className="input border-red-500 text-red-700 bg-red-50 font-bold"
                    value={tplCompliancePairs}
                    onChange={(e) => setTplCompliancePairs(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
            <h4 className="font-semibold text-yellow-800">Điểm KPI Tạm tính (Template):</h4>
            <p>Sản lượng: <b>{tplP}</b> | Chất lượng: <b>{tplQ}</b></p>
            <p className="text-lg">Tổng điểm: <b className="text-blue-600">{tplKPI}</b> / 15</p>
          </div>

          <div className="flex justify-end gap-3">
            <button className="btn" onClick={() => setStep(1)}>‹ Quay lại</button>
            <button className="btn btn-primary" onClick={buildReviewRows}>
              Áp dụng & Xem trước ({selectedWorkers.length}) ›
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button className="btn btn-primary" onClick={saveBatch} disabled={saving || !selReview.size}>
              {saving ? "Đang lưu..." : `Lưu đã chọn (${selReview.size})`}
            </button>
            <button className="btn" onClick={resetToStep1} disabled={saving}> ‹ Quay lại (Nhập mới) </button>
            <div className="ml-auto flex items-center gap-3">
              <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹ Trước</button>
              <span>Trang {page}/{totalPages}</span>
              <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Sau ›</button>
            </div>
          </div>

          <div className="overflow-auto border rounded shadow-inner max-h-[600px]">
            <table className="min-w-max text-sm bg-white">
              <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-2 w-10 text-center">
                    <input type="checkbox" onChange={toggleAllReviewOnPage} checked={pageRows.length > 0 && pageRows.every((_, i) => selReview.has(globalIndex(i)))} />
                  </th>
                  <th className="p-2">MSNV</th>
                  <th className="p-2">Tên</th>
                  <th className="p-2">Line</th>
                  <th className="p-2 w-16">Giờ làm</th>
                  <th className="p-2 w-16">Dừng</th>
                  <th className="p-2 w-16">%OE</th>
                  <th className="p-2 w-16">Phế</th>
                  <th className="p-2 min-w-[200px]">Tuân thủ</th>
                  {/* Cột Số đôi VP */}
                  {section === "LEANLINE_MOLDED" && <th className="p-2 w-16 text-red-600">Số đôi</th>}
                  <th className="p-2 w-12">P</th>
                  <th className="p-2 w-12">Q</th>
                  <th className="p-2 w-12 font-bold">KPI</th>
                  <th className="p-2">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, idx) => {
                  const i = globalIndex(idx);
                  return (
                    <tr key={i} className={`hover:bg-blue-50 border-b ${!selReview.has(i) ? 'opacity-50 bg-gray-50' : ''}`}>
                      <td className="p-2 text-center">
                        <input type="checkbox" checked={selReview.has(i)} onChange={() => setSelReview(prev => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        })} />
                      </td>
                      <td className="p-2">{r.msnv}</td>
                      <td className="p-2 truncate max-w-[150px]">{r.hoten}</td>
                      <td className="p-2"><input className="input w-20 p-1" value={r.line} onChange={e => updateRow(i, 'line', e.target.value)} /></td>
                      <td className="p-2"><input type="number" className="input w-16 p-1" value={r.work_hours} onChange={e => updateRow(i, 'work_hours', e.target.value)} /></td>
                      <td className="p-2"><input type="number" className="input w-16 p-1" value={r.downtime} onChange={e => updateRow(i, 'downtime', e.target.value)} /></td>
                      <td className="p-2"><input type="number" className="input w-16 p-1" value={r.oe} onChange={e => updateRow(i, 'oe', e.target.value)} /></td>
                      <td className="p-2"><input type="number" className="input w-16 p-1" value={r.defects} onChange={e => updateRow(i, 'defects', e.target.value)} /></td>

                      <td className="p-2">
                        <select className="input w-full p-1 text-xs" value={r.compliance} onChange={e => updateRow(i, 'compliance', e.target.value)}>
                          <option value="NONE">--</option>
                          {section === "LEANLINE_MOLDED"
                            ? MOLDED_COMPLIANCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)
                            : COMPLIANCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)
                          }
                        </select>
                      </td>

                      {/* INPUT SỐ ĐÔI TRONG BẢNG */}
                      {section === "LEANLINE_MOLDED" && (
                        <td className="p-2">
                          {/* Ẩn nếu là Phàn nàn KH hoặc Vi phạm khác */}
                          {r.compliance !== "NONE" && r.compliance !== "Phàn nàn Khách hàng" && r.compliance !== "Vi phạm Tuân thủ khác..." ? (
                            <input
                              type="number"
                              className="input w-16 p-1 border-red-300 text-red-600 bg-red-50 font-bold"
                              value={r.compliance_pairs}
                              onChange={e => updateRow(i, 'compliance_pairs', e.target.value)}
                            />
                          ) : <span className="text-gray-300 block text-center">-</span>}
                        </td>
                      )}

                      <td className="p-2 text-center text-gray-600">{r.p_score}</td>
                      <td className="p-2 text-center text-gray-600">{r.q_score}</td>
                      <td className="p-2 text-center font-bold text-blue-600 text-lg">{r.total_score}</td>
                      <td className="p-2"><input className="input w-full p-1" value={r.approver_note || ""} onChange={e => updateRow(i, 'approver_note', e.target.value)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}



/* ======================================================================
   APPROVER MODE — MOLDING
   ====================================================================== */
function ApproverModeMolding({ section }) {
  const [step, setStep] = useState(1);
  const [approverIdInput, setApproverIdInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [searchAllSections, setSearchAllSections] = useState(false);
  const selectedIds = useMemo(() => new Set(selectedWorkers.map(w => w.msnv)), [selectedWorkers]);
  const [prodRules, setProdRules] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const today = new Date().toISOString().slice(0, 10);
  const [tplDate, setTplDate] = useState(today); // <-- SỬ DỤNG 'today'
  const [tplShift, setTplShift] = useState("Ca 1");
  const [tplWorkingInput, setTplWorkingInput] = useState(8);
  const [tplMoldHours, setTplMoldHours] = useState(0);
  const [tplOutput, setTplOutput] = useState(0);
  const [tplCategory, setTplCategory] = useState("");
  const [tplDefects, setTplDefects] = useState(0);
  const [tplCompliance, setTplCompliance] = useState("NONE");
  const [reviewRows, setReviewRows] = useState([]);
  const [selReview, setSelReview] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const pageSize = 50;
  const [page, setPage] = useState(1);

  useEffect(() => {
    supabase.from("kpi_rule_productivity").select("category, threshold, score")
      .eq("section", "MOLDING").eq("active", true)
      .order("category", { ascending: true }).order("threshold", { ascending: false })
      .then(({ data, error }) => {
        if (error) return console.error(error);
        const rules = data || []; setProdRules(rules);
        const list = [...new Set(rules.map((r) => r.category).filter(Boolean))];
        setCategoryOptions(list);
        if (list.length > 0) setTplCategory(list[0]);
      });
  }, []);

  // ----- THÊM HÀM XOÁ TẤT CẢ (MOLDING) -----
  function removeAllWorkers() {
    if (window.confirm(`Bạn có chắc muốn xoá ${selectedWorkers.length} nhân viên đã chọn?`)) {
      setSelectedWorkers([]);
    }
  }

  const previewScores = useMemo(() => {
    return calculateScoresMolding({
      shift: tplShift, working_input: tplWorkingInput, mold_hours: tplMoldHours,
      output: tplOutput, defects: tplDefects, category: tplCategory
    }, prodRules);
  }, [tplShift, tplWorkingInput, tplMoldHours, tplOutput, tplDefects, tplCategory, prodRules]);
  const tplQ = previewScores.q_score;
  const tplP = previewScores.p_score;
  const tplKPI = previewScores.day_score;

  useEffect(() => setPage(1), [reviewRows.length]);
  const totalPages = Math.max(1, Math.ceil(reviewRows.length / pageSize));
  const pageRows = useMemo(
    () => reviewRows.slice((page - 1) * pageSize, page * pageSize),
    [reviewRows, page]
  );

  async function searchByApprover() {
    const q = approverIdInput.trim();
    if (!q) return alert("Nhập Tên hoặc MSNV người duyệt.");
    setLoadingSearch(true);
    let query;
    if (isNaN(Number(q))) {
      query = supabase.from("users")
        .select("msnv, full_name, approver_msnv, approver_name")
        .ilike("approver_name", `%${q}%`);
    } else {
      query = supabase.from("users")
        .select("msnv, full_name, approver_msnv, approver_name")
        .eq("approver_msnv", q);
    }
    if (!searchAllSections) {
      query = query.eq("section", section); // section ở đây sẽ là "MOLDING"
    }
    const { data, error } = await query.limit(1000);
    setLoadingSearch(false);
    if (error) return alert("Lỗi tải nhân viên: " + error.message);
    setSearchResults(data || []);
    setSearchInput("");
  }

  async function searchGlobal() {
    const q = searchInput.trim();
    if (!q) return alert("Nhập Tên hoặc MSNV nhân viên.");
    setLoadingSearch(true);
    let query;
    if (isNaN(Number(q))) {
      query = supabase.from("users").select("msnv, full_name, approver_msnv, approver_name").ilike("full_name", `%${q}%`);
    } else {
      query = supabase.from("users").select("msnv, full_name, approver_msnv, approver_name").eq("msnv", q);
    }
    if (!searchAllSections) {
      query = query.eq("section", section);
    }
    const { data, error } = await query.limit(50);
    setLoadingSearch(false);
    if (error) return alert("Lỗi tìm nhân viên: " + error.message);
    setSearchResults(data || []);
    setApproverIdInput("");
  }

  function addWorker(worker) {
    setSelectedWorkers(prev => {
      if (prev.find(w => w.msnv === worker.msnv)) return prev;
      return [worker, ...prev];
    });
  }
  function removeWorker(msnv) {
    setSelectedWorkers(prev => prev.filter(w => w.msnv !== msnv));
  }

  function addAllResults() {
    if (!searchResults.length) return;

    setSelectedWorkers(prev => {
      // Dùng Set để lọc trùng hiệu quả
      const existingIds = new Set(prev.map(w => w.msnv));
      const newWorkersToAdd = searchResults.filter(
        worker => !existingIds.has(worker.msnv)
      );
      return [...prev, ...newWorkersToAdd];
    });
  }

  function proceedToTemplate() {
    if (!selectedWorkers.length) return alert("Chưa chọn nhân viên nào.");
    if (!prodRules.length) return alert("Chưa tải được Rule điểm, vui lòng thử lại.");
    setStep(2);
  }

  function buildReviewRows() {
    // THÊM KIỂM TRA NGÀY
    if (tplDate > today) {
      return alert("Không thể chọn ngày trong tương lai.");
    }

    if (!tplDate || !tplShift) return alert("Nhập Ngày & Ca.");
    if (!tplCategory) return alert("Chọn Loại hàng.");
    const rows = selectedWorkers.map((w) => {
      const scores = previewScores;
      return {
        section, work_date: tplDate, shift: tplShift, msnv: w.msnv, hoten: w.full_name,
        approver_msnv: w.approver_msnv || approverIdInput, approver_name: w.approver_name,
        category: tplCategory, working_input: toNum(tplWorkingInput),
        mold_hours: toNum(tplMoldHours), output: toNum(tplOutput), defects: toNum(tplDefects),
        compliance_code: tplCompliance, q_score: scores.q_score, p_score: scores.p_score,
        day_score: scores.day_score, working_real: scores.working_real,
        downtime: scores.downtime, working_exact: scores.working_exact, status: "approved",
        approver_note: "", // <-- THÊM DÒNG NÀY
      };
    });
    setReviewRows(rows);
    setSelReview(new Set(rows.map((_, i) => i)));
    setStep(3);
  }

  function updateRow(i, key, val) {
    // THÊM KIỂM TRA NGÀY
    if (key === "work_date") {
      if (val > today) {
        alert("Không thể chọn ngày trong tương lai.");
        return; // Không cập nhật state
      }
    }

    setReviewRows((old) => {
      const arr = old.slice();
      const r0 = arr[i] || {};
      // CẬP NHẬT: Thêm "approver_note"
      const r = ["compliance_code", "category", "shift", "work_date", "approver_note"].includes(key)
        ? { ...r0, [key]: val } : { ...r0, [key]: toNum(val, 0) };
      const scores = calculateScoresMolding(r, prodRules);
      arr[i] = {
        ...r, q_score: scores.q_score, p_score: scores.p_score, day_score: scores.day_score,
        working_real: scores.working_real, downtime: scores.downtime, working_exact: scores.working_exact,
      };
      return arr;
    });
  }
  function toggleAllReviewOnPage() {
    setSelReview((prev) => {
      const next = new Set(prev);
      const allOnPage = pageRows.every((_, idx) => next.has((page - 1) * pageSize + idx));
      if (allOnPage) pageRows.forEach((_, idx) => next.delete((page - 1) * pageSize + idx));
      else pageRows.forEach((_, idx) => next.add((page - 1) * pageSize + idx));
      return next;
    });
  }
  function toggleOneReview(i) {
    setSelReview((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }
  const globalIndex = (i) => (page - 1) * pageSize + i;

  async function saveBatch() {
    const idxs = Array.from(selReview).sort((a, b) => a - b);
    if (!idxs.length) return alert("Chưa chọn dòng để lưu.");
    setSaving(true);
    const list = idxs.map((i) => reviewRows[i]);
    const now = new Date().toISOString();
    const payload = list.map((r) => {
      const scores = calculateScoresMolding(r, prodRules);
      const overflow = Math.max(0, scores.rawTotal - 15);
      return {
        section: r.section, date: r.work_date, ca: r.shift, worker_id: r.msnv, worker_name: r.hoten,
        approver_msnv: r.approver_msnv, approver_name: r.approver_name, category: r.category,
        working_input: r.working_input, working_real: r.working_real, working_exact: r.working_exact,
        downtime: r.downtime, mold_hours: r.mold_hours, output: r.output, defects: Number(r.defects || 0),
        q_score: scores.q_score, p_score: scores.p_score, day_score: scores.day_score, overflow,
        compliance_code: r.compliance_code, status: "approved", approved_at: now,
        approver_note: r.approver_note || null, // <-- THÊM DÒNG NÀY
      };
    });
    const { error } = await supabase
      .from("kpi_entries_molding")
      .upsert(payload, { onConflict: "worker_id,date,section" });
    setSaving(false);
    if (error) return alert("Lưu lỗi: " + error.message);
    alert(`Đã lưu ${payload.length} dòng (approved).`);
  }

  function resetToStep1() {
    setStep(1);
    setSelectedWorkers([]);
    setSearchResults([]);
    setReviewRows([]);
    setSelReview(new Set());
    setSearchInput("");
    setApproverIdInput("");
  }

  /* UI */
  return (
    <div className="space-y-4">
      {step === 1 && (
        <>
          <div className="flex justify-end">
            <button
              className="btn btn-primary"
              onClick={proceedToTemplate}
              disabled={!selectedWorkers.length}
            >
              Tiếp tục ({selectedWorkers.length}) ›
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ minHeight: '400px' }}>
            <div className="border rounded p-3 bg-white space-y-2 flex flex-col">
              {/* ----- THAY THẾ KHỐI HEADER ĐÃ CHỌN ĐỂ THÊM NÚT XOÁ TẤT CẢ ----- */}
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Đã chọn ({selectedWorkers.length})</h3>
                {selectedWorkers.length > 0 && (
                  <button
                    className="btn bg-red-100 text-red-700 hover:bg-red-200"
                    style={{ padding: '4px 8px' }}
                    onClick={removeAllWorkers}
                  >
                    Xoá tất cả
                  </button>
                )}
              </div>
              {/* ----------------------------------------------------------------- */}
              <div className="overflow-auto flex-1">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="p-2 text-left">MSNV</th><th className="p-2 text-left">Họ & tên</th><th className="p-2 text-center">Xoá</th></tr></thead>
                  <tbody>
                    {selectedWorkers.map((w) => (
                      <tr key={w.msnv} className="border-t">
                        <td className="p-2">{w.msnv}</td><td className="p-2">{w.full_name}</td>
                        <td className="p-2 text-center"><button className="btn bg-red-100 text-red-700 hover:bg-red-200" style={{ padding: '4px 8px' }} onClick={() => removeWorker(w.msnv)}>Xoá</button></td>
                      </tr>
                    ))}
                    {!selectedWorkers.length && (<tr><td colSpan={3} className="p-4 text-center text-gray-500">Chưa chọn nhân viên nào.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="border rounded p-3 bg-white space-y-3 flex flex-col">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium">Cách 1: Tìm theo Người duyệt</label>
                  <input className="input w-full" value={approverIdInput} onChange={(e) => setApproverIdInput(e.target.value.trim())} placeholder="Nhập Tên hoặc MSNV người duyệt..." />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="text-sm flex items-center gap-1 mb-2">
                    <input type="checkbox" checked={searchAllSections} onChange={(e) => setSearchAllSections(e.target.checked)} />
                    All sections
                  </label>
                  <button className="btn" onClick={searchByApprover} disabled={loadingSearch}>{loadingSearch ? "..." : "Tải"}</button>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium">Cách 2: Tìm theo Tên/MSNV (NV)</label>
                  <input className="input w-full" value={searchInput} onChange={(e) => setSearchInput(e.target.value.trim())} placeholder="Nhập Tên hoặc MSNV nhân viên..." />
                </div>
                <button className="btn" onClick={searchGlobal} disabled={loadingSearch}>{loadingSearch ? "..." : "Tìm"}</button>
              </div>

              <div className="overflow-auto flex-1 border-t pt-2">
                {/* ----- THÊM NÚT "+ THÊM TẤT CẢ" (MOLDING) ----- */}
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-semibold">Kết quả tìm kiếm ({searchResults.length})</h4>
                  <button
                    className="btn"
                    style={{ padding: '4px 8px' }}
                    onClick={addAllResults}
                    disabled={!searchResults.length}
                    title="Thêm tất cả kết quả tìm kiếm vào danh sách 'Đã chọn'"
                  >
                    + Thêm tất cả
                  </button>
                </div>

                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="p-2 text-left">MSNV</th><th className="p-2 text-left">Họ & tên</th><th className="p-2 text-center">Thêm</th></tr></thead>
                  <tbody>
                    {searchResults.map((w) => {
                      const isSelected = selectedIds.has(w.msnv);
                      return (
                        <tr key={w.msnv} className={cx("border-t", isSelected ? "bg-gray-100 opacity-50" : "hover:bg-gray-50")}>
                          <td className="p-2">{w.msnv}</td><td className="p-2">{w.full_name}</td>
                          <td className="p-2 text-center">
                            <button className="btn" style={{ padding: '4px 8px' }} onClick={() => addWorker(w)} disabled={isSelected}>
                              {isSelected ? "Đã chọn" : "+"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!searchResults.length && (<tr><td colSpan={3} className="p-4 text-center text-gray-500">Không có kết quả.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div><label>Ngày</label><input
              type="date"
              className="input"
              value={tplDate}
              onChange={e => setTplDate(e.target.value)}
              max={today} // <-- THÊM THUỘC TÍNH NÀY
            /></div>
            <div><label>Ca</label><select className="input" value={tplShift} onChange={e => setTplShift(e.target.value)}><option value="Ca 1">Ca 1</option><option value="Ca 2">Ca 2</option><option value="Ca 3">Ca 3</option><option value="Ca HC">Ca HC</option></select></div>
            <div><label>Loại hàng</label><select className="input" value={tplCategory} onChange={e => setTplCategory(e.target.value)}><option value="">-- Chọn loại --</option>{categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label>Tuân thủ</label><select className="input text-center" value={tplCompliance} onChange={(e) => setTplCompliance(e.target.value)}>{COMPLIANCE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></div>
            <div><label>Giờ làm việc (nhập)</label><input type="number" className="input" value={tplWorkingInput} onChange={e => setTplWorkingInput(e.target.value)} /></div>
            <div><label>Số giờ khuôn chạy</label><input type="number" className="input" value={tplMoldHours} onChange={e => setTplMoldHours(e.target.value)} /></div>
            <div><label>Sản lượng / ca</label><input type="number" className="input" value={tplOutput} onChange={e => setTplOutput(e.target.value)} /></div>
            <div><label>Số đôi phế</label><input type="number" className="input" value={tplDefects} onChange={e => setTplDefects(e.target.value)} step="0.5" /></div>
          </div>
          <div className="rounded border p-3 bg-gray-50">
            <div className="flex gap-6 text-sm flex-wrap">
              <div>Giờ T Tế: <b>{previewScores.working_real}</b></div>
              <div>Giờ C Xác: <b>{previewScores.working_exact}</b></div>
              <div>Tỷ lệ NS: <b>{previewScores.prodRate.toFixed(2)}</b></div>
              <div>Q: <b>{tplQ}</b></div><div>P: <b>{tplP}</b></div>
              <div>KPI (Max 15): <b>{tplKPI}</b></div>
            </div>
          </div>
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-center">
                <tr><th>MSNV</th><th>Họ tên</th><th>Loại hàng</th><th>Giờ nhập</th><th>Giờ khuôn</th><th>Sản lượng</th><th>Phế</th><th>Q</th><th>P</th><th>KPI</th><th>Tuân thủ</th></tr>
              </thead>
              <tbody className="text-center">
                {selectedWorkers.map((w) => (
                  <tr key={w.msnv} className="border-t hover:bg-gray-50">
                    <td>{w.msnv}</td><td>{w.full_name}</td><td>{tplCategory}</td><td>{tplWorkingInput}</td>
                    <td>{tplMoldHours}</td><td>{tplOutput}</td><td>{tplDefects}</td>
                    <td>{tplQ}</td><td>{tplP}</td><td className="font-semibold">{tplKPI}</td>
                    <td>{COMPLIANCE_OPTIONS.find(o => o.value === tplCompliance)?.label || tplCompliance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between">
            <button className="btn" onClick={() => { setStep(1); setSearchResults([]); }}>‹ Quay lại</button>
            <button className="btn btn-primary" onClick={buildReviewRows}>Tạo danh sách Review ›</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <EditReviewMolding
          pageSize={pageSize} page={page} setPage={setPage} totalPages={totalPages} pageRows={pageRows}
          selReview={selReview} toggleAllReviewOnPage={toggleAllReviewOnPage}
          toggleOneReview={toggleOneReview} // <-- THÊM PROP NÀY
          saveBatch={saveBatch} saving={saving}
          updateRow={updateRow}
          categoryOptions={categoryOptions}
          resetToStep1={resetToStep1}
        />
      )}
    </div>
  );
}


/* --- Bảng Review (MOLDING) --- */
function EditReviewMolding({
  pageSize, page, setPage, totalPages, pageRows, selReview,
  toggleAllReviewOnPage, toggleOneReview, updateRow, saveBatch, saving,
  categoryOptions,
  resetToStep1
}) {
  const globalIndex = (idx) => (page - 1) * pageSize + idx;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="btn btn-primary" onClick={saveBatch} disabled={saving || !selReview.size}>
          {saving ? "Đang lưu..." : `Lưu đã chọn (${selReview.size})`}
        </button>
        <button className="btn" onClick={resetToStep1} disabled={saving}>
          ‹ Quay lại (Nhập mới)
        </button>
        <div className="ml-auto flex items-center gap-3">
          <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>‹ Trước</button>
          <span>Trang {page}/{totalPages}</span>
          <button className="btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Sau ›</button>
        </div>
      </div>

      <div className="overflow-auto border rounded">
        {/* CẬP NHẬT: Tăng min-w từ 1300px lên 1450px */}
        <table className="min-w-[1450px] text-sm">
          <thead className="bg-gray-50 text-center">
            <tr>
              <th className="p-2"><input type="checkbox" onChange={toggleAllReviewOnPage} checked={pageRows.length > 0 && pageRows.every((_, idx) => selReview.has(globalIndex(idx)))} /></th>
              <th className="p-2">MSNV</th>
              <th className="p-2">Họ tên</th>
              <th className="p-2">Ngày</th>
              <th className="p-2">Ca</th>
              <th className="p-2">Loại hàng</th>
              <th className="p-2">Giờ nhập</th>
              <th className="p-2">Giờ khuôn</th>
              <th className="p-2">SL/ca</th>
              <th className="p-2">Phế</th>
              <th className="p-2">Giờ TT</th>
              <th className="p-2">Giờ CX</th>
              <th className="p-2">Q</th>
              <th className="p-2">P</th>
              <th className="p-2">KPI</th>
              <th className="p-2">Tuân thủ</th>
              {/* THÊM CỘT MỚI */}
              <th className="p-2">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="text-center">
            {pageRows.map((r, idx) => {
              const gi = globalIndex(idx);
              return (
                <tr key={gi} className="border-t hover:bg-gray-50">
                  <td className="p-2"><input type="checkbox" checked={selReview.has(gi)} onChange={() => toggleOneReview(gi)} /></td>
                  <td className="p-2">{r.msnv}</td>
                  <td className="p-2">{r.hoten}</td>
                  <td className="p-2"><input
                    type="date"
                    className="input text-center w-32"
                    value={r.work_date}
                    onChange={(e) => updateRow(gi, "work_date", e.target.value)}
                    max={today} // <-- THÊM THUỘC TÍNH NÀY
                  /></td>
                  <td className="p-2"><select className="input text-center" value={r.shift} onChange={(e) => updateRow(gi, "shift", e.target.value)}><option value="Ca 1">Ca 1</option><option value="Ca 2">Ca 2</option><option value="Ca 3">Ca 3</option><option value="Ca HC">Ca HC</option></select></td>
                  <td className="p-2"><select className="input text-center w-32" value={r.category} onChange={(e) => updateRow(gi, "category", e.target.value)}><option value="">--Chọn--</option>{categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                  <td className="p-2"><input type="number" className="input text-center w-20" value={r.working_input} onChange={(e) => updateRow(gi, "working_input", e.target.value)} /></td>
                  <td className="p-2"><input type="number" className="input text-center w-20" value={r.mold_hours} onChange={(e) => updateRow(gi, "mold_hours", e.target.value)} /></td>
                  <td className="p-2"><input type="number" className="input text-center w-20" value={r.output} onChange={(e) => updateRow(gi, "output", e.target.value)} /></td>
                  <td className="p-2"><input type="number" className="input text-center w-20" value={r.defects} onChange={(e) => updateRow(gi, "defects", e.target.value)} step="0.5" /></td>
                  <td className="p-2">{r.working_real}</td>
                  <td className="p-2">{r.working_exact}</td>
                  <td className="p-2">{r.q_score}</td>
                  <td className="p-2">{r.p_score}</td>
                  <td className="p-2 font-semibold">{r.day_score}</td>
                  <td className="p-2"><select className="input text-center w-28" value={r.compliance_code} onChange={(e) => updateRow(gi, "compliance_code", e.target.value)}>{COMPLIANCE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></td>
                  {/* THÊM CỘT INPUT GHI CHÚ */}
                  <td className="p-2">
                    <input
                      type="text"
                      className="input text-center w-28"
                      value={r.approver_note || ""}
                      onChange={(e) => updateRow(gi, "approver_note", e.target.value)}
                      placeholder="Ghi chú..."
                    />
                  </td>
                </tr>
              );
            })}
            {/* CẬP NHẬT: Tăng colSpan */}
            {!pageRows.length && (<tr><td colSpan={17} className="p-4 text-center text-gray-500">Không có dữ liệu</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
/* ===== (Hết Molding Nâng Cấp) ===== */


/* ======================================================================
   MODE 2: Tự nhập (MSNV người nhập) – MOLDING ONLY (Giữ nguyên)
   ====================================================================== */
function SelfModeMolding({ section }) {
  const today = new Date().toISOString().slice(0, 10);
  const [entrantId, setEntrantId] = useState("");
  const [entrantName, setEntrantName] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [workerName, setWorkerName] = useState("");
  useEffect(() => {
    const id = entrantId.trim();
    if (!id) { setEntrantName(""); setWorkerId(""); setWorkerName(""); return; }
    supabase.from("users").select("msnv, full_name").eq("msnv", id).maybeSingle()
      .then(({ data, error }) => {
        if (error) return console.error(error);
        if (data) { setEntrantName(data.full_name || ""); setWorkerId(data.msnv); setWorkerName(data.full_name || ""); }
        else { setEntrantName(""); setWorkerId(""); setWorkerName(""); }
      });
  }, [entrantId]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [rulesByCat, setRulesByCat] = useState({});
  useEffect(() => {
    supabase.from("kpi_rule_productivity").select("category, threshold, score").eq("section", "MOLDING").eq("active", true)
      .order("category", { ascending: true }).order("threshold", { ascending: false })
      .then(({ data, error }) => {
        if (error) return console.error(error);
        const cats = new Set(); const map = {};
        (data || []).forEach((r) => {
          cats.add(r.category); if (!map[r.category]) map[r.category] = [];
          map[r.category].push({ threshold: Number(r.threshold), score: Number(r.score) });
        });
        setCategoryOptions([...cats]); setRulesByCat(map);
      });
  }, []);
  const [rows, setRows] = useState([]);
  function listDates(from, to) {
    const res = []; const start = new Date(from); const end = new Date(to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) { res.push(d.toISOString().slice(0, 10)); }
    return res;
  }
  function buildRowsByDates() {
    // THÊM KIỂM TRA NGÀY
    if (dateFrom > today || dateTo > today) {
      return alert("Khoảng ngày không thể ở tương lai.");
    }

    if (!entrantId.trim()) return alert("Nhập MSNV người nhập trước.");
    if (!dateFrom || !dateTo) return alert("Chọn khoảng ngày.");
    if (new Date(dateFrom) > new Date(dateTo)) return alert("Khoảng ngày không hợp lệ.");
    const days = listDates(dateFrom, dateTo);
    const base = days.map((d) => ({
      section, date: d, ca: "", worker_id: workerId, worker_name: workerName, entrant_msnv: entrantId, entrant_name: entrantName,
      category: "", working_input: 8, working_real: 0, downtime: 0, working_exact: 0, mold_hours: 0,
      output: 0, defects: 0, q_score: 0, p_score: 0, day_score: 0, compliance_code: "NONE", status: "approved",
    }));
    setRows(base);
  }

  function recompute(row) {
    const scores = calculateScoresMolding(row, rulesByCat[row.category] || []); // <-- Sửa lỗi: truyền đúng rules
    return {
      ...row,
      q_score: scores.q_score,
      p_score: scores.p_score,
      day_score: scores.day_score,
      working_real: scores.working_real,
      downtime: scores.downtime,
      working_exact: scores.working_exact,
    };
  }

  function update(i, key, val) {
    setRows((old) => {
      const copy = old.slice();
      const r = { ...copy[i], [key]: ["ca", "category", "compliance_code"].includes(key) ? val : toNum(val, 0) };
      copy[i] = recompute(r);
      return copy;
    });
  }
  const [saving, setSaving] = useState(false);
  async function saveAll() {
    if (!rows.length) return alert("Không có dữ liệu để lưu.");
    const now = new Date().toISOString();
    const payload = rows.map((r) => {
      const finalScores = calculateScoresMolding(r, rulesByCat[r.category] || []); // <-- Sửa lỗi: truyền đúng rules
      const overflow = Math.max(0, finalScores.rawTotal - 15);
      return {
        section: r.section, date: r.date, ca: r.ca, worker_id: r.worker_id, worker_name: r.worker_name,
        approver_msnv: r.entrant_msnv, approver_name: r.entrant_name, category: r.category,
        working_input: r.working_input,
        working_real: finalScores.working_real,
        working_exact: finalScores.working_exact,
        downtime: finalScores.downtime,
        mold_hours: r.mold_hours, output: r.output, defects: Number(r.defects || 0),
        q_score: finalScores.q_score, p_score: finalScores.p_score, day_score: finalScores.day_score, overflow,
        compliance_code: r.compliance_code, status: "approved", approved_at: now,
      };
    });
    setSaving(true);
    const { error } = await supabase.from("kpi_entries_molding").upsert(payload, { onConflict: "worker_id,date,section" });
    setSaving(false);
    if (error) return alert("Lưu lỗi: " + error.message);
    alert(`Đã lưu ${payload.length} dòng.`);
  }
  return (
    <div className="space-y-4">
      <div className="rounded border p-3 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <label>MSNV người nhập<input className="input" value={entrantId} onChange={(e) => setEntrantId(e.target.value.trim())} /></label>
          <label>Họ tên người nhập<input className="input" value={entrantName} readOnly /></label>
          <label>MSNV/Họ tên (áp dụng = người nhập)<input className="input" value={`${workerId} / ${workerName}`} readOnly /></label>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <label>Từ ngày<input
            type="date"
            className="input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            max={today} // <-- THÊM THUỘC TÍNH NÀY
          /></label>
          <label>Đến ngày<input
            type="date"
            className="input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            max={today} // <-- THÊM THUỘC TÍNH NÀY
          /></label>
          <div className="flex items-end"><button className="btn" onClick={buildRowsByDates}>Tạo danh sách ngày</button></div>
        </div>
      </div>
      {!!rows.length && (
        <>
          <div className="overflow-auto border rounded">
            <table className="min-w-[1100px] text-sm">
              <thead className="bg-gray-50 text-center">
                <tr><th>Ngày</th><th>Ca</th><th>Loại hàng</th><th>Giờ nhập</th><th>Giờ thực tế</th><th>Downtime</th><th>Giờ chính xác</th><th>Khuôn chạy</th><th>SL/ca</th><th>Phế</th><th>Q</th><th>P</th><th>KPI</th><th>Tuân thủ</th></tr>
              </thead>
              <tbody className="text-center">
                {rows.map((r, i) => (
                  <tr key={r.date} className="border-t hover:bg-gray-50">
                    <td>{r.date}</td>
                    <td><select className="input text-center" value={r.ca} onChange={(e) => update(i, "ca", e.target.value)}><option value="">--Ca--</option><option value="Ca 1">Ca 1</option><option value="Ca 2">Ca 2</option><option value="Ca 3">Ca 3</option><option value="Ca HC">Ca HC</option></select></td>
                    <td><select className="input text-center" value={r.category} onChange={(e) => update(i, "category", e.target.value)}><option value="">--Loại--</option>{categoryOptions.map(c => (<option key={c} value={c}>{c}</option>))}</select></td>
                    <td><input type="number" className="input text-center" value={r.working_input} onChange={(e) => update(i, "working_input", e.target.value)} /></td>
                    <td>{r.working_real}</td><td>{r.downtime}</td><td>{r.working_exact}</td>
                    <td><input type="number" className="input text-center" value={r.mold_hours} onChange={(e) => update(i, "mold_hours", e.target.value)} /></td>
                    <td><input type="number" className="input text-center" value={r.output} onChange={(e) => update(i, "output", e.target.value)} /></td>
                    <td><input type="number" className="input text-center" value={r.defects} onChange={(e) => update(i, "defects", e.target.value)} step="0.5" /></td>
                    <td>{r.q_score}</td><td>{r.p_score}</td><td className="font-semibold">{r.day_score}</td>
                    <td><select className="input text-center" value={r.compliance_code} onChange={(e) => update(i, "compliance_code", e.target.value)}>{COMPLIANCE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2"><button className="btn btn-primary" onClick={saveAll} disabled={saving}>{saving ? "Đang lưu..." : "Lưu tất cả"}</button></div>
        </>
      )}
    </div>
  );
}