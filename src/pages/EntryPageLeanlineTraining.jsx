import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useKpiSection } from "../context/KpiSectionContext";

export default function EntryPageLeanlineTraining() {
  const { section } = useKpiSection(); // "LEANLINE_TRAINING"

  // Lấy ngày hôm nay
  const today = new Date().toISOString().slice(0, 10);

  // Form states
  const [date, setDate] = useState(today);
  const [workerId, setWorkerId] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [approverId, setApproverId] = useState("");
  const [approverName, setApproverName] = useState("");
  const [shift, setShift] = useState("Ca 1");
  const [apprenticeStage, setApprenticeStage] = useState("CHẶT ĐÔI MOLDED");
  const [workHours, setWorkHours] = useState(8);
  const [stopHours, setStopHours] = useState(0);
  const [defects, setDefects] = useState(0);
  const [output, setOutput] = useState(0);
  const [compliance, setCompliance] = useState("NONE");
  const [complianceDict, setComplianceDict] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load compliance dictionary
  useEffect(() => {
    supabase
      .from("kpi_compliance_dictionary")
      .select("*")
      .eq("section", "OTHERS")
      .eq("category", "COMPLIANCE")
      .then(({ data, error }) => {
        if (error) console.error("Lỗi tải danh mục tuân thủ:", error);
        if (data) setComplianceDict(data);
      });
  }, []);

  const getComplianceOptions = () => {
    return ["NONE", ...new Set(complianceDict.map((r) => r.content))];
  };

  // Auto-fill worker details globally from users table
  const userCache = useRef(new Map());
  useEffect(() => {
    const id = workerId.trim();
    if (!id) {
      setWorkerName("");
      setApproverId("");
      setApproverName("");
      return;
    }

    const cached = userCache.current.get(id);
    if (cached) {
      setWorkerName(cached.full_name || "");
      setApproverId(cached.approver_msnv || "");
      setApproverName(cached.approver_name || "");
      return;
    }

    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("users")
        .select("msnv, full_name, approver_msnv, approver_name")
        .eq("msnv", id)
        .maybeSingle();

      if (data) {
        userCache.current.set(id, data);
        setWorkerName(data.full_name || "");
        setApproverId(data.approver_msnv || "");
        setApproverName(data.approver_name || "");
      } else {
        setWorkerName("");
        setApproverId("");
        setApproverName("");
      }
    }, 250);

    return () => clearTimeout(t);
  }, [workerId]);

  async function findExisting(wId, dt, secKey) {
    const { data, error } = await supabase
      .from("kpi_entries")
      .select("id, status")
      .eq("worker_id", wId)
      .eq("date", dt)
      .eq("section", secKey)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    return data || null;
  }

  async function handleSubmit() {
    if (date > today) return alert("Không thể nhập KPI cho ngày trong tương lai.");
    if (!workerId) return alert("Vui lòng nhập MSNV.");
    if (!approverId) return alert("Không tìm thấy Người duyệt cho MSNV này.");
    if (!date) return alert("Vui lòng chọn ngày làm việc.");
    if (!apprenticeStage) return alert("Vui lòng chọn công đoạn đang học việc.");

    try {
      setLoading(true);
      const isUpdate = await findExisting(workerId, date, section);
      const now = new Date().toISOString();

      const payload = {
        date,
        worker_id: workerId,
        worker_name: workerName || null,
        approver_id: approverId,
        approver_name: approverName || null,
        line: "Leanline Training",
        ca: shift,
        work_hours: Number(workHours || 0),
        stop_hours: Number(stopHours || 0),
        defects: Number(defects || 0),
        output: Number(output || 0),
        category: apprenticeStage,
        compliance_code: compliance,
        section,
        status: "pending",
        created_at: now,
        p_score: 0,
        q_score: 0,
        c_score: 0,
        day_score: 0,
        overflow: 0,
      };

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
          .from("kpi_entries")
          .update(patch)
          .eq("id", isUpdate.id);
        if (upErr) throw upErr;

        alert("Đã cập nhật bản ghi học việc.");
      } else {
        const { error } = await supabase.from("kpi_entries").insert([payload]);
        if (error) throw error;
        alert(`Đã gửi thông tin học việc của ${workerId} thành công.`);
      }

      // Reset form fields
      setWorkHours(8);
      setStopHours(0);
      setDefects(0);
      setOutput(0);
      setCompliance("NONE");
    } catch (e) {
      console.error(e);
      alert("Lưu thông tin học việc lỗi: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Nhập KPI - {section}</h2>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Ngày làm việc:</label>
          <input
            type="date"
            className="input w-full"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={today}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">MSNV người nhập:</label>
          <input
            className="input w-full"
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value.trim())}
            placeholder="vd: 04126"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Họ & tên người nhập:</label>
          <input className="input w-full" value={workerName} disabled />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">MSNV người duyệt:</label>
          <input className="input w-full" value={approverId} disabled />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Họ & tên người duyệt:</label>
          <input className="input w-full" value={approverName} disabled />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Ca làm việc:</label>
          <select className="input w-full" value={shift} onChange={(e) => setShift(e.target.value)}>
            <option value="Ca 1">Ca 1</option>
            <option value="Ca 2">Ca 2</option>
            <option value="Ca 3">Ca 3</option>
            <option value="Ca HC">Ca HC</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Công đoạn đang học việc:</label>
          <select
            className="input w-full"
            value={apprenticeStage}
            onChange={(e) => setApprenticeStage(e.target.value)}
          >
            <option value="CHẶT ĐÔI MOLDED">CHẶT ĐÔI MOLDED</option>
            <option value="CHẶT ĐÔI DC">CHẶT ĐÔI DC</option>
            <option value="IN LOGO MOLDED">IN LOGO MOLDED</option>
            <option value="IN LOGO DC">IN LOGO DC</option>
            <option value="MÀI">MÀI</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Giờ làm việc:</label>
          <input
            type="number"
            className="input w-full"
            value={workHours}
            onChange={(e) => setWorkHours(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Giờ dừng máy:</label>
          <input
            type="number"
            className="input w-full"
            value={stopHours}
            onChange={(e) => setStopHours(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Số đôi phế:</label>
          <input
            type="number"
            className="input w-full"
            value={defects}
            onChange={(e) => setDefects(Number(e.target.value))}
            step="0.5"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Sản lượng (Đôi/ca):</label>
          <input
            type="number"
            className="input w-full"
            value={output}
            onChange={(e) => setOutput(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 flex items-center flex-wrap gap-1">
            Lỗi Tuân thủ:
            {(() => {
              if (!compliance || compliance === "NONE") return null;
              const item = complianceDict.find((r) => r.content === compliance);
              if (!item) return null;
              const isSevere = item.severity === "SEVERE";
              return (
                <span
                  className={`ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                    isSevere
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  } inline-flex items-center gap-1`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isSevere ? "bg-red-500" : "bg-amber-500"}`}></span>
                  {isSevere ? "Nghiêm trọng (Trừ 3đ)" : "Thường (Trừ 1đ)"}
                </span>
              );
            })()}
          </label>
          <select
            className="input w-full animate-none"
            value={compliance}
            onChange={(e) => setCompliance(e.target.value)}
          >
            {getComplianceOptions().map((opt) => (
              <option key={opt} value={opt}>
                {opt === "NONE" ? "Không vi phạm" : opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 p-4 rounded bg-gray-50 text-sm">
        <p className="text-gray-600 font-semibold italic">
          💡 Lưu ý: Bộ phận Leanline Training chỉ ghi nhận thông tin và không tính điểm KPI tự động.
        </p>
      </div>

      <button onClick={handleSubmit} className="btn btn-primary mt-4" disabled={loading}>
        {loading ? "Đang lưu..." : "Gửi KPI"}
      </button>
    </div>
  );
}
