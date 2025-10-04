import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { scoreByProductivity } from "../lib/scoring";
import { useKpiSection } from "../context/KpiSectionContext";

export default function RulesPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("rules_authed") === "1");
  const [pwd, setPwd] = useState("");

  function login(e) {
    e?.preventDefault();
    if (pwd === "davidtu") {
      sessionStorage.setItem("rules_authed", "1");
      setAuthed(true);
    } else alert("Sai mật khẩu");
  }

  if (!authed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <form onSubmit={login} className="w-full max-w-sm p-6 rounded-xl shadow bg-white">
          <h2 className="text-xl font-semibold mb-4">Cấu hình rule điểm sản lượng</h2>
          <input className="input w-full" placeholder="Mật khẩu" type="password"
                 value={pwd} onChange={e=>setPwd(e.target.value)} />
          <button className="btn btn-primary mt-4 w-full">Đăng nhập</button>
        </form>
      </div>
    );
  }

  return <RulesContent />;
}

function RulesContent() {
  const { section, SECTIONS } = useKpiSection();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testOE, setTestOE] = useState(100);
  const [testCat, setTestCat] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("kpi_rule_productivity")
      .select("*")
      .eq("section", section)
      .order("category", { ascending: true })
      .order("threshold", { ascending: false });
    setLoading(false);
    if (error) return alert(error.message);
    setRows(data || []);
  }
  useEffect(() => { load(); }, [section]);

  function addRow() {
    const newRow =
      section === "Molding"
        ? { id: undefined, category: "", threshold: 100, score: 7, note: "", active: true }
        : { id: undefined, threshold: 100, score: 7, note: "", active: true };
    setRows((r) => [newRow, ...r]);
  }

  function delRow(id, idx) {
    if (!id) return setRows((r) => r.filter((_, i) => i !== idx));
    if (!confirm("Xoá rule này?")) return;
    supabase
      .from("kpi_rule_productivity")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) alert(error.message);
        load();
      });
  }

  async function saveAll() {
    const cleaned = rows.map((r) => ({
      id: r.id,
      category: r.category || null,
      threshold: Number(r.threshold || 0),
      score: Number(r.score || 0),
      note: r.note || "",
      active: !!r.active,
      section,
    }));

    const uniq = new Set();
    for (const r of cleaned) {
      const key = section === "Molding" ? `${r.category || ""}|${r.threshold}` : String(r.threshold);
      if (uniq.has(key)) return alert("Rule bị trùng: " + key);
      uniq.add(key);
    }

    setSaving(true);
    const { error } = await supabase
      .from("kpi_rule_productivity")
      .upsert(cleaned, { onConflict: "id" });
    setSaving(false);
    if (error) return alert(error.message);
    await load();
    alert("Đã lưu rule.");
  }

  const testScore = useMemo(() => {
    if (section === "Molding") {
      const list = rows.filter(r => r.active && r.category === testCat);
      const v = Number(testOE);
      const sorted = [...list].sort((a, b) => b.threshold - a.threshold);
      for (const r of sorted) if (v >= r.threshold) return r.score;
      return 0;
    }
    return scoreByProductivity(testOE, rows);
  }, [testOE, rows, testCat, section]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-xl font-semibold">
          {section === "Molding"
            ? "Rule điểm sản lượng (Loại hàng → Năng suất → Điểm)"
            : "Rule điểm sản lượng (%OE → Điểm)"}
        </h2>
        <span className="px-2 py-1 text-xs rounded bg-slate-100">
          Section: {SECTIONS.find((s) => s.key === section)?.label || section}
        </span>
        <button className="btn" onClick={load} disabled={loading}>
          {loading ? "Đang tải..." : "Tải lại"}
        </button>
        <button className="btn" onClick={addRow}>+ Thêm rule</button>
        <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu tất cả"}
        </button>
      </div>

      {/* Test nhanh */}
      <div className="p-3 rounded border bg-white inline-flex items-center gap-2 flex-wrap">
        {section === "Molding" && (
          <select className="input w-36" value={testCat} onChange={e => setTestCat(e.target.value)}>
            <option value="">-- Loại hàng --</option>
            {[...new Set(rows.map(r => r.category).filter(Boolean))].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        <span>{section === "Molding" ? "Pair/h:" : "Test OE:"}</span>
        <input type="number" className="input w-28" value={testOE}
               onChange={e => setTestOE(Number(e.target.value))}/>
        <span>→ Điểm: <b>{testScore}</b></span>
      </div>

      {/* Bảng Rule */}
      <div className="overflow-auto">
        {section === "Molding" ? (
          <table className="min-w-[800px] text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Loại hàng</th>
                <th className="p-2">Pair/h ≥</th>
                <th className="p-2">Điểm</th>
                <th className="p-2">Ghi chú</th>
                <th className="p-2">Active</th>
                <th className="p-2">Xoá</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id ?? `new-${idx}`} className="border-b">
                  <td className="p-2">
                    <input className="input w-40" value={r.category || ""}
                      onChange={e => setRows(list => list.map((x,i)=> i===idx ? {...x, category:e.target.value} : x))}/>
                  </td>
                  <td className="p-2">
                    <input type="number" className="input w-28" value={r.threshold}
                      onChange={e => setRows(list => list.map((x,i)=> i===idx ? {...x, threshold:Number(e.target.value)} : x))}/>
                  </td>
                  <td className="p-2">
                    <input type="number" className="input w-20" value={r.score}
                      onChange={e => setRows(list => list.map((x,i)=> i===idx ? {...x, score:Number(e.target.value)} : x))}/>
                  </td>
                  <td className="p-2">
                    <input className="input w-80" value={r.note ?? ""}
                      onChange={e => setRows(list => list.map((x,i)=> i===idx ? {...x, note:e.target.value} : x))}/>
                  </td>
                  <td className="p-2">
                    <input type="checkbox" checked={!!r.active}
                      onChange={e => setRows(list => list.map((x,i)=> i===idx ? {...x, active:e.target.checked} : x))}/>
                  </td>
                  <td className="p-2">
                    <button className="btn" onClick={()=>delRow(r.id, idx)}>Xoá</button>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="p-4 text-center text-gray-500">Chưa có rule</td></tr>}
            </tbody>
          </table>
        ) : (
          <table className="min-w-[700px] text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Ngưỡng %OE (≥)</th>
                <th className="p-2">Điểm</th>
                <th className="p-2">Ghi chú</th>
                <th className="p-2">Active</th>
                <th className="p-2">Xoá</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id ?? `new-${idx}`} className="border-b">
                  <td className="p-2">
                    <input type="number" className="input w-28" value={r.threshold}
                      onChange={e => setRows(list => list.map((x,i)=> i===idx ? {...x, threshold:e.target.value} : x))}/>
                  </td>
                  <td className="p-2">
                    <input type="number" className="input w-20" value={r.score}
                      onChange={e => setRows(list => list.map((x,i)=> i===idx ? {...x, score:e.target.value} : x))}/>
                  </td>
                  <td className="p-2">
                    <input className="input w-80" value={r.note ?? ""}
                      onChange={e => setRows(list => list.map((x,i)=> i===idx ? {...x, note:e.target.value} : x))}/>
                  </td>
                  <td className="p-2">
                    <input type="checkbox" checked={!!r.active}
                      onChange={e => setRows(list => list.map((x,i)=> i===idx ? {...x, active:e.target.checked} : x))}/>
                  </td>
                  <td className="p-2">
                    <button className="btn" onClick={()=>delRow(r.id, idx)}>Xoá</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
