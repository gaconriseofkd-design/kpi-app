// src/pages/EntryPage.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";

/* ------------ Helpers chấm điểm ------------ */
// Điểm sản lượng theo rule trong DB
function scoreByProductivity(oe, rules) {
  const v = Number(oe ?? 0);
  const list = (rules || [])
    .filter(r => r.active !== false)
    .sort((a, b) => Number(b.threshold) - Number(a.threshold));
  for (const r of list) {
    if (v >= Number(r.threshold)) return Number(r.score || 0);
  }
  return 0;
}
// Điểm chất lượng (nếu muốn, có thể tách ra bảng rule tương tự)
function scoreByQuality(defects) {
  const d = Number(defects || 0);
  if (d === 0) return 10;
  if (d <= 2) return 8;
  if (d <= 4) return 6;
  if (d <= 6) return 4;
  return 0;
}
function deriveDayScores({ oe, defects }, prodRules) {
  const p = scoreByProductivity(oe, prodRules);
  const q = scoreByQuality(defects);
  const total = p + q;
  return {
    p_score: p,
    q_score: q,
    day_score: Math.min(15, total),
    overflow: Math.max(0, total - 15),
  };
}

/* ------------ Mặc định form ------------ */
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
  compliance: "NONE",
};

export default function EntryPage() {
  const { section } = useKpiSection();
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [prodRules, setProdRules] = useState([]);
  const [loading, setLoading] = useState(false);

  // Tải rule điểm sản lượng
  useEffect(() => {
    supabase
      .from("kpi_rule_productivity")
      .select("*")
      .eq("active", true)
      .eq("section", section)
      .order("threshold", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Load rules error:", error);
        setProdRules(data || []);
      });
    }, [section]);

  // Khi MSNV thay đổi -> tự điền họ tên + approver
  useEffect(() => {
    const id = form.workerId.trim();
    if (!id) {
      setForm(f => ({ ...f, workerName: "", approverId: "", approverName: "" }));
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("msnv, full_name, approver_msnv, approver_name")
        .eq("msnv", id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error(error);
        return;
      }
      if (data) {
        setForm(f => ({
          ...f,
          workerName: data.full_name || "",
          approverId: data.approver_msnv || "",
          approverName: data.approver_name || "",
        }));
      } else {
        setForm(f => ({ ...f, workerName: "", approverId: "", approverName: "" }));
      }
    })();
    return () => { cancelled = true; };
  }, [form.workerId]);

  // Tính điểm động
  const scores = useMemo(
    () => deriveDayScores({ oe: form.oe, defects: form.defects }, prodRules),
    [form.oe, form.defects, prodRules]
  );

  function handleChange(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit() {
    // Validate cơ bản
    if (!form.workerId) return alert("Nhập MSNV.");
    if (!form.approverId) return alert("Không tìm thấy Người duyệt cho MSNV này.");
    if (!form.date) return alert("Chọn ngày.");

    const now = new Date().toISOString();
    const violations = form.compliance === "NONE" ? 0 : 1;

    const payload = {
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
      oe: Number(form.oe || 0),
      compliance_code: form.compliance,

      p_score: scores.p_score,
      q_score: scores.q_score,
      day_score: scores.day_score,
      overflow: scores.overflow,
      
      section, 
      status: "pending",          // ⬅️ nhập thường: chờ duyệt
      violations,
      created_at: now,
    };

    try {
      setLoading(true);
      const { error } = await supabase.from("kpi_entries").insert([payload]);
      if (error) throw error;
      alert(`Đã gửi KPI cho ${form.workerId} – điểm ngày: ${scores.day_score}.`);
      // Giữ ngày + line/ca, reset số liệu
      setForm(f => ({
        ...f,
        workHours: 8,
        stopHours: 0,
        defects: 0,
        oe: 100,
        compliance: "NONE",
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
      <h2 className="text-xl font-bold">Nhập KPI</h2>

      <div className="grid md:grid-cols-2 gap-4">
        <label>Ngày:
          <input
            type="date"
            className="input"
            value={form.date}
            onChange={e => handleChange("date", e.target.value)}
          />
        </label>

        <label>MSNV:
          <input
            className="input"
            value={form.workerId}
            onChange={e => handleChange("workerId", e.target.value.trim())}
            placeholder="vd: 04126"
          />
        </label>

        <label>Họ & tên:
          <input className="input" value={form.workerName} readOnly />
        </label>

        <label>Người duyệt (MSNV):
          <input className="input" value={form.approverId} readOnly />
        </label>

        <label>Người duyệt (Họ tên):
          <input className="input" value={form.approverName} readOnly />
        </label>

        <label>Line làm việc:
          <select className="input" value={form.line} onChange={e => handleChange("line", e.target.value)}>
            <option value="LEAN-D1">LEAN-D1</option>
            <option value="LEAN-D2">LEAN-D2</option>
            <option value="LEAN-D3">LEAN-D3</option>
            <option value="LEAN-D4">LEAN-D4</option>
            <option value="LEAN-H1">LEAN-H1</option>
            <option value="LEAN-H2">LEAN-H2</option>
          </select>
        </label>

        <label>Ca làm việc:
          <select className="input" value={form.ca} onChange={e => handleChange("ca", e.target.value)}>
            <option value="Ca 1">Ca 1</option>
            <option value="Ca 2">Ca 2</option>
            <option value="Ca 3">Ca 3</option>
            <option value="Ca HC">Ca HC</option>
          </select>
        </label>

        <label>Giờ làm việc:
          <input
            type="number"
            className="input"
            value={form.workHours}
            onChange={e => handleChange("workHours", Number(e.target.value))}
          />
        </label>

        <label>Giờ dừng máy:
          <input
            type="number"
            className="input"
            value={form.stopHours}
            onChange={e => handleChange("stopHours", Number(e.target.value))}
          />
        </label>

        <label>Số đôi phế:
          <input
            type="number"
            className="input"
            value={form.defects}
            onChange={e => handleChange("defects", Number(e.target.value))}
          />
        </label>

        <label>%OE:
          <input
            type="number"
            className="input"
            value={form.oe}
            onChange={e => handleChange("oe", Number(e.target.value))}
          />
        </label>

        <label>Vi phạm:
          <select
            className="input"
            value={form.compliance}
            onChange={e => handleChange("compliance", e.target.value)}
          >
            <option value="NONE">Không vi phạm</option>
            <option value="LATE">Ký mẫu đầu chuyền trước khi sử dụng</option>
            <option value="PPE">Quy định về kiểm tra điều kiện máy trước/trong khi sản xuất</option>
            <option value="MAT">Quy định về kiểm tra nguyên liệu trước/trong khi sản xuất</option>
            <option value="SPEC">Quy định về kiểm tra quy cách/tiêu chuẩn sản phẩm trước/trong khi sản xuất</option>
            <option value="RULE">Vi phạm nội quy bộ phận/công ty</option>
          </select>
        </label>
      </div>

      <div className="mt-3">
        <p>Điểm Sản lượng: <b>{scores.p_score}</b></p>
        <p>Điểm Chất lượng: <b>{scores.q_score}</b></p>
        <p>Điểm KPI ngày: <b>{scores.day_score}</b></p>
        <p>Điểm dư: <b>{scores.overflow}</b></p>
      </div>

      <button
        onClick={handleSubmit}
        className="btn btn-primary mt-4"
        disabled={loading}
      >
        {loading ? "Đang lưu..." : "Gửi KPI"}
      </button>
    </div>
  );
}
