// src/pages/QuickEntry.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";

/* ===== Helpers ===== */
const cx = (...a) => a.filter(Boolean).join(" ");
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/* Leanline: điểm P theo %OE (giữ logic cũ) */
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

/* Chất lượng chung */
function calcQ(defects) {
  const d = toNum(defects);
  if (d === 0) return 10;
  if (d <= 2) return 8;
  if (d <= 4) return 6;
  if (d <= 6) return 4;
  return 0;
}

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

/* ===== Main ===== */
export default function QuickEntry() {
  const { section } = useKpiSection();
  const isMolding = section === "MOLDING";

  const [authed, setAuthed] = useState(() => sessionStorage.getItem("quick_authed") === "1");
  const [pwd, setPwd] = useState("");

  function tryLogin(e) {
    e?.preventDefault();
    if (pwd === "davidtu") {
      sessionStorage.setItem("quick_authed", "1");
      setAuthed(true);
    } else alert("Sai mật khẩu.");
  }

  // 👉 Chuyển phần form login ra component riêng
  if (!authed) {
    return <LoginForm pwd={pwd} setPwd={setPwd} tryLogin={tryLogin} />;
  }

  // phần còn lại giữ nguyên
  const [mode, setMode] = useState("approver");

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Nhập KPI nhanh ({section})</h2>
        <div className="ml-auto flex gap-2">
          <button
            className={cx("btn", mode === "approver" && "btn-primary")}
            onClick={() => setMode("approver")}
          >
            Theo người duyệt
          </button>
          {isMolding && (
            <button
              className={cx("btn", mode === "self" && "btn-primary")}
              onClick={() => setMode("self")}
            >
              Tự nhập (MSNV người nhập)
            </button>
          )}
        </div>
      </div>

      {mode === "approver" ? (
        <ApproverMode isMolding={isMolding} section={section} />
      ) : (
        <SelfModeMolding section={section} />
      )}
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
   MODE 1: Theo người duyệt (Leanline & Molding)
   - Chọn MSNV người duyệt → chọn nhân viên → nhập template → LƯU = approved
   ====================================================================== */
function ApproverMode({ isMolding, section }) {
  /* Step & states */
  const [step, setStep] = useState(1);
  const [approverId, setApproverId] = useState("");
  const [workers, setWorkers] = useState([]);
  const [checked, setChecked] = useState(() => new Set());
  const [search, setSearch] = useState("");

  const filteredWorkers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(
      (w) =>
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
    setChecked((prev) => {
      if (prev.size === filteredWorkers.length) return new Set();
      return new Set(filteredWorkers.map((w) => w.msnv));
    });
  }
  function toggleWorker(msnv) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(msnv)) next.delete(msnv);
      else next.add(msnv);
      return next;
    });
  }
  function proceedToTemplate() {
    if (!approverId.trim()) return alert("Nhập MSNV người duyệt trước.");
    if (!checked.size) return alert("Chưa chọn nhân viên nào.");
    setStep(2);
  }

  /* Template inputs */
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
        if (error) return console.error(error);
        const list = [...new Set((data || []).map((r) => r.category).filter(Boolean))];
        setCategoryOptions(list);
      });
  }, [isMolding]);

  /* Review rows */
  const [reviewRows, setReviewRows] = useState([]);
  const [selReview, setSelReview] = useState(() => new Set());

  async function buildReviewRows() {
    if (!date || !shift) return alert("Nhập Ngày & Ca.");
    if (isMolding && !category) return alert("Chọn Loại hàng.");

    const selectedWorkers = workers.filter((w) => checked.has(w.msnv));
    const rows = [];

    let rulesByCat = {};
    if (isMolding) {
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
    }

    selectedWorkers.forEach((w) => {
      if (isMolding) {
        const working_real = calcWorkingReal(shift, workingInput);
        let downtime = (working_real * 24 - toNum(moldHours)) / 24;
        if (downtime > 1) downtime = 1;
        if (downtime < 0) downtime = 0;
        const working_exact = Number((working_real - downtime).toFixed(2));
        const prod = working_exact > 0 ? toNum(output) / working_exact : 0;

        const qScore = calcQ(defects);
        let pScore = 0;
        const catRules = rulesByCat[category] || [];
        for (const r of catRules) {
          if (prod >= r.threshold) {
            pScore = r.score;
            break;
          }
        }
        const dayScore = pScore + qScore;

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
          approver_id: approverId, // người duyệt đã chọn
          approver_name: w.approver_name,
          oe: toNum(oe),
          defects: toNum(defects),
          q_score: qScore,
          p_score: pScore,
          total_score: dayScore,
          compliance,
          status: "approved", // ⬅ duyệt luôn
        });
      }
    });

    setReviewRows(rows);
    setSelReview(new Set(rows.map((_, i) => i)));
    setStep(3);
  }

  /* paging review */
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

  /* Save batch (duyệt luôn) */
  const [saving, setSaving] = useState(false);
  async function saveBatch() {
    const idxs = Array.from(selReview).sort((a, b) => a - b);
    if (!idxs.length) return alert("Chưa chọn dòng để lưu.");

    setSaving(true);
    const list = idxs.map((i) => reviewRows[i]);

    if (isMolding) {
      const payload = list.map((r) => ({
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
        status: "approved",
      }));
      const { error } = await supabase
        .from("kpi_entries_molding")
        .upsert(payload, { onConflict: "worker_id,date,section" });
      setSaving(false);
      if (error) return alert("Lưu lỗi: " + error.message);
      alert(`Đã lưu ${payload.length} dòng (approved).`);
    } else {
      const payload = list.map((r) => ({
        section: r.section,
        work_date: r.work_date,
        shift: r.shift,
        msnv: r.msnv,
        hoten: r.hoten,
        approver_id: r.approver_id,
        approver_name: r.approver_name,
        oe: r.oe,
        defects: r.defects,
        q_score: r.q_score,
        p_score: r.p_score,
        total_score: r.total_score,
        compliance: r.compliance,
        status: "approved",
      }));
      const { error } = await supabase.from("kpi_entries").upsert(payload, {
        onConflict: "msnv,work_date,section",
      });
      setSaving(false);
      if (error) return alert("Lưu lỗi: " + error.message);
      alert(`Đã lưu ${payload.length} dòng (approved).`);
    }
  }

  /* UI */
  return (
    <div className="space-y-4">
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
        <div>
          <label>Tìm nhân viên (MSNV/Họ tên)</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn" onClick={loadWorkers}>Tải danh sách NV</button>
        <button className="btn btn-primary" onClick={proceedToTemplate} disabled={!checked.size}>
          Tiếp tục ›
        </button>
      </div>

      {step === 1 && (
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-center">
                <th className="p-2">
                  <input
                    type="checkbox"
                    onChange={toggleAllWorkers}
                    checked={checked.size === filteredWorkers.length && filteredWorkers.length > 0}
                  />
                </th>
                <th className="p-2">MSNV</th>
                <th className="p-2">Họ & tên</th>
                <th className="p-2">Người duyệt phụ trách</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.map((w) => (
                <tr key={w.msnv} className="border-t hover:bg-gray-50">
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={checked.has(w.msnv)}
                      onChange={() => toggleWorker(w.msnv)}
                    />
                  </td>
                  <td className="p-2 text-center">{w.msnv}</td>
                  <td className="p-2 text-center">{w.full_name}</td>
                  <td className="p-2 text-center">
                    {w.approver_name} ({w.approver_msnv})
                  </td>
                </tr>
              ))}
              {!filteredWorkers.length && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-gray-500">
                    Không có dữ liệu
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
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

            {!isMolding ? (
              <>
                <div>
                  <label>%OE</label>
                  <input type="number" className="input" value={oe} onChange={(e) => setOe(toNum(e.target.value, 0))} />
                </div>
                <div>
                  <label>Số đôi phế</label>
                  <input type="number" className="input" value={defects} onChange={(e) => setDefects(toNum(e.target.value, 0))} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label>Loại hàng</label>
                  <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">-- Chọn loại hàng --</option>
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Giờ làm việc (nhập)</label>
                  <input
                    type="number"
                    className="input"
                    value={workingInput}
                    onChange={(e) => setWorkingInput(toNum(e.target.value, 0))}
                  />
                </div>
                <div>
                  <label>Số giờ khuôn chạy thực tế</label>
                  <input
                    type="number"
                    className="input"
                    value={moldHours}
                    onChange={(e) => setMoldHours(toNum(e.target.value, 0))}
                  />
                </div>
                <div>
                  <label>Sản lượng / ca</label>
                  <input
                    type="number"
                    className="input"
                    value={output}
                    onChange={(e) => setOutput(toNum(e.target.value, 0))}
                  />
                </div>
                <div>
                  <label>Số đôi phế</label>
                  <input
                    type="number"
                    className="input"
                    value={defects}
                    onChange={(e) => setDefects(toNum(e.target.value, 0))}
                  />
                </div>
              </>
            )}

            <div>
              <label>Tuân thủ</label>
              <select className="input" value={compliance} onChange={(e) => setCompliance(e.target.value)}>
                <option value="NONE">Không vi phạm</option>
                <option value="PPE">Vi phạm PPE</option>
                <option value="LATE">Đi trễ</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>
          </div>

          <button className="btn btn-primary" onClick={buildReviewRows}>
            Tạo danh sách Review ›
          </button>
        </div>
      )}

      {step === 3 && (
        <ReviewTable
          isMolding={isMolding}
          pageSize={50}
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

/* ======================================================================
   MODE 2: Tự nhập (MSNV người nhập) – MOLDING ONLY
   - Nhập MSNV người nhập → chọn khoảng ngày → Tải danh sách = hiển thị các ngày
   - Nhập y chang EntryPageMolding, có sẵn cột MSNV/Họ tên NV & MSNV/Họ tên người nhập
   - Lưu = approved, upsert theo (worker_id, date, section)
   ====================================================================== */
function SelfModeMolding({ section }) {
  const [entrantId, setEntrantId] = useState("");
  const [entrantName, setEntrantName] = useState("");
  const [workerId, setWorkerId] = useState("");     // nhân viên = người nhập
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
      // nhân viên = người nhập
      worker_id: workerId,
      worker_name: workerName,
      // hiển thị người nhập (không có cột riêng trong DB, sẽ lưu vào approver_* cho tiện theo dõi)
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
      status: "approved", // duyệt luôn
    }));
    setRows(base);
  }

  // cập nhật & tính lại
  function recompute(row) {
    const working_real = calcWorkingReal(row.ca, row.working_input);
    let downtime = (working_real * 24 - toNum(row.mold_hours)) / 24;
    if (downtime > 1) downtime = 1;
    if (downtime < 0) downtime = 0;
    const working_exact = Number((working_real - downtime).toFixed(2));
    const prod = working_exact > 0 ? toNum(row.output) / working_exact : 0;

    const q = calcQ(row.defects);
    let p = 0;
    const rules = rulesByCat[row.category] || [];
    for (const r of rules) {
      if (prod >= r.threshold) {
        p = r.score;
        break;
      }
    }
    const day = p + q;

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
      const r = { ...copy[i], [key]: ["ca", "category"].includes(key) ? val : toNum(val, 0) };
      copy[i] = recompute(r);
      return copy;
    });
  }

  // lưu tất cả (approved)
  const [saving, setSaving] = useState(false);
  async function saveAll() {
    if (!rows.length) return alert("Không có dữ liệu để lưu.");
    if (!rows.every((r) => r.date && r.ca && r.category)) {
      return alert("Vui lòng nhập đủ Ngày, Ca, Loại hàng cho tất cả dòng.");
    }

    setSaving(true);
    const payload = rows.map((r) => ({
      section: r.section,
      date: r.date,
      ca: r.ca,
      worker_id: r.worker_id,
      worker_name: r.worker_name,
      // gán người nhập vào approver_* để báo cáo có “MSNV người duyệt”
      approver_msnv: r.entrant_msnv,
      approver_name: r.entrant_name,
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
      status: "approved",
    }));

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
      <div className="grid md:grid-cols-4 gap-3">
        <div>
          <label>MSNV người nhập</label>
          <input className="input" value={entrantId} onChange={(e) => setEntrantId(e.target.value)} />
        </div>
        <div>
          <label>Họ & tên người nhập</label>
          <input className="input" value={entrantName} disabled />
        </div>
        <div>
          <label>Từ ngày</label>
          <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label>Đến ngày</label>
          <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <button className="btn" onClick={buildRowsByDates}>Tải danh sách ngày</button>

      {rows.length > 0 && (
        <>
          <div className="text-sm text-gray-600">
            MSNV nhân viên: <b>{workerId}</b> — {workerName} | Người nhập: <b>{entrantId}</b> — {entrantName}
          </div>

          <div className="overflow-auto border rounded">
            <table className="min-w-[1200px] text-sm">
              <thead className="bg-gray-50 text-center">
                <tr>
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
                {rows.map((r, i) => (
                  <tr key={r.date} className="border-t hover:bg-gray-50">
                    <td className="p-2">{r.date}</td>
                    <td className="p-2">
                      <select className="input text-center" value={r.ca} onChange={(e) => update(i, "ca", e.target.value)}>
                        <option value="">-- Chọn --</option>
                        <option value="Ca 1">Ca 1</option>
                        <option value="Ca 2">Ca 2</option>
                        <option value="Ca 3">Ca 3</option>
                        <option value="Ca HC">Ca HC</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <select className="input text-center" value={r.category} onChange={(e) => update(i, "category", e.target.value)}>
                        <option value="">-- Chọn --</option>
                        {categoryOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <CellInput type="number" value={r.working_input} onChange={(v) => update(i, "working_input", v)} step="0.01" min="0" />
                    </td>
                    <td className="p-2">{r.working_real}</td>
                    <td className="p-2">{r.downtime}</td>
                    <td className="p-2">{r.working_exact}</td>
                    <td className="p-2">
                      <CellInput type="number" value={r.mold_hours} onChange={(v) => update(i, "mold_hours", v)} step="0.01" min="0" />
                    </td>
                    <td className="p-2">
                      <CellInput type="number" value={r.output} onChange={(v) => update(i, "output", v)} step="1" min="0" />
                    </td>
                    <td className="p-2">
                      <CellInput type="number" value={r.defects} onChange={(v) => update(i, "defects", v)} step="1" min="0" />
                    </td>
                    <td className="p-2">{r.q_score}</td>
                    <td className="p-2">{r.p_score}</td>
                    <td className="p-2 font-semibold">{r.day_score}</td>
                    <td className="p-2">
                      <select className="input text-center" value={r.compliance_code} onChange={(e) => update(i, "compliance_code", e.target.value)}>
                        <option value="NONE">NONE</option>
                        <option value="PPE">PPE</option>
                        <option value="LATE">LATE</option>
                        <option value="OTHER">OTHER</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu tất cả (duyệt luôn)"}
          </button>
        </>
      )}
    </div>
  );
}

/* ===== Bảng review dùng chung cho ApproverMode ===== */
function ReviewTable({
  isMolding,
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
            {isMolding ? (
              <tr>
                <th className="p-2">
                  <input
                    type="checkbox"
                    onChange={toggleAllReviewOnPage}
                    checked={pageRows.length > 0 && pageRows.every((_, idx) => selReview.has(idx))}
                  />
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
            ) : (
              <tr>
                <th className="p-2">
                  <input
                    type="checkbox"
                    onChange={toggleAllReviewOnPage}
                    checked={pageRows.length > 0 && pageRows.every((_, idx) => selReview.has(idx))}
                  />
                </th>
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
            {pageRows.map((r, idx) =>
              isMolding ? (
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
              ) : (
                <tr key={idx} className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    <input type="checkbox" checked={selReview.has(idx)} onChange={() => toggleOneReview(idx)} />
                  </td>
                  <td className="p-2">{r.msnv}</td>
                  <td className="p-2">{r.hoten}</td>
                  <td className="p-2">{r.work_date}</td>
                  <td className="p-2">{r.shift}</td>
                  <td className="p-2">{r.oe}</td>
                  <td className="p-2">{r.defects}</td>
                  <td className="p-2">{r.q_score}</td>
                  <td className="p-2">{r.p_score}</td>
                  <td className="p-2 font-semibold">{r.total_score}</td>
                  <td className="p-2">{r.compliance}</td>
                </tr>
              )
            )}
            {!pageRows.length && (
              <tr>
                <td colSpan={isMolding ? 17 : 11} className="p-4 text-center text-gray-500">
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
