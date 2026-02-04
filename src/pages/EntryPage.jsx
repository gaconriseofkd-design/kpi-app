// src/pages/EntryPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";
import {
  scoreByQualityLeanline,
  scoreByCompliance,
  getLeanlineCompliancePenalty
} from "../lib/scoring";

/* ================= Helpers & Scoring ================= */

const HYBRID_COMPLIANCE_OPTIONS = [
  { value: "NONE", label: "Không vi phạm" },
  { value: "MQAA", label: "Vi phạm MQAA" },
  { value: "REWORK", label: "Hàng lỗi Rework" },
  { value: "OTHER", label: "Vi phạm khác" },
];

const getMoldedCategoryFromLine = (line) => {
  return '%OE';
};

// Machine Map
const MACHINE_MAP = {
  "LAMINATION": ["Máy dán 1", "Máy dán 2", "Máy dán 3", "Máy dán 4", "Máy dán 5", "Máy dán 6", "Máy dán 7"],
  "PREFITTING": ["Máy cắt 1", "Máy cắt 2", "Máy cắt 3", "Máy cắt 4", "Máy cắt 5", "Máy cắt 6"],
  "BÀO": ["Máy bào 1", "Máy bào 2", "Máy bào 3", "Máy bào 4"],
  "TÁCH": ["Máy tách 1", "Máy tách 2", "Máy tách 3", "Máy tách 4"],
  "LEANLINE_MOLDED": ["M1", "M2", "M3", "M4", "M5"],
  "LEANLINE_DEFAULT": ["LEAN-D1", "LEAN-D2", "LEAN-D3", "LEAN-D4", "LEAN-H1", "LEAN-H2"],
};

const HYBRID_SECTIONS = ["LAMINATION", "PREFITTING", "BÀO", "TÁCH"];
const isHybridSection = (sectionKey) => HYBRID_SECTIONS.includes(sectionKey);

const getTableName = (sectionKey) =>
  isHybridSection(sectionKey) ? "kpi_lps_entries" : "kpi_entries";

/** Quy đổi giờ làm việc thực tế từ giờ nhập + ca làm việc */
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

