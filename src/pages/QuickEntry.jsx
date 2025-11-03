// src/pages/QuickEntry.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";
import { scoreByQuality } from "../lib/scoring"; // Sửa: import scoreByQuality
import ApproverModeHybrid from "./QuickEntryLPS"; 

/* ===== Danh sách Tuân thủ dùng chung ===== */
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
/* ===== Helpers ===== */
const cx = (...a) => a.filter(Boolean).join(" ");
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/* Molding: quy đổi giờ thực tế từ giờ nhập + ca */
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

function CellInput({ value, onChange, type = "text", className = "input text-center", step, min }) {
  return (
    <input
      className={className}
      value={value ?? ""}
      type={type}
      step={step}
      min={min}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Rule mapping helper cho LEANLINE_MOLDED
const getMoldedCategoryFromLine = (line) => {
    if (line === 'M4' || line === 'M5') return 'M4 & M5 %OE';
    if (line === 'M1' || line === 'M2' || line === 'M3') return 'M1 M2 M3 %OE';
    return ''; 
};

// Hàm tính điểm Sản lượng Leanline (Dùng Rule DB dựa trên Line)
function scoreByProductivityLeanlineQuick(oe, allRules, section, line) {
  const val = Number(oe ?? 0);
  let rules = [];
  let category = '';

  if (section === "LEANLINE_MOLDED") {
    // 1. Map line to category và lọc Rule
    category = getMoldedCategoryFromLine(line);
    rules = (allRules || [])
      .filter(r => r.active !== false && r.category === category)
      .sort((a, b) => Number(b.threshold) - Number(a.threshold));
  } else {
    // 2. Default Leanline DC (không cần category filter)
    rules = (allRules || [])
      .filter(r => r.active !== false && !r.category)
      .sort((a, b) => Number(b.threshold) - Number(a.threshold));
  }
  
  for (const r of rules) {
    if (val >= r.threshold) return Number(r.score || 0);
  }
  return 0;
}

// Map để xác định line cho Leanline (DC vs MOLDED)
const LEANLINE_MACHINES = {
    "LEANLINE_MOLDED": ["M1", "M2", "M3", "M4", "M5"],
    "LEANLINE_DC": ["LEAN-D1", "LEAN-D2", "LEAN-D3", "LEAN-D4", "LEAN-H1", "LEAN-H2"],
    "DEFAULT": ["LEAN-D1", "LEAN-D2", "LEAN-D3", "LEAN-D4", "LEAN-H1", "LEAN-H2"],
}
const getLeanlineMachines = (section) => LEANLINE_MACHINES[section] || LEANLINE_MACHINES.DEFAULT;


/* ===== Main ===== */
export default function QuickEntry() {
  const { section } = useKpiSection();
  const isMolding = section === "MOLDING";
  const isHybrid = isHybridSection(section);
  // const isLeanline = String(section || "").toUpperCase().startsWith("LEANLINE"); // Unused

  // Bắt đầu với form login (vì logic ApproverModeMolding nằm bên ngoài)
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
  
  // Sau khi login, chỉ hiển thị Approver mode
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Nhập KPI nhanh ({section})</h2>
        {/* Lược bỏ nút chuyển mode nếu không cần Self Mode */}
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

/* Component con để login */
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
   APPROVER MODE — LEANLINE (CẬP NHẬT GIAO DIỆN CHỌN NV)
   ====================================================================== */
function ApproverModeLeanline({ section }) {
    
  // --- Khai báo States/Constants ở đầu hàm ---
  const [step, setStep] = useState(1);
  const [prodRules, setProdRules] = useState([]); 
  const [approverId, setApproverId] = useState("");
  const [workers, setWorkers] = useState([]); // Danh sách NV gốc
  
  // --- THAY ĐỔI 1: Dùng mảng [Object] cho NV đã chọn, thay vì Set(msnv) ---
  const [selectedWorkers, setSelectedWorkers] = useState([]); 
  const [search, setSearch] = useState("");
  
  const [reviewRows, setReviewRows] = useState([]);
  const [selReview, setSelReview] = useState(() => new Set());
  
  // Biến Template (Khai báo sớm nhất)
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
  
  // --- Khai báo Memoized Values ---
  
  // --- THAY ĐỔI 2: Lấy ID của NV đã chọn để lọc ---
  const selectedIds = useMemo(() => new Set(selectedWorkers.map(w => w.msnv)), [selectedWorkers]);

  // --- THAY ĐỔI 3: filteredWorkers là danh sách TÌM KIẾM (chưa được chọn) ---
  const filteredWorkers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return []; // Chỉ hiển thị khi người dùng gõ tìm kiếm
    return workers.filter(
      (w) =>
        !selectedIds.has(w.msnv) && // Ẩn nếu đã có trong danh sách "Đã chọn"
        (String(w.msnv).toLowerCase().includes(q) ||
         String(w.full_name || "").toLowerCase().includes(q))
    );
  }, [workers, search, selectedIds]); // Thêm selectedIds
  
  // Hàm tính điểm (Helper nội bộ, không dùng useMemo để tránh TDZ)
  const calculateScores = (oe, defects, rules, sec, line) => {
    const q = scoreByQuality(defects);
    const p = scoreByProductivityLeanlineQuick(oe, rules, sec, line);
    const total = q + p;
    return { qScore: q, pScore: p, kpi: Math.min(15, total), rawTotal: total };
  };

  // Tính toán điểm Preview (Sử dụng hàm Helper)
  const previewScores = useMemo(() => calculateScores(tplOE, tplDefects, prodRules, section, tplLine), [tplOE, tplDefects, prodRules, section, tplLine]);
  const tplQ = previewScores.qScore;
  const tplP = previewScores.pScore;
  const tplKPI = previewScores.kpi;
  
  const totalPages = Math.max(1, Math.ceil(reviewRows.length / pageSize));
  const pageRows = useMemo(
    () => reviewRows.slice((page - 1) * pageSize, page * pageSize),
    [reviewRows, page]
  );
  
  // --- Effects ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("kpi_rule_productivity")
        .select("*")
        .eq("active", true)
        .eq("section", section)
        .order("threshold", { ascending: false });
      if (!cancelled) {
        if (error) console.error("Load rules error:", error);
        setProdRules(data || []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section]);
  
  useEffect(() => setPage(1), [reviewRows.length]);

  // --- Functions ---
  async function loadWorkers() {
    const id = approverId.trim();
    if (!id) return alert("Nhập MSNV người duyệt trước.");
    const { data, error } = await supabase
      .from("users")
      .select("msnv, full_name, approver_msnv, approver_name")
      .eq("approver_msnv", id);
    if (error) return alert("Lỗi tải nhân viên: " + error.message);
    setWorkers(data || []);
    // --- THAY ĐỔI 4: Reset mảng NV đã chọn ---
    setSelectedWorkers([]);
    setSearch("");
  }

  // --- THAY ĐỔI 5: Hàm Thêm/Xoá NV khỏi danh sách "Đã chọn" ---
  function addWorker(worker) {
    setSelectedWorkers(prev => {
      if (prev.find(w => w.msnv === worker.msnv)) return prev; // Đã có
      return [worker, ...prev]; // Thêm vào đầu danh sách
    });
  }
  function removeWorker(msnv) {
    setSelectedWorkers(prev => prev.filter(w => w.msnv !== msnv));
  }
  // (Xoá hàm toggleWorker và toggleAllWorkers)
  
  function proceedToTemplate() {
    const requiredRulesLoaded = section === "LEANLINE_MOLDED" || prodRules.length > 0;
    if (!requiredRulesLoaded) return alert("Không thể tải Rule tính điểm sản lượng. Vui lòng thử lại.");
    // --- THAY ĐỔI 6: Kiểm tra mảng selectedWorkers ---
    if (!selectedWorkers.length) return alert("Chưa chọn nhân viên nào.");
    setStep(2);
  }

  function buildReviewRows() {
    if (!tplDate || !tplShift) return alert("Nhập Ngày & Ca.");
    // --- THAY ĐỔI 7: Kiểm tra mảng selectedWorkers ---
    if (!selectedWorkers.length) return alert("Chưa chọn nhân viên.");

    // --- THAY ĐỔI 8: Dùng thẳng mảng selectedWorkers ---
    const rows = selectedWorkers.map((w) => {
      const scores = calculateScores(tplOE, tplDefects, prodRules, section, tplLine);

      return {
      section,
      work_date: tplDate,
      shift: tplShift,
      msnv: w.msnv,
      hoten: w.full_name,
      approver_id: approverId,
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

      // tính lại điểm theo Leanline
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
        date: r.work_date,
        ca: r.shift,
        worker_id: r.msnv,
        worker_name: r.hoten,
        approver_id: r.approver_id,
        approver_name: r.approver_name,
        line: r.line,
        work_hours: Number(r.work_hours || 0),
        stop_hours: Number(r.downtime || 0),
        oe: Number(r.oe || 0),
        defects: Number(r.defects || 0),
        p_score: r.p_score,
        q_score: r.q_score,
        day_score: r.total_score,
        overflow,
        compliance_code: r.compliance,
        section: r.section,
        status: "approved",
        approved_at: now,
      };
    });
    const { error } = await supabase
    .from("kpi_entries") // LUÔN LƯU VÀO kpi_entries CHO LEANLINE
    .upsert(payload, { onConflict: "worker_id,date,section" });
    setSaving(false);
    if (error) return alert("Lưu lỗi: "D + error.message);
    alert(`Đã lưu ${payload.length} dòng (approved).`);
  }


  // --- JSX Render ---
  return (
    <div className="space-y-4">
      
      {/* --- THAY ĐỔI 9: Cập nhật JSX cho Step 1 --- */}
      {step === 1 && (
        <>
          <div className="flex items-end gap-2">
            <div>
              <label>MSNV người duyệt</label>
              <input
                className="input"
                value={approverId}
                onChange={(e) => setApproverId(e.target.value)}
                placeholder="Ví dụ: 00001"
              />
            </div>
            <button className="btn" onClick={loadWorkers}>Tải danh sách NV</button>
            <button 
              className="btn btn-primary ml-auto" 
              onClick={proceedToTemplate} 
              disabled={!selectedWorkers.length || (section !== "LEANLINE_MOLDED" && prodRules.length === 0)}
            >
              Tiếp tục ({selectedWorkers.length}) ›
            </button>
          </div>

          {/* VÙNG CHIA ĐÔI MỚI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ minHeight: '400px' }}>
            
            {/* CỘT BÊN TRÁI: DANH SÁCH ĐÃ CHỌN */}
            <div className="border rounded p-3 bg-white space-y-2 flex flex-col">
              <h3 className="font-semibold text-lg">Đã chọn ({selectedWorkers.length})</h3>
              <div className="overflow-auto flex-1">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">MSNV</th>
                      <th className="p-2 text-left">Họ & tên</th>
                      <th className="p-2 text-center">Xoá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedWorkers.map((w) => (
                      <tr key={w.msnv} className="border-t">
                        <td className="p-2">{w.msnv}</td>
                        <td className="p-2">{w.full_name}</td>
                        <td className="p-2 text-center">
                          <button className="btn bg-red-100 text-red-700 hover:bg-red-200" style={{padding: '4px 8px'}} onClick={() => removeWorker(w.msnv)}>Xoá</button>
                        </td>
                      </tr>
                    ))}
                    {!selectedWorkers.length && (
                      <tr><td colSpan={3} className="p-4 text-center text-gray-500">Chưa chọn nhân viên nào.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CỘT BÊN PHẢI: TÌM KIẾM & KẾT QUẢ */}
            <div className="border rounded p-3 bg-white space-y-2 flex flex-col">
              <h3 className="font-semibold text-lg">Tìm kiếm & Thêm</h3>
              <input 
                className="input" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Gõ MSNV hoặc Tên để tìm..."
                disabled={!workers.length} 
              />
              <div className="overflow-auto flex-1">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">MSNV</th>
                      <th className="p-2 text-left">Họ & tên</th>
                      <th className="p-2 text-center">Thêm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkers.map((w) => (
                      <tr key={w.msnv} className="border-t hover:bg-gray-50">
                        <td className="p-2">{w.msnv}</td>
                        <td className="p-2">{w.full_name}</td>
                        <td className="p-2 text-center">
                          <button className="btn" style={{padding: '4px 8px'}} onClick={() => addWorker(w)}>+</button>
                        </td>
                      </tr>
                    ))}
                    {search && !filteredWorkers.length && (
                      <tr><td colSpan={3} className="p-4 text-center text-gray-500">Không tìm thấy.</td></tr>
                    )}
                    {!search && workers.length > 0 && (
                      <tr><td colSpan={3} className="p-4 text-center text-gray-500">Gõ vào ô tìm kiếm để lọc nhân viên.</td></tr>
                    )}
                    {!workers.length && (
                       <tr><td colSpan={3} className="p-4 text-center text-gray-500">Vui lòng "Tải danh sách NV" trước.</td></tr>
                    )}
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
            <div>
              <label>Ngày</label>
              <input type="date" className="input" value={tplDate} onChange={(e) => setTplDate(e.target.value)} />
            </div>
            <div>
              <label>Ca</label>
              <select className="input" value={tplShift} onChange={(e) => setTplShift(e.target.value)}>
                <option value="Ca 1">Ca 1</option>
                <option value="Ca 2">Ca 2</option>
                <option value="Ca 3">Ca 3</option>
                <option value="Ca HC">Ca HC</option>
              </select>
            </div>
            <div>
              <label>Máy làm việc</label>
              <select className="input" value={tplLine} onChange={(e) => setTplLine(e.target.value)}>
                {currentMachines.map(m => ( 
                    <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Tuân thủ</label>
              <select className="input text-center" value={tplCompliance} onChange={(e) => setTplCompliance(e.target.value)}>
                {COMPLIANCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Giờ làm việc</label>
              <input type="number" className="input" value={tplWorkHours} onChange={(e) => setTplWorkHours(e.target.value)} />
            </div>
            <div>
              <label>Giờ dừng máy</label>
              <input type="number" className="input" value={tplStopHours} onChange={(e) => setTplStopHours(e.target.value)} />
            </div>
            <div>
              <label>%OE</label>
              <input type="number" className="input" value={tplOE} onChange={(e) => setTplOE(e.target.value)} step="0.01" />
            </div>
            <div>
              <label>Phế</label>
              <input type="number" className="input" value={tplDefects} onChange={(e) => setTplDefects(e.target.value)} />
            </div>
          </div>

          <div className="rounded border p-3 bg-gray-50">
            <div className="flex gap-6 text-sm">
              <div>Q: <b>{tplQ}</b></div>
              <div>P: <b>{tplP}</b></div>
              <div>KPI (Max 15): <b>{tplKPI}</b></div>
              <div className="text-gray-500 ml-auto">Các giá trị này sẽ áp cho tất cả NV ở bước Review.</div>
            </div>
          </div>

          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-center">
                <tr>
                  <th>MSNV</th>
                  <th>Họ tên</th>
                  <th>Máy làm việc</th>
                  <th>Giờ làm</th>
                  <th>Giờ dừng</th>
                  <th>%OE</th>
                  <th>Phế</th>
                  <th>Q</th>
                  <th>P</th>
                  <th>KPI</th>
                  <th>Tuân thủ</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {/* THAY ĐỔI: Lặp qua selectedWorkers thay vì checked */}
                {selectedWorkers.map((w) => (
                    <tr key={w.msnv} className="border-t hover:bg-gray-50">
                      <td>{w.msnv}</td>
                      <td>{w.full_name}</td>
                      <td>{tplLine}</td>
                      <td>{tplWorkHours}</td>
                      <td>{tplStopHours}</td>
                      <td>{tplOE}</td>
                      <td>{tplDefects}</td>
                      <td>{tplQ}</td>
                      <td>{tplP}</td>
                      <td className="font-semibold">{tplKPI}</td>
                      <td>{COMPLIANCE_OPTIONS.find(o => o.value === tplCompliance)?.label || tplCompliance}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between">
            <button className="btn" onClick={() => setStep(1)}>‹ Quay lại</button>
            <button className="btn btn-primary" onClick={buildReviewRows}>
              Tạo danh sách Review ›
            </button>
          </div>
        </div>
      )}

      {/* ==== STEP 3: Bảng Review có thể CHỈNH SỬA từng người (Giữ nguyên) ==== */}
      {step === 3 && (
        <EditReviewLeanline
          pageSize={pageSize}
          page={page}
          setPage={setPage}
          totalPages={totalPages}
          pageRows={pageRows}
          reviewRows={reviewRows}
          setReviewRows={setReviewRows}
          selReview={selReview}
          setSelReview={setSelReview}
          toggleAllReviewOnPage={toggleAllReviewOnPage}
          updateRow={updateRow}
          saveBatch={saveBatch}
          saving={saving}
        />
      )}
    </div>
  );
}


/* ==== Bảng Review (LEANLINE) — CHO PHÉP CHỈNH (Đã cập nhật Line) ==== */
function EditReviewLeanline({
  pageSize,
  page,
  setPage,
  totalPages,
  pageRows,
  reviewRows,
  setReviewRows,
  selReview,
  setSelReview,
  toggleAllReviewOnPage,
  toggleOneReview,
  updateRow,
  saveBatch,
  saving,
}) {
  const { section } = useKpiSection();
  const currentMachines = useMemo(() => getLeanlineMachines(section), [section]);
  const globalIndex = (idx) => (page - 1) * pageSize + idx;
  
  // (Nội dung hàm này giữ nguyên)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="btn btn-primary" onClick={saveBatch} disabled={saving || !selReview.size}>
          {saving ? "Đang lưu..." : `Lưu đã chọn (${selReview.size})`}
        </button>
        <div className="ml-auto flex items-center gap-3">
          <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            ‹ Trước
          </button>
          <span>
            Trang {page}/{totalPages}
          </span>
          <button className="btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Sau ›
          </button>
        </div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-[1100px] text-sm">
          <thead className="bg-gray-50 text-center">
            <tr>
              <th className="p-2">
                <input
                  type="checkbox"
                  onChange={toggleAllReviewOnPage}
                  checked={pageRows.length > 0 && pageRows.every((_, idx) => selReview.has(globalIndex(idx)))}
                />
              </th>
              <th className="p-2">MSNV</th>
              <th className="p-2">Họ tên</th>
              <th className="p-2">Ngày</th>
              <th className="p-2">Ca</th>
              <th className="p-2">Máy làm việc</th>
              <th className="p-2">Giờ làm</th>
              <th className="p-2">Giờ dừng</th>
              <th className="p-2">%OE</th>
              <th className="p-2">Phế</th>
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
                  <td className="p-2">
                    <input type="checkbox" checked={selReview.has(gi)} onChange={() => toggleOneReview(gi)} />
                  </td>
                  <td className="p-2">{r.msnv}</td>
                  <td className="p-2">{r.hoten}</td>
                  <td className="p-2">
                    <input
                      type="date"
                      className="input text-center"
                      value={r.work_date}
                      onChange={(e) => updateRow(gi, "work_date", e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <select
                      className="input text-center"
                      value={r.shift}
                      onChange={(e) => updateRow(gi, "shift", e.target.value)}
                    >
                      <option value="Ca 1">Ca 1</option>
                      <option value="Ca 2">Ca 2</option>
                      <option value="Ca 3">Ca 3</option>
                      <option value="Ca HC">Ca HC</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <select // DYNAMIC DROPDOWN
                      className="input text-center"
                      value={r.line || ""}
                      onChange={(e) => updateRow(gi, "line", e.target.value)}
                    >
                      {currentMachines.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      className="input text-center"
                      value={r.work_hours}
                      onChange={(e) => updateRow(gi, "work_hours", e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      className="input text-center"
                      value={r.downtime}
                      onChange={(e) => updateRow(gi, "downtime", e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      className="input text-center"
                      value={r.oe}
                      onChange={(e) => updateRow(gi, "oe", e.target.value)}
                      step="0.01"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      className="input text-center"
                      value={r.defects}
                      onChange={(e) => updateRow(gi, "defects", e.target.value)}
                    />
                  </td>
                  <td className="p-2">{r.q_score}</td>
                  <td className="p-2">{r.p_score}</td>
                  <td className="p-2 font-semibold">{r.total_score}</td>
                  <td className="p-2">
                    <select
                      className="input text-center"
                      value={r.compliance}
                      onChange={(e) => updateRow(gi, "compliance", e.target.value)}
                    >
                      {COMPLIANCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
            {!pageRows.length && (
              <tr>
                <td colSpan={14} className="p-4 text-center text-gray-500">
                  Không có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ======================================================================
   APPROVER MODE — MOLDING (CẬP NHẬT GIAO DIỆN CHỌN NV)
   ====================================================================== */
function ApproverModeMolding({ section }) {
  const [step, setStep] = useState(1);
  const [approverId, setApproverId] = useState("");
  const [workers, setWorkers] = useState([]); // Danh sách NV gốc
  
  // --- THAY ĐỔI 1: Dùng mảng [Object] cho NV đã chọn ---
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [search, setSearch] = useState("");
  
  const [rows, setRows] = useState([]); // (Giữ nguyên, dùng cho Step 2)

  // --- THAY ĐỔI 2: Lấy ID của NV đã chọn để lọc ---
  const selectedIds = useMemo(() => new Set(selectedWorkers.map(w => w.msnv)), [selectedWorkers]);

  // --- THAY ĐỔI 3: filteredWorkers là danh sách TÌM KIẾM (chưa được chọn) ---
  const filteredWorkers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return []; // Chỉ hiển thị khi người dùng gõ tìm kiếm
    return workers.filter(
      (w) =>
        !selectedIds.has(w.msnv) && // Ẩn nếu đã có trong danh sách "Đã chọn"
        (String(w.msnv).toLowerCase().includes(q) ||
         String(w.full_name || "").toLowerCase().includes(q))
    );
  }, [workers, search, selectedIds]);

  // --- Tải danh sách nhân viên theo người duyệt ---
  async function loadWorkers() {
    const id = approverId.trim();
    if (!id) return alert("Nhập MSNV người duyệt trước.");
    const { data, error } = await supabase
      .from("users")
      .select("msnv, full_name, approver_msnv, approver_name")
      .eq("approver_msnv", id);
    if (error) return alert("Lỗi tải nhân viên: " + error.message);
    setWorkers(data || []);
    // --- THAY ĐỔI 4: Reset mảng NV đã chọn ---
    setSelectedWorkers([]);
    setSearch("");
  }

  // --- THAY ĐỔI 5: Hàm Thêm/Xoá NV khỏi danh sách "Đã chọn" ---
  function addWorker(worker) {
    setSelectedWorkers(prev => {
      if (prev.find(w => w.msnv === worker.msnv)) return prev; // Đã có
      return [worker, ...prev]; // Thêm vào đầu danh sách
    });
  }
  function removeWorker(msnv) {
    setSelectedWorkers(prev => prev.filter(w => w.msnv !== msnv));
  }
  // (Xoá hàm toggleWorker và toggleAllWorkers)
  
  // --- Sang bước nhập KPI ---
  function proceedToTemplate() {
    // --- THAY ĐỔI 6: Kiểm tra mảng selectedWorkers ---
    if (!selectedWorkers.length) return alert("Chưa chọn nhân viên nào.");
    
    // (Logic cũ giữ nguyên, nhưng dùng selectedWorkers)
    const selected = selectedWorkers; // Dùng mảng mới
    const initRows = selected.map(w => ({
      msnv: w.msnv,
      hoten: w.full_name,
      line: "",
      work_hours: 8,
      downtime: 0,
      oe: 100,
      defects: 0,
      q_score: 10,
      p_score: 7,
      kpi_score: 8.5,
      compliance: "NONE",
    }));
    setRows(initRows); // (rows này vẫn dùng cho Step 2 của Molding)
    setStep(2);
  }

  /* Template inputs (Giữ nguyên) */
  const [date, setDate] = useState("");
  const [shift, setShift] = useState("");
  const [oe, setOe] = useState(100);
  const [defects, setDefects] = useState(0);
  const [compliance, setCompliance] = useState("NONE");

  // Molding template (Giữ nguyên)
  const [workingInput, setWorkingInput] = useState(8);
  const [moldHours, setMoldHours] = useState(0);
  const [output, setOutput] = useState(0);
  const [category, setCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState([]);
  useEffect(() => {
    supabase
      .from("kpi_rule_productivity")
      .select("category")
      .eq("section", "MOLDING")
      .eq("active", true)
      .then(({ data, error }) => {
        if (error) return console.error(error);
        const list = [...new Set((data || []).map((r) => r.category).filter(Boolean))];
        setCategoryOptions(list);
      });
  }, []);

  /* Review rows (Giữ nguyên) */
  const [reviewRows, setReviewRows] = useState([]);
  const [selReview, setSelReview] = useState(() => new Set());

  async function buildReviewRows() {
    if (!date || !shift) return alert("Nhập Ngày & Ca.");
    if (!category) return alert("Chọn Loại hàng.");

    // --- THAY ĐỔI 7: Dùng mảng selectedWorkers ---
    if (!selectedWorkers.length) return alert("Lỗi: Không tìm thấy nhân viên đã chọn.");
    
    const rows = [];

    let rulesByCat = {};
    const { data: ruleRows } = await supabase
      .from("kpi_rule_productivity")
      .select("category, threshold, score")
      .eq("section", "MOLDING")
      .eq("active", true)
      .order("category", { ascending: true })
      .order("threshold", { ascending: false });
    (ruleRows || []).forEach((r) => {
      if (!rulesByCat[r.category]) rulesByCat[r.category] = [];
      rulesByCat[r.category].push({
        threshold: Number(r.threshold),
        score: Number(r.score),
      });
    });

    // --- THAY ĐỔI 8: Dùng mảng selectedWorkers ---
    selectedWorkers.forEach((w) => {
      const working_real = calcWorkingReal(shift, workingInput);
      let downtime = (working_real * 24 - toNum(moldHours)) / 24;
      if (downtime > 1) downtime = 1;
      if (downtime < 0) downtime = 0;
      const working_exact = Number((working_real - downtime).toFixed(2));
      const prod = working_exact > 0 ? toNum(output) / working_exact : 0;

      const qScore = scoreByQuality(defects); 
      let pScore = 0;
      const catRules = rulesByCat[category] || [];
      for (const r of catRules) {
        if (prod >= r.threshold) {
          pScore = r.score;
          break;
        }
      }
      const dayScore = Math.min(15, pScore + qScore);

      rows.push({
        section,
        date,
        ca: shift,
        worker_id: w.msnv,
        worker_name: w.full_name,
        approver_msnv: approverId, // người duyệt đã chọn
        approver_name: w.approver_name,
        category,
        working_input: toNum(workingInput),
        working_real: Number(working_real.toFixed(2)),
        downtime: Number(downtime.toFixed(2)),
        working_exact,
        mold_hours: toNum(moldHours),
        output: toNum(output),
        defects: toNum(defects),
        q_score: qScore,
        p_score: pScore,
        day_score: dayScore,
        compliance_code: compliance,
        status: "approved", // ⬅ duyệt luôn
      });
    });

    setReviewRows(rows);
    setSelReview(new Set(rows.map((_, i) => i)));
    setStep(3);
  }

  /* paging review (Giữ nguyên) */
  const pageSize = 50;
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [reviewRows.length]);
  const totalPages = Math.max(1, Math.ceil(reviewRows.length / pageSize));
  const pageRows = useMemo(
    () => reviewRows.slice((page - 1) * pageSize, page * pageSize),
    [reviewRows, page]
  );

  function toggleAllReviewOnPage() {
    setSelReview((prev) => {
      const next = new Set(prev);
      const allOnPage = pageRows.every((_, idx) =>
        next.has((page - 1) * pageSize + idx)
      );
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

  /* Save batch (duyệt luôn) (Giữ nguyên) */
  const [saving, setSaving] = useState(false);
  async function saveBatch() {
    const idxs = Array.from(selReview).sort((a, b) => a - b);
    if (!idxs.length) return alert("Chưa chọn dòng để lưu.");

    setSaving(true);
    const list = idxs.map((i) => reviewRows[i]);
    const now = new Date().toISOString();
    const payload = list.map((r) => {
      const overflow = Math.max(0, (r.q_score + r.p_score) - 15);
      return {
        section: r.section,
        date: r.date,
        ca: r.ca,
        worker_id: r.worker_id,
        worker_name: r.worker_name,
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
        q_score: r.q_score,
        p_score: r.p_score,
        day_score: r.day_score,
        overflow,
        compliance_code: r.compliance_code,
        status: "approved",
        approved_at: now,
        // Cột violations sẽ được trigger tự động trong DB hoặc ở Pending
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
      
      {/* --- THAY ĐỔI 9: Cập nhật JSX cho Step 1 --- */}
      {step === 1 && (
        <>
          <div className="flex items-end gap-2">
            <div>
              <label>MSNV người duyệt</label>
              <input
                className="input"
                value={approverId}
                onChange={(e) => setApproverId(e.target.value)}
                placeholder="Ví dụ: 00001"
              />
            </div>
            <button className="btn" onClick={loadWorkers}>Tải danh sách NV</button>
            <button 
              className="btn btn-primary ml-auto" 
              onClick={proceedToTemplate} 
              disabled={!selectedWorkers.length}
            >
              Tiếp tục ({selectedWorkers.length}) ›
            </button>
          </div>

          {/* VÙNG CHIA ĐÔI MỚI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ minHeight: '400px' }}>
            
            {/* CỘT BÊN TRÁI: DANH SÁCH ĐÃ CHỌN */}
            <div className="border rounded p-3 bg-white space-y-2 flex flex-col">
              <h3 className="font-semibold text-lg">Đã chọn ({selectedWorkers.length})</h3>
              <div className="overflow-auto flex-1">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">MSNV</th>
                      <th className="p-2 text-left">Họ & tên</th>
                      <th className="p-2 text-center">Xoá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedWorkers.map((w) => (
                      <tr key={w.msnv} className="border-t">
                        <td className="p-2">{w.msnv}</td>
                        <td className="p-2">{w.full_name}</td>
                        <td className="p-2 text-center">
                          <button className="btn bg-red-100 text-red-700 hover:bg-red-200" style={{padding: '4px 8px'}} onClick={() => removeWorker(w.msnv)}>Xoá</button>
                        </td>
                      </tr>
                    ))}
                    {!selectedWorkers.length && (
                      <tr><td colSpan={3} className="p-4 text-center text-gray-500">Chưa chọn nhân viên nào.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CỘT BÊN PHẢI: TÌM KIẾM & KẾT QUẢ */}
            <div className="border rounded p-3 bg-white space-y-2 flex flex-col">
              <h3 className="font-semibold text-lg">Tìm kiếm & Thêm</h3>
              <input 
                className="input" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Gõ MSNV hoặc Tên để tìm..."
                disabled={!workers.length} 
              />
              <div className="overflow-auto flex-1">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">MSNV</th>
                      <th className="p-2 text-left">Họ & tên</th>
                      <th className="p-2 text-center">Thêm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkers.map((w) => (
                      <tr key={w.msnv} className="border-t hover:bg-gray-50">
                        <td className="p-2">{w.msnv}</td>
                        <td className="p-2">{w.full_name}</td>
                        <td className="p-2 text-center">
                          <button className="btn" style={{padding: '4px 8px'}} onClick={() => addWorker(w)}>+</button>
                        </td>
                      </tr>
                    ))}
                    {search && !filteredWorkers.length && (
                      <tr><td colSpan={3} className="p-4 text-center text-gray-500">Không tìm thấy.</td></tr>
                    )}
                    {!search && workers.length > 0 && (
                      <tr><td colSpan={3} className="p-4 text-center text-gray-500">Gõ vào ô tìm kiếm để lọc nhân viên.</td></tr>
                    )}
                    {!workers.length && (
                       <tr><td colSpan={3} className="p-4 text-center text-gray-500">Vui lòng "Tải danh sách NV" trước.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </>
      )}


      {/* (Step 2 và 3 của Molding giữ nguyên) */}
      {step === 2 && (
        <div className="space-y-4">
           <div className="flex justify-between">
            <button className="btn" onClick={() => setStep(1)}>‹ Quay lại</button>
            <button className="btn btn-primary" onClick={buildReviewRows}>
              Tạo danh sách Review ›
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label>Ngày</label>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label>Ca</label>
              <select className="input" value={shift} onChange={(e) => setShift(e.target.value)}>
                <option value="">-- Chọn ca --</option>
                <option value="Ca 1">Ca 1</option>
                <option value="Ca 2">Ca 2</option>
                <option value="Ca 3">Ca 3</option>
                <option value="Ca HC">Ca HC</option>
              </select>
            </div>
            <div>
              <label>Loại hàng</label>
              <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">-- Chọn loại hàng --</option>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label>Tuân thủ</label>
              <select className="input text-center" value={compliance} onChange={(e) => setCompliance(e.target.value)}>
                {COMPLIANCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Thêm các input cho Molding */}
            <div>
              <label>Giờ làm việc (nhập)</label>
              <input type="number" className="input" value={workingInput} onChange={e => setWorkingInput(e.target.value)} />
            </div>
            <div>
              <label>Số giờ khuôn chạy</label>
              <input type="number" className="input" value={moldHours} onChange={e => setMoldHours(e.target.value)} />
            </div>
            <div>
              <label>Sản lượng / ca</label>
              <input type="number" className="input" value={output} onChange={e => setOutput(e.target.value)} />
            </div>
             <div>
              <label>Số đôi phế</label>
              <input type="number" className="input" value={defects} onChange={e => setDefects(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <ReviewTableMolding
          pageSize={pageSize}
          pageRows={pageRows}
          totalPages={totalPages}
          page={page}
          setPage={setPage}
          selReview={selReview}
          toggleAllReviewOnPage={toggleAllReviewOnPage}
          toggleOneReview={toggleOneReview}
          saveBatch={saveBatch}
          saving={saving}
        />
      )}
    </div>
  );
}

/* ===== Bảng review (MOLDING) giữ nguyên dùng chung trước đây ===== */
function ReviewTableMolding({
  pageRows,
  totalPages,
  page,
  setPage,
  selReview,
  toggleAllReviewOnPage,
  toggleOneReview,
  saveBatch,
  saving,
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="btn btn-primary" onClick={saveBatch} disabled={saving || !selReview.size}>
          {saving ? "Đang lưu..." : `Lưu đã chọn (${selReview.size})`}
        </button>
        <div className="ml-auto flex items-center gap-3">
          <span>Tổng: {pageRows.length} / trang</span>
          <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            ‹ Trước
          </button>
          <span>
            Trang {page}/{totalPages}
          </span>
          <button className="btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Sau ›
          </button>
        </div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-center">
            <tr>
              <th className="p-2">
                <input type="checkbox" onChange={toggleAllReviewOnPage} />
              </th>
              <th className="p-2">MSNV</th>
              <th className="p-2">Họ tên</th>
              <th className="p-2">Ngày</th>
              <th className="p-2">Ca</th>
              <th className="p-2">Loại hàng</th>
              <th className="p-2">Giờ nhập</th>
              <th className="p-2">Giờ thực tế</th>
              <th className="p-2">Downtime</th>
              <th className="p-2">Giờ chính xác</th>
              <th className="p-2">Khuôn chạy</th>
              <th className="p-2">SL/ca</th>
              <th className="p-2">Phế</th>
              <th className="p-2">Q</th>
              <th className="p-2">P</th>
              <th className="p-2">KPI</th>
              <th className="p-2">Tuân thủ</th>
            </tr>
          </thead>
          <tbody className="text-center">
            {pageRows.map((r, idx) => (
              <tr key={idx} className="border-t hover:bg-gray-50">
                <td className="p-2">
                  <input type="checkbox" checked={selReview.has(idx)} onChange={() => toggleOneReview(idx)} />
                </td>
                <td className="p-2">{r.worker_id}</td>
                <td className="p-2">{r.worker_name}</td>
                <td className="p-2">{r.date}</td>
                <td className="p-2">{r.ca}</td>
                <td className="p-2">{r.category}</td>
                <td className="p-2">{r.working_input}</td>
                <td className="p-2">{r.working_real}</td>
                <td className="p-2">{r.downtime}</td>
                <td className="p-2">{r.working_exact}</td>
                <td className="p-2">{r.mold_hours}</td>
                <td className="p-2">{r.output}</td>
                <td className="p-2">{r.defects}</td>
                <td className="p-2">{r.q_score}</td>
                <td className="p-2">{r.p_score}</td>
                <td className="p-2 font-semibold">{r.day_score}</td>
                <td className="p-2">{r.compliance_code}</td>
              </tr>
            ))}
            {!pageRows.length && (
              <tr>
                <td colSpan={17} className="p-4 text-center text-gray-500">
                  Không có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ======================================================================
   MODE 2: Tự nhập (MSNV người nhập) – MOLDING ONLY (giữ nguyên tinh gọn)
   ====================================================================== */
function SelfModeMolding({ section }) {
  const [entrantId, setEntrantId] = useState("");
  const [entrantName, setEntrantName] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [workerName, setWorkerName] = useState("");

  // lấy họ tên từ bảng users theo MSNV người nhập
  useEffect(() => {
    const id = entrantId.trim();
    if (!id) {
      setEntrantName("");
      setWorkerId("");
      setWorkerName("");
      return;
    }
    supabase
      .from("users")
      .select("msnv, full_name")
      .eq("msnv", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return console.error(error);
        if (data) {
          setEntrantName(data.full_name || "");
          setWorkerId(data.msnv);
          setWorkerName(data.full_name || "");
        } else {
          setEntrantName("");
          setWorkerId("");
          setWorkerName("");
        }
      });
  }, [entrantId]);

  // khoảng ngày
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // options & rules
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [rulesByCat, setRulesByCat] = useState({});
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
        const cats = new Set();
        const map = {};
        (data || []).forEach((r) => {
          cats.add(r.category);
          if (!map[r.category]) map[r.category] = [];
          map[r.category].push({ threshold: Number(r.threshold), score: Number(r.score) });
        });
        setCategoryOptions([...cats]);
        setRulesByCat(map);
      });
  }, []);

  // danh sách ngày → review rows
  const [rows, setRows] = useState([]);
  function listDates(from, to) {
    const res = [];
    const start = new Date(from);
    const end = new Date(to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      res.push(d.toISOString().slice(0, 10));
    }
    return res;
  }

  function buildRowsByDates() {
    if (!entrantId.trim()) return alert("Nhập MSNV người nhập trước.");
    if (!dateFrom || !dateTo) return alert("Chọn khoảng ngày.");
    if (new Date(dateFrom) > new Date(dateTo)) return alert("Khoảng ngày không hợp lệ.");

    const days = listDates(dateFrom, dateTo);
    const base = days.map((d) => ({
      section,
      date: d,
      ca: "",
      worker_id: workerId,
      worker_name: workerName,
      entrant_msnv: entrantId,
      entrant_name: entrantName,

      category: "",
      working_input: 8,
      working_real: 0,
      downtime: 0,
      working_exact: 0,
      mold_hours: 0,
      output: 0,
      defects: 0,
      q_score: 0,
      p_score: 0,
      day_score: 0,
      compliance_code: "NONE",
      status: "approved",
    }));
    setRows(base);
  }

  function recompute(row) {
    const working_real = calcWorkingReal(row.ca, row.working_input);
    let downtime = (working_real * 24 - toNum(row.mold_hours)) / 24;
    if (downtime > 1) downtime = 1;
    if (downtime < 0) downtime = 0;
    const working_exact = Number((working_real - downtime).toFixed(2));
    const prod = working_exact > 0 ? toNum(row.output) / working_exact : 0;

    const q = scoreByQuality(row.defects); 
    let p = 0;
    const rules = rulesByCat[row.category] || [];
    for (const r of rules) {
      if (prod >= r.threshold) {
        p = r.score;
        break;
      }
    }
    const day = Math.min(15, p + q);

    return {
      ...row,
      working_real: Number(working_real.toFixed(2)),
      downtime: Number(downtime.toFixed(2)),
      working_exact,
      q_score: q,
      p_score: p,
      day_score: day,
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
    // Tùy DB của bạn, ở SelfMode này bạn có thể chuyển sang bảng molding nếu muốn.
    const now = new Date().toISOString();
    const payload = rows.map((r) => {
      const overflow = Math.max(0, (r.q_score + r.p_score) - 15);
      return {
        section: r.section,
        date: r.date,
        ca: r.ca,
        worker_id: r.worker_id,
        worker_name: r.worker_name,
        approver_msnv: r.entrant_msnv,
        approver_name: r.entrant_name,
        category: r.category,
        working_input: r.working_input,
        working_real: r.working_real,
        working_exact: r.working_exact,
        downtime: r.downtime,
        mold_hours: r.mold_hours,
        output: r.output,
        defects: Number(r.defects || 0),
        q_score: r.q_score,
        p_score: r.p_score,
        day_score: r.day_score,
        overflow,
        compliance_code: r.compliance_code,
        status: "approved",
        approved_at: now,
      };
    });

    setSaving(true);
    const { error } = await supabase
      .from("kpi_entries_molding")
      .upsert(payload, { onConflict: "worker_id,date,section" });
    setSaving(false);

    if (error) return alert("Lưu lỗi: " + error.message);
    alert(`Đã lưu ${payload.length} dòng.`);
  }

  return (
    <div className="space-y-4">
      <div className="rounded border p-3 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <label>MSNV người nhập
            <input className="input" value={entrantId} onChange={(e) => setEntrantId(e.target.value)} />
          </label>
          <label>Họ tên người nhập
            <input className="input" value={entrantName} readOnly />
          </label>
          <label>MSNV/Họ tên (áp dụng = người nhập)
            <input className="input" value={`${workerId} / ${workerName}`} readOnly />
          </label>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <label>Từ ngày
            <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>Đến ngày
            <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <div className="flex items-end">
            <button className="btn" onClick={buildRowsByDates}>Tạo danh sách ngày</button>
          </div>
        </div>
      </div>

      {!!rows.length && (
        <>
          <div className="overflow-auto border rounded">
            <table className="min-w-[1100px] text-sm">
              <thead className="bg-gray-50 text-center">
                <tr>
                  <th>Ngày</th>
                  <th>Ca</th>
                  <th>Loại hàng</th>
                  <th>Giờ nhập</th>
                  <th>Giờ thực tế</th>
                  <th>Downtime</th>
                  <th>Giờ chính xác</th>
                  <th>Khuôn chạy</th>
                  <th>SL/ca</th>
                  <th>Phế</th>
                  <th>Q</th>
                  <th>P</th>
                  <th>KPI</th>
                  <th>Tuân thủ</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {rows.map((r, i) => (
                  <tr key={r.date} className="border-t hover:bg-gray-50">
                    <td>{r.date}</td>
                    <td>
                      <select className="input text-center" value={r.ca} onChange={(e) => update(i, "ca", e.target.value)}>
                        <option value="">--Ca--</option>
                        <option value="Ca 1">Ca 1</option>
                        <option value="Ca 2">Ca 2</option>
                        <option value="Ca 3">Ca 3</option>
                        <option value="Ca HC">Ca HC</option>
                      </select>
                    </td>
                    <td>
                      <select className="input text-center" value={r.category} onChange={(e) => update(i, "category", e.target.value)}>
                        <option value="">--Loại--</option>
                        {categoryOptions.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input type="number" className="input text-center" value={r.working_input} onChange={(e) => update(i, "working_input", e.target.value)} />
                    </td>
                    <td>{r.working_real}</td>
                    <td>{r.downtime}</td>
                    <td>{r.working_exact}</td>
                    <td>
                      <input type="number" className="input text-center" value={r.mold_hours} onChange={(e) => update(i, "mold_hours", e.target.value)} />
                    </td>
                    <td>
                      <input type="number" className="input text-center" value={r.output} onChange={(e) => update(i, "output", e.target.value)} />
                    </td>
                    <td>
                      <input type="number" className="input text-center" value={r.defects} onChange={(e) => update(i, "defects", e.target.value)} />
                    </td>
                    <td>{r.q_score}</td>
                    <td>{r.p_score}</td>
                    <td className="font-semibold">{r.day_score}</td>
                    <td>
                      <select className="input text-center" value={r.compliance_code} onChange={(e) => update(i, "compliance_code", e.target.value)}>
                        {COMPLIANCE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu tất cả"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}