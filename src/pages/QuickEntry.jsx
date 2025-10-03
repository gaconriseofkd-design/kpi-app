// src/pages/QuickEntry.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/* =================== Helpers tính điểm =================== */
// Tính điểm sản lượng theo rule từ DB: mảng [{threshold, score, active}]
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
// Chất lượng (có thể tách thành bảng rule riêng sau)
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

/* =================== Mặc định template nhập nhanh =================== */
const DEFAULT_TEMPLATE = {
  date: new Date().toISOString().slice(0, 10),
  line: "LEAN-D1",
  ca: "Ca 1",
  work_hours: 8,
  stop_hours: 0,
  defects: 0,
  oe: 100,
  compliance_code: "NONE",
};

/* =================== Gate đăng nhập (pass: davidtu) =================== */
export default function QuickEntry() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("qe_authed") === "1");
  const [pwd, setPwd] = useState("");

  function tryLogin(e) {
    e?.preventDefault();
    if (pwd === "davidtu") {
      sessionStorage.setItem("qe_authed", "1");
      setAuthed(true);
    } else {
      alert("Sai mật khẩu.");
    }
  }

  if (!authed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <form onSubmit={tryLogin} className="w-full max-w-sm p-6 rounded-xl shadow bg-white">
          <h2 className="text-xl font-semibold mb-4">Nhập KPI nhanh</h2>
          <label className="block mb-2">Mật khẩu</label>
          <input
            type="password"
            className="input w-full"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="..."
          />
          <button className="btn btn-primary mt-4 w-full" type="submit">Đăng nhập</button>
        </form>
      </div>
    );
  }

  return <QuickEntryContent />;
}

