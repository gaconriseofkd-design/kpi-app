// src/pages/EntryPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";

/* ================= Helpers & Scoring ================= */

// Định nghĩa các section Hybrid
const HYBRID_SECTIONS = ["LAMINATION", "PREFITTING", "BÀO", "TÁCH"];
const isHybridSection = (sectionKey) => HYBRID_SECTIONS.includes(sectionKey);

// Xác định bảng mục tiêu để lưu
const getTableName = (sectionKey) => 
  isHybridSection(sectionKey) ? "kpi_LPS_entries" : "kpi_entries";

function scoreByQuality(defects) {
  const d = Number(defects || 0);
  if (d === 0) return 10;
  if (d <= 2) return 8;
  if (d <= 4) return 6;
  if (d <= 6) return 4;
  return 0;
}

// Logic cho Leanline tiêu chuẩn (chỉ dùng %OE, không cần Category)
function scoreByProductivityLeanline(oe, allRules) {
  const val = Number(oe ?? 0);
  const list = (allRules || [])
    .filter(r => r.active !== false && !r.category)
    .sort((a, b) => Number(b.threshold) - Number(a.threshold));
  for (const r of list) {
    if (val >= Number(r.threshold)) return Number(r.score || 0);
  }
  return 0;
}

// Logic cho các Section Hybrid (dùng Production Rate + Category)
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

