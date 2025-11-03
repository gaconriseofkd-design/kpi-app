// src/pages/QuickEntryLPS.jsx

import React, { useEffect, useMemo, useState } from "react"; 
import { supabase } from "../lib/supabaseClient";

/* ================= Scoring & Helpers ================= */

// Machine Map (Giữ nguyên)
const MACHINE_MAP = {
    "LAMINATION": ["Máy dán 1", "Máy dán 2", "Máy dán 3", "Máy dán 4", "Máy dán 5", "Máy dán 6", "Máy dán 7"],
    "PREFITTING": ["Máy cắt 1", "Máy cắt 2", "Máy cắt 3", "Máy cắt 4", "Máy cắt 5", "Máy cắt 6"],
    "BÀO": ["Máy bào 1", "Máy bào 2", "Máy bào 3", "Máy bào 4"],
    "TÁCH": ["Máy tách 1", "Máy tách 2", "Máy tách 3", "Máy tách 4"],
};

// THÊM HÀM QUY ĐỔI GIỜ THỰC TẾ (calcWorkingReal)
function calcWorkingReal(shift, inputHours) {
  const h = Number(inputHours || 0);
  if (h < 8) return h;

  const BASE_BY_SHIFT = {
    "Ca 1": 7.17,
    "Ca 2": 7.17,
    "Ca 3": 6.92,
    "Ca HC": 6.67,
  };
  const base = BASE_BY_SHIFT[shift] ?? 7.17;

  if (h < 9) return base;

  const extra = h - 8;
  const adj = extra >= 2 ? extra - 0.5 : extra; 
  return base + adj;
}

// SỬA LỖI: Chuyển tên bảng thành chữ thường (kpi_lps_entries)
const getTableName = (sectionKey) => "kpi_lps_entries";

function scoreByQuality(defects) {
  const d = Number(defects || 0);
  if (d === 0) return 10;
  if (d <= 2) return 8;
  if (d <= 4) return 6;
  if (d <= 6) return 4;
  return 0;
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

function deriveDayScoresHybrid({ section, defects, category, output, workHours, stopHours, shift }, prodRules) {
  const q = scoreByQuality(defects);

  const workingReal = calcWorkingReal(shift, workHours);
  const exactHours = Math.max(0, workingReal - Number(stopHours || 0));
  
  // Tỷ lệ NS (Prod Rate) = Output / Giờ Chính xác
  const prodRate = exactHours > 0 ? Number(output || 0) / exactHours : 0;
  
  const p = scoreByProductivityHybrid(prodRate, category, prodRules);
  const total = p + q;

  return {
    p_score: p,
    q_score: q,
    day_score: Math.min(15, total),
    prodRate: prodRate,
    workingReal: workingReal,
    rawTotal: total, // Thêm tổng thô cho tính toán overflow
  };
}

const COMPLIANCE_OPTIONS = [
    { value: "NONE", label: "Không vi phạm" },
    { value: "LATE", label: "Ký mẫu đầu chuyền trước khi sử dụng" },
    { value: "PPE", label: "Quy định về kiểm tra điều kiện máy trước/trong khi sản xuất" },
    { value: "MAT", label: "Quy định về kiểm tra nguyên liệu trước/trong khi sản xuất" },
    { value: "SPEC", label: "Quy định về kiểm tra quy cách/tiêu chuẩn sản phẩm trước/trong khi sản xuất" },
    { value: "RULE", label: "Vi phạm nội quy bộ phận/công ty" },
];
const cx = (...a) => a.filter(Boolean).join(" ");
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};


/* ================= Approver Mode HYBRID ================= */

