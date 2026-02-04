// src/pages/QuickEntryLPS.jsx

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/* ================= Scoring & Helpers ================= */
const MACHINE_MAP = {
  "LAMINATION": ["Máy dán 1", "Máy dán 2", "Máy dán 3", "Máy dán 4", "Máy dán 5", "Máy dán 6", "Máy dán 7", "Vòng ngoài"],
  "PREFITTING": ["Máy cắt 1", "Máy cắt 2", "Máy cắt 3", "Máy cắt 4", "Máy cắt 5", "Máy cắt 6", "Vòng ngoài"],
  "BÀO": ["Máy bào 1", "Máy bào 2", "Máy bào 3", "Máy bào 4", "Vòng ngoài"],
  "TÁCH": ["Máy tách 1", "Máy tách 2", "Máy tách 3", "Máy tách 4", "Vòng ngoài"],
};

/* --- LAMINATION CONSTANTS --- */
const LAMINATION_QUALITY_OPTIONS = [
  { value: "SCRAP", label: "Hàng phế" },
  { value: "FAIL_BONDING", label: "Hàng fail bonding (Dry)" },
];
const LAMINATION_COMPLIANCE_OPTIONS = [
  { value: "NONE", label: "Không vi phạm" },
  { value: "MQAA", label: "Vi phạm MQAA" },
  { value: "REWORK", label: "Hàng lỗi Rework" },
  { value: "OTHER", label: "Vi phạm khác" },
];

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
const getTableName = (sectionKey) => "kpi_lps_entries";

// Helper mới cho Prefitting, Bào, Tách (Max 5 điểm)
function scoreByQualityLPS(defects) {
  const d = Number(defects || 0);
  if (d <= 1) return 5;
  if (d <= 2) return 4;
  if (d <= 3) return 2;
  return 0;
}

// Helper mới cho LAMINATION (Chất lượng)
function scoreByQualityLamination(type, defects) {
  if (type === 'FAIL_BONDING') return 0;
  // Mặc định là SCRAP (hoặc rỗng)
  const d = Number(defects || 0);
  if (d <= 1) return 5;
  if (d <= 3) return 4;
  if (d <= 5) return 2;
  return 0;
}

// Helper mới cho LAMINATION (Tuân thủ)
function scoreByComplianceLamination(type, count) {
  if (!type || type === 'NONE') return 3;
  const c = Number(count || 0);
  return Math.max(0, 3 - c);
}

function scoreByProductivityHybrid(prodRate, category, allRules) {
  const val = Number(prodRate ?? 0);
  const rules = (allRules || []).filter(r =>
    r.active !== false &&
    r.category === category
  ).sort((a, b) => Number(b.threshold) - Number(a.threshold));
  for (const r of rules) {
    if (val >= Number(r.threshold)) return Number(r.score || 0);
  }
  return 0;
}

function deriveDayScoresHybrid({ section, defects, category, output, workHours, stopHours, shift, qualityType, compliance, complianceCount }, prodRules) {
  const workingReal = calcWorkingReal(shift, workHours);
  const exactHours = Math.max(0, workingReal - Number(stopHours || 0));
  const prodRate = exactHours > 0 ? Number(output || 0) / exactHours : 0;
  const p = scoreByProductivityHybrid(prodRate, category, prodRules);

  let q;
  if (section === 'LAMINATION') {
    q = scoreByQualityLamination(qualityType, defects);
  } else {
    q = scoreByQualityLPS(defects);
  }

  const c = scoreByComplianceLamination(compliance, complianceCount);
  const total = p + q + c;

  return {
    p_score: p, q_score: q, c_score: c, day_score: Math.min(15, total),
    prodRate: prodRate, workingReal: workingReal, rawTotal: total,
  };
}

const COMPLIANCE_OPTIONS = [
  { value: "NONE", label: "Không vi phạm" },
  { value: "MQAA", label: "Vi phạm MQAA" },
  { value: "REWORK", label: "Hàng lỗi Rework" },
  { value: "OTHER", label: "Vi phạm khác" },
];
const cx = (...a) => a.filter(Boolean).join(" ");
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
/* ================= (Hết Helpers) ================= */


/* ================= Approver Mode HYBRID ================= */

