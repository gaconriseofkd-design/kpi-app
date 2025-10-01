import { useState, useEffect } from "react";

// Giả sử user list sẽ lấy từ trang AdminPage (sau này load từ DB hoặc context)
const mockUsers = [
  { workerId: "W001", workerName: "Nguyen Van A", approverId: "A101", approverName: "Tran B" },
  { workerId: "W002", workerName: "Le Thi B", approverId: "A102", approverName: "Pham C" },
];

export default function EntryPage() {
  const [form, setForm] = useState({
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
  });

  // Tự động điền tên và người duyệt khi nhập MSNV
  useEffect(() => {
    const found = mockUsers.find(u => u.workerId === form.workerId);
    if (found) {
      setForm(f => ({
        ...f,
        workerName: found.workerName,
        approverId: found.approverId,
        approverName: found.approverName,
      }));
    }
  }, [form.workerId]);

  function handleChange(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  // --- Tính điểm
  function calcProductivityScore(oe) {
    if (oe >= 112) return 10;
    if (oe >= 108) return 9;
    if (oe >= 104) return 8;
    if (oe >= 100) return 7;
    if (oe >= 98) return 6;
    if (oe >= 96) return 4;
    if (oe >= 94) return 2;
    return 0;
  }

  function calcQualityScore(defects) {
    if (defects === 0) return 10;
    if (defects <= 2) return 8;
    if (defects <= 4) return 6;
    if (defects <= 6) return 4;
    return 0;
  }

  const pScore = calcProductivityScore(form.oe);
  const qScore = calcQualityScore(form.defects);
  const dayScore = Math.min(15, pScore + qScore);
  const overflow = Math.max(0, pScore + qScore - 15);

  function handleSubmit() {
    alert(`Đã gửi KPI cho ${form.workerId} – Điểm ngày: ${dayScore}`);
    // sau này fetch POST API /api/kpi/submit
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
        </label>

        <label>Họ tên:
          <input className="inp" value={form.workerName} readOnly />
        </label>

        <label>Người duyệt (MSNV):
          <input className="inp" value={form.approverId} readOnly />
        </label>

        <label>Người duyệt (Họ tên):
          <input className="inp" value={form.approverName} readOnly />
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

      <button onClick={handleSubmit} className="mt-4 px-4 py-2 rounded bg-green-600 text-white">
        Gửi KPI
      </button>
    </div>
  );
}
