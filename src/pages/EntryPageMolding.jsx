import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";

// Tính điểm chất lượng (Q)
function calcQ(defects) {
  if (defects === 0) return 10;
  if (defects <= 2) return 8;
  if (defects <= 4) return 6;
  if (defects <= 6) return 4;
  return 0;
}

export default function EntryPageMolding() {
  const { section } = useKpiSection();
  const [msnv, setMsnv] = useState("");
  const [employee, setEmployee] = useState(null);
  const [workDate, setWorkDate] = useState("");
  const [shift, setShift] = useState("");
  const [workingInput, setWorkingInput] = useState(8); // số giờ nhập ban đầu
  const [category, setCategory] = useState(""); // Loại hàng
  const [moldHours, setMoldHours] = useState(0); // số giờ khuôn chạy thực tế
  const [defects, setDefects] = useState(0);
  const [output, setOutput] = useState(0);
  const [compliance, setCompliance] = useState("OK");

  const [scoreQ, setScoreQ] = useState(0);
  const [scoreP, setScoreP] = useState(0);
  const [scoreTotal, setScoreTotal] = useState(0);
  const [downtime, setDowntime] = useState(0);
  const [workingExact, setWorkingExact] = useState(0);

  // Load tên NV từ MSNV
  useEffect(() => {
    if (!msnv) return;
    supabase.from("employees").select("*").eq("msnv", msnv).single().then(({ data }) => {
      setEmployee(data);
    });
  }, [msnv]);

  // Tính toán khi có dữ liệu
  useEffect(() => {
    // 1. Thời gian làm việc thực tế (ví dụ lấy theo shift từ bảng Choose section list)
    let workingReal = Number(workingInput) || 0;

    // 2. Thời gian dừng
    let dt = (workingReal * 24 - moldHours) / 24;
    if (dt > 1) dt = 1;
    if (dt < 0) dt = 0;
    setDowntime(dt);

    // 3. Thời gian chính xác
    let wExact = workingReal - dt;
    setWorkingExact(wExact);

    // 4. Năng suất = sản lượng/ca / thời gian chính xác
    let prod = wExact > 0 ? output / wExact : 0;

    // 5. Điểm chất lượng
    let q = calcQ(defects);
    setScoreQ(q);

    // 6. Điểm sản lượng: dò rule trong DB
    if (category && prod > 0) {
      supabase
        .from("kpi_rule_productivity")
        .select("threshold,score")
        .eq("section", "MOLDING")
        .eq("category", category)
        .order("threshold", { ascending: false })
        .then(({ data }) => {
          let p = 0;
          for (const r of data) {
            if (prod >= r.threshold) {
              p = r.score;
              break;
            }
          }
          setScoreP(p);
          setScoreTotal(p + q);
        });
    } else {
      setScoreP(0);
      setScoreTotal(q);
    }
  }, [workingInput, moldHours, output, defects, category]);

  // Save KPI entry
  async function saveEntry() {
    const { error } = await supabase.from("kpi_entries").insert({
      section,
      msnv,
      hoten: employee?.name || "",
      shift,
      work_date: workDate,
      working_input: workingInput,
      working_real: workingInput,
      working_exact: workingExact,
      downtime,
      category,
      mold_hours: moldHours,
      defects,
      output,
      compliance,
      score_q: scoreQ,
      score_p: scoreP,
      score_total: scoreTotal,
    });
    if (error) alert(error.message);
    else alert("Đã lưu KPI Molding");
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Nhập KPI - Molding</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input className="input" placeholder="MSNV" value={msnv} onChange={e => setMsnv(e.target.value)} />
        <input className="input" placeholder="Họ tên" value={employee?.name || ""} disabled />

        <input type="date" className="input" value={workDate} onChange={e => setWorkDate(e.target.value)} />
        <select className="input" value={shift} onChange={e => setShift(e.target.value)}>
          <option value="">-- Ca làm việc --</option>
          <option value="Ca 1">Ca 1</option>
          <option value="Ca 2">Ca 2</option>
          <option value="Ca 3">Ca 3</option>
          <option value="Ca HC">Ca HC</option>
        </select>

        <input type="number" className="input" placeholder="Giờ làm việc (nhập)" value={workingInput} onChange={e => setWorkingInput(Number(e.target.value))} />
        <input type="number" className="input" placeholder="Số giờ khuôn chạy thực tế" value={moldHours} onChange={e => setMoldHours(Number(e.target.value))} />

        <input className="input" placeholder="Loại hàng (Category)" value={category} onChange={e => setCategory(e.target.value)} />
        <input type="number" className="input" placeholder="Sản lượng/ca" value={output} onChange={e => setOutput(Number(e.target.value))} />

        <input type="number" className="input" placeholder="Số đôi phế" value={defects} onChange={e => setDefects(Number(e.target.value))} />
        <select className="input" value={compliance} onChange={e => setCompliance(e.target.value)}>
          <option value="OK">Không vi phạm</option>
          <option value="VIOLATION">Vi phạm</option>
        </select>
      </div>

      <div className="p-4 rounded bg-gray-50 space-y-2">
        <div>Điểm chất lượng (Q): {scoreQ}</div>
        <div>Điểm sản lượng (P): {scoreP}</div>
        <div>Điểm KPI ngày (Q+P): {scoreTotal}</div>
        <div>Thời gian dừng /24 khuôn (h): {downtime}</div>
        <div>Thời gian làm việc chính xác: {workingExact}</div>
      </div>

      <button className="btn btn-primary" onClick={saveEntry}>Lưu KPI</button>
    </div>
  );
}
