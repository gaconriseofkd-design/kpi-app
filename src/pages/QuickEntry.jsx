// src/pages/QuickEntry.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";
import {
  scoreByQuality,
  scoreByQualityLeanline,
  scoreByQualityMolding,
  scoreByCompliance,
  getLeanlineCompliancePenalty,
  getMoldingCompliancePenalty
} from "../lib/scoring";
import ApproverModeHybrid from "./QuickEntryLPS";

/* ===== Helpers ===== */
// Hardcoded options removed in favor of Supabase dictionary

const HYBRID_SECTIONS = ["LAMINATION", "PREFITTING", "BÀO", "TÁCH"];
const isHybridSection = (sectionKey) => HYBRID_SECTIONS.includes(sectionKey);
const cx = (...a) => a.filter(Boolean).join(" ");
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const getMoldedCategoryFromLine = (line) => {
  return '%OE';
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
function calculateScoresLeanlineQuick(oe, defects, rules, sec, line, compliance) {
  const q = scoreByQualityLeanline(defects);
  const penalty = getLeanlineCompliancePenalty(compliance);
  const c = scoreByCompliance(penalty);
  const p = scoreByProductivityLeanlineQuick(oe, rules, sec, line);
  const total = q + p + c;

  // !!! QUAN TRỌNG: Trả về key là "day_score" để đồng nhất với database !!!
  return { qScore: q, pScore: p, cScore: c, day_score: Math.min(15, total), rawTotal: total };
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

function calculateScoresMolding({ shift, working_input, mold_hours, output, defects, category, quality_code, compliance }, rules) {
  const workingReal = calcWorkingReal(shift, working_input);
  let dt = (Number(workingReal) * 24 - Number(mold_hours || 0)) / 24;
  // Cap lại logic
  if (dt > 1) dt = 1;
  if (dt < 0) dt = 0;

  const workingExact = Math.max(0, Number(workingReal) - dt);

  // Quality Score
  // Nếu có quality_code (lỗi chất lượng cụ thể) thì có thể xử lý điểm ở đây.
  // Hiện tại vẫn giữ logic theo số đôi phế.
  const q = scoreByQualityMolding(defects);

  // Compliance Score
  const penalty = getMoldingCompliancePenalty(compliance);
  const c = scoreByCompliance(penalty);

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

  const total = p + q + c;

  // Return all needed fields
  return {
    q_score: q,
    p_score: p,
    c_score: c,
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
  const [tplQualityCode, setTplQualityCode] = useState("NONE");
  const [tplCompliance, setTplCompliance] = useState("NONE");
  const [complianceDict, setComplianceDict] = useState([]);

  // Fetch Compliance Options
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("kpi_compliance_dictionary").select("*");
      if (data) setComplianceDict(data);
    })();
  }, []);

  const getComplianceOptions = (cat = "COMPLIANCE") => {
    const secKey = section === "MOLDING" ? "MOLDING" : (section === "LAMINATION" ? "LAMINATION" : "OTHERS");
    return ["NONE", ...new Set(complianceDict.filter(r => r.section === secKey && r.category === cat).map(r => r.content))];
  };

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

  const calculateScores = (oe, defects, rules, sec, line, compl) => {
    return calculateScoresLeanlineQuick(oe, defects, rules, sec, line, compl);
  };

  const previewScores = useMemo(() =>
    calculateScores(tplOE, tplDefects, prodRules, section, tplLine, tplCompliance),
    [tplOE, tplDefects, prodRules, section, tplLine, tplCompliance]
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
      const scores = calculateScores(tplOE, tplDefects, prodRules, section, tplLine, tplCompliance);
      return {
        section, work_date: tplDate, shift: tplShift, msnv: w.msnv, hoten: w.full_name,
        approver_id: w.approver_msnv || approverIdInput, approver_name: w.approver_name,
        line: tplLine,
        work_hours: toNum(tplWorkHours), downtime: toNum(tplStopHours),
        oe: toNum(tplOE), defects: toNum(tplDefects),
        quality_code: tplQualityCode,
        compliance: tplCompliance,
        q_score: scores.qScore, p_score: scores.pScore, c_score: scores.cScore,
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
      if (["compliance", "quality_code", "line", "shift", "work_date", "approver_note"].includes(key)) {
        r[key] = val;
      } else {
        r[key] = toNum(val, 0);
      }
      const sc = calculateScores(r.oe, r.defects, prodRules, section, r.line, r.compliance);
      arr[i] = { ...r, q_score: sc.qScore, p_score: sc.pScore, c_score: sc.cScore, total_score: sc.day_score };
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
      const rawScores = calculateScores(r.oe, r.defects, prodRules, section, r.line, r.compliance);
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
        quality_code: r.quality_code || null,
        compliance_code: r.compliance,


        section,
        status: "approved",
        created_at: now,
        approved_at: now,
        approver_note: r.approver_note || null,
        p_score: rawScores.pScore,
        q_score: rawScores.qScore,
        c_score: rawScores.cScore,

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

            <div className="md:col-span-2 flex gap-4">
              <div className="flex-1">
                <label className="font-bold text-blue-700">Lỗi Chất lượng (Q)</label>
                <select className="input w-full" value={tplQualityCode} onChange={(e) => setTplQualityCode(e.target.value)}>
                  {getComplianceOptions("QUALITY").map(o => <option key={o} value={o}>{o === "NONE" ? "Không lỗi" : o}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="font-bold text-red-700">Lỗi Tuân thủ (C)</label>
                <select className="input w-full" value={tplCompliance} onChange={(e) => setTplCompliance(e.target.value)}>
                  {getComplianceOptions("COMPLIANCE").map(o => <option key={o} value={o}>{o === "NONE" ? "Không vi phạm" : o}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
            <h4 className="font-semibold text-yellow-800">Điểm KPI Tạm tính (Template):</h4>
            <p>Sản Lượng: <b>{tplP}</b> | Chất Lượng: <b>{tplQ}</b> | Tuân Thủ: <b>{previewScores.cScore}</b></p>
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
                  <th className="p-2 min-w-[150px]">Lỗi CL</th>
                  <th className="p-2 min-w-[150px]">Tuân thủ</th>
                  <th className="p-2 w-10">P</th>
                  <th className="p-2 w-10">Q</th>
                  <th className="p-2 w-10">C</th>
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
                        <select className="input w-full p-1 text-xs" value={r.quality_code} onChange={e => updateRow(i, 'quality_code', e.target.value)}>
                          {getComplianceOptions("QUALITY").map(o => <option key={o} value={o}>{o === "NONE" ? "--" : o}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <select className="input text-center w-[140px]" value={r.compliance} onChange={e => updateRow(i, "compliance", e.target.value)}>
                          {getComplianceOptions("COMPLIANCE").map(o => (
                            <option key={o} value={o}>{o === "NONE" ? (section === 'LAMINATION' ? "Không vi phạm" : "--") : o}</option>
                          ))}
                        </select>
                      </td>

                      <td className="p-2 text-center text-gray-600">{r.p_score}</td>
                      <td className="p-2 text-center text-gray-600">{r.q_score}</td>
                      <td className="p-2 text-center text-gray-600">{r.c_score}</td>
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
  const [tplQualityCode, setTplQualityCode] = useState("NONE");
  const [tplCompliance, setTplCompliance] = useState("NONE");
  const [reviewRows, setReviewRows] = useState([]);
  const [selReview, setSelReview] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const pageSize = 50;
  const [page, setPage] = useState(1);

  const [complianceDict, setComplianceDict] = useState([]);

  useEffect(() => {
    supabase.from("kpi_compliance_dictionary").select("*").then(({ data }) => {
      if (data) setComplianceDict(data);
    });

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

  const getComplianceOptions = (cat = "COMPLIANCE") => {
    return ["NONE", ...new Set(complianceDict.filter(r => r.section === "MOLDING" && r.category === cat).map(r => r.content))];
  };

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
    if (!searchAllSections) query = query.eq("section", "MOLDING");
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
      query = supabase.from("users").select("msnv, full_name, section, line, approver_msnv, approver_name").ilike("full_name", `%${q}%`);
    } else {
      query = supabase.from("users").select("msnv, full_name, section, line, approver_msnv, approver_name").eq("msnv", q);
    }
    if (!searchAllSections) query = query.eq("section", "MOLDING");
    const { data, error } = await query.limit(50);
    setLoadingSearch(false);
    if (error) return alert("Lỗi tìm nhân viên: " + error.message);
    setSearchResults(data || []);
    setApproverIdInput("");
  }

  function addWorker(worker) {
    setSelectedWorkers(prev => prev.find(w => w.msnv === worker.msnv) ? prev : [worker, ...prev]);
  }
  function removeWorker(msnv) { setSelectedWorkers(prev => prev.filter(w => w.msnv !== msnv)); }

  function buildReviewRows() {
    if (tplDate > today) return alert("Không thể chọn ngày trong tương lai.");
    if (!selectedWorkers.length) return alert("Chưa chọn NV.");
    if (!tplCategory) return alert("Chưa chọn Loại hàng.");

    const rows = selectedWorkers.map((w) => {
      const result = calculateScoresMolding({
        shift: tplShift, working_input: tplWorkingInput, mold_hours: tplMoldHours,
        output: tplOutput, defects: tplDefects, category: tplCategory,
        quality_code: tplQualityCode, compliance: tplCompliance
      }, prodRules);

      return {
        section, work_date: tplDate, shift: tplShift, msnv: w.msnv, hoten: w.full_name,
        approver_id: w.approver_msnv || approverIdInput, approver_name: w.approver_name,
        line: w.line, work_hours: toNum(tplWorkingInput), stop_hours: toNum(tplMoldHours),
        output: toNum(tplOutput), defects: toNum(tplDefects), category: tplCategory,
        quality_code: tplQualityCode, compliance: tplCompliance,
        q_score: result.q_score, p_score: result.p_score, c_score: result.c_score,
        total_score: result.day_score, status: "approved", approver_note: "",
      }
    });
    setReviewRows(rows);
    setSelReview(new Set(rows.map((_, i) => i)));
    setStep(2);
    setPage(1);
  }

  function updateRow(i, key, val) {
    if (key === "work_date" && val > today) return alert("Không thể chọn ngày trong tương lai.");
    setReviewRows((old) => {
      const arr = [...old];
      const r0 = arr[i] || {};
      let r = { ...r0 };
      if (["category", "quality_code", "compliance", "shift", "work_date", "approver_note", "line"].includes(key)) r[key] = val;
      else r[key] = toNum(val, 0);

      const result = calculateScoresMolding({
        shift: r.shift, working_input: r.work_hours, mold_hours: r.stop_hours,
        output: r.output, defects: r.defects, category: r.category,
        quality_code: r.quality_code, compliance: r.compliance
      }, prodRules);

      arr[i] = { ...r, q_score: result.q_score, p_score: result.p_score, c_score: result.c_score, total_score: result.day_score };
      return arr;
    });
  }

  async function saveBatch() {
    const idxs = Array.from(selReview).sort((a, b) => a - b);
    if (!idxs.length) return alert("Chưa chọn dòng.");
    setSaving(true);
    const list = idxs.map(i => reviewRows[i]);
    const now = new Date().toISOString();

    const payload = list.map(r => {
      const result = calculateScoresMolding({
        shift: r.shift, working_input: r.work_hours, mold_hours: r.stop_hours,
        output: r.output, defects: r.defects, category: r.category,
        quality_code: r.quality_code, compliance: r.compliance
      }, prodRules);

      return {
        date: r.work_date, ca: r.shift, worker_id: r.msnv, worker_name: r.hoten,
        approver_id: r.approver_id, approver_name: r.approver_name, line: r.line,
        work_hours: r.work_hours, stop_hours: r.stop_hours, output: r.output || null,
        defects: r.defects, category: r.category || null, quality_code: r.quality_code || null,
        compliance_code: r.compliance, section: "MOLDING", status: "approved",
        created_at: now, approved_at: now, approver_note: r.approver_note || null,
        p_score: result.p_score, q_score: result.q_score, c_score: result.c_score,
        day_score: result.day_score, overflow: result.rawTotal > 15 ? (result.rawTotal - 15) : 0
      };
    });

    const { error } = await supabase.from("kpi_entries").upsert(payload, { onConflict: "worker_id,date,section" });
    setSaving(false);
    if (error) return alert("Lỗi: " + error.message);
    alert(`Đã lưu ${payload.length} dòng.`);
    setReviewRows(prev => prev.filter((_, i) => !idxs.includes(i)));
    setSelReview(new Set());
    if (reviewRows.length - idxs.length === 0) setStep(1);
  }

  const globalIdx = (idx) => (page - 1) * pageSize + idx;
  const totalPages = Math.ceil(reviewRows.length / pageSize) || 1;
  const pageRows = reviewRows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-1/2 p-4 border rounded bg-white">
              <h3 className="font-bold mb-2">Tìm NV ({selectedWorkers.length})</h3>
              <div className="space-y-2 pb-2 border-b">
                <form onSubmit={e => { e.preventDefault(); searchByApprover(); }} className="flex gap-2">
                  <input className="input flex-1" placeholder="Mã/Tên Người Duyệt" value={approverIdInput} onChange={e => setApproverIdInput(e.target.value)} />
                  <button className="btn btn-primary">Tìm</button>
                </form>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="searchAllSectionsM" checked={searchAllSections} onChange={e => setSearchAllSections(e.target.checked)} />
                  <label htmlFor="searchAllSectionsM" className="text-sm">Tìm NV toàn hệ thống</label>
                </div>
              </div>
              <div className="mt-2 text-sm font-medium">Tìm NV lẻ:</div>
              <form onSubmit={e => { e.preventDefault(); searchGlobal(); }} className="flex gap-2">
                <input className="input flex-1" placeholder="Mã/Tên NV" value={searchInput} onChange={e => setSearchInput(e.target.value)} />
                <button className="btn">Tìm</button>
              </form>
            </div>
            <div className="w-1/2 p-4 border rounded bg-gray-50 flex flex-col h-[400px]">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">Kết quả ({searchResults.length})</span>
                <button className="btn btn-xs" onClick={() => setSelectedWorkers(prev => [...new Set([...prev, ...searchResults])])}>+ Thêm hết</button>
              </div>
              <div className="flex-1 overflow-auto bg-white border rounded">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-100 sticky top-0"><tr><th className="p-1 text-left">MSNV</th><th className="p-1 text-left">Họ Tên</th><th className="p-1"></th></tr></thead>
                  <tbody>{searchResults.map(w => (
                    <tr key={w.msnv} className="border-b">{/* Use w.msnv here */}
                      <td className="p-1">{w.msnv}</td><td className="p-1">{w.full_name}</td>
                      <td className="p-1 text-right"><button className="btn btn-xs" onClick={() => addWorker(w)} disabled={selectedIds.has(w.msnv)}>+</button></td>
                    </tr>))}</tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="border rounded p-4 bg-white">
            <h3 className="font-bold mb-2 text-gray-700">Thông tin KPI áp dụng chung (Template):</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <label>Ngày: <input type="date" className="input" value={tplDate} onChange={e => setTplDate(e.target.value)} max={today} /></label>
              <label>Ca: <select className="input" value={tplShift} onChange={e => setTplShift(e.target.value)}><option value="Ca 1">Ca 1</option><option value="Ca 2">Ca 2</option><option value="Ca 3">Ca 3</option><option value="Ca HC">Ca HC</option></select></label>
              <label>Giờ LV (input): <input type="number" className="input" value={tplWorkingInput} onChange={e => setTplWorkingInput(e.target.value)} /></label>
              <label>Giờ dừng máy: <input type="number" className="input" value={tplMoldHours} onChange={e => setTplMoldHours(e.target.value)} /></label>
              <label>Loại hàng: <select className="input" value={tplCategory} onChange={e => setTplCategory(e.target.value)}><option value="">--Chọn--</option>{categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
              <label>Sản lượng đầu ra: <input type="number" className="input" value={tplOutput} onChange={e => setTplOutput(e.target.value)} /></label>
              <label>Số đôi phế: <input type="number" step="0.5" className="input" value={tplDefects} onChange={e => setTplDefects(e.target.value)} /></label>
              <label>Lỗi Tuân thủ (C): <select className="input" value={tplCompliance} onChange={e => setTplCompliance(e.target.value)}>{getComplianceOptions("COMPLIANCE").map(o => <option key={o} value={o}>{o === "NONE" ? "Không" : o}</option>)}</select></label>
            </div>
            <div className="mt-4 flex justify-between items-center">
              <div className="flex flex-wrap gap-1 max-w-[70%]">{selectedWorkers.map(w => (
                <div key={w.msnv} className="badge gap-1">{w.msnv}<button onClick={() => removeWorker(w.msnv)}>x</button></div>
              ))}</div>
              <button className="btn btn-primary" onClick={buildReviewRows} disabled={!selectedWorkers.length}>Tiếp tục nhập liệu ({selectedWorkers.length}) ›</button>
            </div>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button className="btn btn-primary" onClick={saveBatch} disabled={saving || !selReview.size}>Lưu {selReview.size} dòng</button>
            <button className="btn" onClick={() => setStep(1)}>‹ Quay lại</button>
            <div className="ml-auto flex items-center gap-2">
              <button className="btn btn-xs" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
              <span className="text-sm">Trang {page}/{totalPages}</span>
              <button className="btn btn-xs" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
            </div>
          </div>
          <div className="overflow-auto border rounded bg-white max-h-[500px]">
            <table className="min-w-max text-xs">
              <thead className="bg-gray-100 sticky top-0"><tr>
                <th className="p-1"><input type="checkbox" onChange={() => { if (selReview.size === reviewRows.length) setSelReview(new Set()); else setSelReview(new Set(reviewRows.map((_, i) => i))) }} checked={selReview.size === reviewRows.length && reviewRows.length > 0} /></th>
                <th className="p-1">MSNV</th><th className="p-1">Tên</th><th className="p-1">Mã hàng</th><th className="p-1 w-12">S.Lg</th><th className="p-1 w-12">Giờ LV</th><th className="p-1 w-12">Giờ M</th><th className="p-1 w-12">Phế</th><th className="p-1">Lỗi C</th><th className="p-1">P</th><th className="p-1">Q</th><th className="p-1">C</th><th className="p-1 font-bold">KPI</th><th className="p-1">Ghi chú</th>
              </tr></thead>
              <tbody>{pageRows.map((r, idx) => {
                const i = globalIdx(idx);
                return (
                  <tr key={i} className="border-b">
                    <td className="p-1 text-center"><input type="checkbox" checked={selReview.has(i)} onChange={() => { const ns = new Set(selReview); if (ns.has(i)) ns.delete(i); else ns.add(i); setSelReview(ns); }} /></td>
                    <td className="p-1">{r.msnv}</td><td className="p-1">{r.hoten}</td>
                    <td className="p-1"><select className="input w-36 h-7 py-0" value={r.category} onChange={e => updateRow(i, 'category', e.target.value)}>{categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                    <td className="p-1"><input className="input w-12 h-7 py-0" type="number" value={r.output} onChange={e => updateRow(i, 'output', e.target.value)} /></td>
                    <td className="p-1"><input className="input w-12 h-7 py-0" type="number" value={r.work_hours} onChange={e => updateRow(i, 'work_hours', e.target.value)} /></td>
                    <td className="p-1"><input className="input w-12 h-7 py-0" type="number" value={r.stop_hours} onChange={e => updateRow(i, 'stop_hours', e.target.value)} /></td>
                    <td className="p-1"><input className="input w-12 h-7 py-0" type="number" step="0.5" value={r.defects} onChange={e => updateRow(i, 'defects', e.target.value)} /></td>
                    <td className="p-1"><select className="input w-32 h-7 py-0" value={r.compliance} onChange={e => updateRow(i, 'compliance', e.target.value)}>{getComplianceOptions("COMPLIANCE").map(o => <option key={o} value={o}>{o === "NONE" ? "Không" : o}</option>)}</select></td>
                    <td className="p-1 text-center">{r.p_score}</td><td className="p-1 text-center">{r.q_score}</td><td className="p-1 text-center">{r.c_score}</td><td className="p-1 font-bold text-blue-600">{r.total_score}</td>
                    <td className="p-1"><input className="input w-full h-7 py-0" value={r.approver_note} onChange={e => updateRow(i, 'approver_note', e.target.value)} /></td>
                  </tr>)
              })}</tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}