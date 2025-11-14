// src/pages/QuickEntry.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";
import { scoreByQuality, scoreByProductivityLeanlineQuick, scoreByProductivityMoldingQuick } from "../lib/scoring";
import ApproverModeHybrid from "./QuickEntryLPS";

/* ===== Helpers ===== */
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
const cx = (...classes) => classes.filter(Boolean).join(" ");
const currentMachines = [
  "LEAN-D1", "LEAN-D2", "LEAN-D3", "LEAN-D4", "LEAN-D5", "LEAN-D6",
  "LEAN-D7", "LEAN-D8", "LEAN-D9", "LEAN-D10", "LEAN-D11", "LEAN-D12"
];
// const currentMoldingLines = ["INJ1", "INJ2", "INJ3", "INJ4", "INJ5"]; // Not used directly in UI here


function QuickEntry() {
  const { kpiSection } = useKpiSection();
  if (isHybridSection(kpiSection)) {
    return <ApproverModeHybrid section={kpiSection} />;
  }
  if (kpiSection === "LEANLINE_DC" || kpiSection === "LEANLINE_MOLDED") {
    return <ApproverModeLeanline section={kpiSection} />;
  }
  if (kpiSection === "MOLDING") {
    return <ApproverModeMolding section={kpiSection} />;
  }
  return <div>Chọn Section KPI để bắt đầu.</div>;
}


/* ======================================================================
   APPROVER MODE — LEANLINE
   ====================================================================== */