export default function ApproverModeHybrid({ section }) {
  const [step, setStep] = useState(1);
  const [prodRules, setProdRules] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const tableName = getTableName(section);
  const [approverIdInput, setApproverIdInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [searchAllSections, setSearchAllSections] = useState(false);
  const [reviewRows, setReviewRows] = useState([]);
  const [selReview, setSelReview] = useState(() => new Set());

  // Lấy ngày hôm nay
  const today = new Date().toISOString().slice(0, 10);

  const [tplDate, setTplDate] = useState(today); // <-- Đặt mặc định là hôm nay
  const [tplShift, setTplShift] = useState("Ca 1");
  const [tplWorkHours, setTplWorkHours] = useState(8);
  const [tplStopHours, setTplStopHours] = useState(0);
  const [tplOutput, setTplOutput] = useState(100);
  const [tplDefects, setTplDefects] = useState(0);
  const [tplCompliance, setTplCompliance] = useState("NONE");
  const [complianceDict, setComplianceDict] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("kpi_compliance_dictionary").select("*");
      if (data) setComplianceDict(data);
    })();
  }, []);

  const getComplianceOptions = () => {
    const secKey = section === "MOLDING" ? "MOLDING" : (section === "LAMINATION" ? "LAMINATION" : "OTHERS");
    return ["NONE", ...new Set(complianceDict.filter(r => r.section === secKey).map(r => r.content))];
  };

  // --- STATE MỚI CHO LAMINATION ---
  const [tplQualityType, setTplQualityType] = useState('SCRAP'); // SCRAP | FAIL_BONDING
  const [tplComplianceCount, setTplComplianceCount] = useState(0);
  // ------------------------------

  const [saving, setSaving] = useState(false);
  const pageSize = 50;
  const [page, setPage] = useState(1);
  const currentMachines = useMemo(() => MACHINE_MAP[section] || [], [section]);
  const [tplLine, setTplLine] = useState(currentMachines[0] || "");
  const defaultCategory = section === 'LAMINATION' ? 'Lượt dán/giờ' : '';
  const [tplCategory, setTplCategory] = useState(defaultCategory);

  const selectedIds = useMemo(() => new Set(selectedWorkers.map(w => w.msnv)), [selectedWorkers]);

  // ===== THÊM STATE VÀ LOGIC LỌC THEO LINE MỚI =====
  const [lineFilter, setLineFilter] = useState(""); // <-- THÊM DÒNG NÀY

  const availableLines = useMemo(() => {
    // Chỉ lấy lines từ kết quả tìm kiếm hiện tại
    const lines = new Set(searchResults.map(w => w.line).filter(Boolean));
    return ["", ...Array.from(lines).sort()];
  }, [searchResults]);

  const filteredSearchResults = useMemo(() => {
    if (!lineFilter) return searchResults;
    return searchResults.filter(w => w.line === lineFilter);
  }, [searchResults, lineFilter]);
  // =================================================

  // THÊM HÀM XOÁ TẤT CẢ
  function removeAllWorkers() {
    if (window.confirm(`Bạn có chắc muốn xoá ${selectedWorkers.length} nhân viên đã chọn?`)) {
      setSelectedWorkers([]);
    }
  }

  const scores = useMemo(
    () => deriveDayScoresHybrid({
      section, defects: tplDefects, category: tplCategory, output: tplOutput,
      workHours: tplWorkHours, stopHours: tplStopHours, shift: tplShift,
      // Params mới
      qualityType: tplQualityType, compliance: tplCompliance, complianceCount: tplComplianceCount
    }, prodRules),
    [section, tplDefects, tplCategory, tplOutput, tplWorkHours, tplStopHours, tplShift, prodRules, tplQualityType, tplCompliance, tplComplianceCount]
  );
  const tplKPI = scores.day_score;
  const tplProdRate = scores.prodRate;
  const tplQ = scores.q_score;
  const tplP = scores.p_score;
  const tplC = scores.c_score; // Có thể undefined nếu không phải Lamination
  const tplExactHours = Math.max(0, scores.workingReal - toNum(tplStopHours));
  const totalPages = Math.max(1, Math.ceil(reviewRows.length / pageSize));
  const pageRows = useMemo(
    () => reviewRows.slice((page - 1) * pageSize, page * pageSize),
    [reviewRows, page]
  );

  useEffect(() => {
    if (section === 'LAMINATION') setTplCategory('Lượt dán/giờ');
    else setTplCategory('');
  }, [section]);
  useEffect(() => {
    let cancelled = false; const dbSection = section.toUpperCase();
    (async () => {
      const { data, error } = await supabase.from("kpi_rule_productivity")
        .select("*").eq("active", true).eq("section", dbSection)
        .order("threshold", { ascending: false });
      if (!cancelled) {
        if (error) console.error("Load rules error:", error);
        setProdRules(data || []);
        const opts = [...new Set((data || []).map(r => r.category).filter(Boolean))].sort();
        setCategoryOptions(opts);
      }
    })();
    return () => { cancelled = true; };
  }, [section]);

  async function searchByApprover() {
    const q = approverIdInput.trim();
    if (!q) return alert("Nhập Tên hoặc MSNV người duyệt.");
    setLoadingSearch(true);
    let query;
    if (isNaN(Number(q))) {
      query = supabase.from("users")
        .select("msnv, full_name, section, line, approver_msnv, approver_name") // <-- ĐÃ CẬP NHẬT: THÊM section, line
        .ilike("approver_name", `%${q}%`);
    } else {
      query = supabase.from("users")
        .select("msnv, full_name, section, line, approver_msnv, approver_name") // <-- ĐÃ CẬP NHẬT: THÊM section, line
        .eq("approver_msnv", q);
    }
    if (!searchAllSections) {
      query = query.eq("section", section);
    }
    const { data, error } = await query.limit(100);
    setLoadingSearch(false);
    if (error) return alert("Lỗi tải nhân viên: " + error.message);
    setSearchResults(data || []);
    setSearchInput("");
    setLineFilter(""); // Reset filter khi tìm kiếm mới
  }

  async function searchGlobal() {
    const q = searchInput.trim();
    if (!q) return alert("Nhập Tên hoặc MSNV nhân viên.");
    setLoadingSearch(true);
    let query;
    if (isNaN(Number(q))) {
      query = supabase.from("users").select("msnv, full_name, section, line, approver_msnv, approver_name").ilike("full_name", `%${q}%`); // <-- ĐÃ CẬP NHẬT: THÊM section, line
    } else {
      query = supabase.from("users").select("msnv, full_name, section, line, approver_msnv, approver_name").eq("msnv", q); // <-- ĐÃ CẬP NHẬT: THÊM section, line
    }
    if (!searchAllSections) {
      query = query.eq("section", section);
    }
    const { data, error } = await query.limit(50);
    setLoadingSearch(false);
    if (error) return alert("Lỗi tìm nhân viên: " + error.message);
    setSearchResults(data || []);
    setApproverIdInput("");
    setLineFilter(""); // Reset filter khi tìm kiếm mới
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
    setSelectedWorkers(prev => {
      const existingIds = new Set(prev.map(w => w.msnv));
      const newWorkersToAdd = filteredSearchResults.filter(
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
    if (!tplCategory) return alert("Vui lòng chọn Loại năng suất.");
    if (!selectedWorkers.length) return alert("Chưa chọn nhân viên.");

    // Logic check Lamination
    if (section === 'LAMINATION') {
      if (!tplQualityType) return alert("Chọn loại chất lượng.");
      // Nếu là hàng phế thì kiểm tra nhập số
    }

    const rows = selectedWorkers.map((w) => {
      const s = deriveDayScoresHybrid({
        section, defects: tplDefects, category: tplCategory, output: tplOutput,
        workHours: tplWorkHours, stopHours: tplStopHours, shift: tplShift,
        qualityType: tplQualityType, compliance: tplCompliance, complianceCount: tplComplianceCount
      }, prodRules);
      return {
        section, work_date: tplDate, shift: tplShift, msnv: w.msnv, hoten: w.full_name,
        approver_id: w.approver_msnv || approverIdInput, approver_name: w.approver_name,
        line: w.line || tplLine, // LẤY LINE CỦA WORKER HOẶC TEMPLATE NẾU KHÔNG CÓ
        work_hours: toNum(tplWorkHours), stop_hours: toNum(tplStopHours),
        output: toNum(tplOutput), defects: toNum(tplDefects),
        q_score: s.q_score, p_score: s.p_score, c_score: s.c_score, total_score: s.day_score,
        prod_rate: s.prodRate, compliance: tplCompliance, category: tplCategory,
        // Fields mới
        quality_type: tplQualityType, compliance_pairs: tplComplianceCount,
        status: "approved", approver_note: "", // <-- THÊM DÒNG NÀY
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
      const r =
        // CẬP NHẬT: Thêm "approver_note", "line", "category", "quality_type"
        key === "compliance" || key === "shift" || key === "work_date" || key === "approver_note" || key === "line" || key === "category" || key === "quality_type"
          ? { ...r0, [key]: val }
          : { ...r0, [key]: toNum(val, 0) };

      const s = deriveDayScoresHybrid({
        section, defects: r.defects, category: r.category, output: r.output,
        workHours: r.work_hours, stopHours: r.stop_hours, shift: r.shift,
        qualityType: r.quality_type, compliance: r.compliance, complianceCount: r.compliance_pairs
      }, prodRules);

      arr[i] = {
        ...r,
        q_score: s.q_score, p_score: s.p_score, c_score: s.c_score, total_score: s.day_score,
        prod_rate: s.prodRate,
      };
      return arr;
    });
  }

  function toggleAllReviewOnPage() {
    setSelReview((prev) => {
      const next = new Set(prev);
      const start = (page - 1) * pageSize;
      const allOnPage = pageRows.every((_, idx) => next.has(start + idx));
      if (allOnPage) { pageRows.forEach((_, idx) => next.delete(start + idx)); }
      else { pageRows.forEach((_, idx) => next.add(start + idx)); }
      return next;
    });
  }
  function toggleOneReview(globalIndex) {
    setSelReview((prev) => {
      const next = new Set(prev);
      if (next.has(globalIndex)) next.delete(globalIndex);
      else next.add(globalIndex);
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
      const s = deriveDayScoresHybrid({
        section, defects: r.defects, category: r.category, output: r.output,
        workHours: r.work_hours, stopHours: r.stop_hours, shift: r.shift,
        qualityType: r.quality_type, compliance: r.compliance, complianceCount: r.compliance_pairs
      }, prodRules);
      const overflow = Math.max(0, s.rawTotal - 15);
      return {
        date: r.work_date, ca: r.shift, worker_id: r.msnv, worker_name: r.hoten,
        approver_id: r.approver_id, approver_name: r.approver_name, line: r.line,
        category: r.category, prod_rate: Number(r.prod_rate || 0),
        work_hours: Number(r.work_hours || 0), stop_hours: Number(r.stop_hours || 0),
        output: Number(r.output || 0), defects: Number(r.defects || 0),
        p_score: r.p_score, q_score: r.q_score, c_score: r.c_score, day_score: r.total_score, overflow,
        compliance_code: r.compliance, section: r.section, status: "approved", approved_at: now,
        approver_note: r.approver_note || null,
        // Fields mới (hy vọng DB có hoặc bỏ qua)
        quality_type: r.quality_type || null,
        compliance_pairs: r.compliance_pairs || 0,
      };
    });

    const { error } = await supabase
      .from(tableName)
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
    setLineFilter(""); // Reset line filter
  }

  return (
    <div className="space-y-4">
      {step === 1 && (
        <>
          <div className="flex justify-end">
            <button
              className="btn btn-primary"
              onClick={proceedToTemplate}
              disabled={!selectedWorkers.length || prodRules.length === 0}
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

            {/* KHỐI KẾT QUẢ TÌM KIẾM */}
            <div className="md:col-span-1 border rounded p-3 bg-white space-y-2 flex flex-col">
              <h3 className="font-semibold text-lg">Kết quả tìm kiếm ({searchResults.length})</h3>
              <div className="space-y-2 pb-2 border-b">
                <label className="text-sm font-medium">Tìm theo Người duyệt (ID/Tên):</label>
                <form onSubmit={(e) => { e.preventDefault(); searchByApprover(); }} className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Nhập ID/Tên người duyệt"
                    value={approverIdInput}
                    onChange={(e) => setApproverIdInput(e.target.value)}
                    disabled={loadingSearch}
                  />
                  <button type="submit" className="btn btn-primary" disabled={loadingSearch}>
                    {loadingSearch ? "..." : "Tìm"}
                  </button>
                </form>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="searchAllSections"
                    checked={searchAllSections}
                    onChange={e => setSearchAllSections(e.target.checked)}
                  />
                  <label htmlFor="searchAllSections" className="text-sm">Tìm kiếm User ở tất cả các Section</label>
                </div>
              </div>
              <div className="space-y-2 pb-2 border-b">
                <label className="text-sm font-medium">Tìm toàn cục (ID/Tên Nhân viên):</label>
                <form onSubmit={(e) => { e.preventDefault(); searchGlobal(); }} className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Nhập ID/Tên Nhân viên"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    disabled={loadingSearch}
                  />
                  <button type="submit" className="btn" disabled={loadingSearch}>
                    {loadingSearch ? "..." : "Tìm"}
                  </button>
                </form>
              </div>

              {/* ===== THÊM DROPDOWN LỌC THEO VỊ TRÍ LÀM VIỆC (LINE) MỚI ===== */}
              {searchResults.length > 0 && (
                <div className="pb-2 border-b">
                  <label className="text-sm font-medium">Lọc theo Vị trí làm việc (Line):</label>
                  <select
                    className="input w-full mt-1"
                    value={lineFilter}
                    onChange={(e) => setLineFilter(e.target.value)}
                  >
                    <option value="">-- Tất cả Lines ({searchResults.length}) --</option>
                    {availableLines.map(line => (
                      <option key={line} value={line}>{line || "(Không có Line)"}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Hiển thị: {filteredSearchResults.length} nhân viên
                  </p>
                </div>
              )}
              {/* ========================================================= */}

              <div className="flex justify-end">
                <button
                  className="btn"
                  onClick={addAllResults}
                  disabled={!filteredSearchResults.length}
                >
                  + Thêm tất cả ({filteredSearchResults.length})
                </button>
              </div>

              <div className="overflow-auto flex-1">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">MSNV</th>
                      <th className="p-2 text-left">Họ & tên</th>
                      <th className="p-2 text-center">Line</th> {/* THÊM CỘT LINE VÀO BẢNG KẾT QUẢ TÌM KIẾM */}
                      <th className="p-2 text-center">Thêm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSearchResults.map((w) => { // Dùng filteredSearchResults
                      const isSelected = selectedIds.has(w.msnv);
                      return (
                        <tr key={w.msnv} className={cx("border-t", isSelected ? "bg-gray-100 opacity-50" : "hover:bg-gray-50")}>
                          <td className="p-2">{w.msnv}</td>
                          <td className="p-2">{w.full_name}</td>
                          <td className="p-2 text-center">{w.line || "N/A"}</td> {/* HIỂN THỊ LINE */}
                          <td className="p-2 text-center">
                            <button
                              className="btn"
                              style={{ padding: '4px 8px' }}
                              onClick={() => addWorker(w)}
                              disabled={isSelected}
                            >
                              {isSelected ? "Đã chọn" : "+"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!filteredSearchResults.length && (<tr><td colSpan={4} className="p-4 text-center text-gray-500">Không có kết quả.</td></tr>)} {/* Cập nhật colSpan = 4 */}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div><label>Ngày</label><input type="date" className="input" value={tplDate} onChange={e => setTplDate(e.target.value)} max={today} /></div>
            <div><label>Ca</label><select className="input" value={tplShift} onChange={(e) => setTplShift(e.target.value)}><option value="Ca 1">Ca 1</option><option value="Ca 2">Ca 2</option><option value="Ca 3">Ca 3</option><option value="Ca HC">Ca HC</option></select></div>
            <div><label>Máy làm việc</label><select className="input" value={tplLine} onChange={(e) => setTplLine(e.target.value)}>{currentMachines.map(m => (<option key={m} value={m}>{m}</option>))}</select></div>
            <div><label>Loại năng suất</label>
              <select className="input" value={tplCategory} onChange={(e) => setTplCategory(e.target.value)} disabled={categoryOptions.length === 0}>
                <option value="">-- Chọn loại NS --</option>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label>Giờ làm việc</label><input type="number" step="0.1" className="input" value={tplWorkHours} onChange={(e) => setTplWorkHours(e.target.value)} /></div>
            <div><label>Giờ dừng máy</label><input type="number" step="0.1" className="input" value={tplStopHours} onChange={(e) => setTplStopHours(e.target.value)} /></div>
            <div><label>Sản lượng</label><input type="number" step="1" className="input" value={tplOutput} onChange={(e) => setTplOutput(e.target.value)} /></div>

            {section === 'LAMINATION' ? (
              <>
                {/* KHỐI CHẤT LƯỢNG CHO LAMINATION */}
                <div>
                  <label>Chất lượng</label>
                  <select className="input" value={tplQualityType} onChange={(e) => setTplQualityType(e.target.value)}>
                    {LAMINATION_QUALITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {tplQualityType === 'SCRAP' && (
                  <div>
                    <label>Lỗi/Phế (Tấm)</label>
                    <input type="number" step="1" className="input" value={tplDefects} onChange={(e) => setTplDefects(e.target.value)} />
                  </div>
                )}

                {/* KHỐI TUÂN THỦ CHO LAMINATION */}
                <div className="md:col-span-2">
                  <div>
                    <label className="text-sm font-bold block mb-1">Tuân thủ</label>
                    <select className="input input-bordered w-full" value={tplCompliance} onChange={e => setTplCompliance(e.target.value)}>
                      {getComplianceOptions().map(o => (
                        <option key={o} value={o}>{o === "NONE" ? "Không vi phạm" : o}</option>
                      ))}
                    </select>
                  </div>
                  {tplCompliance !== 'NONE' && (
                    <div className="w-24">
                      <label className="text-red-600 font-bold">Số lần</label>
                      <input type="number" className="input border-red-500 text-red-700 bg-red-50 font-bold" value={tplComplianceCount} onChange={(e) => setTplComplianceCount(e.target.value)} />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div><label>Lỗi/Phế</label><input type="number" step="1" className="input" value={tplDefects} onChange={(e) => setTplDefects(e.target.value)} /></div>
                <div><label>Tuân thủ</label><select className="input text-center" value={tplCompliance} onChange={(e) => setTplCompliance(e.target.value)}>{COMPLIANCE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></div>
              </>
            )}
          </div>

          <div className="p-3 bg-yellow-50 rounded">
            <h4 className="font-semibold">Điểm KPI Tạm tính (Cho template):</h4>
            <p>NS/Giờ: {tplProdRate.toFixed(2)} | Giờ chính xác: {tplExactHours.toFixed(2)}</p>
            <p>
              Sản lượng: {tplP} | Chất lượng: {tplQ} | Tuân thủ: {tplC}
              | **Tổng: {tplKPI}** (Tối đa 15)
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button className="btn" onClick={() => setStep(1)}>‹ Quay lại</button>
            <button className="btn btn-primary" onClick={buildReviewRows} disabled={!tplDate || !tplShift || !tplLine || !tplCategory}>
              Áp dụng Template ({selectedWorkers.length}) ›
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
              <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>‹ Trước</button>
              <span>Trang {page}/{totalPages}</span>
              <button className="btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Sau ›</button>
            </div>
          </div>
          <div className="overflow-auto border rounded">
            {/* CẬP NHẬT: Tăng min-w để chứa cột Line/Ghi chú */}
            <table className="min-w-[1450px] text-sm">
              <thead className="bg-gray-50 text-center">
                <tr>
                  <th className="p-2"><input type="checkbox" onChange={toggleAllReviewOnPage} checked={pageRows.length > 0 && pageRows.every((_, idx) => selReview.has(globalIndex(idx)))} /></th>
                  <th className="p-2">MSNV</th><th className="p-2">Họ tên</th>
                  <th className="p-2">Ngày</th><th className="p-2">Ca</th>
                  <th className="p-2">Máy làm việc</th>
                  <th className="p-2">Loại NS</th>
                  <th className="p-2">Giờ làm</th><th className="p-2">Giờ dừng</th>
                  <th className="p-2">SL/Output</th>

                  {/* CỘT CHẤT LƯỢNG (PHẾ HOẶC DROP-DOWN) */}
                  <th className="p-2">{section === 'LAMINATION' ? "Chất lượng" : "Phế"}</th>

                  <th className="p-2">NS/Giờ</th>
                  <th className="p-2">Q</th><th className="p-2">P</th>
                  <th className="p-2">C</th>
                  <th className="p-2">KPI</th>

                  {/* CỘT TUÂN THỦ */}
                  <th className="p-2 min-w-[150px]">Tuân thủ</th>
                  <th className="p-2 w-16 text-red-600">Số lần</th>

                  <th className="p-2">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {pageRows.map((r, idx) => {
                  const gi = globalIndex(idx);
                  const isSelected = selReview.has(gi);
                  return (
                    <tr key={r.msnv + r.work_date + r.shift} className={cx("border-t", isSelected ? "bg-blue-50" : "hover:bg-gray-50")}>
                      <td className="p-2"><input type="checkbox" checked={isSelected} onChange={() => toggleOneReview(gi)} /></td>
                      <td className="p-2">{r.msnv}</td>
                      <td className="p-2 text-left">{r.hoten}</td>
                      <td className="p-2"><input type="date" className="input text-center w-[120px]" value={r.work_date} onChange={e => updateRow(idx, "work_date", e.target.value)} max={today} /></td>
                      <td className="p-2">
                        <select className="input text-center w-[80px]" value={r.shift} onChange={e => updateRow(idx, "shift", e.target.value)}>
                          <option value="Ca 1">Ca 1</option><option value="Ca 2">Ca 2</option>
                          <option value="Ca 3">Ca 3</option><option value="Ca HC">Ca HC</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <select className="input text-center w-[100px]" value={r.line} onChange={e => updateRow(idx, "line", e.target.value)}>
                          {currentMachines.map(m => (<option key={m} value={m}>{m}</option>))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select className="input text-center w-[120px]" value={r.category} onChange={e => updateRow(idx, "category", e.target.value)}>
                          {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="p-2"><input type="number" step="0.1" className="input text-center w-[60px]" value={r.work_hours} onChange={e => updateRow(idx, "work_hours", e.target.value)} /></td>
                      <td className="p-2"><input type="number" step="0.1" className="input text-center w-[60px]" value={r.stop_hours} onChange={e => updateRow(idx, "stop_hours", e.target.value)} /></td>
                      <td className="p-2"><input type="number" step="1" className="input text-center w-[60px]" value={r.output} onChange={e => updateRow(idx, "output", e.target.value)} /></td>

                      {/* Cột dữ liệu Chất lượng / Phế */}
                      <td className="p-2">
                        {section === 'LAMINATION' ? (
                          <div className="flex flex-col gap-1 items-center">
                            <select className="input text-xs w-[110px]" value={r.quality_type} onChange={e => updateRow(idx, 'quality_type', e.target.value)}>
                              {LAMINATION_QUALITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {r.quality_type === 'SCRAP' && (
                              <input type="number" className="input text-center w-[60px]" value={r.defects} onChange={e => updateRow(idx, 'defects', e.target.value)} placeholder="SL Phế" />
                            )}
                          </div>
                        ) : (
                          <input type="number" step="1" className="input text-center w-[60px]" value={r.defects} onChange={e => updateRow(idx, "defects", e.target.value)} />
                        )}
                      </td>

                      <td className="p-2 font-semibold">{r.prod_rate.toFixed(2)}</td>
                      <td className="p-2 font-semibold text-green-700">{r.q_score}</td>
                      <td className="p-2 font-semibold text-green-700">{r.p_score}</td>
                      <td className="p-2 font-semibold text-orange-600">{r.c_score}</td>
                      <td className="p-2 font-bold text-lg text-blue-700">{r.total_score}</td>

                      <td className="p-2">
                        <select className="input text-center w-[140px]" value={r.compliance} onChange={e => updateRow(idx, "compliance", e.target.value)}>
                          {getComplianceOptions().map(o => (
                            <option key={o} value={o}>{o === "NONE" ? (section === 'LAMINATION' ? "Không vi phạm" : "--") : o}</option>
                          ))}
                        </select>
                      </td>

                      {/* Cột Số lần vi phạm */}
                      <td className="p-2">
                        {r.compliance !== 'NONE' && (
                          <input type="number" className="input text-center w-[60px] border-red-300 text-red-600 font-bold" value={r.compliance_pairs} onChange={e => updateRow(idx, 'compliance_pairs', e.target.value)} />
                        )}
                      </td>

                      <td className="p-2">
                        <input type="text" className="input text-center w-[120px]" value={r.approver_note || ""} onChange={e => updateRow(idx, "approver_note", e.target.value)} placeholder="Ghi chú" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}