export default function ApproverModeHybrid({ section }) {
  // --- Khai báo States/Constants ở đầu hàm ---
  const [step, setStep] = useState(1);
  const [prodRules, setProdRules] = useState([]); 
  const [categoryOptions, setCategoryOptions] = useState([]);
  const tableName = getTableName(section);
  const [search, setSearch] = useState("");
  const [workers, setWorkers] = useState([]); // Danh sách NV gốc
  
  // --- THAY ĐỔI 1: Dùng mảng [Object] cho NV đã chọn ---
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  
  const [approverId, setApproverId] = useState("");
  const [reviewRows, setReviewRows] = useState([]);
  const [selReview, setSelReview] = useState(() => new Set());

  // Biến Template (Khai báo sớm nhất)
  const [tplDate, setTplDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tplShift, setTplShift] = useState("Ca 1");
  const [tplWorkHours, setTplWorkHours] = useState(8);
  const [tplStopHours, setTplStopHours] = useState(0);
  const [tplOutput, setTplOutput] = useState(100); 
  const [tplDefects, setTplDefects] = useState(0);
  const [tplCompliance, setTplCompliance] = useState("NONE");
  
  const [saving, setSaving] = useState(false);
  const pageSize = 50;
  const [page, setPage] = useState(1);
  
  // Lấy danh sách máy cho section hiện tại
  const currentMachines = useMemo(() => {
    return MACHINE_MAP[section] || [];
  }, [section]);
  const [tplLine, setTplLine] = useState(currentMachines[0] || ""); 
  
  // FIX: Logic tự động chọn Category
  const defaultCategory = section === 'LAMINATION' ? 'Lượt dán/giờ' : '';
  const [tplCategory, setTplCategory] = useState(defaultCategory); // SỬ DỤNG DEFAULT CATEGORY

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

  const scores = useMemo(
    () => deriveDayScoresHybrid({ 
        section, 
        defects: tplDefects, 
        category: tplCategory, 
        output: tplOutput, 
        workHours: tplWorkHours, 
        stopHours: tplStopHours,
        shift: tplShift 
    }, prodRules),
    [section, tplDefects, tplCategory, tplOutput, tplWorkHours, tplStopHours, tplShift, prodRules]
  );
  
  const tplKPI = scores.day_score;
  const tplProdRate = scores.prodRate;
  const tplQ = scores.q_score;
  const tplP = scores.p_score;
  const tplExactHours = Math.max(0, scores.workingReal - toNum(tplStopHours));

  const totalPages = Math.max(1, Math.ceil(reviewRows.length / pageSize));

  const pageRows = useMemo(
    () => reviewRows.slice((page - 1) * pageSize, page * pageSize),
    [reviewRows, page]
  );

  // --- Effects ---
  // Rerender category khi đổi section (chỉ cho Prefitting, Bào, Tách)
  useEffect(() => {
    if (section === 'LAMINATION') {
        setTplCategory('Lượt dán/giờ');
    } else {
        setTplCategory('');
    }
  }, [section]);

  useEffect(() => {
    let cancelled = false;
    const dbSection = section.toUpperCase(); // CHUẨN HÓA SANG IN HOA
    
    (async () => {
      const { data, error } = await supabase
        .from("kpi_rule_productivity")
        .select("*")
        .eq("active", true)
        .eq("section", dbSection) 
        .order("threshold", { ascending: false });
      if (!cancelled) {
        if (error) console.error("Load rules error:", error);
        setProdRules(data || []);
        
        const opts = [...new Set((data || []).map(r => r.category).filter(Boolean))].sort();
        setCategoryOptions(opts);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section]);
  
  // ---- B1: Chọn nhân viên theo Người duyệt ----
  
  async function loadWorkers() {
    const id = approverId.trim();
    if (!id) return alert("Nhập MSNV người duyệt trước.");
    // FIX: Luôn dùng approver_msnv cho bảng users
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
  // (Xoá hàm toggleWorker)

  // ---- B2: Template KPI CHUNG ----
  
  function proceedToTemplate() {
    if (!prodRules.length) return alert("Không thể tải Rule tính điểm sản lượng. Vui lòng thử lại.");
    // --- THAY ĐỔI 6: Kiểm tra mảng selectedWorkers ---
    if (!selectedWorkers.length) return alert("Chưa chọn nhân viên nào.");
    setStep(2);
  }

  // ---- B3: Build Review Rows từ Template + cho phép CHỈNH ----
  
  function buildReviewRows() {
    if (!tplDate || !tplShift) return alert("Nhập Ngày & Ca.");
    if (!tplCategory) return alert("Vui lòng chọn Loại năng suất.");
    // --- THAY ĐỔI 7: Kiểm tra mảng selectedWorkers ---
    if (!selectedWorkers.length) return alert("Chưa chọn nhân viên.");

    // --- THAY ĐỔI 8: Dùng thẳng mảng selectedWorkers ---
    const rows = selectedWorkers.map((w) => {
      const s = deriveDayScoresHybrid({ 
          section, 
          defects: tplDefects, 
          category: tplCategory, 
          output: tplOutput, 
          workHours: tplWorkHours, 
          stopHours: tplStopHours,
          shift: tplShift 
      }, prodRules);

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
        stop_hours: toNum(tplStopHours),
        output: toNum(tplOutput),
        category: tplCategory,
        defects: toNum(tplDefects),
        q_score: s.q_score,
        p_score: s.p_score,
        total_score: s.day_score,
        compliance: tplCompliance,
        working_real: s.workingReal, 
        status: "approved",
      };
    });

    setReviewRows(rows);
    setSelReview(new Set(rows.map((_, i) => i)));
    setStep(3);
  }

  // (Các hàm updateRow, Paging, toggleAllReviewOnPage, toggleOneReview, saveBatch giữ nguyên)
  // ... (Không lặp lại các hàm này vì chúng không đổi)
  function updateRow(i, key, val) {
    setReviewRows((old) => {
      const arr = old.slice();
      const r0 = arr[i] || {};
      const r =
        ["compliance", "category", "line", "shift", "work_date"].includes(key)
          ? { ...r0, [key]: val }
          : { ...r0, [key]: toNum(val, 0) };

      const s = deriveDayScoresHybrid({
          section, 
          defects: r.defects, 
          category: r.category, 
          output: r.output, 
          workHours: r.work_hours, 
          stopHours: r.stop_hours,
          shift: r.shift
      }, prodRules);

      arr[i] = { 
          ...r, 
          q_score: s.q_score, 
          p_score: s.p_score, 
          total_score: s.day_score,
          working_real: s.workingReal, 
      };
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
      const overflow = Math.max(0, (r.q_score + r.p_score) - 15);
      return {
        date: r.work_date,
        ca: r.shift,
        worker_id: r.msnv,
        worker_name: r.hoten,
        approver_id: r.approver_id,
        approver_name: r.approver_name,
        line: r.line,
        work_hours: r.work_hours,
        stop_hours: r.stop_hours,
        output: r.output,
        category: r.category,
        defects: r.defects,
        p_score: r.p_score,
        q_score: r.q_score,
        day_score: r.total_score,
        overflow,
        compliance_code: r.compliance,
        section: r.section,
        working_real: r.working_real,
        violations: r.compliance === "NONE" ? 0 : 1, // FIX: Thêm violations
        status: "approved",
        approved_at: now,
      };
    });

    const { error } = await supabase
    .from(tableName)
    .upsert(payload, { onConflict: "worker_id,date,section" });


    setSaving(false);
    if (error) return alert("Lưu lỗi: " + error.message);
    alert(`Đã lưu ${payload.length} dòng (approved) vào bảng ${tableName}.`);
  }


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
              disabled={!selectedWorkers.length || prodRules.length === 0}
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
                {COMPLIANCE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
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
              <label>Sản lượng/ca (Lượt dán Output)</label>
              <input type="number" className="input" value={tplOutput} onChange={(e) => setTplOutput(e.target.value)} />
            </div>
            <div>
              <label>Loại năng suất (Category)</label>
              <select className="input" value={tplCategory} onChange={e => setTplCategory(e.target.value)} disabled={section === 'LAMINATION'}> {/* DISABLE NẾU LAMINATION */}
                <option value="">-- Chọn loại --</option>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label>Phế</label>
              <input type="number" className="input" value={tplDefects} onChange={(e) => setTplDefects(e.target.value)} />
            </div>
          </div>

          <div className="rounded border p-3 bg-gray-50">
            <div className="flex gap-6 text-sm">
              <div>Giờ thực tế (QĐ): <b>{scores.workingReal.toFixed(2)}</b></div>
              <div>Giờ chính xác: <b>{tplExactHours.toFixed(2)}</b></div>
              <div>Tỷ lệ NS: <b>{tplProdRate.toFixed(2)}</b></div>
              <div>Q: <b>{tplQ}</b></div>
              <div>P: <b>{tplP}</b></div>
              <div>KPI (Max 15): <b>{tplKPI}</b></div>
            </div>
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
        <EditReviewHybrid
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
          categoryOptions={categoryOptions}
        />
      )}
    </div>
  );
}

/* ==== Bảng Review (HYBRID) — CHO PHÉP CHỈNH ==== */
function EditReviewHybrid({
    pageSize, page, setPage, totalPages, pageRows, selReview,
    toggleAllReviewOnPage, toggleOneReview, updateRow, saveBatch, saving, categoryOptions
  }) {
  const globalIndex = (idx) => (page - 1) * pageSize + idx;
  const allMachines = MACHINE_MAP.LAMINATION.concat(
    MACHINE_MAP.PREFITTING, 
    MACHINE_MAP.BÀO, 
    MACHINE_MAP.TÁCH
  ); 

  // (Nội dung hàm này giữ nguyên)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="btn btn-primary" onClick={saveBatch} disabled={saving || !selReview.size}>
          {saving ? "Đang lưu..." : `Lưu đã chọn (${selReview.size})`}
        </button>
        {/* Paging */}
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
              <th className="p-2">Giờ nhập</th>
              <th className="p-2">Giờ dừng</th>
              <th className="p-2">Giờ TT (QĐ)</th> 
              <th className="p-2">Giờ CX</th> 
              <th className="p-2">Máy làm việc</th>
              <th className="p-2">Loại NS</th>
              <th className="p-2">SL (Output)</th>
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
              const exactHours = Math.max(0, r.working_real - toNum(r.stop_hours));
              return (
                <tr key={gi} className="border-t hover:bg-gray-50">
                  <td className="p-2"><input type="checkbox" checked={selReview.has(gi)} onChange={() => toggleOneReview(gi)} /></td>
                  <td className="p-2">{r.msnv}</td>
                  <td className="p-2">{r.hoten}</td>
                  <td className="p-2"><input type="date" className="input text-center" value={r.work_date} onChange={(e) => updateRow(gi, "work_date", e.target.value)} /></td>
                  <td className="p-2">
                    <select className="input text-center" value={r.shift} onChange={(e) => updateRow(gi, "shift", e.target.value)}>
                        <option value="Ca 1">Ca 1</option> <option value="Ca 2">Ca 2</option> <option value="Ca 3">Ca 3</option> <option value="Ca HC">Ca HC</option>
                    </select>
                  </td>
                  <td className="p-2"><input type="number" className="input text-center" value={r.work_hours} onChange={(e) => updateRow(gi, "work_hours", e.target.value)} /></td>
                  <td className="p-2"><input type="number" className="input text-center" value={r.stop_hours} onChange={(e) => updateRow(gi, "stop_hours", e.target.value)} /></td>
                  <td className="p-2 font-medium">{r.working_real.toFixed(2)}</td> 
                  <td className="p-2">{exactHours.toFixed(2)}</td> 
                  <td className="p-2">
                    <select className="input text-center" value={r.line} onChange={(e) => updateRow(gi, "line", e.target.value)}>
                        {allMachines.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="p-2">
                    <select className="input text-center" value={r.category} onChange={(e) => updateRow(gi, "category", e.target.value)}>
                        <option value="">--Chọn--</option>
                        {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="p-2"><input type="number" className="input text-center" value={r.output} onChange={(e) => updateRow(gi, "output", e.target.value)} /></td>
                  <td className="p-2"><input type="number" className="input text-center" value={r.defects} onChange={(e) => updateRow(gi, "defects", e.target.value)} /></td>
                  <td className="p-2">{r.q_score}</td>
                  <td className="p-2">{r.p_score}</td>
                  <td className="p-2 font-semibold">{r.total_score}</td>
                  <td className="p-2">
                    <select className="input text-center" value={r.compliance} onChange={(e) => updateRow(gi, "compliance", e.target.value)}>
                      {COMPLIANCE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                  </td>
                </tr>
              );
            })}
            {!pageRows.length && (
              <tr><td colSpan={17} className="p-4 text-center text-gray-500">Không có dữ liệu</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}