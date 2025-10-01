import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

function useDebounce(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
}

export default function EntryPage() {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    workerId: "", workerName: "",
    approverId: "", approverName: "",
    line: "LEAN-D1", ca: "Ca 1",
    workHours: 8, stopHours: 0,
    defects: 0, oe: 100,
    compliance: "NONE",
  });
  const [isLookup, setIsLookup] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const debouncedWorkerId = useDebounce((form.workerId || "").trim());

  // Tra người dùng theo MSNV (public.users)
  useEffect(() => {
    const id = debouncedWorkerId;
    if (!id) { setNotFound(false); setForm(f => ({ ...f, workerName:"", approverId:"", approverName:"" })); return; }
    let cancelled = false;
    (async () => {
      try {
        setIsLookup(true); setNotFound(false);
        const { data, error } = await supabase
          .from("users")
          .select("msnv, full_name, approver_msnv, approver_name")
          .eq("msnv", id)
          .maybeSingle();
        if (cancelled) return;
        if (error) { console.error(error); return; }
        if (data) {
          setForm(f => ({
            ...f,
            workerName: data.full_name || "",
            approverId: data.approver_msnv || "",
            approverName: data.approver_name || "",
          }));
          setNotFound(false);
        } else {
          setForm(f => ({ ...f, workerName:"", approverId:"", approverName:"" }));
          setNotFound(true);
        }
      } finally { if (!cancelled) setIsLookup(false); }
    })();
    return () => { cancelled = true; };
  }, [debouncedWorkerId]);

  function handleChange(key, val) { setForm(f => ({ ...f, [key]: val })); }

  // Tính điểm
  function calcProductivityScore(oe) {
    if (oe >= 112) return 10; if (oe >= 108) return 9; if (oe >= 104) return 8;
    if (oe >= 100) return 7;  if (oe >= 98)  return 6; if (oe >= 96)  return 4;
    if (oe >= 94)  return 2;  return 0;
  }
  function calcQualityScore(defects) {
    if (defects === 0) return 10; if (defects <= 2) return 8;
    if (defects <= 4)  return 6;  if (defects <= 6) return 4; return 0;
  }

  const pScore = calcProductivityScore(form.oe);
  const qScore = calcQualityScore(form.defects);
  const raw = pScore + qScore;
  const dayScore = Math.min(15, raw);
  const overflow = Math.max(0, raw - 15);

  async function handleSubmit() {
    if (!form.workerId) return alert("Vui lòng nhập MSNV.");
    if (notFound) return alert("MSNV không tồn tại trong danh sách nhân viên.");
    try {
      setSaving(true);
      const payload = {
        date: form.date,
        worker_id: form.workerId,
        worker_name: form.workerName,
        approver_id: form.approverId,
        approver_name: form.approverName,
        line: form.line,
        ca: form.ca,
        work_hours: form.workHours,
        stop_hours: form.stopHours,
        defects: form.defects,
        oe: form.oe,
        compliance_code: form.compliance,
        p_score: pScore,
        q_score: qScore,
        day_score: dayScore,
        overflow,
        status: "pending",
      };
      const { data, error } = await supabase
        .from("kpi.kpi_entries")
        .insert([payload])
        .select("id");
      if (error) throw error;
      alert(`Đã gửi KPI cho ${form.workerId} – Điểm ngày: ${dayScore} (ID: ${data?.[0]?.id})`);
      // Tuỳ ý: reset form về mặc định
      // setForm(f => ({ ...f, defects:0, oe:100, compliance:"NONE" }));
    } catch (e) {
      console.error(e);
      alert("Lưu KPI lỗi: " + (e.message || e));
    } finally { setSaving(false); }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Nhập KPI</h2>

      <div className="grid md:grid-cols-2 gap-4">
        <label>Ngày:
          <input type="date" className="inp" value={form.date} onChange={e => handleChange("date", e.target.value)} />
        </label>

        <label>MSNV:
          <input className="inp" value={form.workerId} onChange={e => handleChange("workerId", e.target.value)} />
          {isLookup && <span className="text-sm text-gray-500 ml-2">đang tra…</span>}
          {notFound && !isLookup && form.workerId && <span className="text-sm text-red-600 ml-2">không tìm thấy</span>}
        </label>

        <label>Họ tên:
          <input className="inp" value={form.workerName} onChange={e => handleChange("workerName", e.target.value)} placeholder="Tự điền theo MSNV hoặc nhập tay" />
        </label>

        <label>Người duyệt (MSNV):
          <input className="inp" value={form.approverId} onChange={e => handleChange("approverId", e.target.value)} />
        </label>

        <label>Người duyệt (Họ tên):
          <input className="inp" value={form.approverName} onChange={e => handleChange("approverName", e.target.value)} />
        </label>

        <label>Line làm việc:
          <select className="inp" value={form.line} onChange={e => handleChange("line", e.target.value)}>
            <option value="LEAN-D1">LEAN-D1</option>
            <option value="LEAN-D2">LEAN-D2</option>
          </select>
        </label>

        <label>Ca làm việc:
          <select className="inp" value={form.ca} onChange={e => handleChange("ca", e.target.value)}>
            <option value="Ca 1">Ca 1</option>
            <option value="Ca 2">Ca 2</option>
            <option value="Ca 3">Ca 3</option>
          </select>
        </label>

        <label>Giờ làm việc:
          <input type="number" className="inp" value={form.workHours} onChange={e => handleChange("workHours", Number(e.target.value))} />
        </label>

        <label>Giờ dừng máy:
          <input type="number" className="inp" value={form.stopHours} onChange={e => handleChange("stopHours", Number(e.target.value))} />
        </label>

        <label>Số đôi phế:
          <input type="number" className="inp" value={form.defects} onChange={e => handleChange("defects", Number(e.target.value))} />
        </label>

        <label>%OE:
          <input type="number" className="inp" value={form.oe} onChange={e => handleChange("oe", Number(e.target.value))} />
        </label>

        <label>Vi phạm:
          <select className="inp" value={form.compliance} onChange={e => handleChange("compliance", e.target.value)}>
            <option value="NONE">Không vi phạm</option>
            <option value="LATE">Đi trễ / Về sớm</option>
            <option value="PPE">Vi phạm PPE</option>
            <option value="5S">Vi phạm 5S</option>
          </select>
        </label>
      </div>

      <div className="mt-4">
        <p>Điểm Sản lượng: {pScore}</p>
        <p>Điểm Chất lượng: {qScore}</p>
        <p>Điểm KPI ngày: {dayScore}</p>
        <p>Điểm dư: {overflow}</p>
      </div>

      <button onClick={handleSubmit} disabled={saving} className="mt-4 px-4 py-2 rounded bg-green-600 text-white">
        {saving ? "Đang lưu..." : "Gửi KPI"}
      </button>
    </div>
  );
}