function scoreByProductivityLeanline(oe, allRules, section, line) {
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

// CẬP NHẬT: Thêm logic tính điểm Tuân thủ mới
function deriveDayScores({ section, oe, defects, category, output, workHours, stopHours, ca, line, compliance, compliancePairs }, prodRules) {
  const isHybrid = isHybridSection(section);

  let q = 0;
  let c = 0;

  if (section === "LEANLINE_MOLDED") {
    q = scoreByQualityLeanline(defects);
    const penalty = getLeanlineCompliancePenalty(compliance);
    c = scoreByCompliance(penalty);
  } else if (section === "LEANLINE_DEFAULT") {
    q = scoreByQualityLeanline(defects);
    c = scoreByCompliance(compliancePairs);
  } else if (isHybrid) {
    const d = Number(defects || 0);
    q = (d <= 1) ? 5 : (d <= 2) ? 4 : (d <= 3) ? 2 : 0;
    c = scoreByCompliance(compliancePairs);
  }

  let p = 0;
  let prodRate = 0;
  let workingReal = 0;

  if (isHybrid) {
    workingReal = calcWorkingReal(ca, workHours);
    const exactHours = Math.max(0, workingReal - Number(stopHours || 0));

    prodRate = exactHours > 0 ? Number(output || 0) / exactHours : 0;
    p = scoreByProductivityHybrid(prodRate, category, prodRules);
  } else {
    prodRate = Number(oe || 0);
    p = scoreByProductivityLeanline(prodRate, prodRules, section, line);
    workingReal = Number(workHours || 0);
  }

  const total = p + q + c;
  return {
    p_score: p,
    q_score: q,
    c_score: c,
    day_score: Math.min(15, total),
    overflow: Math.max(0, total - 15),
    prodRate: prodRate,
    workingReal: workingReal,
  };
}

/* ================= Form mặc định ================= */
const DEFAULT_FORM = {
  date: new Date().toISOString().slice(0, 10),
  workerId: "",
  workerName: "",
  approverId: "",
  approverName: "",
  line: "LEAN-D1",
  ca: "Ca 1",
  workHours: 8,
  stopHours: 0,
  defects: 0,
  oe: 100,
  output: 0,
  category: "",
  compliance: "NONE",
  compliancePairs: 0, // <-- THÊM TRƯỜNG NÀY
};

export default function EntryPage() {
  const { section } = useKpiSection();
  const isHybrid = isHybridSection(section);
  const tableName = getTableName(section);

  const [form, setForm] = useState({ ...DEFAULT_FORM });

  const [prodRules, setProdRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [complianceDict, setComplianceDict] = useState([]);

  const today = new Date().toISOString().slice(0, 10);

  const currentMachines = useMemo(() => {
    return MACHINE_MAP[section] || MACHINE_MAP.LEANLINE_DEFAULT;
  }, [section]);

  // ====== tải rule theo section ======
  useEffect(() => {
    let cancelled = false;

    const defaultLine = currentMachines[0] || DEFAULT_FORM.line;
    setForm(f => ({
      ...DEFAULT_FORM,
      date: f.date,
      line: defaultLine,
      category: isHybridSection(section) ? f.category : "",
      output: isHybridSection(section) ? f.output : 0,
      oe: isHybridSection(section) ? 100 : f.oe,
    }));

    (async () => {
      const dbSection = section.toUpperCase();
      const { data, error } = await supabase
        .from("kpi_rule_productivity")
        .select("*")
        .eq("active", true)
        .eq("section", dbSection)
        .order("threshold", { ascending: false });
      if (!cancelled) {
        if (error) console.error("Load rules error:", error);
        setProdRules(data || []);

        if (isHybridSection(section)) {
          const opts = [...new Set((data || []).map(r => r.category).filter(Boolean))].sort();
          setCategoryOptions(opts);
        } else {
          setCategoryOptions([]);
        }
      }
    })();

    // Tải dictionary tuân thủ
    (async () => {
      const { data } = await supabase.from("kpi_compliance_dictionary").select("*");
      if (!cancelled && data) setComplianceDict(data);
    })();

    return () => {
      cancelled = true;
    };
  }, [section]);

  const getComplianceOptions = (cat = "COMPLIANCE") => {
    const secKey = section === "MOLDING" ? "MOLDING" : (section === "LAMINATION" ? "LAMINATION" : "OTHERS");
    return ["NONE", ...new Set(complianceDict.filter(r => r.section === secKey && r.category === cat).map(r => r.content))];
  };

  // ====== auto fill họ tên + approver ======
  const userCache = useRef(new Map());
  useEffect(() => {
    const id = (form.workerId || "").trim();
    if (!id) {
      setForm((f) => ({ ...f, workerName: "", approverId: "", approverName: "" }));
      return;
    }

    const cached = userCache.current.get(id);
    if (cached) {
      setForm((f) => ({ ...f, workerName: cached.full_name || "", approverId: cached.approver_msnv || "", approverName: cached.approver_name || "" }));
      return;
    }

    const t = setTimeout(async () => {
      const { data } = await supabase.from("users").select("msnv, full_name, approver_msnv, approver_name").eq("msnv", id).maybeSingle();
      if (data) {
        userCache.current.set(id, data);
        setForm((f) => ({ ...f, workerName: data.full_name || "", approverId: data.approver_msnv || "", approverName: data.approver_name || "" }));
      } else {
        setForm((f) => ({ ...f, workerName: "", approverId: "", approverName: "" }));
      }
    }, 250);

    return () => clearTimeout(t);
  }, [form.workerId]);

  // ====== tính điểm động ======
  const scores = useMemo(
    () => deriveDayScores({
      section,
      oe: form.oe,
      defects: form.defects,
      category: form.category,
      output: form.output,
      workHours: form.workHours,
      stopHours: form.stopHours,
      ca: form.ca,
      line: form.line,
      compliance: form.compliance,         // Truyền lỗi
      compliancePairs: form.compliancePairs // Truyền số đôi lỗi
    }, prodRules),
    [section, form.oe, form.defects, form.category, form.output, form.workHours, form.stopHours, form.ca, form.line, form.compliance, form.compliancePairs, prodRules]
  );

  function handleChange(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function findExisting(workerId, date, sectionKey) {
    const table = getTableName(sectionKey);
    const { data, error } = await supabase
      .from(table)
      .select("id, status, approved_at")
      .eq("worker_id", workerId)
      .eq("date", date)
      .eq("section", sectionKey)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    return data || null;
  }

  async function handleSubmit() {
    if (form.date > today) return alert("Không thể nhập KPI cho ngày trong tương lai.");
    if (!form.workerId) return alert("Nhập MSNV.");
    if (!form.approverId) return alert("Không tìm thấy Người duyệt cho MSNV này.");
    if (!form.date) return alert("Chọn ngày.");
    if (isHybrid && !form.category) return alert("Vui lòng chọn Loại năng suất (Category).");

    const violationsValue = form.compliance === "NONE" ? 0 : 1;
    const isUpdate = await findExisting(form.workerId, form.date, section);
    const now = new Date().toISOString();

    // Payload chung
    const basePayload = {
      date: form.date,
      worker_id: form.workerId,
      worker_name: form.workerName || null,
      approver_id: form.approverId,
      approver_name: form.approverName || null,
      line: form.line,
      ca: form.ca,
      work_hours: Number(form.workHours || 0),
      stop_hours: Number(form.stopHours || 0),
      defects: Number(form.defects || 0),
      compliance_code: form.compliance,
      section,
      status: "pending",
      created_at: now,
      p_score: scores.p_score,
      q_score: scores.q_score,
      c_score: scores.c_score,
      day_score: scores.day_score,
      overflow: scores.overflow,
    };

    let sectionPayload = {};

    if (isHybrid) {
      sectionPayload = {
        output: Number(form.output || 0),
        category: form.category,
        working_real: scores.workingReal,
        violations: violationsValue,
        compliance_pairs: Number(form.compliancePairs || 0),
      };
    } else {
      sectionPayload = {
        oe: Number(form.oe || 0),
      };
    }

    const payload = { ...basePayload, ...sectionPayload };

    try {
      setLoading(true);

      if (isUpdate) {
        const isApproved = isUpdate.status === "approved";
        const msg = isApproved
          ? "Ngày này đã có bản ghi ĐÃ DUYỆT.\nGhi đè sẽ đưa bản ghi về trạng thái CHỜ DUYỆT lại. Tiếp tục?"
          : "Ngày này đã có bản ghi CHỜ DUYỆT.\nBạn có muốn CẬP NHẬT bản ghi đó không?";
        if (!confirm(msg)) {
          setLoading(false);
          return;
        }

        const patch = { ...payload };
        if (isApproved) {
          patch.status = "pending";
          patch.approved_at = null;
          patch.approver_note = null;
        }

        const { error: upErr } = await supabase
          .from(tableName)
          .update(patch)
          .eq("id", isUpdate.id);
        if (upErr) throw upErr;

        alert("Đã cập nhật bản ghi.");
      } else {
        const { error } = await supabase.from(tableName).insert([payload]);
        if (error) throw error;
        alert(`Đã gửi KPI cho ${form.workerId} – điểm ngày: ${scores.day_score}.`);
      }

      setForm((f) => ({
        ...f,
        workHours: 8,
        stopHours: 0,
        defects: 0,
        oe: isHybrid ? 100 : DEFAULT_FORM.oe,
        output: isHybrid ? 0 : DEFAULT_FORM.output,
        compliance: "NONE",
        compliancePairs: 0,
      }));
    } catch (e) {
      console.error(e);
      alert("Lưu KPI lỗi: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Nhập KPI - {section}</h2>

      <div className="grid md:grid-cols-2 gap-4">
        <label>Ngày:
          <input
            type="date"
            className="input"
            value={form.date}
            onChange={(e) => handleChange("date", e.target.value)}
            max={today}
          />
        </label>

        <div>
          <label>MSNV:</label>
          <input
            className="input"
            value={form.workerId}
            onChange={(e) => handleChange("workerId", e.target.value.trim())}
            placeholder="vd: 04126"
          />
        </div>

        <label>Họ & tên: <input className="input" value={form.workerName} disabled /></label>
        <label>Người duyệt (MSNV): <input className="input" value={form.approverId} disabled /></label>
        <label>Người duyệt (Họ tên): <input className="input" value={form.approverName} disabled /></label>

        <label>Máy làm việc:
          <select
            className="input"
            value={form.line}
            onChange={(e) => handleChange("line", e.target.value)}
          >
            {currentMachines.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>

        <label>Ca làm việc:
          <select className="input" value={form.ca} onChange={(e) => handleChange("ca", e.target.value)}>
            <option value="Ca 1">Ca 1</option>
            <option value="Ca 2">Ca 2</option>
            <option value="Ca 3">Ca 3</option>
            <option value="Ca HC">Ca HC</option>
          </select>
        </label>

        <label>Giờ làm việc:
          <input type="number" className="input" value={form.workHours} onChange={(e) => handleChange("workHours", Number(e.target.value))} />
        </label>

        <label>Giờ dừng máy:
          <input type="number" className="input" value={form.stopHours} onChange={(e) => handleChange("stopHours", Number(e.target.value))} />
        </label>

        <label>Số đôi phế:
          <input type="number" className="input" value={form.defects} onChange={(e) => handleChange("defects", Number(e.target.value))} step="0.5" />
        </label>

        {isHybrid ? (
          <>
            <label>Loại năng suất (Category):
              <select className="input" value={form.category} onChange={(e) => handleChange("category", e.target.value)}>
                <option value="">-- Chọn loại --</option>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>Sản lượng (Output):
              <input type="number" className="input" value={form.output} onChange={(e) => handleChange("output", Number(e.target.value))} />
            </label>
          </>
        ) : (
          <label>%OE:
            <input type="number" className="input" value={form.oe} onChange={(e) => handleChange("oe", Number(e.target.value))} step="0.01" />
          </label>
        )}

        <label>Lỗi Tuân thủ:
          <select
            className="input"
            value={form.compliance}
            onChange={(e) => handleChange("compliance", e.target.value)}
          >
            {getComplianceOptions("COMPLIANCE").map(opt => (
              <option key={opt} value={opt}>{opt === "NONE" ? "Không vi phạm" : opt}</option>
            ))}
          </select>
        </label>

        {/* Ô NHẬP SỐ ĐÔI VI PHẠM */}
        {form.compliance !== "NONE" && (
          <label className="text-red-600 font-semibold border-l-4 border-red-500 pl-2 ml-2 bg-red-50 rounded-r">
            Số lần/đôi vi phạm:
            <input
              type="number"
              className="input border-red-400 bg-white ml-2 w-32"
              value={form.compliancePairs}
              onChange={(e) => handleChange("compliancePairs", Number(e.target.value))}
              min="1"
              step="1"
              placeholder="Nhập số..."
            />
          </label>
        )}
      </div>

      <div className="mt-3 p-4 rounded bg-gray-50">
        <p>Giờ làm việc nhập: <b>{Number(form.workHours || 0)}</b></p>
        <p>Giờ dừng máy: <b>{Number(form.stopHours || 0)}</b></p>
        {isHybrid && (
          <>
            <p>Giờ thực tế (Quy đổi): <b>{scores.workingReal.toFixed(2)}</b></p>
            <p>Giờ chính xác: <b>{(scores.workingReal - Number(form.stopHours || 0)).toFixed(2)}</b></p>
            <p>Tỷ lệ năng suất: <b>{scores.prodRate.toFixed(2)}</b></p>
          </>
        )}
        <p>Điểm Sản lượng (P): <b>{scores.p_score}</b></p>
        <p>Điểm Chất lượng (Q): <b>{scores.q_score}</b></p>
        <p>Điểm Tuân thủ (C): <b>{scores.c_score}</b></p>
        <p>Điểm KPI ngày: <b>{scores.day_score}</b></p>
        <p>Điểm dư: <b>{scores.overflow}</b></p>
      </div>

      <button onClick={handleSubmit} className="btn btn-primary mt-4" disabled={loading}>
        {loading ? "Đang lưu..." : "Gửi KPI"}
      </button>
    </div>
  );
}