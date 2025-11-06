import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";

/** Quy đổi giờ làm việc thực tế từ giờ nhập + ca làm việc (mô phỏng bảng Choose section list)
 * Excel: =IF(G4<8,G4, IF(G4<9, VLOOKUP(C5, S:AM,16,0),
 * VLOOKUP(C5,S:AM,16,0) + IF((G4-8)>=2, G4-8-0.5, G4-8)))
 */
function calcWorkingReal(shift, inputHours) {
  const h = Number(inputHours || 0);
  if (h < 8) return h;

  // base theo ca (từ ảnh bảng bạn gửi)
  const BASE_BY_SHIFT = {
    "Ca 1": 7.17,
    "Ca 2": 7.17,
    "Ca 3": 6.92,
    "Ca HC": 6.67,
  };
  const base = BASE_BY_SHIFT[shift] ?? 7.17;

  if (h < 9) return base;

  const extra = h - 8;
  const adj = extra >= 2 ? extra - 0.5 : extra; // trừ 0.5 nếu OT >= 2
  return base + adj;
}

function calcQ(defects) {
  const d = Number(defects || 0);
  if (d === 0) return 10;
  if (d <= 2) return 8;
  if (d <= 4) return 6;
  if (d <= 6) return 4;
  return 0;
}

export default function EntryPageMolding() {
  const { section } = useKpiSection(); // sẽ là "MOLDING"

  // Lấy ngày hôm nay
  const today = new Date().toISOString().slice(0, 10);

  // Người nhập
  const [workerId, setWorkerId] = useState("");
  const [workerName, setWorkerName] = useState("");

  // Người duyệt
  const [approverId, setApproverId] = useState("");
  const [approverName, setApproverName] = useState("");

  // Form cơ bản
  const [date, setDate] = useState(today); // Đặt ngày mặc định là hôm nay
  const [shift, setShift] = useState("");
  const [inputHours, setInputHours] = useState(8);

  // Molding-only
  const [category, setCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [moldHours, setMoldHours] = useState(0);     // số giờ khuôn chạy thực tế
  const [defects, setDefects] = useState(0);
  const [output, setOutput] = useState(0);           // sản lượng/ca
  const [complianceCode, setComplianceCode] = useState("NONE"); // NONE/...

  // Kết quả tính
  const workingReal = useMemo(() => calcWorkingReal(shift, inputHours), [shift, inputHours]);
  const downtime = useMemo(() => {
    const dt = (Number(workingReal) * 24 - Number(moldHours || 0)) / 24;
    if (dt > 1) return 1;
    if (dt < 0) return 0;
    return Number(dt.toFixed(2));
  }, [workingReal, moldHours]);

  const workingExact = useMemo(() => Number((Number(workingReal) - Number(downtime)).toFixed(2)), [workingReal, downtime]);

  // Load dropdown Loại hàng từ rule MOLDING
  useEffect(() => {
    supabase
      .from("kpi_rule_productivity")
      .select("category")
      .eq("section", "MOLDING")
      .eq("active", true)
      .then(({ data, error }) => {
        if (error) { console.error(error); return; }
        const opts = [...new Set((data || []).map(r => r.category).filter(Boolean))];
        setCategoryOptions(opts);
      });
  }, []);

  // Khi nhập MSNV → đọc từ bảng users đúng cột: msnv, full_name, approver_msnv, approver_name
  useEffect(() => {
    const id = workerId.trim();
    if (!id) { setWorkerName(""); setApproverId(""); setApproverName(""); return; }
    supabase
      .from("users")
      .select("msnv, full_name, approver_msnv, approver_name")
      .eq("msnv", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error(error); return; }
        if (data) {
          setWorkerName(data.full_name || "");
          setApproverId(data.approver_msnv || "");
          setApproverName(data.approver_name || "");
        } else {
          setWorkerName("");
          setApproverId("");
          setApproverName("");
        }
      });
  }, [workerId]);

  // Điểm Q
  const qScore = useMemo(() => calcQ(defects), [defects]);

  // Điểm P (dò theo rule: category + pairs/hour)
  const [pScore, setPScore] = useState(0);
  useEffect(() => {
    const prod = workingExact > 0 ? Number(output || 0) / workingExact : 0; // pair/h
    if (!category || prod <= 0) { setPScore(0); return; }

    supabase
      .from("kpi_rule_productivity")
      .select("threshold, score")
      .eq("section", "MOLDING")
      .eq("category", category)
      .eq("active", true)
      .order("threshold", { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error(error); setPScore(0); return; }
        let p = 0;
        for (const r of (data || [])) {
          if (prod >= Number(r.threshold)) { p = Number(r.score); break; }
        }
        setPScore(p);
      });
  }, [category, output, workingExact]);

  const dayTotal = Math.min(15, pScore + qScore);
  const overflow = Math.max(0, pScore + qScore - 15);

  async function saveEntry() {
    // THÊM KIỂM TRA NGÀY
    if (date > today) {
      return alert("Không thể nhập KPI cho ngày trong tương lai.");
    }

    if (!workerId || !date || !shift || !category) {
      alert("Vui lòng nhập đủ: MSNV, Ngày, Ca, Loại hàng.");
      return;
    }

    const payload = {
      // khóa định danh
      section,                             // "MOLDING"
      date,                                // yyyy-mm-dd
      ca: shift,

      // người nhập & duyệt
      worker_id: workerId,
      worker_name: workerName,
      approver_msnv: approverId,
      approver_name: approverName,

      // molding fields
      category,                            // cột mới
      
      working_input: Number(inputHours || 0),
      working_real: Number(workingReal || 0),
      working_exact: Number(workingExact || 0),
      downtime: Number(downtime || 0),
      mold_hours: Number(moldHours || 0),
      output: Number(output || 0),         // sản lượng/ca
      defects: Number(defects || 0),       // Gửi số phế

      // điểm
      q_score: qScore,
      p_score: pScore,
      day_score: dayTotal,
      overflow,

      // tuân thủ
      compliance_code: complianceCode,
      violations: complianceCode === "NONE" ? 0 : 1,
    
      status: "pending",
    };

    const { error } = await supabase.from("kpi_entries_molding").upsert(payload, {
      onConflict: "worker_id,date,section",
    });
    if (error) return alert("Lưu lỗi: " + error.message);
    alert("Đã lưu KPI Molding (pending).");
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Nhập KPI - Molding</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        // pages/EntryPageMolding.jsx
        
        <div>
          <label>MSNV người nhập</label>
          <input className="input" value={workerId} onChange={e => setWorkerId(e.target.value.trim())} />
        </div>
        <div>
          <label>Họ & tên người nhập</label>
          <input className="input" value={workerName} disabled />
        </div>

        <div>
          <label>MSNV người duyệt</label>
          <input className="input" value={approverId} disabled />
        </div>
        <div>
          <label>Họ & tên người duyệt</label>
          <input className="input" value={approverName} disabled />
        </div>

        <div>
          <label>Ngày làm việc</label>
          <input 
            type="date" 
            className="input" 
            value={date} 
            onChange={e => setDate(e.target.value)} 
            max={today} // THÊM THUỘC TÍNH MAX
          />
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
          <label>Giờ làm việc (người nhập)</label>
          <input type="number" className="input" value={inputHours} onChange={e => setInputHours(e.target.value)} />
        </div>
        <div>
          <label>Số giờ khuôn chạy thực tế</label>
          <input type="number" className="input" value={moldHours} onChange={e => setMoldHours(e.target.value)} />
        </div>

        <div>
          <label>Loại hàng</label>
          <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">-- Chọn loại hàng --</option>
            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label>Sản lượng / ca</label>
          <input type="number" className="input" value={output} onChange={e => setOutput(e.target.value)} />
        </div>

        <div>
          <label>Số đôi phế</label>
          <input 
            type="number" 
            className="input" 
            value={defects} 
            onChange={e => setDefects(e.target.value)} 
            step="0.5" // <-- THÊM BƯỚC NÀY
          />
        </div>
        <div>
          <label>Tuân thủ</label>
          <select className="input" value={complianceCode} onChange={e => setComplianceCode(e.target.value)}>
            <option value="NONE">Không vi phạm</option>
            <option value="LATE">Ký mẫu đầu chuyền trước khi sử dụng</option>
            <option value="PPE">Quy định về kiểm tra điều kiện máy trước/trong khi sản xuất</option>
            <option value="MAT">Quy định về kiểm tra nguyên liệu trước/trong khi sản xuất</option>
            <option value="SPEC">Quy định về kiểm tra quy cách/tiêu chuẩn sản phẩm trước/trong khi sản xuất</option>
            <option value="RULE">Vi phạm nội quy bộ phận/công ty</option>
          </select>
        </div>
      </div>

      <div className="p-4 rounded bg-gray-50 space-y-1 text-sm">
        <div>Giờ thực tế (quy đổi): <b>{workingReal}</b></div>
        <div>Thời gian dừng /24 khuôn (h): <b>{downtime}</b></div>
        <div>Giờ làm việc chính xác: <b>{workingExact}</b></div>
        <div>Điểm chất lượng (Q): <b>{qScore}</b></div>
        <div>Điểm sản lượng (P): <b>{pScore}</b></div>
        <div>Điểm KPI ngày: <b>{dayTotal}</b> &nbsp; (Điểm dư: <b>{overflow}</b>)</div>
      </div>

      <button className="btn btn-primary" onClick={saveEntry}>Lưu KPI</button>
    </div>
  );
}