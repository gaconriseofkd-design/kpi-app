import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";

// Điểm chất lượng (Q)
function calcQ(defects) {
  if (defects === 0) return 10;
  if (defects <= 2) return 8;
  if (defects <= 4) return 6;
  if (defects <= 6) return 4;
  return 0;
}

export default function EntryPageMolding() {
  const { section } = useKpiSection();

  // Form fields
  const [msnv, setMsnv] = useState("");
  const [employee, setEmployee] = useState(null);
  const [approver, setApprover] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [shift, setShift] = useState("");
  const [workingInput, setWorkingInput] = useState(8);
  const [category, setCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [moldHours, setMoldHours] = useState(0);
  const [defects, setDefects] = useState(0);
  const [output, setOutput] = useState(0);
  const [compliance, setCompliance] = useState("OK");

  // Results
  const [scoreQ, setScoreQ] = useState(0);
  const [scoreP, setScoreP] = useState(0);
  const [scoreTotal, setScoreTotal] = useState(0);
  const [downtime, setDowntime] = useState(0);
  const [workingExact, setWorkingExact] = useState(0);

  // Load danh sách Category từ rule MOLDING
  useEffect(() => {
    supabase
      .from("kpi_rule_productivity")
      .select("category")
      .eq("section", "MOLDING")
      .then(({ data }) => {
        const list = [...new Set(data.map(d => d.category).filter(Boolean))];
        setCategoryOptions(list);
      });
  }, []);

  // Load nhân viên khi nhập MSNV
  useEffect(() => {
    if (!msnv) return;
    supabase
      .from("employees")
      .select("name, approver")
      .eq("msnv", msnv)
      .single()
      .then(({ data }) => {
        setEmployee(data || null);
        setApprover(data?.approver || "");
      });
  }, [msnv]);

  // Tính toán tự động
  useEffect(() => {
    let workingReal = Number(workingInput) || 0;

    // Downtime
    let dt = (workingReal * 24 - moldHours) / 24;
    if (dt > 1) dt = 1;
    if (dt < 0) dt = 0;
    setDowntime(dt);

    let wExact = workingReal - dt;
    setWorkingExact(wExact);

    let prod = wExact > 0 ? output / wExact : 0;

    let q = calcQ(defects);
    setScoreQ(q);

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

  async function saveEntry() {
    const { error } = await supabase.from("kpi_entries").insert({
      section,
      msnv,
      hoten: employee?.name || "",
      approver,
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
        <div>
          <label>MSNV</label>
          <input className="input" value={msnv} onChange={e => setMsnv(e.target.value)} />
        </div>
        <div>
          <label>Họ tên</label>
          <input className="input" value={employee?.name || ""} disabled />
        </div>

        <div>
          <label>Người duyệt</label>
          <input className="input" value={approver} disabled />
        </div>

        <div>
          <label>Ngày làm việc</label>
          <input type="date" className="input" value={workDate} onChange={e => setWorkDate(e.target.value)} />
        </div>

        <div>
          <label>Ca làm việc</label>
          <select className="input" value={shift} onChange={e => setShift(e.target.value)}>
            <option value="">-- Chọn ca --</option>
            <option value="Ca 1">Ca 1</option>
            <option value="Ca 2">Ca 2</option>
            <option value="Ca 3">Ca 3</option>
            <option value="Ca HC">Ca HC</option>
          </select>
        </div>

        <div>
          <label>Giờ làm việc (nhập)</label>
          <input type="number" className="input" value={workingInput} onChange={e => setWorkingInput(Number(e.target.value))} />
        </div>

        <div>
          <label>Số giờ khuôn chạy thực tế</label>
          <input type="number" className="input" value={moldHours} onChange={e => setMoldHours(Number(e.target.value))} />
        </div>

        <div>
          <label>Loại hàng (Category)</label>
          <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">-- Chọn loại hàng --</option>
            {categoryOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Sản lượng / ca</label>
          <input type="number" className="input" value={output} onChange={e => setOutput(Number(e.target.value))} />
        </div>

        <div>
          <label>Số đôi phế</label>
          <input type="number" className="input" value={defects} onChange={e => setDefects(Number(e.target.value))} />
        </div>

        <div>
          <label>Tuân thủ</label>
          <select className="input" value={compliance} onChange={e => setCompliance(e.target.value)}>
            <option value="OK">Không vi phạm</option>
            <option value="VIOLATION">Vi phạm</option>
          </select>
        </div>
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
