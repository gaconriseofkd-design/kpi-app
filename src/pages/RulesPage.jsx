// src/pages/RulesPage.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { scoreByProductivity } from "../lib/scoring";
import { useKpiSection } from "../context/KpiSectionContext";
import * as XLSX from "xlsx";

/* =============== Helper: Chuẩn hóa Section và Nhận diện Loại Rule =============== */
const HYBRID_SECTIONS = ["LAMINATION", "PREFITTING", "BÀO", "TÁCH"];
const isHybridSection = (s) => HYBRID_SECTIONS.includes(s);
const normalizeSection = (s, currentSection) => {
  if (!s) return currentSection.toUpperCase() || "MOLDING";
  const cleaned = s.toString().trim().toUpperCase();

  // Nếu là loại Leanline, thay thế khoảng trắng bằng gạch dưới
  if (cleaned.startsWith("LEANLINE")) {
    return cleaned.replace(/\s/g, '_');
  }
  return cleaned;
}
// Các Section cần nhập Category (Molding, Hybrid, và Leanline Molded)
const requiresCategory = (s) => s === "MOLDING" || isHybridSection(s) || s === "LEANLINE_MOLDED";
/* =============== Helper: Lỗi RLS (Giữ nguyên) =============== */

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
          <input
            className="input w-full"
            placeholder="Mật khẩu"
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
          />
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
  const [activeTab, setActiveTab] = useState("productivity"); // "productivity" or "quality"
  const [showAllSections, setShowAllSections] = useState(false);

  const needsCategory = requiresCategory(section.toUpperCase());

  // 📥 Load rule hiện có
  async function load() {
    setLoading(true);
    const dbSection = section.toUpperCase();

    const { data, error } = await supabase
      .from("kpi_rule_productivity")
      .select("*")
      .eq("section", dbSection)
      .order("category", { ascending: true })
      .order("threshold", { ascending: false });
    setLoading(false);
    if (error) return alert(error.message);
    setRows(data || []);
  }
  useEffect(() => {
    load();
  }, [section]);

  // ➕ Thêm dòng mới
  function addRow() {
    const newRow =
      needsCategory
        ? { category: "", threshold: 100, score: 7, note: "", active: true }
        : { threshold: 100, score: 7, note: "", active: true };
    setRows((r) => [newRow, ...r]);
  }

  // 🗑️ Xoá rule
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

  // 📤 Import Excel
  async function handleImportExcel(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!json.length) return alert("File không có dữ liệu.");

      // Chuẩn hoá
      const raw = json.map(r => ({
        section: normalizeSection(r.section, section),
        category: (r.category ?? "").toString().trim().replace(/\s+/g, " "),
        threshold: Number(r.threshold || 0),
        score: Number(r.score || 0),
        note: r.note ?? "",
        active: String(r.active ?? "true").toLowerCase() !== "false",
      }));

      // Dedupe đúng theo (section, category, threshold)
      const seen = new Set();
      const payload = [];
      for (const row of raw) {
        const catKey = needsCategory ? row.category : "";
        const key = `${row.section}|${catKey}|${row.threshold}`;

        if (!seen.has(key)) { seen.add(key); payload.push(row); }
      }

      if (!confirm(`Nhập/cập nhật ${payload.length} rule vào database?`)) return;

      setSaving(true);
      const { error } = await supabase
        .from("kpi_rule_productivity")
        .upsert(payload, { onConflict: 'section,category,threshold' });
      setSaving(false);

      if (error) {
        console.error(error);
        alert("Import lỗi: " + error.message);
      } else {
        alert(`✅ Import thành công ${payload.length} rule!`);
        await load();
      }
    };

    reader.readAsArrayBuffer(file);
  }

  // 💾 Lưu tất cả rule hiện tại..
  async function saveAll() {
    const payload = rows.map(r => {
      const x = { ...r };
      delete x.id;
      x.section = (x.section || section || "MOLDING").toUpperCase();
      x.category = (x.category || "").toString().trim().replace(/\s+/g, " ");
      x.threshold = Number(x.threshold || 0);
      x.score = Number(x.score || 0);
      x.active = !!x.active;
      if (!("note" in x)) x.note = "";
      return x;
    });

    // Kiểm tra trùng trong payload
    const seen = new Set();
    for (const r of payload) {
      const catKey = needsCategory ? r.category : "";
      const key = `${r.section}|${catKey}|${r.threshold}`;
      if (seen.has(key)) return alert("Rule bị trùng trong bảng: " + key);
      seen.add(key);
    }

    setSaving(true);
    const { error } = await supabase
      .from("kpi_rule_productivity")
      .upsert(payload, { onConflict: 'section,category,threshold' });
    setSaving(false);

    if (error) return alert("Lưu lỗi: " + error.message);
    await load();
    alert("Đã lưu rule.");
  }

  // 🧮 Test nhanh điểm
  const testScore = useMemo(() => {
    const currentSection = section.toUpperCase();
    const isMolding = currentSection === "MOLDING";

    if (needsCategory) {
      const list = rows.filter((r) => r.active && r.category === testCat);
      const v = Number(testOE);
      const sorted = [...list].sort((a, b) => b.threshold - a.threshold);
      for (const r of sorted) if (v >= r.threshold) return r.score;
      return 0;
    }

    // Leanline DC
    return scoreByProductivity(testOE, rows);
  }, [testOE, rows, testCat, section]);

  // 🖼️ Giao diện chính
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 border-b pb-2">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-indigo-800">Cấu hình Rule KPI</h2>
          <span className="px-2 py-1 text-xs font-semibold rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
            {SECTIONS.find((s) => s.key === section)?.label || section}
          </span>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === "productivity" ? "bg-white shadow text-indigo-700" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("productivity")}
          >
            1. Điểm Sản lượng (P)
          </button>
          <button
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === "quality" ? "bg-white shadow text-indigo-700" : "text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab("quality")}
          >
            2. Điểm Chất lượng & Tuân thủ (Q/C)
          </button>
        </div>
      </div>

      {activeTab === "productivity" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 flex-wrap bg-white p-3 rounded-xl border shadow-sm">
            <h3 className="text-sm font-bold text-gray-500 uppercase mr-auto">
              {needsCategory ? "Thiết lập Ngưỡng Sản lượng" : "Thiết lập %OE"}
            </h3>
            <button className="btn btn-sm" onClick={load} disabled={loading}>
              {loading ? "Đang tải..." : "Tải lại"}
            </button>
            <button className="btn btn-sm bg-indigo-600 text-white hover:bg-indigo-700" onClick={addRow}>
              + Thêm dòng
            </button>
            <label className="btn btn-sm cursor-pointer bg-green-600 hover:bg-green-700 text-white">
              📤 Import Excel
              <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleImportExcel} />
            </label>
            <button className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700" onClick={saveAll} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu tất cả"}
            </button>
          </div>

          {/* Test nhanh */}
          <div className="p-3 rounded border bg-white inline-flex items-center gap-2 flex-wrap">
            {needsCategory ? (
              <>
                <select
                  className="input w-36"
                  value={testCat}
                  onChange={(e) => setTestCat(e.target.value)}
                >
                  <option value="">-- Loại hàng/Line --</option>
                  {[...new Set(rows.map((r) => r.category).filter(Boolean))].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <span>%OE/Tỷ lệ NS:</span>
              </>
            ) : (
              <span>Test %OE:</span>
            )}
            <input
              type="number"
              className="input w-28"
              value={testOE}
              onChange={(e) => setTestOE(Number(e.target.value))}
            />
            <span>
              → Điểm: <b>{testScore}</b>
            </span>
          </div>

          {/* Bảng Rule */}
          <div className="overflow-auto pb-4">
            {needsCategory ? (
              <table className="min-w-[800px] text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2">Loại hàng/Line</th>
                    <th className="p-2">Ngưỡng (≥)</th>
                    <th className="p-2">Điểm</th>
                    <th className="p-2">Ghi chú</th>
                    <th className="p-2">Active</th>
                    <th className="p-2">Xoá</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.id ?? `new-${idx}`} className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        <input
                          className="input w-40"
                          value={r.category || ""}
                          onChange={(e) =>
                            setRows((list) =>
                              list.map((x, i) =>
                                i === idx ? { ...x, category: e.target.value } : x
                              )
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="input w-28"
                          value={r.threshold}
                          onChange={(e) =>
                            setRows((list) =>
                              list.map((x, i) =>
                                i === idx ? { ...x, threshold: Number(e.target.value) } : x
                              )
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="input w-20"
                          value={r.score}
                          onChange={(e) =>
                            setRows((list) =>
                              list.map((x, i) =>
                                i === idx ? { ...x, score: Number(e.target.value) } : x
                              )
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="input w-80"
                          value={r.note ?? ""}
                          onChange={(e) =>
                            setRows((list) =>
                              list.map((x, i) =>
                                i === idx ? { ...x, note: e.target.value } : x
                              )
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={!!r.active}
                          onChange={(e) =>
                            setRows((list) =>
                              list.map((x, i) =>
                                i === idx ? { ...x, active: e.target.checked } : x
                              )
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <button className="btn" onClick={() => delRow(r.id, idx)}>
                          Xoá
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-gray-500">
                        Chưa có rule
                      </td>
                    </tr>
                  )}
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
                    <tr key={r.id ?? `new-${idx}`} className="border-b hover:bg-gray-50">
                      <td className="p-2">
                        <input
                          type="number"
                          className="input w-28"
                          value={r.threshold}
                          onChange={(e) =>
                            setRows((list) =>
                              list.map((x, i) =>
                                i === idx ? { ...x, threshold: Number(e.target.value) } : x
                              )
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          className="input w-20"
                          value={r.score}
                          onChange={(e) =>
                            setRows((list) =>
                              list.map((x, i) =>
                                i === idx ? { ...x, score: Number(e.target.value) } : x
                              )
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="input w-80"
                          value={r.note ?? ""}
                          onChange={(e) =>
                            setRows((list) =>
                              list.map((x, i) =>
                                i === idx ? { ...x, note: e.target.value } : x
                              )
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={!!r.active}
                          onChange={(e) =>
                            setRows((list) =>
                              list.map((x, i) =>
                                i === idx ? { ...x, active: e.target.checked } : x
                              )
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        <button className="btn" onClick={() => delRow(r.id, idx)}>
                          Xoá
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-gray-500">
                        Chưa có rule
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === "quality" && (
        <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border shadow-sm">
            <h3 className="text-sm font-bold text-gray-500 uppercase">
              Tra cứu Quy định Q / C
            </h3>
            <button
              className={`btn btn-sm ${showAllSections ? "bg-indigo-600 text-white" : "bg-gray-100"}`}
              onClick={() => setShowAllSections(!showAllSections)}
            >
              {showAllSections ? "← Quay lại Section hiện tại" : "Xem tất cả bộ phận"}
            </button>
          </div>

          {showAllSections ? (
            <div className="space-y-6">
              <QualityRulesInfo section="LAMINATION" isSingle={false} />
              <QualityRulesInfo section="MOLDING" isSingle={false} />
              <QualityRulesInfo section="LEANLINE_DC" isSingle={false} />
            </div>
          ) : (
            <QualityRulesInfo section={section} isSingle={true} />
          )}
        </div>
      )}
    </div>
  );
}

function QualityRulesInfo({ section, isSingle = true }) {
  const s = (section || "").toUpperCase();
  const label = isSingle ? s : (s === "LEANLINE_DC" ? "LEANLINE/PREFITTING/TÁCH/BÀO" : s);

  // 1. RULES CHO LAMINATION
  if (s === "LAMINATION") {
    return (
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg shadow-sm">
        <h3 className="font-bold text-orange-800 mb-3 text-lg border-b border-orange-200 pb-1">
          {isSingle ? "Bảng tra điểm Chất lượng (Q) & Tuân thủ (C) - " + s : "1. BỘ PHẬN " + label}
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="font-semibold text-orange-700">1. Điểm Chất lượng (Q) - Tối đa 5 đ</h4>
            <ul className="list-disc pl-5 text-sm space-y-2">
              <li><b>Hàng phế (Scrap):</b>
                <table className="text-xs border mt-1 bg-white">
                  <thead><tr className="bg-orange-100"><th className="p-1 px-3 border">Số đôi phế</th><th className="p-1 px-3 border">Điểm Q</th></tr></thead>
                  <tbody>
                    <tr><td className="p-1 px-3 border">0 - 1 đôi</td><td className="p-1 px-3 border font-bold">5</td></tr>
                    <tr><td className="p-1 px-3 border">2 - 3 đôi</td><td className="p-1 px-3 border font-bold">4</td></tr>
                    <tr><td className="p-1 px-3 border">4 - 5 đôi</td><td className="p-1 px-3 border font-bold">2</td></tr>
                    <tr><td className="p-1 px-3 border">&gt; 5 đôi</td><td className="p-1 px-3 border font-bold text-red-600">0</td></tr>
                  </tbody>
                </table>
              </li>
              <li><b>Fail Bonding (Dry):</b> Mặc định <b>0 điểm Q</b>.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-orange-700">2. Điểm Tuân thủ (C) - Tối đa 3 đ</h4>
            <ul className="list-disc pl-5 text-sm space-y-2">
              <li>Mặc định ban đầu: <b>3 điểm</b>.</li>
              <li><b>Vi phạm MQAA / Lỗi Rework / Vi phạm khác:</b> Trừ <b>1 điểm/lần</b> (Tối thiểu 0).</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-orange-200 text-sm font-medium text-orange-900">
          CÔNG THỨC: Tổng điểm = P (max 7) + Q (max 5) + C (max 3) = Tối đa 15 điểm.
        </div>
      </div>
    );
  }

  // 2. RULES CHO MOLDING
  if (s === "MOLDING") {
    return (
      <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg shadow-sm">
        <h3 className="font-bold text-teal-800 mb-3 text-lg border-b border-teal-200 pb-1">
          {isSingle ? "Bảng tra điểm Chất lượng (Q) & Tuân thủ (C) - " + s : "2. BỘ PHẬN " + label}
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="font-semibold text-teal-700">1. Điểm Chất lượng (Q) - Tối đa 5 đ</h4>
            <table className="text-sm border bg-white">
              <thead><tr className="bg-teal-100"><th className="p-1 px-3 border">Số đôi phế</th><th className="p-1 px-3 border">Điểm Q</th></tr></thead>
              <tbody>
                <tr><td className="p-1 px-3 border">0 - 2 đôi</td><td className="p-1 px-3 border font-bold">5</td></tr>
                <tr><td className="p-1 px-3 border">2.5 - 3 đôi</td><td className="p-1 px-3 border font-bold">4</td></tr>
                <tr><td className="p-1 px-3 border">3.5 - 5 đôi</td><td className="p-1 px-3 border font-bold">2</td></tr>
                <tr><td className="p-1 px-3 border">&gt; 5 đôi</td><td className="p-1 px-3 border font-bold text-red-600">0</td></tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-teal-700">2. Điểm Tuân thủ (C) - Tối đa 3 đ</h4>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Mặc định ban đầu: <b>3 điểm</b>.</li>
              <li><b>Lỗi Nghiêm trọng:</b> Trừ <b>3 điểm</b> (Về 0). <br /><i className="text-gray-500 text-xs">(Vd: Nhiệt độ không quy định)</i></li>
              <li><b>Lỗi Bình thường:</b> Trừ <b>1 điểm/lần</b>.</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 pt-2 border-t border-teal-200 text-sm font-medium text-teal-900">
          CÔNG THỨC: Tổng điểm = P (max 7) + Q (max 5) + C (max 3) = Tối đa 15 điểm.
        </div>
      </div>
    );
  }

  // 3. RULES CHO CÁC BỘ PHẬN CÒN LẠI (Leanline, Prefitting, Tách, Bào)
  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
      <h3 className="font-bold text-blue-800 mb-3 text-lg border-b border-blue-200 pb-1">
        {isSingle ? "Bảng tra điểm Chất lượng (Q) & Tuân thủ (C) - " + s : "3. BỘ PHẬN " + label}
      </h3>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h4 className="font-semibold text-blue-700">1. Điểm Chất lượng (Q) - Tối đa 5 đ</h4>
          <table className="text-sm border bg-white">
            <thead><tr className="bg-blue-100"><th className="p-1 px-3 border">Số đôi phế</th><th className="p-1 px-3 border">Điểm Q</th></tr></thead>
            <tbody>
              <tr><td className="p-1 px-3 border">0 - 1 đôi</td><td className="p-1 px-3 border font-bold">5</td></tr>
              <tr><td className="p-1 px-3 border">1.5 - 2 đôi</td><td className="p-1 px-3 border font-bold">4</td></tr>
              <tr><td className="p-1 px-3 border">2.5 - 3 đôi</td><td className="p-1 px-3 border font-bold">2</td></tr>
              <tr><td className="p-1 px-3 border">&gt; 3 đôi</td><td className="p-1 px-3 border font-bold text-red-600">0</td></tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-blue-700">2. Điểm Tuân thủ (C) - Tối đa 3 đ</h4>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>Mặc định ban đầu: <b>3 điểm</b>.</li>
            <li><b>Lỗi loại A (Nghiêm trọng):</b> Trừ <b>3 điểm</b> (Về 0). <br /><i className="text-gray-500 text-xs">(Vd: Không mộc dò kim, không bảo hộ, chắn lối thoát hiểm...)</i></li>
            <li><b>Lỗi loại B (Thường):</b> Trừ <b>1 điểm/lần</b>.</li>
          </ul>
        </div>
      </div>
      <div className="mt-4 pt-2 border-t border-blue-200 text-sm font-medium text-blue-900">
        CÔNG THỨC: Tổng điểm = P (max 7) + Q (max 5) + C (max 3) = Tối đa 15 điểm.
      </div>
    </div>
  );
}
