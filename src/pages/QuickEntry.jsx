import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";

/** ===== Helpers chung ===== */
function classNames(...arr) { return arr.filter(Boolean).join(" "); }
function toNum(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }

/** ===== Leanline: tính P theo %OE (giữ nguyên logic cũ) ===== */
function calcPfromOE(oe) {
  const x = toNum(oe);
  if (x >= 112) return 10;
  if (x >= 108) return 9;
  if (x >= 104) return 8;
  if (x >= 100) return 7;
  if (x >= 98) return 6;
  if (x >= 96) return 4;
  if (x >= 94) return 2;
  return 0;
}

/** ===== Chất lượng chung ===== */
function calcQ(defects) {
  const d = toNum(defects);
  if (d === 0) return 10;
  if (d <= 2) return 8;
  if (d <= 4) return 6;
  if (d <= 6) return 4;
  return 0;
}

/** ===== Molding: quy đổi giờ thực tế từ Giờ nhập + Ca ===== */
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

/** ===== Review table cell editor (input) ===== */
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

/** ===== Main ===== */
export default function QuickEntry() {
  const { section } = useKpiSection();
  const isMolding = section === "MOLDING";

  /** ===== Step state ===== */
  const [step, setStep] = useState(1);

  /** ===== Step 1: chọn người duyệt và nhân viên ===== */
  const [approverId, setApproverId] = useState("");
  const [workers, setWorkers] = useState([]);
  const [checked, setChecked] = useState(() => new Set());
  const [search, setSearch] = useState("");

  const filteredWorkers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(w =>
      String(w.msnv).toLowerCase().includes(q) ||
      String(w.full_name || "").toLowerCase().includes(q)
    );
  }, [workers, search]);

  async function loadWorkers() {
    const a = approverId.trim();
    if (!a) return alert("Nhập MSNV người duyệt trước.");
    const { data, error } = await supabase
      .from("users")
      .select("msnv, full_name, approver_msnv, approver_name")
      .eq("approver_msnv", a)
      .order("msnv", { ascending: true });
    if (error) return alert("Lỗi tải nhân viên: " + error.message);
    setWorkers(data || []);
    setChecked(new Set());
  }

  function toggleAllWorkers() {
    setChecked(prev => {
      if (prev.size === filteredWorkers.length) return new Set();
      return new Set(filteredWorkers.map(w => w.msnv));
    });
  }
  function toggleWorker(msnv) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(msnv)) next.delete(msnv); else next.add(msnv);
      return next;
    });
  }

  /** ===== Step 2: Template ===== */
  const [date, setDate] = useState("");
  const [shift, setShift] = useState("");
  const [oe, setOe] = useState(100);
  const [defects, setDefects] = useState(0);
  const [compliance, setCompliance] = useState("NONE");

  // Molding template
  const [workingInput, setWorkingInput] = useState(8);
  const [moldHours, setMoldHours] = useState(0);
  const [output, setOutput] = useState(0);
  const [category, setCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState([]);

  useEffect(() => {
    if (!isMolding) return;
    supabase
      .from("kpi_rule_productivity")
      .select("category")
      .eq("section", "MOLDING")
      .eq("active", true)
      .then(({ data, error }) => {
        if (error) { console.error(error); return; }
        const list = [...new Set((data || []).map(r => r.category).filter(Boolean))];
        setCategoryOptions(list);
      });
  }, [isMolding]);

  /** ===== Step 3: Review & batch ===== */
  const [reviewRows, setReviewRows] = useState([]);
  const [selReview, setSelReview] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  function proceedToTemplate() {
    if (!approverId.trim()) return alert("Nhập MSNV người duyệt trước.");
    if (!checked.size) return alert("Chưa chọn nhân viên nào.");
    setStep(2);
  }

  async function buildReviewRows() {
    if (!date || !shift) return alert("Vui lòng nhập Ngày và Ca.");
    if (isMolding) {
      if (!category) return alert("Chọn Loại hàng (Category).");
    }

    // Tạo bản ghi cho mỗi nhân viên đã chọn
    const selectedWorkers = workers.filter(w => checked.has(w.msnv));
    const rows = [];

    // Preload rule cho Molding (map theo category, threshold desc)
    let rulesByCat = {};
    if (isMolding) {
      const { data: ruleRows } = await supabase
        .from("kpi_rule_productivity")
        .select("category, threshold, score")
        .eq("section", "MOLDING")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("threshold", { ascending: false });
      (ruleRows || []).forEach(r => {
        if (!rulesByCat[r.category]) rulesByCat[r.category] = [];
        rulesByCat[r.category].push({ threshold: Number(r.threshold), score: Number(r.score) });
      });
    }

    selectedWorkers.forEach(w => {
      if (isMolding) {
        const working_real = calcWorkingReal(shift, workingInput);
        let downtime = (working_real * 24 - toNum(moldHours)) / 24;
        if (downtime > 1) downtime = 1;
        if (downtime < 0) downtime = 0;
        const working_exact = Number((working_real - downtime).toFixed(2));
        const prod = working_exact > 0 ? toNum(output) / working_exact : 0;

        // Q & P & day
        const qScore = calcQ(defects);
        let pScore = 0;
        const catRules = rulesByCat[category] || [];
        for (const r of catRules) { if (prod >= r.threshold) { pScore = r.score; break; } }
        const dayScore = pScore + qScore;

        rows.push({
          section,
          date,
          ca: shift,
          worker_id: w.msnv,
          worker_name: w.full_name,
          approver_msnv: w.approver_msnv,
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
          status: "pending",
          __selected: true,
        });
      } else {
        const qScore = calcQ(defects);
        const pScore = calcPfromOE(oe);
        const dayScore = pScore + qScore;
        rows.push({
          section,
          work_date: date,
          shift,
          msnv: w.msnv,
          hoten: w.full_name,
          approver_id: w.approver_msnv,
          approver_name: w.approver_name,
          oe: toNum(oe),
          defects: toNum(defects),
          q_score: qScore,
          p_score: pScore,
          total_score: dayScore,
          compliance,
          status: "pending",
          __selected: true,
        });
      }
    });

    setReviewRows(rows);
    setSelReview(new Set(rows.map((_, i) => i)));
    setStep(3);
  }

  /** ===== Review table: helpers ===== */
  const pageSize = 50;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [reviewRows.length]);
  const totalPages = Math.max(1, Math.ceil(reviewRows.length / pageSize));
  const pageRows = useMemo(() => reviewRows.slice((page - 1) * pageSize, page * pageSize), [reviewRows, page]);

  function toggleAllReviewOnPage() {
    setSelReview(prev => {
      const next = new Set(prev);
      const allOnPage = pageRows.every((_, idx) => next.has((page - 1) * pageSize + idx));
      if (allOnPage) {
        pageRows.forEach((_, idx) => next.delete((page - 1) * pageSize + idx));
      } else {
        pageRows.forEach((_, idx) => next.add((page - 1) * pageSize + idx));
      }
      return next;
    });
  }
  function toggleOneReview(globalIndex) {
    setSelReview(prev => {
      const next = new Set(prev);
      if (next.has(globalIndex)) next.delete(globalIndex); else next.add(globalIndex);
      return next;
    });
  }

  function updateCell(globalIndex, key, val) {
    setReviewRows(rows => {
      const copy = rows.slice();
      const r = { ...copy[globalIndex] };
      // Cập nhật và tính lại cần thiết
      if (isMolding) {
        if (["working_input", "mold_hours", "output", "defects", "ca", "category"].includes(key)) {
          r[key] = key === "ca" || key === "category" ? val : toNum(val);
          // Recompute
          const working_real = calcWorkingReal(r.ca, r.working_input);
          let downtime = (working_real * 24 - toNum(r.mold_hours)) / 24;
          if (downtime > 1) downtime = 1;
          if (downtime < 0) downtime = 0;
          const working_exact = Number((working_real - downtime).toFixed(2));
          const prod = working_exact > 0 ? toNum(r.output) / working_exact : 0;
          const qScore = calcQ(r.defects);

          // Lấy rule theo category hiện tại (đơn giản hoá: giữ P cũ nếu chưa load lại; ở bước tạo review đã map rules)
          let pScore = 0;
          // tạm thời dựa trên p hiện có + delta theo threshold mới => để chính xác, bạn có thể reload rulesByCat tại đây nếu muốn
          // (để tối ưu, mình không gọi Supabase mỗi lần người dùng chỉnh 1 ô)
          // => phương án: giữ nguyên pScore nếu không thay đổi category; nếu đổi category, set 0 (hoặc bạn ấn "Áp lại điểm" riêng)
          if (key === "category") {
            pScore = 0; // bạn có thể muốn yêu cầu người dùng bấm lại "Áp template" để tính lại theo category mới
          } else {
            // nếu không đổi category, tạm giữ pScore cũ
            pScore = r.p_score ?? 0;
          }

          r.working_real = Number(working_real.toFixed(2));
          r.downtime = Number(downtime.toFixed(2));
          r.working_exact = working_exact;
          r.q_score = qScore;
          r.p_score = pScore;
          r.day_score = pScore + qScore;
        } else if (key === "compliance_code") {
          r.compliance_code = val;
        } else if (key === "date") {
          r.date = val;
        } else {
          r[key] = val;
        }
      } else {
        if (key === "oe") {
          r.oe = toNum(val);
          r.p_score = calcPfromOE(r.oe);
          r.day_score = r.p_score + r.q_score;
        } else if (key === "defects") {
          r.defects = toNum(val);
          r.q_score = calcQ(r.defects);
          r.day_score = r.p_score + r.q_score;
        } else if (key === "compliance") {
          r.compliance = val;
        } else if (key === "work_date") {
          r.work_date = val;
        } else if (key === "shift") {
          r.shift = val;
        } else {
          r[key] = val;
        }
      }
      copy[globalIndex] = r;
      return copy;
    });
  }

  /** ===== Batch save với chống trùng theo ngày ===== */
  async function saveBatch() {
    const indexes = Array.from(selReview).sort((a, b) => a - b);
    if (!indexes.length) return alert("Chưa chọn dòng nào để lưu.");

    setSaving(true);

    // Tách các dòng sẽ lưu
    const batch = indexes.map(i => reviewRows[i]);

    // Chống trùng theo ngày
    const byKey = new Map(); // key = worker_id|date|section  (molding)
    const filtered = [];
    for (const r of batch) {
      const key = isMolding ? `${r.worker_id}|${r.date}|${r.section}` : `${r.msnv}|${r.work_date}|${r.section}`;
      if (byKey.has(key)) continue;
      byKey.set(key, 1);
      filtered.push(r);
    }

    // Kiểm tra tồn tại trong DB trước khi insert
    let existingKeys = new Set();
    if (filtered.length) {
      if (isMolding) {
        const { data: exist, error } = await supabase
          .from("kpi_entries_molding")
          .select("worker_id,date")
          .in("worker_id", filtered.map(r => r.worker_id))
          .eq("section", "MOLDING")
          .gte("date", filtered.reduce((min, r) => r.date < min ? r.date : min, filtered[0].date))
          .lte("date", filtered.reduce((max, r) => r.date > max ? r.date : max, filtered[0].date));
        if (error) console.error(error);
        (exist || []).forEach(e => existingKeys.add(`${e.worker_id}|${e.date}|MOLDING`));
      } else {
        const { data: exist, error } = await supabase
          .from("kpi_entries")
          .select("msnv,work_date,section")
          .in("msnv", filtered.map(r => r.msnv))
          .eq("section", section)
          .gte("work_date", filtered.reduce((min, r) => r.work_date < min ? r.work_date : min, filtered[0].work_date))
          .lte("work_date", filtered.reduce((max, r) => r.work_date > max ? r.work_date : max, filtered[0].work_date));
        if (error) console.error(error);
        (exist || []).forEach(e => existingKeys.add(`${e.msnv}|${e.work_date}|${e.section}`));
      }
    }

    const toInsert = filtered.filter(r => {
      const key = isMolding ? `${r.worker_id}|${r.date}|${r.section}` : `${r.msnv}|${r.work_date}|${r.section}`;
      return !existingKeys.has(key);
    });
    const skipped = filtered.length - toInsert.length;

    if (!toInsert.length) {
      setSaving(false);
      return alert("Tất cả dòng đã tồn tại (trùng MSNV theo ngày). Không có gì để lưu.");
    }

    // Insert
    if (isMolding) {
      const payload = toInsert.map(r => ({
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
        defects: r.defects,
        q_score: r.q_score,
        p_score: r.p_score,
        day_score: r.day_score,
        compliance_code: r.compliance_code,
        status: r.status,
      }));
      const { error } = await supabase.from("kpi_entries_molding").insert(payload);
      setSaving(false);
      if (error) return alert("Lưu lỗi: " + error.message);
      alert(`Đã lưu ${payload.length} dòng. ${skipped ? `(Bỏ qua ${skipped} dòng trùng)` : ""}`);
    } else {
      const payload = toInsert.map(r => ({
        section: r.section,
        work_date: r.work_date,
        shift: r.shift,
        msnv: r.msnv,
        hoten: r.hoten,
        approver_id: r.approver_id,
        approver_name: r.approver_name,
        oe: r.oe,
        defects: r.defects,
        p_score: r.p_score,
        q_score: r.q_score,
        total_score: r.total_score,
        compliance: r.compliance,
        status: r.status,
      }));
      const { error } = await supabase.from("kpi_entries").insert(payload);
      setSaving(false);
      if (error) return alert("Lưu lỗi: " + error.message);
      alert(`Đã lưu ${payload.length} dòng. ${skipped ? `(Bỏ qua ${skipped} dòng trùng)` : ""}`);
    }
  }

  /** ===== UI ===== */
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Nhập KPI nhanh ({section})</h2>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className={classNames("px-2 py-0.5 rounded", step === 1 ? "bg-indigo-600 text-white" : "bg-gray-100")}>1. Chọn người duyệt & nhân viên</span>
          <span>›</span>
          <span className={classNames("px-2 py-0.5 rounded", step === 2 ? "bg-indigo-600 text-white" : "bg-gray-100")}>2. Nhập template</span>
          <span>›</span>
          <span className={classNames("px-2 py-0.5 rounded", step === 3 ? "bg-indigo-600 text-white" : "bg-gray-100")}>3. Review & Lưu</span>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label>MSNV người duyệt</label>
              <input className="input" value={approverId} onChange={e => setApproverId(e.target.value)} placeholder="Ví dụ: 00001" />
            </div>
            <div>
              <label>Tìm nhân viên (MSNV/Họ tên)</label>
              <input className="input" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn" onClick={loadWorkers}>Tải danh sách</button>
            <button className="btn btn-primary" onClick={proceedToTemplate} disabled={!checked.size}>Tiếp tục ›</button>
          </div>

          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-center">
                  <th className="p-2"><input type="checkbox" onChange={toggleAllWorkers} checked={checked.size === filteredWorkers.length && filteredWorkers.length > 0} /></th>
                  <th className="p-2">MSNV</th>
                  <th className="p-2">Họ & tên</th>
                  <th className="p-2">Người duyệt</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkers.map((w) => (
                  <tr key={w.msnv} className="border-t hover:bg-gray-50">
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={checked.has(w.msnv)} onChange={() => toggleWorker(w.msnv)} />
                    </td>
                    <td className="p-2 text-center">{w.msnv}</td>
                    <td className="p-2 text-center">{w.full_name}</td>
                    <td className="p-2 text-center">{w.approver_name} ({w.approver_msnv})</td>
                  </tr>
                ))}
                {!filteredWorkers.length && (
                  <tr><td className="p-4 text-center text-gray-500" colSpan={4}>Không có dữ liệu</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label>Ngày</label>
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label>Ca</label>
              <select className="input" value={shift} onChange={e => setShift(e.target.value)}>
                <option value="">-- Chọn ca --</option>
                <option value="Ca 1">Ca 1</option>
                <option value="Ca 2">Ca 2</option>
                <option value="Ca 3">Ca 3</option>
                <option value="Ca HC">Ca HC</option>
              </select>
            </div>

            {!isMolding ? (
              <>
                <div>
                  <label>%OE</label>
                  <input type="number" className="input" value={oe} onChange={e => setOe(toNum(e.target.value, 0))} />
                </div>
                <div>
                  <label>Số đôi phế</label>
                  <input type="number" className="input" value={defects} onChange={e => setDefects(toNum(e.target.value, 0))} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label>Loại hàng</label>
                  <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="">-- Chọn loại hàng --</option>
                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label>Giờ làm việc (nhập)</label>
                  <input type="number" className="input" value={workingInput} onChange={e => setWorkingInput(toNum(e.target.value, 0))} />
                </div>
                <div>
                  <label>Số giờ khuôn chạy thực tế</label>
                  <input type="number" className="input" value={moldHours} onChange={e => setMoldHours(toNum(e.target.value, 0))} />
                </div>
                <div>
                  <label>Sản lượng / ca</label>
                  <input type="number" className="input" value={output} onChange={e => setOutput(toNum(e.target.value, 0))} />
                </div>
                <div>
                  <label>Số đôi phế</label>
                  <input type="number" className="input" value={defects} onChange={e => setDefects(toNum(e.target.value, 0))} />
                </div>
              </>
            )}

            <div>
              <label>Tuân thủ</label>
              <select className="input" value={compliance} onChange={e => setCompliance(e.target.value)}>
                <option value="NONE">Không vi phạm</option>
                <option value="PPE">Vi phạm PPE</option>
                <option value="LATE">Đi trễ</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="btn" onClick={() => setStep(1)}>‹ Quay lại</button>
            <button className="btn btn-primary" onClick={buildReviewRows}>Tạo danh sách Review ›</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => setStep(2)}>‹ Sửa Template</button>
            <button className="btn btn-primary" onClick={saveBatch} disabled={saving || !selReview.size}>
              {saving ? "Đang lưu..." : `Lưu đã chọn (${selReview.size})`}
            </button>
            <div className="ml-auto flex items-center gap-3">
              <span>Tổng: {reviewRows.length}</span>
              <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹ Trước</button>
              <span>Trang {page}/{totalPages}</span>
              <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Sau ›</button>
              <button className="btn" onClick={() => setSelReview(new Set())} disabled={!selReview.size}>Bỏ chọn</button>
            </div>
          </div>

          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-center">
                {isMolding ? (
                  <tr>
                    <th className="p-2"><input type="checkbox"
                      onChange={toggleAllReviewOnPage}
                      checked={pageRows.length > 0 && pageRows.every((_, idx) => selReview.has((page - 1) * pageSize + idx))}
                    /></th>
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
                ) : (
                  <tr>
                    <th className="p-2"><input type="checkbox"
                      onChange={toggleAllReviewOnPage}
                      checked={pageRows.length > 0 && pageRows.every((_, idx) => selReview.has((page - 1) * pageSize + idx))}
                    /></th>
                    <th className="p-2">MSNV</th>
                    <th className="p-2">Họ tên</th>
                    <th className="p-2">Ngày</th>
                    <th className="p-2">Ca</th>
                    <th className="p-2">%OE</th>
                    <th className="p-2">Phế</th>
                    <th className="p-2">Q</th>
                    <th className="p-2">P</th>
                    <th className="p-2">KPI</th>
                    <th className="p-2">Tuân thủ</th>
                  </tr>
                )}
              </thead>
              <tbody className="text-center">
                {pageRows.map((r, idxOnPage) => {
                  const gi = (page - 1) * pageSize + idxOnPage; // global index
                  return isMolding ? (
                    <tr key={gi} className="border-t hover:bg-gray-50">
                      <td className="p-2">
                        <input type="checkbox" checked={selReview.has(gi)} onChange={() => toggleOneReview(gi)} />
                      </td>
                      <td className="p-2">{r.worker_id}</td>
                      <td className="p-2">{r.worker_name}</td>
                      <td className="p-2">
                        <CellInput value={r.date} type="date" onChange={(v) => updateCell(gi, "date", v)} />
                      </td>
                      <td className="p-2">
                        <select className="input text-center" value={r.ca} onChange={(e) => updateCell(gi, "ca", e.target.value)}>
                          <option value="Ca 1">Ca 1</option>
                          <option value="Ca 2">Ca 2</option>
                          <option value="Ca 3">Ca 3</option>
                          <option value="Ca HC">Ca HC</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <select className="input text-center" value={r.category} onChange={(e) => updateCell(gi, "category", e.target.value)}>
                          <option value={r.category}>{r.category}</option>
                          {categoryOptions.filter(c => c !== r.category).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <CellInput type="number" value={r.working_input} onChange={(v) => updateCell(gi, "working_input", v)} step="0.01" min="0" />
                      </td>
                      <td className="p-2">{r.working_real}</td>
                      <td className="p-2">{r.downtime}</td>
                      <td className="p-2">{r.working_exact}</td>
                      <td className="p-2">
                        <CellInput type="number" value={r.mold_hours} onChange={(v) => updateCell(gi, "mold_hours", v)} step="0.01" min="0" />
                      </td>
                      <td className="p-2">
                        <CellInput type="number" value={r.output} onChange={(v) => updateCell(gi, "output", v)} step="1" min="0" />
                      </td>
                      <td className="p-2">
                        <CellInput type="number" value={r.defects} onChange={(v) => updateCell(gi, "defects", v)} step="1" min="0" />
                      </td>
                      <td className="p-2">{r.q_score}</td>
                      <td className="p-2">{r.p_score}</td>
                      <td className="p-2 font-semibold">{r.day_score}</td>
                      <td className="p-2">
                        <select className="input text-center" value={r.compliance_code} onChange={(e) => updateCell(gi, "compliance_code", e.target.value)}>
                          <option value="NONE">NONE</option>
                          <option value="PPE">PPE</option>
                          <option value="LATE">LATE</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                      </td>
                    </tr>
                  ) : (
                    <tr key={gi} className="border-t hover:bg-gray-50">
                      <td className="p-2">
                        <input type="checkbox" checked={selReview.has(gi)} onChange={() => toggleOneReview(gi)} />
                      </td>
                      <td className="p-2">{r.msnv}</td>
                      <td className="p-2">{r.hoten}</td>
                      <td className="p-2">
                        <CellInput value={r.work_date} type="date" onChange={(v) => updateCell(gi, "work_date", v)} />
                      </td>
                      <td className="p-2">
                        <select className="input text-center" value={r.shift} onChange={(e) => updateCell(gi, "shift", e.target.value)}>
                          <option value="Ca 1">Ca 1</option>
                          <option value="Ca 2">Ca 2</option>
                          <option value="Ca 3">Ca 3</option>
                          <option value="Ca HC">Ca HC</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <CellInput type="number" value={r.oe} onChange={(v) => updateCell(gi, "oe", v)} step="0.01" />
                      </td>
                      <td className="p-2">
                        <CellInput type="number" value={r.defects} onChange={(v) => updateCell(gi, "defects", v)} step="1" min="0" />
                      </td>
                      <td className="p-2">{r.q_score}</td>
                      <td className="p-2">{r.p_score}</td>
                      <td className="p-2 font-semibold">{r.total_score}</td>
                      <td className="p-2">
                        <select className="input text-center" value={r.compliance} onChange={(e) => updateCell(gi, "compliance", e.target.value)}>
                          <option value="NONE">NONE</option>
                          <option value="PPE">PPE</option>
                          <option value="LATE">LATE</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
                {!pageRows.length && (
                  <tr><td className="p-4 text-center text-gray-500" colSpan={18}>Không có dữ liệu</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