// Logic tính điểm KPI ngày cốt lõi
function deriveDayScores({ section, oe, defects, category, output, workHours, stopHours }, prodRules) {
  const isHybrid = isHybridSection(section);
  const q = scoreByQuality(defects);
  let p = 0;
  let prodRate = 0; // Tỷ lệ năng suất (có thể là OE hoặc Prod Rate)

  if (isHybrid) {
    // 1. Tính Giờ làm việc chính xác (tương tự Leanline)
    const exactHours = Math.max(0, Number(workHours || 0) - Number(stopHours || 0));
    // 2. Tính Tỷ lệ Sản lượng (Output/Giờ chính xác)
    prodRate = exactHours > 0 ? Number(output || 0) / exactHours : 0;
    
    // 3. Chấm điểm P bằng logic Hybrid (Category + ProdRate)
    p = scoreByProductivityHybrid(prodRate, category, prodRules);

  } else {
    // 1. Tỷ lệ Sản lượng là %OE cho Leanline
    prodRate = Number(oe || 0);

    // 2. Chấm điểm P bằng logic Leanline (chỉ dùng OE)
    p = scoreByProductivityLeanline(prodRate, prodRules);
  }

  const total = p + q;
  return {
    p_score: p,
    q_score: q,
    day_score: Math.min(15, total),
    overflow: Math.max(0, total - 15),
    prodRate: prodRate,
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
  // Leanline fields
  oe: 100,
  // Hybrid fields
  output: 0, 
  category: "", 
  // Common field
  compliance: "NONE",
};

export default function EntryPage() {
  const { section } = useKpiSection();
  const isHybrid = isHybridSection(section);
  const tableName = getTableName(section); // Tên bảng mục tiêu
  
  const [form, setForm] = useState({ ...DEFAULT_FORM });

  const [prodRules, setProdRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([]);


  // ====== tải rule theo section ======
  useEffect(() => {
    // Logic tải Rules... (Giữ nguyên)
    let cancelled = false;
    setForm(f => ({ ...DEFAULT_FORM, date: f.date })); 

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
        
        if (isHybridSection(section)) {
            const opts = [...new Set((data || []).map(r => r.category).filter(Boolean))].sort();
            setCategoryOptions(opts);
        } else {
            setCategoryOptions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section]);

  // ====== auto fill họ tên + approver từ bảng users (Giữ nguyên) ======
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

  // ====== tính điểm động (Giữ nguyên) ======
  const scores = useMemo(
    () => deriveDayScores({ section, oe: form.oe, defects: form.defects, category: form.category, output: form.output, workHours: form.workHours, stopHours: form.stopHours }, prodRules),
    [section, form.oe, form.defects, form.category, form.output, form.workHours, form.stopHours, prodRules]
  );

  function handleChange(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  // ====== kiểm tra trùng (worker_id, date, section) ======
  async function findExisting(workerId, date, sectionKey) {
    const table = getTableName(sectionKey); // Dùng tên bảng động
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
    // ... (Kiểm tra dữ liệu đầu vào - Giữ nguyên)
    if (!form.workerId) return alert("Nhập MSNV.");
    if (!form.approverId) return alert("Không tìm thấy Người duyệt cho MSNV này.");
    if (!form.date) return alert("Chọn ngày.");
    if (isHybrid && !form.category) return alert("Vui lòng chọn Loại năng suất (Category).");

    const now = new Date().toISOString();
    const violations = form.compliance === "NONE" ? 0 : 1;
    const isUpdate = await findExisting(form.workerId, form.date, section);

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
      compliance_code: form.compliance,

      // Dữ liệu tùy thuộc vào loại Section
      oe: isHybrid ? null : Number(form.oe || 0),
      output: isHybrid ? Number(form.output || 0) : null,
      category: isHybrid ? form.category : null,
      
      p_score: scores.p_score,
      q_score: scores.q_score,
      day_score: scores.day_score,
      overflow: scores.overflow,

      section,
      status: "pending", 
      violations,
      created_at: now,
    };

    try {
      setLoading(true);

      if (isUpdate) {
        // Cập nhật
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
          .from(tableName) // Dùng tên bảng động
          .update(patch)
          .eq("id", isUpdate.id);
        if (upErr) throw upErr;

        alert("Đã cập nhật bản ghi.");
      } else {
        // Insert mới
        const { error } = await supabase.from(tableName).insert([payload]); // Dùng tên bảng động
        if (error) throw error;
        alert(`Đã gửi KPI cho ${form.workerId} – điểm ngày: ${scores.day_score}.`);
      }

      // Reset số liệu... (Giữ nguyên)
      setForm((f) => ({
        ...f,
        workHours: 8,
        stopHours: 0,
        defects: 0,
        oe: isHybrid ? DEFAULT_FORM.oe : 100,
        output: isHybrid ? DEFAULT_FORM.output : 0,
        compliance: "NONE",
      }));
    } catch (e) {
      console.error(e);
      alert("Lưu KPI lỗi: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  // ... (Giao diện JSX - Giữ nguyên)
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
          />
        </label>

        <label>MSNV:
          <input
            className="input"
            value={form.workerId}
            onChange={(e) => handleChange("workerId", e.target.value.trim())}
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
          <select
            className="input"
            value={form.line}
            onChange={(e) => handleChange("line", e.target.value)}
          >
            <option value="LEAN-D1">LEAN-D1</option>
            <option value="LEAN-D2">LEAN-D2</option>
            <option value="LEAN-D3">LEAN-D3</option>
            <option value="LEAN-D4">LEAN-D4</option>
            <option value="LEAN-H1">LEAN-H1</option>
            <option value="LEAN-H2">LEAN-H2</option>
          </select>
        </label>

        <label>Ca làm việc:
          <select
            className="input"
            value={form.ca}
            onChange={(e) => handleChange("ca", e.target.value)}
          >
            <option value="Ca 1">Ca 1</option>
            <option value="Ca 2">Ca 2</option>
            <option value="Ca 3">Ca 3</option>
            <option value="Ca HC">Ca HC</option>
          </select>
        </label>
        
        {/* INPUT CHO TẤT CẢ SECTIONS (LEANLINE & HYBRID) */}
        <label>Giờ làm việc:
          <input
            type="number"
            className="input"
            value={form.workHours}
            onChange={(e) => handleChange("workHours", Number(e.target.value))}
          />
        </label>

        <label>Giờ dừng máy:
          <input
            type="number"
            className="input"
            value={form.stopHours}
            onChange={(e) => handleChange("stopHours", Number(e.target.value))}
          />
        </label>
        
        <label>Số đôi phế:
          <input
            type="number"
            className="input"
            value={form.defects}
            onChange={(e) => handleChange("defects", Number(e.target.value))}
          />
        </label>
        
        {/* INPUT TÙY CHỌN: HYBRID vs LEANLINE */}
        {isHybrid ? (
            <>
            <label>Loại năng suất (Category):
                <select
                    className="input"
                    value={form.category}
                    onChange={(e) => handleChange("category", e.target.value)}
                >
                    <option value="">-- Chọn loại --</option>
                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </label>
            <label>Sản lượng (Output):
                <input
                    type="number"
                    className="input"
                    value={form.output}
                    onChange={(e) => handleChange("output", Number(e.target.value))}
                />
            </label>
            </>
        ) : (
            <label>%OE:
                <input
                    type="number"
                    className="input"
                    value={form.oe}
                    onChange={(e) => handleChange("oe", Number(e.target.value))}
                />
            </label>
        )}

        <label>Vi phạm:
          <select
            className="input"
            value={form.compliance}
            onChange={(e) => handleChange("compliance", e.target.value)}
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

      <div className="mt-3 p-4 rounded bg-gray-50">
        <p>Giờ chính xác: <b>{Math.max(0, Number(form.workHours || 0) - Number(form.stopHours || 0))}</b></p>
        {isHybrid && (
            <p>Tỷ lệ năng suất: <b>{scores.prodRate.toFixed(2)}</b></p>
        )}
        <p>Điểm Sản lượng (P): <b>{scores.p_score}</b></p>
        <p>Điểm Chất lượng (Q): <b>{scores.q_score}</b></p>
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