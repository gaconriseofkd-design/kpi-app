// src/pages/QuickEntry.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";
import { scoreByQuality } from "../lib/scoring";
import ApproverModeHybrid from "./QuickEntryLPS"; 

/* ===== Helpers (Giữ nguyên) ===== */
const COMPLIANCE_OPTIONS = [
  { value: "NONE", label: "Không vi phạm" },
  { value: "Ký mẫu đầu chuyền trước khi sử dụng", label: "Ký mẫu đầu chuyền trước khi sử dụng" },
  { value: "Quy định về kiểm tra điều kiện máy trước/trong khi sản xuất", label: "Quy định về kiểm tra điều kiện máy trước/trong khi sản xuất" },
  { value: "Quy định về kiểm tra nguyên liệu trước/trong khi sản xuất", label: "Quy định về kiểm tra nguyên liệu trước/trong khi sản xuất" },
  { value: "Quy định về kiểm tra quy cách/tiêu chuẩn sản phẩm trước/trong khi sản xuất", label: "Quy định về kiểm tra quy cách/tiêu chuẩn sản phẩm trước/trong khi sản xuất" },
  { value: "Vi phạm nội quy bộ phận/công ty", label: "Vi phạm nội quy bộ phận/công ty" },
];
const HYBRID_SECTIONS = ["LAMINATION", "PREFITTING", "BÀO", "TÁCH"];
const isHybridSection = (sectionKey) => HYBRID_SECTIONS.includes(sectionKey);
const cx = (...a) => a.filter(Boolean).join(" ");
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
function calcWorkingReal(shift, inputHours) {
  const h = toNum(inputHours);
  if (h < 8) return h;
  const BASE = { "Ca 1": 7.17, "Ca 2": 7.17, "Ca 3": 6.92, "Ca HC": 6.67 };
  const base = BASE[shift] ?? 7.17;
  if (h < 9) return base;
  const extra = h - 8;
  const adj = extra >= 2 ? extra - 0.5 : extra;
  return base + adj;
}
const getMoldedCategoryFromLine = (line) => {
    if (line === 'M4' || line === 'M5') return 'M4 & M5 %OE';
    if (line === 'M1' || line === 'M2' || line === 'M3') return 'M1 M2 M3 %OE';
    return ''; 
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
    if (val >= r.threshold) return Number(r.score || 0);
  }
  return 0;
}
const LEANLINE_MACHINES = {
    "LEANLINE_MOLDED": ["M1", "M2", "M3", "M4", "M5"],
    "LEANLINE_DC": ["LEAN-D1", "LEAN-D2", "LEAN-D3", "LEAN-D4", "LEAN-H1", "LEAN-H2"],
    "DEFAULT": ["LEAN-D1", "LEAN-D2", "LEAN-D3", "LEAN-D4", "LEAN-H1", "LEAN-H2"],
}
const getLeanlineMachines = (section) => LEANLINE_MACHINES[section] || LEANLINE_MACHINES.DEFAULT;


// --- THÊM MỚI: Helper tính điểm cho Molding (tách ra từ code cũ) ---
/**
 * @param {object} entry - { shift, working_input, mold_hours, output, defects, category }
 * @param {Array} allRules - Rules for MOLDING
 */
function calculateScoresMolding(entry, allRules) {
    const { shift, working_input, mold_hours, output, defects, category } = entry;
    
    const working_real = calcWorkingReal(shift, working_input);
    
    let downtime = (working_real * 24 - toNum(mold_hours)) / 24;
    if (downtime > 1) downtime = 1;
    if (downtime < 0) downtime = 0;
    
    const working_exact = Number((working_real - downtime).toFixed(2));
    const prod = working_exact > 0 ? toNum(output) / working_exact : 0; // Tỷ lệ NS

    const qScore = scoreByQuality(defects); 
    let pScore = 0;
    
    const catRules = (allRules || []).filter(r => r.category === category);
    for (const r of catRules) {
        if (prod >= r.threshold) {
            pScore = r.score;
            break;
        }
    }
    const total = pScore + qScore;
    
    return {
        q_score: qScore,
        p_score: pScore,
        day_score: Math.min(15, total),
        rawTotal: total,
        // Dữ liệu trung gian
        working_real: Number(working_real.toFixed(2)),
        downtime: Number(downtime.toFixed(2)),
        working_exact,
        prodRate: prod
    };
}
/* ===== (Hết Helpers) ===== */


/* ===== Main (Giữ nguyên) ===== */
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
/* ===== (Hết Main) ===== */


/* ======================================================================
   APPROVER MODE — LEANLINE (Giữ nguyên logic từ lần trước)
   ====================================================================== */