function ApproverModeLeanline({ section }) {
    
  const [step, setStep] = useState(1);
  const [prodRules, setProdRules] = useState([]); 
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [approverIdInput, setApproverIdInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchAllSections, setSearchAllSections] = useState(false);
  const [lineFilter, setLineFilter] = useState("");
  const [tplOE, setTplOE] = useState(0); 
  const [tplDefects, setTplDefects] = useState(0); 
  const [tplDowntime, setTplDowntime] = useState(0); 
  const [tplLine, setTplLine] = useState(currentMachines[0] || "LEAN-D1"); 
  const [saving, setSaving] = useState(false);
  const pageSize = 50;
  const [page, setPage] = useState(1);
  const selectedIds = useMemo(() => new Set(selectedWorkers.map(w => w.msnv)), [selectedWorkers]);
  
  const filteredSearchResults = useMemo(() => {
    if (!lineFilter) return searchResults;
    return searchResults.filter(w => w.line === lineFilter);
  }, [searchResults, lineFilter]);

  const calculateScores = (oe, defects, rules, sec, line) => {
    const q = scoreByQuality(defects);
    const p = scoreByProductivityLeanlineQuick(oe, rules, sec, line);
    const total = q + p;
    return { qScore: q, pScore: p, kpi: Math.min(15, total), rawTotal: total };
  };

  const reviewRows = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return selectedWorkers.map(w => {
      const { qScore, pScore, kpi } = calculateScores(tplOE, tplDefects, prodRules, section, tplLine);
      return {
        ...w,
        date: today,
        section,
        line: tplLine,
        oe: tplOE,
        defects: tplDefects,
        downtime: tplDowntime,
        q_score: qScore,
        p_score: pScore,
        day_score: kpi,
        compliance_code: w.compliance_code || "NONE" // Lấy compliance_code từ selectedWorkers
      };
    });
  }, [selectedWorkers, tplOE, tplDefects, tplDowntime, tplLine, prodRules, section]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(reviewRows.length / pageSize)), [reviewRows.length]);
  const pageRows = useMemo(
    () => reviewRows.slice((page - 1) * pageSize, page * pageSize),
    [reviewRows, page]
  );
  
  useEffect(() => {
    let cancelled = false;
    async function loadRules() {
      const { data: rules, error } = await supabase
        .from("kpi_rules_prod_leanline")
        .select("*")
        .eq("section", section);
      if (!cancelled) {
        if (error) {
          console.error("Lỗi tải rules:", error);
        } else {
          setProdRules(rules || []);
        }
      }
    }
    loadRules();
    return () => { cancelled = true; };
  }, [section]);
  useEffect(() => setPage(1), [reviewRows.length]);

  function addWorker(worker) {
    if (!selectedIds.has(worker.msnv)) {
      setSelectedWorkers(prev => [...prev, worker]);
    }
  }

  function removeWorker(msnv) {
    setSelectedWorkers(prev => prev.filter(w => w.msnv !== msnv));
  }
  
  function removeAllWorkers() {
    if (window.confirm(`Bạn có chắc muốn xoá ${selectedWorkers.length} nhân viên đã chọn?`)) {
      setSelectedWorkers([]);
    }
  }

  function proceedToTemplate() {
    if (selectedWorkers.length === 0) return alert("Vui lòng chọn nhân viên.");
    setStep(2);
  }

  function buildReviewRows() {
    setStep(3);
  }

  async function searchByApprover() {
    const q = approverIdInput.trim();
    if (!q) return alert("Nhập Tên hoặc MSNV người duyệt.");
    setLoadingSearch(true);
    let query;
    if (isNaN(Number(q))) {
      query = supabase.from("users")
        .select("msnv, full_name, section, line, approver_msnv, approver_name")
        .ilike("approver_name", `%${q}%`);
    } else {
      query = supabase.from("users")
        .select("msnv, full_name, section, line, approver_msnv, approver_name")
        .eq("approver_msnv", q);
    }
    if (!searchAllSections) {
      query = query.eq("section", section); 
    }
    // ĐÃ XOÁ .limit(100)
    const { data, error } = await query;
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
      query = supabase.from("users").select("msnv, full_name, section, line, approver_msnv, approver_name").ilike("full_name", `%${q}%`);
    } else {
      query = supabase.from("users").select("msnv, full_name, section, line, approver_msnv, approver_name").eq("msnv", q);
    }
    if (!searchAllSections) {
      query = query.eq("section", section);
    }
    // ĐÃ XOÁ .limit(50)
    const { data, error } = await query;
    setLoadingSearch(false);
    if (error) return alert("Lỗi tìm nhân viên: " + error.message);
    setSearchResults(data || []);
    setApproverIdInput("");
    setLineFilter(""); // Reset filter khi tìm kiếm mới
  }

  async function saveEntry() {
    setSaving(true);
    const records = reviewRows.map(r => ({
      ...r,
      approver_id: r.approver_msnv, // dùng cho bảng kpi_quick_entry
      compliance_code: r.compliance_code || "NONE",
      date: new Date(r.date).toISOString().split('T')[0]
    }));

    const { error } = await supabase
      .from("kpi_quick_entry")
      .insert(records);

    setSaving(false);
    if (error) {
      alert("Lỗi lưu KPI: " + error.message);
    } else {
      alert(`Đã lưu thành công ${records.length} bản ghi.`);
      setStep(1);
      setSelectedWorkers([]);
    }
  }

  function updateCompliance(msnv, value) {
    setSelectedWorkers(prev => prev.map(w => w.msnv === msnv ? { ...w, compliance_code: value } : w));
  }


  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Nhập KPI Nhanh - {section}</h2>
      
      {step === 1 && (
        <>
          <div className="flex justify-end">
            <button className="btn btn-primary" onClick={proceedToTemplate} disabled={selectedWorkers.length === 0}>
              Tiếp tục ({selectedWorkers.length} nhân viên)
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ minHeight: '400px' }}>
            {/* KHỐI ĐÃ CHỌN */}
            <div className="border rounded p-3 bg-white space-y-2 flex flex-col">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Đã chọn ({selectedWorkers.length})</h3>
                {selectedWorkers.length > 0 && (
                  <button 
                    className="btn bg-red-100 text-red-700 hover:bg-red-200" 
                    style={{padding: '4px 8px'}} 
                    onClick={removeAllWorkers}
                  >
                    Xoá tất cả
                  </button>
                )}
              </div>
              <div className="overflow-auto flex-1">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr><th className="p-2 text-left">MSNV</th><th className="p-2 text-left">Họ & tên</th><th className="p-2 text-center">Line</th><th className="p-2 text-center">Xoá</th></tr>
                  </thead>
                  <tbody>
                    {selectedWorkers.map((w) => (
                      <tr key={w.msnv} className="border-t hover:bg-gray-50">
                        <td className="p-2">{w.msnv}</td>
                        <td className="p-2">{w.full_name}</td>
                        <td className="p-2 text-center">{w.line || "N/A"}</td>
                        <td className="p-2 text-center">
                          <button className="text-red-500 hover:text-red-700" onClick={() => removeWorker(w.msnv)}>Xoá</button>
                        </td>
                      </tr>
                    ))}
                    {!selectedWorkers.length && (<tr><td colSpan={4} className="p-4 text-center text-gray-500">Chưa chọn nhân viên nào.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* KHỐI KẾT QUẢ TÌM KIẾM */}
            <div className="md:col-span-1 border rounded p-3 bg-white space-y-2 flex flex-col">
              <h3 className="font-semibold text-lg">Tìm kiếm nhân viên</h3>
              
              {/* Form tìm kiếm theo Người duyệt (Cách 1) */}
              <div className="space-y-2 p-2 border rounded">
                <h4 className="font-medium">Cách 1: Tìm theo MSNV/Tên người duyệt</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="MSNV hoặc Tên người duyệt"
                    value={approverIdInput}
                    onChange={(e) => setApproverIdInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchByApprover()}
                  />
                  <button className="btn btn-primary" onClick={searchByApprover} disabled={loadingSearch}>
                    {loadingSearch ? "Đang tìm..." : "Tìm"}
                  </button>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={searchAllSections} onChange={(e) => setSearchAllSections(e.target.checked)} />
                  Tìm kiếm toàn bộ Section
                </label>
              </div>

              {/* Form tìm kiếm toàn cục (Cách 2) */}
              <div className="space-y-2 p-2 border rounded">
                <h4 className="font-medium">Cách 2: Tìm theo MSNV/Tên nhân viên (Toàn cục)</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="MSNV hoặc Tên nhân viên"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchGlobal()}
                  />
                  <button className="btn btn-primary" onClick={searchGlobal} disabled={loadingSearch}>
                    {loadingSearch ? "Đang tìm..." : "Tìm"}
                  </button>
                </div>
              </div>

              {/* Filter theo Line (Leanline) */}
              {searchResults.length > 0 && section !== "MOLDING" && (
                <div className="flex gap-2 items-center text-sm">
                  <label>Lọc theo Line:</label>
                  <select className="input" value={lineFilter} onChange={(e) => setLineFilter(e.target.value)}>
                    <option value="">Tất cả ({searchResults.length})</option>
                    {[...new Set(searchResults.map(w => w.line))].sort().filter(Boolean).map(line => (
                      <option key={line} value={line}>{line} ({searchResults.filter(w => w.line === line).length})</option>
                    ))}
                  </select>
                </div>
              )}
              {searchResults.length > 0 && section === "MOLDING" && (
                 <div className="flex gap-2 items-center text-sm">
                 <label>Kết quả tìm kiếm:</label>
                 <span>({searchResults.length} nhân viên)</span>
               </div>
              )}


              <div className="flex justify-end">
                  <button 
                      className="btn" 
                      onClick={() => {
                          if (!filteredSearchResults.length) return;
                          setSelectedWorkers(prev => {
                              const existingIds = new Set(prev.map(w => w.msnv));
                              // Thêm toàn bộ kết quả đã được lọc
                              const newWorkersToAdd = filteredSearchResults.filter(
                                  worker => !existingIds.has(worker.msnv)
                              );
                              return [...prev, ...newWorkersToAdd];
                          });
                      }} 
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
                      <th className="p-2 text-center">Line</th> 
                      <th className="p-2 text-center">Thêm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSearchResults.map((w) => { 
                      const isSelected = selectedIds.has(w.msnv);
                      return (
                        <tr key={w.msnv} className={cx("border-t", isSelected ? "bg-gray-100 opacity-50" : "hover:bg-gray-50")}>
                          <td className="p-2">{w.msnv}</td>
                          <td className="p-2">{w.full_name}</td>
                          <td className="p-2 text-center">{w.line || "N/A"}</td> 
                          <td className="p-2 text-center">
                            <button 
                              className="btn" 
                              style={{padding: '4px 8px'}} 
                              onClick={() => addWorker(w)} 
                              disabled={isSelected}
                            >
                              {isSelected ? "Đã chọn" : "+"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!filteredSearchResults.length && (<tr><td colSpan={4} className="p-4 text-center text-gray-500">Không có kết quả.</td></tr>)} 
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Bước 2: Nhập dữ liệu KPI mẫu</h3>
          <div className="space-y-3 p-4 border rounded bg-gray-50">
            <h4 className="font-medium">Áp dụng cho {selectedWorkers.length} nhân viên</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className="block text-sm font-medium">Line</label>
                <select className="input w-full" value={tplLine} onChange={(e) => setTplLine(e.target.value)}>
                  {currentMachines.map(m => (<option key={m} value={m}>{m}</option>))}
                </select>
              </div>
              <div><label className="block text-sm font-medium">OE (%)</label>
                <input type="number" className="input w-full" value={tplOE} onChange={(e) => setTplOE(Number(e.target.value))} />
              </div>
              <div><label className="block text-sm font-medium">Defects (pcs)</label>
                <input type="number" className="input w-full" value={tplDefects} onChange={(e) => setTplDefects(Number(e.target.value))} />
              </div>
              <div><label className="block text-sm font-medium">Downtime (phút)</label>
                <input type="number" className="input w-full" value={tplDowntime} onChange={(e) => setTplDowntime(Number(e.target.value))} />
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Quay lại</button>
            <button className="btn btn-primary" onClick={buildReviewRows}>Xem trước và Xác nhận</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Bước 3: Xác nhận & Lưu KPI</h3>
          <p className="text-sm text-red-500">LƯU Ý: Vui lòng kiểm tra kỹ trước khi lưu! Điểm sẽ được tính theo công thức của Section **{section}**.</p>
          
          <div className="overflow-auto max-h-[60vh] border rounded">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-gray-200">
                <tr>
                  <th className="p-2 text-left">MSNV</th>
                  <th className="p-2 text-left">Họ & tên</th>
                  <th className="p-2 text-center">Line</th>
                  <th className="p-2 text-center">OE</th>
                  <th className="p-2 text-center">Defects</th>
                  <th className="p-2 text-center">Downtime</th>
                  <th className="p-2 text-center">Q-Score</th>
                  <th className="p-2 text-center">P-Score</th>
                  <th className="p-2 text-center">KPI</th>
                  <th className="p-2 text-left">Code Vi phạm</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.msnv} className="border-t">
                    <td className="p-2">{r.msnv}</td>
                    <td className="p-2">{r.full_name}</td>
                    <td className="p-2 text-center">{r.line}</td>
                    <td className="p-2 text-center">{r.oe}%</td>
                    <td className="p-2 text-center">{r.defects}</td>
                    <td className="p-2 text-center">{r.downtime}</td>
                    <td className="p-2 text-center">{r.q_score.toFixed(1)}</td>
                    <td className="p-2 text-center">{r.p_score.toFixed(1)}</td>
                    <td className="p-2 text-center font-semibold">{r.day_score.toFixed(1)}</td>
                    <td className="p-2">
                        <select className="input text-center" value={r.compliance_code} onChange={(e) => updateCompliance(r.msnv, e.target.value)}>
                            {COMPLIANCE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                        </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                ‹ Trước
              </button>
              <span>
                Trang {page}/{totalPages}
              </span>
              <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Sau ›
              </button>
            </div>
          )}

          <div className="flex justify-between mt-4">
            <button className="btn btn-secondary" onClick={() => setStep(2)}>Quay lại</button>
            <button className="btn btn-success" onClick={saveEntry} disabled={saving}>
              {saving ? "Đang lưu..." : `Lưu ${reviewRows.length} Bản Ghi`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


/* ======================================================================
   APPROVER MODE — MOLDING
   ====================================================================== */
function ApproverModeMolding({ section }) {
  const [step, setStep] = useState(1);
  const [prodRules, setProdRules] = useState([]); 
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [approverIdInput, setApproverIdInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchAllSections, setSearchAllSections] = useState(false);
  const [tplWorkingInput, setTplWorkingInput] = useState(0); 
  const [tplMoldHours, setTplMoldHours] = useState(0); 
  const [tplOutput, setTplOutput] = useState(0); 
  const [tplDefects, setTplDefects] = useState(0); 
  const [saving, setSaving] = useState(false);
  const pageSize = 50;
  const [page, setPage] = useState(1);
  const selectedIds = useMemo(() => new Set(selectedWorkers.map(w => w.msnv)), [selectedWorkers]);
  
  // Thêm hàm xoá tất cả
  function removeAllWorkers() {
    if (window.confirm(`Bạn có chắc muốn xoá ${selectedWorkers.length} nhân viên đã chọn?`)) {
      setSelectedWorkers([]);
    }
  }

  const calculateScores = (wi, mh, output, defects, rules) => {
    const q = scoreByQuality(defects, output);
    const { pScore, workingReal, downtime, workingExact } = scoreByProductivityMoldingQuick(wi, mh, rules);
    const total = q + pScore;
    return { 
      q_score: q, 
      p_score: pScore, 
      day_score: Math.min(15, total), 
      working_real: workingReal, 
      downtime: downtime, 
      working_exact: workingExact, 
      output 
    };
  };

  const reviewRows = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return selectedWorkers.map(w => {
      const { q_score, p_score, day_score, working_real, downtime, working_exact, output } = calculateScores(
        tplWorkingInput, tplMoldHours, tplOutput, tplDefects, prodRules
      );
      return {
        ...w,
        date: today,
        section,
        working_input: tplWorkingInput,
        mold_hours: tplMoldHours,
        output: tplOutput,
        defects: tplDefects,
        working_real,
        downtime,
        working_exact,
        q_score,
        p_score,
        day_score,
        compliance_code: w.compliance_code || "NONE" // Lấy compliance_code từ selectedWorkers
      };
    });
  }, [selectedWorkers, tplWorkingInput, tplMoldHours, tplOutput, tplDefects, prodRules, section]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(reviewRows.length / pageSize)), [reviewRows.length]);
  const pageRows = useMemo(
    () => reviewRows.slice((page - 1) * pageSize, page * pageSize),
    [reviewRows, page]
  );
  
  useEffect(() => {
    let cancelled = false;
    async function loadRules() {
      const { data: rules, error } = await supabase
        .from("kpi_rules_prod_molding")
        .select("*");
      if (!cancelled) {
        if (error) {
          console.error("Lỗi tải rules:", error);
        } else {
          setProdRules(rules || []);
        }
      }
    }
    loadRules();
    return () => { cancelled = true; };
  }, [section]);
  useEffect(() => setPage(1), [reviewRows.length]);

  function addWorker(worker) {
    if (!selectedIds.has(worker.msnv)) {
      setSelectedWorkers(prev => [...prev, worker]);
    }
  }

  function removeWorker(msnv) {
    setSelectedWorkers(prev => prev.filter(w => w.msnv !== msnv));
  }
  
  function addAllResults() {
    setSelectedWorkers(prev => {
        const existingIds = new Set(prev.map(w => w.msnv));
        const newWorkersToAdd = searchResults.filter(
            worker => !existingIds.has(worker.msnv)
        );
        return [...prev, ...newWorkersToAdd];
    });
  }


  function proceedToTemplate() {
    if (selectedWorkers.length === 0) return alert("Vui lòng chọn nhân viên.");
    setStep(2);
  }

  function buildReviewRows() {
    setStep(3);
  }

  async function searchByApprover() {
    const q = approverIdInput.trim();
    if (!q) return alert("Nhập Tên hoặc MSNV người duyệt.");
    setLoadingSearch(true);
    let query;
    if (isNaN(Number(q))) {
      query = supabase.from("users")
        .select("msnv, full_name, section, line, approver_msnv, approver_name")
        .ilike("approver_name", `%${q}%`);
    } else {
      query = supabase.from("users")
        .select("msnv, full_name, section, line, approver_msnv, approver_name")
        .eq("approver_msnv", q);
    }
    if (!searchAllSections) {
      query = query.eq("section", section); 
    }
    // ĐÃ XOÁ .limit(100)
    const { data, error } = await query;
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
    if (!searchAllSections) {
      query = query.eq("section", section);
    }
    // ĐÃ XOÁ .limit(50)
    const { data, error } = await query;
    setLoadingSearch(false);
    if (error) return alert("Lỗi tìm nhân viên: " + error.message);
    setSearchResults(data || []);
    setApproverIdInput("");
  }

  async function saveEntry() {
    setSaving(true);
    const records = reviewRows.map(r => ({
      ...r,
      approver_id: r.approver_msnv, // dùng cho bảng kpi_quick_entry
      compliance_code: r.compliance_code || "NONE",
      date: new Date(r.date).toISOString().split('T')[0]
    }));

    const { error } = await supabase
      .from("kpi_quick_entry_molding")
      .insert(records);

    setSaving(false);
    if (error) {
      alert("Lỗi lưu KPI: " + error.message);
    } else {
      alert(`Đã lưu thành công ${records.length} bản ghi.`);
      setStep(1);
      setSelectedWorkers([]);
    }
  }

  function updateCompliance(msnv, value) {
    setSelectedWorkers(prev => prev.map(w => w.msnv === msnv ? { ...w, compliance_code: value } : w));
  }
  
  /* UI */
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Nhập KPI Nhanh - {section}</h2>
      
      {step === 1 && (
        <>
          <div className="flex justify-end">
            <button className="btn btn-primary" onClick={proceedToTemplate} disabled={selectedWorkers.length === 0}>
              Tiếp tục ({selectedWorkers.length} nhân viên)
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ minHeight: '400px' }}>
            {/* KHỐI ĐÃ CHỌN */}
            <div className="border rounded p-3 bg-white space-y-2 flex flex-col">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Đã chọn ({selectedWorkers.length})</h3>
                {selectedWorkers.length > 0 && (
                  <button 
                    className="btn bg-red-100 text-red-700 hover:bg-red-200" 
                    style={{padding: '4px 8px'}} 
                    onClick={removeAllWorkers}
                  >
                    Xoá tất cả
                  </button>
                )}
              </div>
              <div className="overflow-auto flex-1">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr><th className="p-2 text-left">MSNV</th><th className="p-2 text-left">Họ & tên</th><th className="p-2 text-center">Xoá</th></tr>
                  </thead>
                  <tbody>
                    {selectedWorkers.map((w) => (
                      <tr key={w.msnv} className="border-t hover:bg-gray-50">
                        <td className="p-2">{w.msnv}</td>
                        <td className="p-2">{w.full_name}</td>
                        <td className="p-2 text-center">
                          <button className="text-red-500 hover:text-red-700" onClick={() => removeWorker(w.msnv)}>Xoá</button>
                        </td>
                      </tr>
                    ))}
                    {!selectedWorkers.length && (<tr><td colSpan={3} className="p-4 text-center text-gray-500">Chưa chọn nhân viên nào.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* KHỐI KẾT QUẢ TÌM KIẾM */}
            <div className="md:col-span-1 border rounded p-3 bg-white space-y-2 flex flex-col">
              <h3 className="font-semibold text-lg">Tìm kiếm nhân viên</h3>
              
              {/* Form tìm kiếm theo Người duyệt (Cách 1) */}
              <div className="space-y-2 p-2 border rounded">
                <h4 className="font-medium">Cách 1: Tìm theo MSNV/Tên người duyệt</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="MSNV hoặc Tên người duyệt"
                    value={approverIdInput}
                    onChange={(e) => setApproverIdInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchByApprover()}
                  />
                  <button className="btn btn-primary" onClick={searchByApprover} disabled={loadingSearch}>
                    {loadingSearch ? "Đang tìm..." : "Tìm"}
                  </button>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={searchAllSections} onChange={(e) => setSearchAllSections(e.target.checked)} />
                  Tìm kiếm toàn bộ Section
                </label>
              </div>

              {/* Form tìm kiếm toàn cục (Cách 2) */}
              <div className="space-y-2 p-2 border rounded">
                <h4 className="font-medium">Cách 2: Tìm theo MSNV/Tên nhân viên (Toàn cục)</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="MSNV hoặc Tên nhân viên"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchGlobal()}
                  />
                  <button className="btn btn-primary" onClick={searchGlobal} disabled={loadingSearch}>
                    {loadingSearch ? "Đang tìm..." : "Tìm"}
                  </button>
                </div>
              </div>

              <div className="overflow-auto flex-1 border-t pt-2">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-semibold">Kết quả tìm kiếm ({searchResults.length})</h4>
                  <button 
                    className="btn" 
                    style={{padding: '4px 8px'}} 
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

      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Bước 2: Nhập dữ liệu KPI mẫu</h3>
          <div className="space-y-3 p-4 border rounded bg-gray-50">
            <h4 className="font-medium">Áp dụng cho {selectedWorkers.length} nhân viên</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className="block text-sm font-medium">Working Input (giờ)</label>
                <input type="number" className="input w-full" value={tplWorkingInput} onChange={(e) => setTplWorkingInput(Number(e.target.value))} />
              </div>
              <div><label className="block text-sm font-medium">Mold Hours</label>
                <input type="number" className="input w-full" value={tplMoldHours} onChange={(e) => setTplMoldHours(Number(e.target.value))} />
              </div>
              <div><label className="block text-sm font-medium">Output (pcs)</label>
                <input type="number" className="input w-full" value={tplOutput} onChange={(e) => setTplOutput(Number(e.target.value))} />
              </div>
              <div><label className="block text-sm font-medium">Defects (pcs)</label>
                <input type="number" className="input w-full" value={tplDefects} onChange={(e) => setTplDefects(Number(e.target.value))} step="0.5" />
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <button className="btn btn-secondary" onClick={() => setStep(1)}>Quay lại</button>
            <button className="btn btn-primary" onClick={buildReviewRows}>Xem trước và Xác nhận</button>
          </div>
        </div>
      )}
      
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Bước 3: Xác nhận & Lưu KPI</h3>
          <p className="text-sm text-red-500">LƯU Ý: Vui lòng kiểm tra kỹ trước khi lưu! Điểm sẽ được tính theo công thức của Section **{section}**.</p>
          
          <div className="overflow-auto max-h-[60vh] border rounded">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-gray-200">
                <tr>
                  <th className="p-2 text-left">MSNV</th>
                  <th className="p-2 text-left">Họ & tên</th>
                  <th className="p-2 text-center">Input (giờ)</th>
                  <th className="p-2 text-center">Thực (giờ)</th>
                  <th className="p-2 text-center">Downtime</th>
                  <th className="p-2 text-center">Exact (giờ)</th>
                  <th className="p-2 text-center">Mold Hours</th>
                  <th className="p-2 text-center">Output</th>
                  <th className="p-2 text-center">Defects</th>
                  <th className="p-2 text-center">Q-Score</th>
                  <th className="p-2 text-center">P-Score</th>
                  <th className="p-2 text-center">KPI</th>
                  <th className="p-2 text-left">Code Vi phạm</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.msnv} className="border-t">
                    <td className="p-2">{r.msnv}</td>
                    <td className="p-2">{r.full_name}</td>
                    <td className="p-2 text-center">{r.working_input}</td>
                    <td className="p-2 text-center">{r.working_real}</td>
                    <td className="p-2 text-center">{r.downtime}</td>
                    <td className="p-2 text-center">{r.working_exact}</td>
                    <td className="p-2 text-center">{r.mold_hours}</td>
                    <td className="p-2 text-center">{r.output}</td>
                    <td className="p-2 text-center">{r.defects}</td>
                    <td className="p-2 text-center">{r.q_score.toFixed(1)}</td>
                    <td className="p-2 text-center">{r.p_score.toFixed(1)}</td>
                    <td className="p-2 text-center font-semibold">{r.day_score.toFixed(1)}</td>
                    <td className="p-2">
                        <select className="input text-center" value={r.compliance_code} onChange={(e) => updateCompliance(r.msnv, e.target.value)}>
                            {COMPLIANCE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                        </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                ‹ Trước
              </button>
              <span>
                Trang {page}/{totalPages}
              </span>
              <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Sau ›
              </button>
            </div>
          )}

          <div className="flex justify-between mt-4">
            <button className="btn btn-secondary" onClick={() => setStep(2)}>Quay lại</button>
            <button className="btn btn-success" onClick={saveEntry} disabled={saving}>
              {saving ? "Đang lưu..." : `Lưu ${reviewRows.length} Bản Ghi`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuickEntry;  