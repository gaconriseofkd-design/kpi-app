import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";

function calcQ(defects) {
  if (defects === 0) return 10;
  if (defects <= 2) return 8;
  if (defects <= 4) return 6;
  if (defects <= 6) return 4;
  return 0;
}

export default function EntryPageMolding() {
  const { section } = useKpiSection();

  // Người nhập
  const [msnv, setMsnv] = useState("");
  const [empName, setEmpName] = useState("");

  // Người duyệt
  const [approverId, setApproverId] = useState("");
  const [approverName, setApproverName] = useState("");

  const [workDate, setWorkDate] = useState("");
  const [shift, setShift] = useState("");
  const [workingInput, setWorkingInput] = useState(8);
  const [category, setCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [moldHours, setMoldHours] = useState(0);
  const [defects, setDefects] = useState(0);
  const [output, setOutput] = useState(0);
  const [compliance, setCompliance] = useState("OK");

  const [scoreQ, setScoreQ] = useState(0);
  const [scoreP, setScoreP] = useState(0);
  const [scoreTotal, setScoreTotal] = useState(0);
  const [downtime, setDowntime] = useState(0);
  const [workingExact, setWorkingExact] = useState(0);

  // Lấy danh sách Category
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

  // Khi nhập MSNV → lấy Họ tên và người duyệt
  useEffect(() => {
    if (!msnv) return;
    supabase
      .from("users")   // bảng quản lý Users (trang AdminPage)
      .select("msnv, full_name, approver_id, approver_name")
      .eq("msnv", msnv)
      .single()
      .then(({ data }) => {
        if (data) {
          setEmpName(data.full_name);
          setApproverId(data.approver_id);
          setApproverName(data.approver_name);
        } else {
          setEmpName("");
          setApproverId("");
          setApproverName("");
        }
      });
  }, [msnv]);

  // Tính toán điểm
  useEffect(() => {
    let workingReal = Number(workingInput) || 0;
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
      hoten: empName,
      approver_id: approverId,
      approver_name: approverName,
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
          <label>MSNV Người nhập</label>
          <input className="input" value={msnv} onChange={e => setMsnv(e.target.value)} />
        </div>
        <div>
          <label>Họ tên Người nhập</label>
          <input className="input" value={empName} disabled />
        </div>

        <div>
          <label>MSNV Người duyệt</label>
          <input className="input" value={approverId} disabled />
        </div>
        <div>
          <label>Họ tên Người duyệt</label>
          <input className="input" value={approverName} disabled />
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
