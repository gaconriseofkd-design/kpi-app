import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";

/* ======= Các hàm tính điểm dùng chung ======= */
function calcP(oe) {
  if (oe >= 112) return 10;
  if (oe >= 108) return 9;
  if (oe >= 104) return 8;
  if (oe >= 100) return 7;
  if (oe >= 98) return 6;
  if (oe >= 96) return 4;
  if (oe >= 94) return 2;
  return 0;
}
function calcQ(defects) {
  if (defects === 0) return 10;
  if (defects <= 2) return 8;
  if (defects <= 4) return 6;
  if (defects <= 6) return 4;
  return 0;
}

/* ======= Hàm tính giờ thực tế Molding ======= */
function calcWorkingReal(shift, inputHours) {
  const h = Number(inputHours || 0);
  if (h < 8) return h;
  const BASE = { "Ca 1": 7.17, "Ca 2": 7.17, "Ca 3": 6.92, "Ca HC": 6.67 };
  const base = BASE[shift] ?? 7.17;
  if (h < 9) return base;
  const extra = h - 8;
  const adj = extra >= 2 ? extra - 0.5 : extra;
  return base + adj;
}

/* ======= Component chính ======= */
export default function QuickEntry() {
  const { section } = useKpiSection();
  const isMolding = section === "MOLDING";

  // Dữ liệu nhập
  const [msnv, setMsnv] = useState("");
  const [empName, setEmpName] = useState("");
  const [approverId, setApproverId] = useState("");
  const [approverName, setApproverName] = useState("");
  const [date, setDate] = useState("");
  const [shift, setShift] = useState("");
  const [workingInput, setWorkingInput] = useState(8);
  const [category, setCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [moldHours, setMoldHours] = useState(0);
  const [defects, setDefects] = useState(0);
  const [output, setOutput] = useState(0);
  const [oe, setOe] = useState(100);
  const [compliance, setCompliance] = useState("NONE");

  // Kết quả tính
  const [qScore, setQScore] = useState(0);
  const [pScore, setPScore] = useState(0);
  const [dayScore, setDayScore] = useState(0);
  const [downtime, setDowntime] = useState(0);
  const [workingReal, setWorkingReal] = useState(0);
  const [workingExact, setWorkingExact] = useState(0);

  /* ==== Lấy category từ rule Molding ==== */
  useEffect(() => {
    if (!isMolding) return;
    supabase.from("kpi_rule_productivity")
      .select("category")
      .eq("section", "MOLDING")
      .eq("active", true)
      .then(({ data }) => {
        const list = [...new Set(data?.map(r => r.category).filter(Boolean))];
        setCategoryOptions(list);
      });
  }, [isMolding]);

  /* ==== Lấy tên & người duyệt từ MSNV ==== */
  useEffect(() => {
    if (!msnv) return;
    supabase.from("users")
      .select("msnv, full_name, approver_msnv, approver_name")
      .eq("msnv", msnv)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEmpName(data.full_name || "");
          setApproverId(data.approver_msnv || "");
          setApproverName(data.approver_name || "");
        } else {
          setEmpName(""); setApproverId(""); setApproverName("");
        }
      });
  }, [msnv]);

  /* ==== Tính điểm ==== */
  useEffect(() => {
    if (isMolding) {
      const wReal = calcWorkingReal(shift, workingInput);
      setWorkingReal(wReal);

      let dt = (wReal * 24 - moldHours) / 24;
      if (dt > 1) dt = 1; if (dt < 0) dt = 0;
      setDowntime(dt);

      const wExact = wReal - dt;
      setWorkingExact(Number(wExact.toFixed(2)));

      const q = calcQ(defects);
      setQScore(q);

      const prod = wExact > 0 ? output / wExact : 0;
      if (category && prod > 0) {
        supabase.from("kpi_rule_productivity")
          .select("threshold, score")
          .eq("section", "MOLDING")
          .eq("category", category)
          .order("threshold", { ascending: false })
          .then(({ data }) => {
            let p = 0;
            for (const r of data || []) if (prod >= r.threshold) { p = r.score; break; }
            setPScore(p);
            setDayScore(p + q);
          });
      } else {
        setPScore(0);
        setDayScore(q);
      }
    } else {
      const p = calcP(Number(oe || 0));
      const q = calcQ(Number(defects || 0));
      setPScore(p); setQScore(q); setDayScore(p + q);
    }
  }, [isMolding, oe, defects, workingInput, shift, category, moldHours, output]);

  /* ==== Lưu dữ liệu ==== */
  async function saveData() {
    if (!msnv || !date) return alert("Vui lòng nhập đủ MSNV và Ngày.");

    if (isMolding) {
      const { error } = await supabase.from("kpi_entries_molding").insert({
        section,
        date,
        ca: shift,
        worker_id: msnv,
        worker_name: empName,
        approver_msnv: approverId,
        approver_name: approverName,
        category,
        working_input: workingInput,
        working_real: workingReal,
        working_exact: workingExact,
        downtime,
        mold_hours: moldHours,
        output,
        defects,
        q_score: qScore,
        p_score: pScore,
        day_score: dayScore,
        compliance_code: compliance,
        status: "pending",
      });
      if (error) alert(error.message);
      else alert("Đã lưu KPI Molding!");
    } else {
      const { error } = await supabase.from("kpi_entries").insert({
        section,
        msnv,
        hoten: empName,
        approver_id: approverId,
        approver_name: approverName,
        work_date: date,
        shift,
        oe,
        defects,
        p_score: pScore,
        q_score: qScore,
        total_score: dayScore,
        compliance,
        status: "pending",
      });
      if (error) alert(error.message);
      else alert("Đã lưu KPI!");
    }
  }

  /* ==== Giao diện ==== */
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Nhập KPI nhanh ({section})</h2>

      {/* Nhập cơ bản */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label>MSNV</label>
          <input className="input" value={msnv} onChange={e => setMsnv(e.target.value)} />
        </div>
        <div><label>Họ tên</label>
          <input className="input" value={empName} disabled />
        </div>
        <div><label>Người duyệt</label>
          <input className="input" value={approverName} disabled />
        </div>
        <div><label>Ngày</label>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div><label>Ca</label>
          <select className="input" value={shift} onChange={e => setShift(e.target.value)}>
            <option value="">-- Chọn ca --</option>
            <option value="Ca 1">Ca 1</option>
            <option value="Ca 2">Ca 2</option>
            <option value="Ca 3">Ca 3</option>
            <option value="Ca HC">Ca HC</option>
          </select>
        </div>

        {/* Giao diện riêng cho từng section */}
        {isMolding ? (
          <>
            <div><label>Giờ làm việc (nhập)</label>
              <input type="number" className="input" value={workingInput} onChange={e => setWorkingInput(Number(e.target.value))} />
            </div>
            <div><label>Số giờ khuôn chạy thực tế</label>
              <input type="number" className="input" value={moldHours} onChange={e => setMoldHours(Number(e.target.value))} />
            </div>
            <div><label>Loại hàng</label>
              <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">-- Chọn loại hàng --</option>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label>Sản lượng / ca</label>
              <input type="number" className="input" value={output} onChange={e => setOutput(Number(e.target.value))} />
            </div>
            <div><label>Số đôi phế</label>
              <input type="number" className="input" value={defects} onChange={e => setDefects(Number(e.target.value))} />
            </div>
          </>
        ) : (
          <>
            <div><label>%OE</label>
              <input type="number" className="input" value={oe} onChange={e => setOe(Number(e.target.value))} />
            </div>
            <div><label>Số đôi phế</label>
              <input type="number" className="input" value={defects} onChange={e => setDefects(Number(e.target.value))} />
            </div>
          </>
        )}

        <div><label>Tuân thủ</label>
          <select className="input" value={compliance} onChange={e => setCompliance(e.target.value)}>
            <option value="NONE">Không vi phạm</option>
            <option value="PPE">Vi phạm PPE</option>
            <option value="LATE">Đi trễ</option>
            <option value="OTHER">Khác</option>
          </select>
        </div>
      </div>

      {/* Hiển thị điểm */}
      <div className="p-4 rounded bg-gray-50 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        {isMolding && <>
          <div><strong>Giờ thực tế:</strong><div>{workingReal}</div></div>
          <div><strong>Downtime:</strong><div>{downtime}</div></div>
          <div><strong>Giờ chính xác:</strong><div>{workingExact}</div></div>
        </>}
        <div><strong>Điểm Q:</strong><div>{qScore}</div></div>
        <div><strong>Điểm P:</strong><div>{pScore}</div></div>
        <div><strong>KPI ngày:</strong><div>{dayScore}</div></div>
      </div>

      <button className="btn btn-primary" onClick={saveData}>Lưu KPI nhanh</button>
    </div>
  );
}