function ApproverModeLeanline({ section }) {
    
  const [step, setStep] = useState(1);
  const [prodRules, setProdRules] = useState([]); 
  const [approverIdInput, setApproverIdInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [reviewRows, setReviewRows] = useState([]);
  const [selReview, setSelReview] = useState(() => new Set());
  const [tplDate, setTplDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tplShift, setTplShift] = useState("Ca 1");
  const [tplWorkHours, setTplWorkHours] = useState(8);
  const [tplStopHours, setTplStopHours] = useState(0);
  const [tplOE, setTplOE] = useState(100); 
  const [tplDefects, setTplDefects] = useState(0);
  const [tplCompliance, setTplCompliance] = useState("NONE");
  const currentMachines = useMemo(() => getLeanlineMachines(section), [section]);
  const [tplLine, setTplLine] = useState(currentMachines[0] || "LEAN-D1"); 
  const [saving, setSaving] = useState(false);
  const pageSize = 50;
  const [page, setPage] = useState(1);
  const selectedIds = useMemo(() => new Set(selectedWorkers.map(w => w.msnv)), [selectedWorkers]);

  // (Các hàm tính điểm, helper... giữ nguyên)
  const previewScores = useMemo(() => calculateScores(tplOE, tplDefects, prodRules, section, tplLine), [tplOE, tplDefects, prodRules, section, tplLine]);
  const tplQ = previewScores.qScore;
  const tplP = previewScores.pScore;
  const tplKPI = previewScores.kpi;
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

  // CÁCH A: TÌM THEO NGƯỜI DUYỆT
  async function searchByApprover() {
    const id = approverIdInput.trim();
    if (!id) return alert("Nhập MSNV người duyệt.");
    setLoadingSearch(true);
    const { data, error } = await supabase
      .from("users")
      .select("msnv, full_name, approver_msnv, approver_name")
      .eq("approver_msnv", id);
    setLoadingSearch(false);
    if (error) return alert("Lỗi tải nhân viên: " + error.message);
    setSearchResults(data || []); 
    setSearchInput("");
  }
  // CÁCH B: TÌM THEO TÊN/MSNV (GLOBAL)
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
    const { data, error } = await query.limit(50);
    setLoadingSearch(false);
    if (error) return alert("Lỗi tìm nhân viên: " + error.message);
    setSearchResults(data || []);
    setApproverIdInput("");
  }
  // Hàm Thêm/Xoá NV
  function addWorker(worker) {
    setSelectedWorkers(prev => {
      if (prev.find(w => w.msnv === worker.msnv)) return prev; 
      return [worker, ...prev]; 
    });
  }
  function removeWorker(msnv) {
    setSelectedWorkers(prev => prev.filter(w => w.msnv !== msnv));
  }
  
  function proceedToTemplate() {
    const requiredRulesLoaded = section === "LEANLINE_MOLDED" || prodRules.length > 0;
    if (!requiredRulesLoaded) return alert("Không thể tải Rule tính điểm sản lượng. Vui lòng thử lại.");
    if (!selectedWorkers.length) return alert("Chưa chọn nhân viên nào.");
    setStep(2);
  }

  function buildReviewRows() {
    if (!tplDate || !tplShift) return alert("Nhập Ngày & Ca.");
    if (!selectedWorkers.length) return alert("Chưa chọn nhân viên.");

    const rows = selectedWorkers.map((w) => {
      const scores = calculateScores(tplOE, tplDefects, prodRules, section, tplLine);
      return {
      section,
      work_date: tplDate,
      shift: tplShift,
      msnv: w.msnv,
      hoten: w.full_name,
      approver_id: w.approver_msnv || approverIdInput, 
      approver_name: w.approver_name,
      line: tplLine,
      work_hours: toNum(tplWorkHours),
      downtime: toNum(tplStopHours),
      oe: toNum(tplOE),
      defects: toNum(tplDefects),
      q_score: scores.qScore,
      p_score: scores.pScore,
      total_score: scores.kpi,
      compliance: tplCompliance,
      status: "approved",
    }});
    setReviewRows(rows);
    setSelReview(new Set(rows.map((_, i) => i)));
    setStep(3);
  }

  // (Các hàm updateRow, toggleAllReviewOnPage, toggleOneReview, saveBatch giữ nguyên)
  function updateRow(i, key, val) {
    setReviewRows((old) => {
      const arr = old.slice();
      const r0 = arr[i] || {};
      const r =
        key === "compliance" || key === "line" || key === "shift" || key === "work_date"
          ? { ...r0, [key]: val }
          : { ...r0, [key]: toNum(val, 0) };
      const scores = calculateScores(r.oe, r.defects, prodRules, section, r.line);
      arr[i] = { ...r, q_score: scores.qScore, p_score: scores.pScore, total_score: scores.kpi };
      return arr;
    });
  }
  function toggleAllReviewOnPage() {
    setSelReview((prev) => {
      const next = new Set(prev);
      const start = (page - 1) * pageSize;
      const allOnPage = pageRows.every((_, idx) => next.has(start + idx));
      if (allOnPage) {
        pageRows.forEach((_, idx) => next.delete(start + idx));
      } else {
        pageRows.forEach((_, idx) => next.add(start + idx));
      }
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
  async function saveBatch() {
    const idxs = Array.from(selReview).sort((a, b) => a - b);
    if (!idxs.length) return alert("Chưa chọn dòng để lưu.");
    setSaving(true);
    const list = idxs.map((i) => reviewRows[i]);
    const now = new Date().toISOString();
    const payload = list.map((r) => {
      const rawScores = calculateScores(r.oe, r.defects, prodRules, section, r.line);
      const overflow = Math.max(0, rawScores.rawTotal - 15);
      return {
        date: r.work_date, ca: r.shift, worker_id: r.msnv, worker_name: r.hoten,
        approver_id: r.approver_id, approver_name: r.approver_name, line: r.line,
        work_hours: Number(r.work_hours || 0), stop_hours: Number(r.downtime || 0),
        oe: Number(r.oe || 0), defects: Number(r.defects || 0),
        p_score: r.p_score, q_score: r.q_score, day_score: r.total_score, overflow,
        compliance_code: r.compliance, section: r.section, status: "approved", approved_at: now,
      };
    });
    const { error } = await supabase
    .from("kpi_entries") 
    .upsert(payload, { onConflict: "worker_id,date,section" });
    setSaving(false);
    if (error) return alert("Lưu lỗi: " + error.message);
    alert(`Đã lưu ${payload.length} dòng (approved).`);
  }


  // --- JSX Render (Giữ nguyên) ---
  return (
    <div className="space-y-4">
      {step === 1 && (
        <>
          <div className="flex justify-end">
            <button 
              className="btn btn-primary" 
              onClick={proceedToTemplate} 
              disabled={!selectedWorkers.length || (section !== "LEANLINE_MOLDED" && prodRules.length === 0)}
            >
              Tiếp tục ({selectedWorkers.length}) ›
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ minHeight: '400px' }}>
            <div className="border rounded p-3 bg-white space-y-2 flex flex-col">
              <h3 className="font-semibold text-lg">Đã chọn ({selectedWorkers.length})</h3>
              <div className="overflow-auto flex-1">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="p-2 text-left">MSNV</th><th className="p-2 text-left">Họ & tên</th><th className="p-2 text-center">Xoá</th></tr></thead>
                  <tbody>
                    {selectedWorkers.map((w) => (
                      <tr key={w.msnv} className="border-t">
                        <td className="p-2">{w.msnv}</td><td className="p-2">{w.full_name}</td>
                        <td className="p-2 text-center"><button className="btn bg-red-100 text-red-700 hover:bg-red-200" style={{padding: '4px 8px'}} onClick={() => removeWorker(w.msnv)}>Xoá</button></td>
                      </tr>
                    ))}
                    {!selectedWorkers.length && (<tr><td colSpan={3} className="p-4 text-center text-gray-500">Chưa chọn nhân viên nào.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="border rounded p-3 bg-white space-y-3 flex flex-col">
              <div className="flex items-end gap-2">
                <div className="flex-1"><label className="text-sm font-medium">Cách 1: Tìm theo Người duyệt</label><input className="input w-full" value={approverIdInput} onChange={(e) => setApproverIdInput(e.target.value)} placeholder="Nhập MSNV người duyệt..." /></div>
                <button className="btn" onClick={searchByApprover} disabled={loadingSearch}>{loadingSearch ? "..." : "Tải"}</button>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1"><label className="text-sm font-medium">Cách 2: Tìm theo Tên/MSNV</label><input className="input w-full" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Nhập Tên hoặc MSNV nhân viên..." /></div>
                 <button className="btn" onClick={searchGlobal} disabled={loadingSearch}>{loadingSearch ? "..." : "Tìm"}</button>
              </div>
              <div className="overflow-auto flex-1 border-t pt-2">
                <h4 className="font-semibold mb-1">Kết quả tìm kiếm ({searchResults.length})</h4>
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="p-2 text-left">MSNV</th><th className="p-2 text-left">Họ & tên</th><th className="p-2 text-center">Thêm</th></tr></thead>
                  <tbody>
                    {searchResults.map((w) => {
                      const isSelected = selectedIds.has(w.msnv);
                      return (
                        <tr key={w.msnv} className={cx("border-t", isSelected ? "bg-gray-100 opacity-50" : "hover:bg-gray-50")}>
                          <td className="p-2">{w.msnv}</td><td className="p-2">{w.full_name}</td>
                          <td className="p-2 text-center">
                            <button className="btn" style={{padding: '4px 8px'}} onClick={() => addWorker(w)} disabled={isSelected}>
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

      {/* ==== STEP 2: Template CHUNG + Preview (Giữ nguyên) ==== */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div><label>Ngày</label><input type="date" className="input" value={tplDate} onChange={(e) => setTplDate(e.target.value)} /></div>
            <div><label>Ca</label><select className="input" value={tplShift} onChange={(e) => setTplShift(e.target.value)}><option value="Ca 1">Ca 1</option><option value="Ca 2">Ca 2</option><option value="Ca 3">Ca 3</option><option value="Ca HC">Ca HC</option></select></div>
            <div><label>Máy làm việc</label><select className="input" value={tplLine} onChange={(e) => setTplLine(e.target.value)}>{currentMachines.map(m => (<option key={m} value={m}>{m}</option>))}</select></div>
            <div><label>Tuân thủ</label><select className="input text-center" value={tplCompliance} onChange={(e) => setTplCompliance(e.target.value)}>{COMPLIANCE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></div>
            <div><label>Giờ làm việc</label><input type="number" className="input" value={tplWorkHours} onChange={(e) => setTplWorkHours(e.target.value)} /></div>
            <div><label>Giờ dừng máy</label><input type="number" className="input" value={tplStopHours} onChange={(e) => setTplStopHours(e.target.value)} /></div>
            <div><label>%OE</label><input type="number" className="input" value={tplOE} onChange={(e) => setTplOE(e.target.value)} step="0.01" /></div>
            <div><label>Phế</label><input type="number" className="input" value={tplDefects} onChange={(e) => setTplDefects(e.target.value)} /></div>
          </div>
          <div className="rounded border p-3 bg-gray-50"><div className="flex gap-6 text-sm"><div>Q: <b>{tplQ}</b></div><div>P: <b>{tplP}</b></div><div>KPI (Max 15): <b>{tplKPI}</b></div><div className="text-gray-500 ml-auto">Các giá trị này sẽ áp cho tất cả NV ở bước Review.</div></div></div>
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-center"><tr><th>MSNV</th><th>Họ tên</th><th>Máy làm việc</th><th>Giờ làm</th><th>Giờ dừng</th><th>%OE</th><th>Phế</th><th>Q</th><th>P</th><th>KPI</th><th>Tuân thủ</th></tr></thead>
              <tbody className="text-center">
                {selectedWorkers.map((w) => (
                    <tr key={w.msnv} className="border-t hover:bg-gray-50">
                      <td>{w.msnv}</td><td>{w.full_name}</td><td>{tplLine}</td><td>{tplWorkHours}</td><td>{tplStopHours}</td><td>{tplOE}</td><td>{tplDefects}</td><td>{tplQ}</td><td>{tplP}</td><td className="font-semibold">{tplKPI}</td><td>{COMPLIANCE_OPTIONS.find(o => o.value === tplCompliance)?.label || tplCompliance}</td>
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

      {/* ==== STEP 3: Bảng Review (Giữ nguyên) ==== */}
      {step === 3 && (
        <EditReviewLeanline
          pageSize={pageSize} page={page} setPage={setPage} totalPages={totalPages} pageRows={pageRows}
          reviewRows={reviewRows} setReviewRows={setReviewRows} selReview={selReview} setSelReview={setSelReview}
          toggleAllReviewOnPage={toggleAllReviewOnPage} updateRow={updateRow} saveBatch={saveBatch} saving={saving}
        />
      )}
    </div>
  );
}


/* ==== Bảng Review (LEANLINE) (Giữ nguyên) ==== */
function EditReviewLeanline({
  pageSize, page, setPage, totalPages, pageRows, reviewRows, setReviewRows, selReview, setSelReview,
  toggleAllReviewOnPage, toggleOneReview, updateRow, saveBatch, saving,
}) {
  const { section } = useKpiSection();
  const currentMachines = useMemo(() => getLeanlineMachines(section), [section]);
  const globalIndex = (idx) => (page - 1) * pageSize + idx;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="btn btn-primary" onClick={saveBatch} disabled={saving || !selReview.size}>
          {saving ? "Đang lưu..." : `Lưu đã chọn (${selReview.size})`}
        </button>
        <div className="ml-auto flex items-center gap-3">
          <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>‹ Trước</button>
          <span>Trang {page}/{totalPages}</span>
          <button className="btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Sau ›</button>
        </div>
      </div>
      <div className="overflow-auto border rounded">
        <table className="min-w-[1100px] text-sm">
          <thead className="bg-gray-50 text-center">
            <tr>
              <th className="p-2"><input type="checkbox" onChange={toggleAllReviewOnPage} checked={pageRows.length > 0 && pageRows.every((_, idx) => selReview.has(globalIndex(idx)))} /></th>
              <th className="p-2">MSNV</th><th className="p-2">Họ tên</th><th className="p-2">Ngày</th><th className="p-2">Ca</th><th className="p-2">Máy làm việc</th><th className="p-2">Giờ làm</th><th className="p-2">Giờ dừng</th><th className="p-2">%OE</th><th className="p-2">Phế</th><th className="p-2">Q</th><th className="p-2">P</th><th className="p-2">KPI</th><th className="p-2">Tuân thủ</th>
            </tr>
          </thead>
          <tbody className="text-center">
            {pageRows.map((r, idx) => {
              const gi = globalIndex(idx);
              return (
                <tr key={gi} className="border-t hover:bg-gray-50">
                  <td className="p-2"><input type="checkbox" checked={selReview.has(gi)} onChange={() => toggleOneReview(gi)} /></td>
                  <td className="p-2">{r.msnv}</td><td className="p-2">{r.hoten}</td>
                  <td className="p-2"><input type="date" className="input text-center" value={r.work_date} onChange={(e) => updateRow(gi, "work_date", e.target.value)} /></td>
                  <td className="p-2"><select className="input text-center" value={r.shift} onChange={(e) => updateRow(gi, "shift", e.target.value)}><option value="Ca 1">Ca 1</option><option value="Ca 2">Ca 2</option><option value="Ca 3">Ca 3</option><option value="Ca HC">Ca HC</option></select></td>
                  <td className="p-2"><select className="input text-center" value={r.line || ""} onChange={(e) => updateRow(gi, "line", e.target.value)}>{currentMachines.map(m => (<option key={m} value={m}>{m}</option>))}</select></td>
                  <td className="p-2"><input type="number" className="input text-center" value={r.work_hours} onChange={(e) => updateRow(gi, "work_hours", e.target.value)} /></td>
                  <td className="p-2"><input type="number" className="input text-center" value={r.downtime} onChange={(e) => updateRow(gi, "downtime", e.target.value)} /></td>
                  <td className="p-2"><input type="number" className="input text-center" value={r.oe} onChange={(e) => updateRow(gi, "oe", e.target.value)} step="0.01" /></td>
                  <td className="p-2"><input type="number" className="input text-center" value={r.defects} onChange={(e) => updateRow(gi, "defects", e.target.value)} /></td>
                  <td className="p-2">{r.q_score}</td><td className="p-2">{r.p_score}</td><td className="p-2 font-semibold">{r.total_score}</td>
                  <td className="p-2"><select className="input text-center" value={r.compliance} onChange={(e) => updateRow(gi, "compliance", e.target.value)}>{COMPLIANCE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></td>
                </tr>
              );
            })}
            {!pageRows.length && (<tr><td colSpan={14} className="p-4 text-center text-gray-500">Không có dữ liệu</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
/* ===== (Hết Leanline) ===== */



/* ======================================================================
   APPROVER MODE — MOLDING (NÂNG CẤP LÊN GIỐNG LEANLINE)
   ====================================================================== */
function ApproverModeMolding({ section }) {
  const [step, setStep] = useState(1);

  // --- Step 1: Tìm kiếm (Logic mới) ---
  const [approverIdInput, setApproverIdInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const selectedIds = useMemo(() => new Set(selectedWorkers.map(w => w.msnv)), [selectedWorkers]);

  // --- Step 2: Template ---
  const [prodRules, setProdRules] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  
  const [tplDate, setTplDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tplShift, setTplShift] = useState("Ca 1");
  const [tplWorkingInput, setTplWorkingInput] = useState(8);
  const [tplMoldHours, setTplMoldHours] = useState(0);
  const [tplOutput, setTplOutput] = useState(0);
  const [tplCategory, setTplCategory] = useState("");
  const [tplDefects, setTplDefects] = useState(0);
  const [tplCompliance, setTplCompliance] = useState("NONE");
  
  // --- Step 3: Review ---
  const [reviewRows, setReviewRows] = useState([]);
  const [selReview, setSelReview] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const pageSize = 50;
  const [page, setPage] = useState(1);

  // --- Load Rules & Categories cho Molding ---
  useEffect(() => {
    supabase
      .from("kpi_rule_productivity")
      .select("category, threshold, score")
      .eq("section", "MOLDING")
      .eq("active", true)
      .order("category", { ascending: true })
      .order("threshold", { ascending: false })
      .then(({ data, error }) => {
        if (error) return console.error(error);
        const rules = data || [];
        setProdRules(rules);
        const list = [...new Set(rules.map((r) => r.category).filter(Boolean))];
        setCategoryOptions(list);
        if (list.length > 0) setTplCategory(list[0]);
      });
  }, []);
  
  // --- Tính điểm Preview (Step 2) ---
  const previewScores = useMemo(() => {
    return calculateScoresMolding({
        shift: tplShift,
        working_input: tplWorkingInput,
        mold_hours: tplMoldHours,
        output: tplOutput,
        defects: tplDefects,
        category: tplCategory
    }, prodRules);
  }, [tplShift, tplWorkingInput, tplMoldHours, tplOutput, tplDefects, tplCategory, prodRules]);

  const tplQ = previewScores.q_score;
  const tplP = previewScores.p_score;
  const tplKPI = previewScores.day_score;

  /* Paging (Step 3) */
  useEffect(() => setPage(1), [reviewRows.length]);
  const totalPages = Math.max(1, Math.ceil(reviewRows.length / pageSize));
  const pageRows = useMemo(
    () => reviewRows.slice((page - 1) * pageSize, page * pageSize),
    [reviewRows, page]
  );


  // --- Step 1: Functions (Tìm kiếm) ---
  async function searchByApprover() {
    const id = approverIdInput.trim();
    if (!id) return alert("Nhập MSNV người duyệt.");
    setLoadingSearch(true);
    const { data, error } = await supabase.from("users")
      .select("msnv, full_name, approver_msnv, approver_name")
      .eq("approver_msnv", id);
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
  function proceedToTemplate() {
    if (!selectedWorkers.length) return alert("Chưa chọn nhân viên nào.");
    if (!prodRules.length) return alert("Chưa tải được Rule điểm, vui lòng thử lại.");
    setStep(2);
  }

  // --- Step 2: Function (Build Review) ---
  function buildReviewRows() {
    if (!tplDate || !tplShift) return alert("Nhập Ngày & Ca.");
    if (!tplCategory) return alert("Chọn Loại hàng.");

    const rows = selectedWorkers.map((w) => {
      const scores = previewScores; // Dùng điểm đã tính ở preview
      
      return {
        section,
        work_date: tplDate,
        shift: tplShift,
        msnv: w.msnv,
        hoten: w.full_name,
        approver_msnv: w.approver_msnv || approverIdInput,
        approver_name: w.approver_name,
        
        // Dữ liệu Molding từ Template
        category: tplCategory,
        working_input: toNum(tplWorkingInput),
        mold_hours: toNum(tplMoldHours),
        output: toNum(tplOutput),
        defects: toNum(tplDefects),
        compliance_code: tplCompliance,

        // Điểm đã tính
        q_score: scores.q_score,
        p_score: scores.p_score,
        day_score: scores.day_score,
        
        // Dữ liệu trung gian
        working_real: scores.working_real,
        downtime: scores.downtime,
        working_exact: scores.working_exact,
        
        status: "approved",
      };
    });

    setReviewRows(rows);
    setSelReview(new Set(rows.map((_, i) => i)));
    setStep(3);
  }

  // --- Step 3: Functions (Update/Save) ---
  function updateRow(i, key, val) {
    setReviewRows((old) => {
      const arr = old.slice();
      const r0 = arr[i] || {};
      
      const r = ["compliance_code", "category", "shift", "work_date"].includes(key)
          ? { ...r0, [key]: val }
          : { ...r0, [key]: toNum(val, 0) };

      // Tính lại điểm khi 1 dòng thay đổi
      const scores = calculateScoresMolding(r, prodRules);

      arr[i] = { 
          ...r, 
          q_score: scores.q_score, 
          p_score: scores.p_score, 
          day_score: scores.day_score,
          working_real: scores.working_real,
          downtime: scores.downtime,
          working_exact: scores.working_exact,
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
  async function saveBatch() {
    const idxs = Array.from(selReview).sort((a, b) => a - b);
    if (!idxs.length) return alert("Chưa chọn dòng để lưu.");

    setSaving(true);
    const list = idxs.map((i) => reviewRows[i]);
    const now = new Date().toISOString();

    const payload = list.map((r) => {
      // Tính lại điểm lần cuối để lấy overflow
      const scores = calculateScoresMolding(r, prodRules);
      const overflow = Math.max(0, scores.rawTotal - 15);
      
      return {
        section: r.section,
        date: r.work_date,
        ca: r.shift,
        worker_id: r.msnv,
        worker_name: r.hoten,
        approver_msnv: r.approver_msnv,
        approver_name: r.approver_name,
        category: r.category,
        working_input: r.working_input,
        working_real: r.working_real,
        working_exact: r.working_exact,
        downtime: r.downtime,
        mold_hours: r.mold_hours,
        output: r.output,
        defects: Number(r.defects || 0),
        q_score: scores.q_score,
        p_score: scores.p_score,
        day_score: scores.day_score,
        overflow,
        compliance_code: r.compliance_code,
        status: "approved",
        approved_at: now,
      };
    });
    const { error } = await supabase
      .from("kpi_entries_molding")
      .upsert(payload, { onConflict: "worker_id,date,section" });
    setSaving(false);
    if (error) return alert("Lưu lỗi: " + error.message);
    alert(`Đã lưu ${payload.length} dòng (approved).`);
  }

  /* UI */
  return (
    <div className="space-y-4">
      
      {/* --- Step 1: Tìm kiếm (Giống Leanline) --- */}
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
              <h3 className="font-semibold text-lg">Đã chọn ({selectedWorkers.length})</h3>
              <div className="overflow-auto flex-1">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="p-2 text-left">MSNV</th><th className="p-2 text-left">Họ & tên</th><th className="p-2 text-center">Xoá</th></tr></thead>
                  <tbody>
                    {selectedWorkers.map((w) => (
                      <tr key={w.msnv} className="border-t">
                        <td className="p-2">{w.msnv}</td><td className="p-2">{w.full_name}</td>
                        <td className="p-2 text-center"><button className="btn bg-red-100 text-red-700 hover:bg-red-200" style={{padding: '4px 8px'}} onClick={() => removeWorker(w.msnv)}>Xoá</button></td>
                      </tr>
                    ))}
                    {!selectedWorkers.length && (<tr><td colSpan={3} className="p-4 text-center text-gray-500">Chưa chọn nhân viên nào.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="border rounded p-3 bg-white space-y-3 flex flex-col">
              <div className="flex items-end gap-2">
                <div className="flex-1"><label className="text-sm font-medium">Cách 1: Tìm theo Người duyệt</label><input className="input w-full" value={approverIdInput} onChange={(e) => setApproverIdInput(e.target.value)} placeholder="Nhập MSNV người duyệt..." /></div>
                <button className="btn" onClick={searchByApprover} disabled={loadingSearch}>{loadingSearch ? "..." : "Tải"}</button>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1"><label className="text-sm font-medium">Cách 2: Tìm theo Tên/MSNV</label><input className="input w-full" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Nhập Tên hoặc MSNV nhân viên..." /></div>
                 <button className="btn" onClick={searchGlobal} disabled={loadingSearch}>{loadingSearch ? "..." : "Tìm"}</button>
              </div>
              <div className="overflow-auto flex-1 border-t pt-2">
                <h4 className="font-semibold mb-1">Kết quả tìm kiếm ({searchResults.length})</h4>
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="p-2 text-left">MSNV</th><th className="p-2 text-left">Họ & tên</th><th className="p-2 text-center">Thêm</th></tr></thead>
                  <tbody>
                    {searchResults.map((w) => {
                      const isSelected = selectedIds.has(w.msnv);
                      return (
                        <tr key={w.msnv} className={cx("border-t", isSelected ? "bg-gray-100 opacity-50" : "hover:bg-gray-50")}>
                          <td className="p-2">{w.msnv}</td><td className="p-2">{w.full_name}</td>
                          <td className="p-2 text-center">
                            <button className="btn" style={{padding: '4px 8px'}} onClick={() => addWorker(w)} disabled={isSelected}>
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

      {/* --- Step 2: Template (NÂNG CẤP) --- */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div><label>Ngày</label><input type="date" className="input" value={tplDate} onChange={(e) => setTplDate(e.target.value)} /></div>
            <div><label>Ca</label><select className="input" value={tplShift} onChange={(e) => setTplShift(e.target.value)}><option value="Ca 1">Ca 1</option><option value="Ca 2">Ca 2</option><option value="Ca 3">Ca 3</option><option value="Ca HC">Ca HC</option></select></div>
            <div><label>Loại hàng</label><select className="input" value={tplCategory} onChange={e => setTplCategory(e.target.value)}><option value="">-- Chọn loại --</option>{categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label>Tuân thủ</label><select className="input text-center" value={tplCompliance} onChange={(e) => setTplCompliance(e.target.value)}>{COMPLIANCE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></div>
            <div><label>Giờ làm việc (nhập)</label><input type="number" className="input" value={tplWorkingInput} onChange={e => setTplWorkingInput(e.target.value)} /></div>
            <div><label>Số giờ khuôn chạy</label><input type="number" className="input" value={tplMoldHours} onChange={e => setTplMoldHours(e.target.value)} /></div>
            <div><label>Sản lượng / ca</label><input type="number" className="input" value={tplOutput} onChange={e => setTplOutput(e.target.value)} /></div>
            <div><label>Số đôi phế</label><input type="number" className="input" value={tplDefects} onChange={e => setTplDefects(e.target.value)} /></div>
          </div>

          {/* Preview Scores */}
          <div className="rounded border p-3 bg-gray-50">
            <div className="flex gap-6 text-sm flex-wrap">
              <div>Giờ T Tế: <b>{previewScores.working_real}</b></div>
              <div>Giờ C Xác: <b>{previewScores.working_exact}</b></div>
              <div>Tỷ lệ NS: <b>{previewScores.prodRate.toFixed(2)}</b></div>
              <div>Q: <b>{tplQ}</b></div>
              <div>P: <b>{tplP}</b></div>
              <div>KPI (Max 15): <b>{tplKPI}</b></div>
            </div>
          </div>

          {/* Preview Table */}
          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-center">
                <tr>
                  <th>MSNV</th><th>Họ tên</th><th>Loại hàng</th><th>Giờ nhập</th><th>Giờ khuôn</th><th>Sản lượng</th><th>Phế</th><th>Q</th><th>P</th><th>KPI</th><th>Tuân thủ</th>
                </tr>
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

      {/* --- Step 3: Editable Review (NÂNG CẤP) --- */}
      {step === 3 && (
        <EditReviewMolding
          pageSize={pageSize} page={page} setPage={setPage} totalPages={totalPages} pageRows={pageRows}
          selReview={selReview} toggleAllReviewOnPage={toggleAllReviewOnPage} toggleOneReview={toggleOneReview}
          saveBatch={saveBatch} saving={saving}
          // Props mới
          updateRow={updateRow}
          categoryOptions={categoryOptions}
        />
      )}
    </div>
  );
}


/* --- THÊM MỚI: Bảng Review (MOLDING) (Bản sao của EditReviewLeanline) --- */
function EditReviewMolding({
  pageSize, page, setPage, totalPages, pageRows, selReview,
  toggleAllReviewOnPage, toggleOneReview, updateRow, saveBatch, saving,
  categoryOptions 
}) {
  const globalIndex = (idx) => (page - 1) * pageSize + idx;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="btn btn-primary" onClick={saveBatch} disabled={saving || !selReview.size}>
          {saving ? "Đang lưu..." : `Lưu đã chọn (${selReview.size})`}
        </button>
        <div className="ml-auto flex items-center gap-3">
          <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>‹ Trước</button>
          <span>Trang {page}/{totalPages}</span>
          <button className="btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Sau ›</button>
        </div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-[1300px] text-sm">
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
                  <td className="p-2"><input type="date" className="input text-center w-32" value={r.work_date} onChange={(e) => updateRow(gi, "work_date", e.target.value)} /></td>
                  <td className="p-2"><select className="input text-center" value={r.shift} onChange={(e) => updateRow(gi, "shift", e.target.value)}><option value="Ca 1">Ca 1</option><option value="Ca 2">Ca 2</option><option value="Ca 3">Ca 3</option><option value="Ca HC">Ca HC</option></select></td>
                  <td className="p-2"><select className="input text-center w-32" value={r.category} onChange={(e) => updateRow(gi, "category", e.target.value)}><option value="">--Chọn--</option>{categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}</select></td>
                  <td className="p-2"><input type="number" className="input text-center w-20" value={r.working_input} onChange={(e) => updateRow(gi, "working_input", e.target.value)} /></td>
                  <td className="p-2"><input type="number" className="input text-center w-20" value={r.mold_hours} onChange={(e) => updateRow(gi, "mold_hours", e.target.value)} /></td>
                  <td className="p-2"><input type="number" className="input text-center w-20" value={r.output} onChange={(e) => updateRow(gi, "output", e.target.value)} /></td>
                  <td className="p-2"><input type="number" className="input text-center w-20" value={r.defects} onChange={(e) => updateRow(gi, "defects", e.target.value)} /></td>
                  <td className="p-2">{r.working_real}</td>
                  <td className="p-2">{r.working_exact}</td>
                  <td className="p-2">{r.q_score}</td>
                  <td className="p-2">{r.p_score}</td>
                  <td className="p-2 font-semibold">{r.day_score}</td>
                  <td className="p-2"><select className="input text-center w-28" value={r.compliance_code} onChange={(e) => updateRow(gi, "compliance_code", e.target.value)}>{COMPLIANCE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select></td>
                </tr>
              );
            })}
            {!pageRows.length && (<tr><td colSpan={16} className="p-4 text-center text-gray-500">Không có dữ liệu</td></tr>)}
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
  
  // Sử dụng helper tính điểm mới
  function recompute(row) {
    const scores = calculateScoresMolding(row, rulesByCat);
    return { ...row, ...scores, day_score: scores.kpi };
  }

  function update(i, key, val) {
    setRows((old) => {
      const copy = old.slice();
      const r = { ...copy[i], [key]: ["ca", "category", "compliance_code"].includes(key) ? val : toNum(val, 0) };
      copy[i] = recompute(r); // Recompute sử dụng helper mới
      return copy;
    });
  }
  const [saving, setSaving] = useState(false);
  async function saveAll() {
    if (!rows.length) return alert("Không có dữ liệu để lưu.");
    const now = new Date().toISOString();
    const payload = rows.map((r) => {
      // Recompute lần cuối để đảm bảo
      const finalScores = calculateScoresMolding(r, rulesByCat);
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
          <label>MSNV người nhập<input className="input" value={entrantId} onChange={(e) => setEntrantId(e.target.value)} /></label>
          <label>Họ tên người nhập<input className="input" value={entrantName} readOnly /></label>
          <label>MSNV/Họ tên (áp dụng = người nhập)<input className="input" value={`${workerId} / ${workerName}`} readOnly /></label>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <label>Từ ngày<input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
          <label>Đến ngày<input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
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
                    <td><input type="number" className="input text-center" value={r.defects} onChange={(e) => update(i, "defects", e.target.value)} /></td>
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