/* =================== Nội dung trang Nhập nhanh =================== */
function QuickEntryContent() {
  // Steps: chọn NV -> nhập template -> review & lưu
  const [step, setStep] = useState("choose"); // choose | template | review

  // Bộ dữ liệu người duyệt & nhân viên
  const [approverId, setApproverId] = useState("");
  const [approverName, setApproverName] = useState("");
  const [users, setUsers] = useState([]);          // [{msnv, full_name, approver_msnv, approver_name}]
  const [selected, setSelected] = useState(() => new Set());

  // Template KPI chung
  const [tpl, setTpl] = useState({ ...DEFAULT_TEMPLATE });

  // Danh sách bản ghi sẽ lưu
  const [entries, setEntries] = useState([]);
  const [saving, setSaving] = useState(false);

  // Rule điểm sản lượng (tải từ Supabase)
  const [prodRules, setProdRules] = useState([]);
  useEffect(() => {
    supabase
      .from("kpi_rule_productivity")
      .select("*")
      .eq("active", true)
      .order("threshold", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Load rules error:", error);
        setProdRules(data || []);
      });
  }, []);

  const allSelected = useMemo(
    () => (users.length ? users.every((u) => selected.has(u.msnv)) : false),
    [users, selected]
  );

  /* ---------- B1: tải NV theo người duyệt ---------- */
  async function loadUsersByApprover() {
    const id = approverId.trim();
    if (!id) return alert("Nhập MSNV người duyệt trước.");
    const { data, error } = await supabase
      .from("users")
      .select("msnv, full_name, approver_msnv, approver_name")
      .eq("approver_msnv", id)
      .order("msnv");
    if (error) return alert("Lỗi tải danh sách: " + error.message);
    setUsers(data || []);
    setApproverName(data?.[0]?.approver_name || "");
    setSelected(new Set());
    setStep("choose");
  }

  function toggleRow(msnv) {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(msnv) ? s.delete(msnv) : s.add(msnv);
      return s;
    });
  }
  function toggleAll() {
    setSelected(() => (allSelected ? new Set() : new Set(users.map(u => u.msnv))));
  }
  function gotoTemplate() {
    if (!selected.size) return alert("Chưa chọn nhân viên nào.");
    setTpl({ ...DEFAULT_TEMPLATE });
    setStep("template");
  }

  /* ---------- B2: xác nhận template -> tạo entries ---------- */
  function confirmTemplate() {
    const list = users
      .filter(u => selected.has(u.msnv))
      .map(u => {
        const base = {
          worker_id: u.msnv,
          worker_name: u.full_name || "",
          approver_id: u.approver_msnv || approverId.trim(),
          approver_name: u.approver_name || approverName || "",
          ...tpl,
        };
        return { ...base, ...deriveDayScores(base, prodRules) };
      });
    setEntries(list);
    setStep("review");
  }

  /* ---------- B3: chỉnh từng dòng & lưu thẳng đã duyệt ---------- */
  function updateEntry(idx, key, val) {
    setEntries(prev => {
      const arr = [...prev];
      const row = { ...arr[idx], [key]: val };
      arr[idx] = { ...row, ...deriveDayScores(row, prodRules) };
      return arr;
    });
  }

  async function saveAll() {
    if (!entries.length) return alert("Không có dữ liệu để lưu.");
    try {
      setSaving(true);
      const now = new Date().toISOString();
      const size = 500;

      for (let i = 0; i < entries.length; i += size) {
        const chunk = entries.slice(i, i + size).map(e => {
          const violations = e.compliance_code === "NONE" ? 0 : 1;
          return {
            date: e.date,
            worker_id: e.worker_id,
            worker_name: e.worker_name,
            approver_id: e.approver_id,
            approver_name: e.approver_name,
            line: e.line,
            ca: e.ca,
            work_hours: Number(e.work_hours || 0),
            stop_hours: Number(e.stop_hours || 0),
            defects: Number(e.defects || 0),
            oe: Number(e.oe || 0),
            compliance_code: e.compliance_code,
            p_score: e.p_score,
            q_score: e.q_score,
            day_score: e.day_score,
            overflow: e.overflow,

            // Lưu thẳng là đã duyệt
            status: "approved",
            violations,
            approver_note: "Fast entry",
            approved_at: now,
          };
        });

        // Nếu có unique (worker_id,date) thì có thể dùng upsert với onConflict
        // const { error } = await supabase.from("kpi_entries").upsert(chunk, { onConflict: "worker_id,date" });
        const { error } = await supabase.from("kpi_entries").insert(chunk);
        if (error) throw error;
      }

      alert(`Đã lưu & duyệt ${entries.length} bản ghi KPI.`);
      setStep("choose");
      setEntries([]);
      setSelected(new Set());
    } catch (e) {
      console.error(e);
      alert("Lưu KPI lỗi: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  /* =================== RENDER =================== */
  if (step === "template") {
    const scores = deriveDayScores(tpl, prodRules);
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-xl font-semibold">Nhập KPI nhanh – Template cho {selected.size} nhân viên</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <label>Ngày:
            <input type="date" className="input" value={tpl.date}
                   onChange={e => setTpl(s => ({ ...s, date: e.target.value }))} />
          </label>

          <label>Line:
            <select className="input" value={tpl.line}
                    onChange={e => setTpl(s => ({ ...s, line: e.target.value }))}>
              <option value="LEAN-D1">LEAN-D1</option>
              <option value="LEAN-D2">LEAN-D2</option>
              <option value="LEAN-D3">LEAN-D3</option>
              <option value="LEAN-D4">LEAN-D4</option>
              <option value="LEAN-H1">LEAN-H1</option>
              <option value="LEAN-H2">LEAN-H2</option>
            </select>
          </label>

          <label>Ca:
            <select className="input" value={tpl.ca}
                    onChange={e => setTpl(s => ({ ...s, ca: e.target.value }))}>
              <option value="Ca 1">Ca 1</option>
              <option value="Ca 2">Ca 2</option>
              <option value="Ca 3">Ca 3</option>
              <option value="Ca HC">Ca HC</option>
            </select>
          </label>

          <label>Giờ làm việc:
            <input type="number" className="input" value={tpl.work_hours}
                   onChange={e => setTpl(s => ({ ...s, work_hours: Number(e.target.value) }))} />
          </label>

          <label>Giờ dừng máy:
            <input type="number" className="input" value={tpl.stop_hours}
                   onChange={e => setTpl(s => ({ ...s, stop_hours: Number(e.target.value) }))} />
          </label>

          <label>Số đôi phế:
            <input type="number" className="input" value={tpl.defects}
                   onChange={e => setTpl(s => ({ ...s, defects: Number(e.target.value) }))} />
          </label>

          <label>%OE:
            <input type="number" className="input" value={tpl.oe}
                   onChange={e => setTpl(s => ({ ...s, oe: Number(e.target.value) }))} />
          </label>

          <label>Vi phạm:
            <select className="input" value={tpl.compliance_code}
                    onChange={e => setTpl(s => ({ ...s, compliance_code: e.target.value }))}>
              <option value="NONE">Không vi phạm</option>
              <option value="LATE">Đi trễ / Về sớm</option>
              <option value="PPE">Vi phạm PPE</option>
              <option value="MAT">Vi phạm nguyên liệu</option>
              <option value="SPEC">Vi phạm tiêu chuẩn</option>
              <option value="RULE">Vi phạm nội quy</option>
            </select>
          </label>
        </div>

        <div className="mt-2">
          <p>Điểm Sản lượng: {scores.p_score}</p>
          <p>Điểm Chất lượng: {scores.q_score}</p>
          <p>Điểm KPI ngày: {scores.day_score}</p>
          <p>Điểm dư: {scores.overflow}</p>
        </div>

        <div className="flex gap-2">
          <button className="btn" onClick={() => setStep("choose")}>Quay lại</button>
          <button className="btn btn-primary" onClick={confirmTemplate}>OK</button>
        </div>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-3">Sửa chi tiết & Hoàn thành nhập KPI</h2>
        <div className="mb-3 flex gap-2">
          <button className="btn" onClick={() => setStep("template")}>Sửa template</button>
          <button className="btn" onClick={() => setStep("choose")}>Chọn lại nhân viên</button>
          <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
            {saving ? "Đang lưu..." : "Hoàn thành & LƯU (đã duyệt)"}
          </button>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">MSNV</th>
                <th className="p-2">Họ tên</th>
                <th className="p-2">Ngày</th>
                <th className="p-2">Line</th>
                <th className="p-2">Ca</th>
                <th className="p-2">Giờ LV</th>
                <th className="p-2">Dừng</th>
                <th className="p-2">Phế</th>
                <th className="p-2">%OE</th>
                <th className="p-2">Vi phạm</th>
                <th className="p-2">P</th>
                <th className="p-2">Q</th>
                <th className="p-2">KPI</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((r, idx) => (
                <tr key={r.worker_id} className="border-b">
                  <td className="p-2">{r.worker_id}</td>
                  <td className="p-2">{r.worker_name}</td>
                  <td className="p-2">
                    <input type="date" className="input" value={r.date}
                           onChange={(e) => updateEntry(idx, "date", e.target.value)} />
                  </td>
                  <td className="p-2">
                    <select className="input" value={r.line}
                            onChange={(e) => updateEntry(idx, "line", e.target.value)}>
                      <option value="LEAN-D1">LEAN-D1</option>
                      <option value="LEAN-D2">LEAN-D2</option>
                      <option value="LEAN-D3">LEAN-D3</option>
                      <option value="LEAN-D4">LEAN-D4</option>
                      <option value="LEAN-H1">LEAN-H1</option>
                      <option value="LEAN-H2">LEAN-H2</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <select className="input" value={r.ca}
                            onChange={(e) => updateEntry(idx, "ca", e.target.value)}>
                      <option value="Ca 1">Ca 1</option>
                      <option value="Ca 2">Ca 2</option>
                      <option value="Ca 3">Ca 3</option>
                      <option value="Ca HC">Ca HC</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <input type="number" className="input w-24" value={r.work_hours}
                           onChange={(e) => updateEntry(idx, "work_hours", Number(e.target.value))} />
                  </td>
                  <td className="p-2">
                    <input type="number" className="input w-20" value={r.stop_hours}
                           onChange={(e) => updateEntry(idx, "stop_hours", Number(e.target.value))} />
                  </td>
                  <td className="p-2">
                    <input type="number" className="input w-20" value={r.defects}
                           onChange={(e) => updateEntry(idx, "defects", Number(e.target.value))} />
                  </td>
                  <td className="p-2">
                    <input type="number" className="input w-24" value={r.oe}
                           onChange={(e) => updateEntry(idx, "oe", Number(e.target.value))} />
                  </td>
                  <td className="p-2">
                    <select className="input" value={r.compliance_code}
                            onChange={(e) => updateEntry(idx, "compliance_code", e.target.value)}>
                      <option value="NONE">NONE</option>
                      <option value="LATE">LATE</option>
                      <option value="PPE">PPE</option>
                      <option value="MAT">MAT</option>
                      <option value="SPEC">SPEC</option>
                      <option value="RULE">RULE</option>
                    </select>
                  </td>
                  <td className="p-2">{r.p_score}</td>
                  <td className="p-2">{r.q_score}</td>
                  <td className="p-2 font-semibold">{r.day_score}</td>
                </tr>
              ))}
              {!entries.length && (
                <tr><td colSpan={13} className="p-4 text-center text-gray-500">Chưa có dữ liệu.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ---------- B1: chọn nhân viên ---------- */
  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-3">Nhập KPI nhanh – Bước 1: Chọn nhân viên</h2>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          className="input"
          placeholder="MSNV người duyệt (VD: 04126)"
          value={approverId}
          onChange={(e) => setApproverId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadUsersByApprover()}
        />
        <button className="btn" onClick={loadUsersByApprover}>Tải danh sách</button>
        {approverName && <span className="text-sm opacity-70">Người duyệt: {approverName}</span>}

        <div className="ml-auto flex gap-2">
          <button className="btn" onClick={toggleAll} disabled={!users.length}>
            {allSelected ? "Bỏ chọn tất" : "Chọn tất cả"}
          </button>
          <button className="btn btn-primary" onClick={gotoTemplate} disabled={!selected.size}>
            Xác nhận danh sách ({selected.size})
          </button>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
              <th className="p-2">MSNV</th>
              <th className="p-2">Họ tên</th>
              <th className="p-2">Approver MSNV</th>
              <th className="p-2">Approver Họ tên</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.msnv} className="border-b">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selected.has(u.msnv)}
                    onChange={() => toggleRow(u.msnv)}
                  />
                </td>
                <td className="p-2">{u.msnv}</td>
                <td className="p-2">{u.full_name}</td>
                <td className="p-2">{u.approver_msnv}</td>
                <td className="p-2">{u.approver_name}</td>
              </tr>
            ))}
            {!users.length && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">
                  Nhập MSNV người duyệt rồi bấm “Tải danh sách”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
