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
const requiresCategory = (s) => s === "MOLDING" || isHybridSection(s);
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

// Helper component để hiển thị bảng Rule
function RuleTableInner({ rows, idxOffset = 0, onUpdateRow, onDeleteRow, needsCategory }) {
  return (
    <div className="overflow-auto pb-4">
      <table className="table table-sm w-full">
        <thead>
          <tr className="bg-slate-50 text-slate-600">
            {needsCategory && <th className="p-3 text-left">Loại hàng/Line</th>}
            <th className="p-3 text-left">{needsCategory ? "Ngưỡng (≥)" : "Ngưỡng %OE (≥)"}</th>
            <th className="p-3 text-left">Điểm</th>
            <th className="p-3 text-left">Ghi chú</th>
            <th className="p-3 text-center">Active</th>
            <th className="p-3 text-center">Xoá</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.id ?? `new-${idxOffset + idx}`} className="hover:bg-slate-50 transition-colors">
              {needsCategory && (
                <td className="p-2 text-left">
                  <input
                    className="input input-sm input-bordered w-full"
                    value={r.category || ""}
                    onChange={(e) => onUpdateRow({ ...r, category: e.target.value }, idx)}
                  />
                </td>
              )}
              <td className="p-2 text-left">
                <input
                  type="number"
                  step="any"
                  className={`input input-sm input-bordered ${needsCategory ? "w-24" : "w-32"}`}
                  value={r.threshold}
                  onChange={(e) => onUpdateRow({ ...r, threshold: Number(e.target.value) }, idx)}
                />
              </td>
              <td className="p-2 text-left">
                <input
                  type="number"
                  className={`input input-sm input-bordered ${needsCategory ? "w-16" : "w-20"}`}
                  value={r.score}
                  onChange={(e) => onUpdateRow({ ...r, score: Number(e.target.value) }, idx)}
                />
              </td>
              <td className="p-2 text-left">
                <input
                  className="input input-sm input-bordered w-full"
                  value={r.note ?? ""}
                  onChange={(e) => onUpdateRow({ ...r, note: e.target.value }, idx)}
                />
              </td>
              <td className="p-2 text-center">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={!!r.active}
                  onChange={(e) => onUpdateRow({ ...r, active: e.target.checked }, idx)}
                />
              </td>
              <td className="p-2 text-center">
                <button className="btn btn-ghost btn-xs text-red-500 hover:bg-red-50" onClick={() => onDeleteRow(r.id, idx)}>
                  Xoá
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RulesContent() {
  const { section, SECTIONS } = useKpiSection();
  const [rows, setRows] = useState([]);
  const [complianceDict, setComplianceDict] = useState([]);
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
      .eq(showAllSections ? "" : "section", showAllSections ? undefined : dbSection)
      .order("section", { ascending: true })
      .order("category", { ascending: true })
      .order("threshold", { ascending: false });
    setLoading(false);
    if (error) return alert(error.message);
    setRows(data || []);
  }

  async function loadCompliance() {
    const { data, error } = await supabase
      .from("kpi_compliance_dictionary")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data) setComplianceDict(data);
  }

  useEffect(() => {
    load();
    loadCompliance();
  }, [section, showAllSections]);

  // ➕ Thêm dòng mới
  function addRow() {
    const p = prompt("Nhập mật khẩu để thêm dòng:");
    if (p !== "davidtu") return;

    const s = section.toUpperCase();
    if (s === "LEANLINE_MOLDED" || s === "LEANLINE_DC") category = "%OE";

    const newRow =
      needsCategory
        ? { category: "", threshold: 100, score: 7, note: "", active: true }
        : { category, threshold: 100, score: 7, note: "", active: true };
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
      const pass = prompt("Nhập mật khẩu để xác nhận Import:");
      if (pass !== "davidtu") return alert("Sai mật khẩu");

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

  // 📥 Xuất Excel (Tất cả)
  async function handleExportExcel() {
    setLoading(true);
    const { data, error } = await supabase
      .from("kpi_rule_productivity")
      .select("*")
      .order("section", { ascending: true })
      .order("category", { ascending: true })
      .order("score", { ascending: false });
    setLoading(false);

    if (error) return alert("Lỗi khi tải dữ liệu: " + error.message);
    if (!data || data.length === 0) return alert("Không có dữ liệu để xuất.");

    // Chuẩn bị dữ liệu cho Excel (loại bỏ id và timestamps)
    const exportData = data.map(r => ({
      "Section": r.section,
      "Category": r.category,
      "Threshold (≥)": r.threshold,
      "Score": r.score,
      "Note": r.note || "",
      "Active": r.active ? "TRUE" : "FALSE"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "KPI_Rules");

    // Tải file về
    XLSX.writeFile(workbook, `MQAA_KPI_Rules_All_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  // 💾 Lưu tất cả rule hiện tại..
  async function saveAll() {
    const pass = prompt("Nhập mật khẩu để Lưu:");
    if (pass !== "davidtu") return alert("Sai mật khẩu");
    const payload = rows.map(r => {
      const x = { ...r };
      delete x.id;
      x.section = (x.section || section || "MOLDING").toUpperCase();
      let cat = (x.category || "").toString().trim().replace(/\s+/g, " ");
      if ((x.section === "LEANLINE_MOLDED" || x.section === "LEANLINE_DC") && !cat) cat = "%OE";
      x.category = cat;
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
    <div className="p-4 space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center gap-6 border-b pb-4">
        <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-inner">
          <button
            className={`px-6 py-2.5 rounded-xl text-sm font-extrabold transition-all duration-300 flex items-center gap-2 ${activeTab === "productivity"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-700 scale-105 z-10"
              : "text-gray-500 hover:bg-white hover:text-indigo-600"
              }`}
            onClick={() => setActiveTab("productivity")}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${activeTab === "productivity" ? "bg-white text-indigo-600" : "bg-gray-200"}`}>1</div>
            ĐIỂM SẢN LƯỢNG (P)
          </button>
          <button
            className={`px-6 py-2.5 rounded-xl text-sm font-extrabold transition-all duration-300 flex items-center gap-2 ${activeTab === "quality"
              ? "bg-teal-600 text-white shadow-lg shadow-teal-200 ring-2 ring-teal-700 scale-105 z-10"
              : "text-gray-500 hover:bg-white hover:text-teal-600"
              }`}
            onClick={() => setActiveTab("quality")}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${activeTab === "quality" ? "bg-white text-teal-600" : "bg-gray-200"}`}>2</div>
            ĐIỂM Q & C
          </button>
        </div>

        <div className="flex items-center gap-3 ml-auto md:ml-0 order-first md:order-last">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Cấu hình Rule</h2>
          <span className="px-3 py-1 text-xs font-bold rounded-lg bg-slate-800 text-white shadow-sm">
            {SECTIONS.find((s) => s.key === section)?.label || section}
          </span>
        </div>
      </div>

      {activeTab === "productivity" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="flex items-center gap-2 flex-wrap bg-white p-4 rounded-2xl border shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mr-auto">
              {showAllSections ? "Tất cả các bộ phận" : (needsCategory ? "Thiết lập Ngưỡng Sản lượng" : "Thiết lập tỷ lệ %OE")}
            </h3>
            <div className="flex items-center gap-2">
              <button
                className={`btn btn-sm ${showAllSections ? "bg-slate-800 text-white shadow-md" : "bg-white text-slate-800"}`}
                onClick={() => setShowAllSections(!showAllSections)}
              >
                {showAllSections ? "← Quay lại" : "Xem tất cả bộ phận"}
              </button>
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
              <button className="btn btn-sm bg-teal-600 text-white hover:bg-teal-700" onClick={handleExportExcel} disabled={loading}>
                📥 Xuất Excel (Tất cả)
              </button>
              <button className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700" onClick={saveAll} disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu tất cả"}
              </button>
            </div>
          </div>

          {/* Test nhanh */}
          <div className="p-4 rounded-2xl border bg-indigo-50/50 flex items-center gap-4 flex-wrap">
            <span className="text-sm font-bold text-indigo-900">Kiểm tra nhanh:</span>
            {needsCategory ? (
              <select
                className="select select-sm select-bordered w-44 bg-white"
                value={testCat}
                onChange={(e) => setTestCat(e.target.value)}
              >
                <option value="">-- Chọn Loại hàng --</option>
                {[...new Set(rows.map((r) => r.category).filter(Boolean))].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : null}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">%OE:</span>
              <input
                type="number"
                className="input input-sm input-bordered w-24 bg-white"
                value={testOE}
                onChange={(e) => setTestOE(Number(e.target.value))}
              />
            </div>
            <div className="bg-white px-4 py-1 rounded-full border border-indigo-200 shadow-sm">
              <span className="text-sm text-gray-500">Kết quả:</span>
              <span className="ml-2 text-lg font-black text-indigo-600">{testScore} điểm</span>
            </div>
          </div>

          {/* Bảng Rule */}
          <div className="space-y-6">
            {showAllSections ? (
              // HIỂN THỊ TẤT CẢ BỘ PHẬN
              [...new Set(rows.map(r => r.section))].map(secName => (
                <div key={secName} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 border-b flex justify-between items-center">
                    <span className="font-black text-slate-700 uppercase">{secName}</span>
                    <span className="text-xs text-slate-500">{rows.filter(r => r.section === secName).length} rules</span>
                  </div>
                  <RuleTableInner
                    rows={rows.filter(r => r.section === secName)}
                    idxOffset={rows.findIndex(r => r.section === secName)}
                    onUpdateRow={(newRow, idx) => {
                      const absoluteIdx = rows.findIndex(r => r.section === secName) + idx;
                      setRows(list => list.map((x, i) => i === absoluteIdx ? newRow : x));
                    }}
                    onDeleteRow={(id, idx) => delRow(id, rows.findIndex(r => r.section === secName) + idx)}
                    needsCategory={requiresCategory(secName)}
                  />
                </div>
              ))
            ) : (
              // HIỂN THỊ 1 BỘ PHẬN ĐANG CHỌN
              <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <RuleTableInner
                  rows={rows}
                  onUpdateRow={(newRow, idx) => setRows(list => list.map((x, i) => i === idx ? newRow : x))}
                  onDeleteRow={delRow}
                  needsCategory={needsCategory}
                />
              </div>
            )}

            {!rows.length && (
              <div className="p-10 text-center text-gray-400 italic bg-white rounded-2xl border shadow-sm">Chưa có dữ liệu cấu hình.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "quality" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border shadow-sm">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Tra cứu Quy định Chất lượng (Q) & Tuân thủ (C)</h3>
            <div className="flex gap-2">
              <button
                onClick={loadCompliance}
                className="btn btn-sm btn-ghost border border-slate-200"
                title="Lấy dữ liệu mới nhất từ Database"
              >
                🔄 Làm mới
              </button>
              <button
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${showAllSections
                  ? "bg-slate-800 text-white border-slate-800 shadow-md"
                  : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
                  }`}
                onClick={() => setShowAllSections(!showAllSections)}
              >
                {showAllSections ? "← Quay lại bộ phận hiện tại" : "Xem tất cả bộ phận"}
              </button>
            </div>
          </div>
          {showAllSections ? (
            <div className="space-y-6">
              <QualityRulesInfo section="LAMINATION" isSingle={false} complianceDict={complianceDict} onRefresh={loadCompliance} />
              <QualityRulesInfo section="MOLDING" isSingle={false} complianceDict={complianceDict} onRefresh={loadCompliance} />
              <QualityRulesInfo section="LEANLINE_DC" isSingle={false} complianceDict={complianceDict} onRefresh={loadCompliance} />
            </div>
          ) : (
            <QualityRulesInfo section={section} isSingle={true} complianceDict={complianceDict} onRefresh={loadCompliance} />
          )}
        </div>
      )}
    </div>
  );
}

function QualityRulesInfo({ section, isSingle = true, complianceDict = [], onRefresh }) {
  const s = (section || "").toUpperCase();
  const label = isSingle ? s : (s === "LEANLINE_DC" ? "LEANLINE/PREFITTING/TÁCH/BÀO" : s);

  // Helper to add rule
  const handleAdd = async (category, severity) => {
    const pass = prompt("Nhập mật khẩu:");
    if (pass !== "davidtu") return alert("Sai mật khẩu");
    const content = prompt("Nhập nội dung lỗi:");
    if (!content) return;

    const secKey = s === "MOLDING" ? "MOLDING" : (s === "LAMINATION" ? "LAMINATION" : "OTHERS");

    const { error } = await supabase
      .from("kpi_compliance_dictionary")
      .insert([{
        section: secKey,
        category,
        severity,
        content,
      }]);
    if (error) alert("Lỗi: " + error.message);
    else {
      alert("Đã thêm thành công");
      onRefresh?.();
    }
  };

  const handleDelete = async (content) => {
    const pass = prompt("Nhập mật khẩu để xoá:");
    if (pass !== "davidtu") return alert("Sai mật khẩu");
    if (!confirm(`Xoá lỗi: "${content}"?`)) return;

    const { error } = await supabase
      .from("kpi_compliance_dictionary")
      .delete()
      .eq("content", content);

    if (error) alert("Lỗi khi xoá: " + error.message);
    else {
      alert("Đã xoá");
      onRefresh?.();
    }
  };

  const handleSeed = async () => {
    const pass = prompt("Nhập mật khẩu hệ thống:");
    if (pass !== "davidtu") return;

    const defaults = [
      // 1. LAMINATION
      { section: "LAMINATION", category: "COMPLIANCE", severity: "NORMAL", content: "Vi phạm MQAA" },
      { section: "LAMINATION", category: "COMPLIANCE", severity: "NORMAL", content: "Lỗi Rework" },
      { section: "LAMINATION", category: "COMPLIANCE", severity: "NORMAL", content: "Vi phạm khác" },

      // 2. MOLDING
      { section: "MOLDING", category: "COMPLIANCE", severity: "SEVERE", content: "Không kiểm soát nhiệt độ theo quy định" },
      { section: "MOLDING", category: "COMPLIANCE", severity: "NORMAL", content: "Lỗi Tuân thủ khác" },

      // 3. OTHERS (LEANLINE, PREFITTING...)
      // TUÂN THỦ (C) - SEVERE
      { section: "OTHERS", category: "COMPLIANCE", severity: "SEVERE", content: "Không có/không có mẫu đầu chuyền" },
      { section: "OTHERS", category: "COMPLIANCE", severity: "SEVERE", content: "Không thực hiện checklist trước khi làm việc" },
      { section: "OTHERS", category: "COMPLIANCE", severity: "SEVERE", content: "Không thực hiện checklist dò kim" },
      { section: "OTHERS", category: "COMPLIANCE", severity: "SEVERE", content: "Không có mộc dò kim" },
      { section: "OTHERS", category: "COMPLIANCE", severity: "SEVERE", content: "Dao chặt không có thông tin" },
      { section: "OTHERS", category: "COMPLIANCE", severity: "SEVERE", content: "Không tuân thủ/không đo nhiệt độ tiêu chuẩn máy" },
      { section: "OTHERS", category: "COMPLIANCE", severity: "SEVERE", content: "Không sử dụng bảo hộ lao động, chắn lối thoát hiểm" },

      // TUÂN THỦ (C) - NORMAL
      { section: "OTHERS", category: "COMPLIANCE", severity: "NORMAL", content: "Sử dụng điện thoại cá nhân với mục đích riêng" },
      { section: "OTHERS", category: "COMPLIANCE", severity: "NORMAL", content: "Nghỉ ngắn, nghỉ cuối ca trước thời gian quy định" },
      { section: "OTHERS", category: "COMPLIANCE", severity: "NORMAL", content: "Không scan đầy đủ QR code" },
      { section: "OTHERS", category: "COMPLIANCE", severity: "NORMAL", content: "Ngồi nằm trên vật liệu" },
      { section: "OTHERS", category: "COMPLIANCE", severity: "NORMAL", content: "Logo lưu trữ không có tem nhãn" },
      { section: "OTHERS", category: "COMPLIANCE", severity: "NORMAL", content: "Dụng cụ để không đúng vị trí, ko có mã số quản lý" },
      { section: "OTHERS", category: "COMPLIANCE", severity: "NORMAL", content: "Các lỗi tuân thủ khác" },

      // CHẤT LƯỢNG (Q)
      { section: "OTHERS", category: "QUALITY", severity: "NORMAL", content: "Đóng gói sai thiếu (theo đôi)" },
      { section: "OTHERS", category: "QUALITY", severity: "NORMAL", content: "Đóng dư, ghi số thiếu sai/ không ghi số thiếu" },
      { section: "OTHERS", category: "QUALITY", severity: "NORMAL", content: "Dán nhầm tem size run" },
      { section: "OTHERS", category: "QUALITY", severity: "NORMAL", content: "Không in logo" },
      { section: "OTHERS", category: "QUALITY", severity: "NORMAL", content: "Chặt sai dao" },
      { section: "OTHERS", category: "QUALITY", severity: "NORMAL", content: "In sai logo/ in sai phân đoạn" },
      { section: "OTHERS", category: "QUALITY", severity: "NORMAL", content: "Chặt in đóng gói sai yêu cầu đối với chỉ lệnh" },
      { section: "OTHERS", category: "QUALITY", severity: "NORMAL", content: "Lỗi in khác" },
      { section: "OTHERS", category: "QUALITY", severity: "NORMAL", content: "Lỗi đóng gói khác" },
      { section: "OTHERS", category: "QUALITY", severity: "NORMAL", content: "Phàn nàn khách hàng" },
      { section: "OTHERS", category: "QUALITY", severity: "NORMAL", content: "Lỗi Phế" }
    ];

    const { error } = await supabase.from("kpi_compliance_dictionary").upsert(defaults, { onConflict: 'section,category,content' });
    if (error) alert(error.message);
    else {
      alert("Đã đồng bộ dữ liệu gốc lên hệ thống!");
      onRefresh?.();
    }
  };

  const getComplianceOptions = (cat = "COMPLIANCE") => {
    const secKey = s === "MOLDING" ? "MOLDING" : (s === "LAMINATION" ? "LAMINATION" : "OTHERS");
    return ["NONE", ...new Set(complianceDict.filter(r => r.section === secKey && r.category === cat).map(r => r.content))];
  };

  const getRules = (category, type) => {
    const secKey = s === "MOLDING" ? "MOLDING" : (s === "LAMINATION" ? "LAMINATION" : "OTHERS");
    return complianceDict.filter(r => r.section === secKey && r.category === category && r.severity === type);
  };

  // 1. RULES CHO LAMINATION
  if (s === "LAMINATION") {
    return (
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg shadow-sm">
        <h3 className="font-bold text-orange-800 mb-3 text-lg border-b border-orange-200 pb-1">
          {isSingle ? "Bảng tra điểm Chất lượng (Q) & Tuân thủ (C) - " + s : "1. BỘ PHẬN " + label}
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          {/* CỘT CHẤT LƯỢNG (Q) */}
          <div className="p-4 bg-white rounded-xl border border-orange-100 shadow-sm space-y-4">
            <div>
              <h4 className="font-bold text-orange-700 border-b pb-1 mb-2 text-xs uppercase underline">Quy tắc tính điểm Q (Tối đa 5đ):</h4>
              <p className="text-[11px] font-bold text-blue-700 mb-1">● Nếu là Hàng Phế (Scrap):</p>
              <table className="text-[11px] border w-full bg-white text-center mb-2">
                <thead><tr className="bg-orange-100"><th className="p-1 border text-orange-800">Số đôi phế</th><th className="p-1 border text-orange-800">Điểm Q</th></tr></thead>
                <tbody>
                  <tr><td className="p-1 border italic">0 - 1 đôi</td><td className="p-1 border font-black text-green-600">5</td></tr>
                  <tr><td className="p-1 border italic">2 - 3 đôi</td><td className="p-1 border font-black text-blue-600">4</td></tr>
                  <tr><td className="p-1 border italic">4 - 5 đôi</td><td className="p-1 border font-black text-orange-500">2</td></tr>
                  <tr><td className="p-1 border italic">&gt; 5 đôi</td><td className="p-1 border font-black text-red-600">0</td></tr>
                </tbody>
              </table>
              <div className="p-2 bg-red-50 border border-red-200 rounded text-[11px]">
                <p className="font-bold text-red-700">● Nếu là Hàng Fail Bonding (Dry):</p>
                <p className="text-red-600 font-medium italic">Trừ thẳng 5 điểm → Còn 0 điểm chất lượng.</p>
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-orange-700 text-xs uppercase">Danh mục lỗi Chất lượng</h4>
                <button onClick={() => handleAdd("QUALITY", "NORMAL")} className="btn btn-xs bg-green-400 text-black hover:bg-green-500 border-none text-[9px] h-6 min-h-0 shadow-sm">+ Thêm</button>
              </div>
              <ul className="list-disc pl-4 text-[11px] space-y-1 text-gray-700">
                {getRules("QUALITY", "NORMAL").map((item, idx) => (
                  <li key={idx} className="group flex items-center justify-between hover:bg-orange-50 rounded px-1">
                    <span>{item.content}</span>
                    <button onClick={() => handleDelete(item.content)} className="hidden group-hover:block text-red-500 ml-2">×</button>
                  </li>
                ))}
                {getRules("QUALITY", "NORMAL").length === 0 && <li className="italic text-gray-400">Trống</li>}
              </ul>
            </div>
          </div>

          {/* CỘT TUÂN THỦ (C) */}
          <div className="p-4 bg-white rounded-xl border border-red-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-red-700">2. Lỗi Tuân thủ (C)</h4>
              <div className="flex gap-1">
                <button onClick={() => handleAdd("COMPLIANCE", "SEVERE")} className="btn btn-xs bg-red-500 text-white hover:bg-red-600 border-none"> + Nghiêm trọng</button>
                <button onClick={() => handleAdd("COMPLIANCE", "NORMAL")} className="btn btn-xs bg-red-100 text-red-700 hover:bg-red-200 border-none"> + Thường</button>
              </div>
            </div>
            <ul className="list-disc pl-5 text-[11px] space-y-1 text-gray-700">
              <li className="text-red-700 font-bold uppercase">Lỗi Nghiêm trọng:</li>
              <ul className="list-circle pl-5 mb-1">
                {getRules("COMPLIANCE", "SEVERE").map((item, idx) => (
                  <li key={idx} className="group flex items-center justify-between">
                    <span>{item.content}</span>
                    <button onClick={() => handleDelete(item.content)} className="hidden group-hover:block text-red-500 ml-2">×</button>
                  </li>
                ))}
              </ul>
              <li className="text-gray-900 font-bold uppercase">Lỗi Bình thường:</li>
              <ul className="list-circle pl-5">
                {getRules("COMPLIANCE", "NORMAL").map((item, idx) => (
                  <li key={idx} className="group flex items-center justify-between">
                    <span>{item.content}</span>
                    <button onClick={() => handleDelete(item.content)} className="hidden group-hover:block text-red-500 ml-2">×</button>
                  </li>
                ))}
              </ul>
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
                <tr><td className="p-1 px-3 border">0 - 1 đôi</td><td className="p-1 px-3 border font-bold">5</td></tr>
                <tr><td className="p-1 px-3 border">1.5 - 2 đôi</td><td className="p-1 px-3 border font-bold">4</td></tr>
                <tr><td className="p-1 px-3 border">2.5 - 3 đôi</td><td className="p-1 px-3 border font-bold">3</td></tr>
                <tr><td className="p-1 px-3 border">3.5 - 4 đôi</td><td className="p-1 px-3 border font-bold">2</td></tr>
                <tr><td className="p-1 px-3 border">4.5 - 5 đôi</td><td className="p-1 px-3 border font-bold">1</td></tr>
                <tr><td className="p-1 px-3 border">&gt; 5 đôi</td><td className="p-1 px-3 border font-bold text-red-600">0</td></tr>
              </tbody>
            </table>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* CỘT CHẤT LƯỢNG (Q) */}
            <div className="p-4 bg-white rounded-xl border border-teal-100 shadow-sm space-y-4">
              <div>
                <h4 className="font-bold text-teal-700 border-b pb-1 mb-2 text-xs uppercase">Bảng tính điểm theo số đôi phế (Q)</h4>
                <table className="text-[11px] border w-full bg-white text-center">
                  <thead><tr className="bg-teal-100"><th className="p-1 border text-teal-800">Số đôi phế</th><th className="p-1 border text-teal-800">Điểm Q</th></tr></thead>
                  <tbody>
                    <tr><td className="p-1 border">0 - 1 đôi</td><td className="p-1 border font-bold">5</td></tr>
                    <tr><td className="p-1 border">1.5 - 2 đôi</td><td className="p-1 border font-bold">4</td></tr>
                    <tr><td className="p-1 border">2.5 - 3 đôi</td><td className="p-1 border font-bold">3</td></tr>
                    <tr><td className="p-1 border">3.5 - 4 đôi</td><td className="p-1 border font-bold">2</td></tr>
                    <tr><td className="p-1 border">4.5 - 5 đôi</td><td className="p-1 border font-bold">1</td></tr>
                    <tr><td className="p-1 border text-red-600">&gt; 5 đôi</td><td className="p-1 border font-bold text-red-600">0</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="pt-2 border-t">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-teal-700 text-xs uppercase">Danh mục lỗi Chất lượng</h4>
                  <button onClick={() => handleAdd("QUALITY", "NORMAL")} className="btn btn-xs bg-green-400 text-black hover:bg-green-500 border-none text-[9px] h-6 min-h-0 shadow-sm">+ Thêm</button>
                </div>
                <ul className="list-disc pl-4 text-[11px] space-y-1 text-gray-700">
                  {getRules("QUALITY", "NORMAL").map((item, idx) => (
                    <li key={idx} className="group flex items-center justify-between hover:bg-teal-50 rounded px-1">
                      <span>{item.content}</span>
                      <button onClick={() => handleDelete(item.content)} className="hidden group-hover:block text-red-500 ml-2">×</button>
                    </li>
                  ))}
                  {getRules("QUALITY", "NORMAL").length === 0 && <li className="italic text-gray-400">Trống</li>}
                </ul>
              </div>
            </div>

            {/* CỘT TUÂN THỦ (C) */}
            <div className="p-4 bg-white rounded-xl border border-red-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-bold text-red-700">2. Lỗi Tuân thủ (C)</h4>
                <div className="flex gap-1">
                  <button onClick={() => handleAdd("COMPLIANCE", "SEVERE")} className="btn btn-xs bg-red-500 text-white hover:bg-red-600 border-none"> + Nghiêm trọng</button>
                  <button onClick={() => handleAdd("COMPLIANCE", "NORMAL")} className="btn btn-xs bg-red-100 text-red-700 hover:bg-red-200 border-none"> + Thường</button>
                </div>
              </div>
              <ul className="list-disc pl-5 text-[11px] space-y-1 text-gray-700">
                <li className="text-red-700 font-bold uppercase">Lỗi Nghiêm trọng:</li>
                <ul className="list-circle pl-5 mb-1">
                  {getRules("COMPLIANCE", "SEVERE").map((item, idx) => (
                    <li key={idx} className="group flex items-center justify-between">
                      <span>{item.content}</span>
                      <button onClick={() => handleDelete(item.content)} className="hidden group-hover:block text-red-500 ml-2">×</button>
                    </li>
                  ))}
                </ul>
                <li className="text-gray-900 font-bold uppercase">Lỗi Bình thường:</li>
                <ul className="list-circle pl-5">
                  {getRules("COMPLIANCE", "NORMAL").map((item, idx) => (
                    <li key={idx} className="group flex items-center justify-between">
                      <span>{item.content}</span>
                      <button onClick={() => handleDelete(item.content)} className="hidden group-hover:block text-red-500 ml-2">×</button>
                    </li>
                  ))}
                </ul>
              </ul>
            </div>
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
              <tr><td className="p-1 px-3 border">2.5 - 3 đôi</td><td className="p-1 px-3 border font-bold">3</td></tr>
              <tr><td className="p-1 px-3 border">3.5 - 4 đôi</td><td className="p-1 px-3 border font-bold">2</td></tr>
              <tr><td className="p-1 px-3 border">4.5 - 5 đôi</td><td className="p-1 px-3 border font-bold">1</td></tr>
              <tr><td className="p-1 px-3 border">&gt; 5 đôi</td><td className="p-1 px-3 border font-bold text-red-600">0</td></tr>
            </tbody>
          </table>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* CỘT CHẤT LƯỢNG (Q) */}
          <div className="p-4 bg-white rounded-xl border border-blue-100 shadow-sm space-y-4">
            <div>
              <h4 className="font-bold text-blue-700 border-b pb-1 mb-2 text-xs uppercase">Bảng tính điểm theo số đôi phế (Q)</h4>
              <table className="text-[11px] border w-full bg-white text-center">
                <thead><tr className="bg-blue-100"><th className="p-1 border text-blue-800">Số đôi phế</th><th className="p-1 border text-blue-800">Điểm Q</th></tr></thead>
                <tbody>
                  <tr><td className="p-1 border">0 - 1 đôi</td><td className="p-1 border font-bold">5</td></tr>
                  <tr><td className="p-1 border">1.5 - 2 đôi</td><td className="p-1 border font-bold">4</td></tr>
                  <tr><td className="p-1 border">2.5 - 3 đôi</td><td className="p-1 border font-bold">3</td></tr>
                  <tr><td className="p-1 border">3.5 - 4 đôi</td><td className="p-1 border font-bold">2</td></tr>
                  <tr><td className="p-1 border">4.5 - 5 đôi</td><td className="p-1 border font-bold">1</td></tr>
                  <tr><td className="p-1 border text-red-600">&gt; 5 đôi</td><td className="p-1 border font-bold text-red-600">0</td></tr>
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-blue-700 text-xs uppercase">Danh mục lỗi Chất lượng</h4>
                <button onClick={() => handleAdd("QUALITY", "NORMAL")} className="btn btn-xs bg-green-400 text-black hover:bg-green-500 border-none text-[9px] h-6 min-h-0 shadow-sm">+ Thêm</button>
              </div>
              <ul className="list-disc pl-4 text-[11px] space-y-1 text-gray-700">
                {getRules("QUALITY", "NORMAL").map((item, idx) => (
                  <li key={idx} className="group flex items-center justify-between hover:bg-blue-50 rounded px-1">
                    <span>{item.content}</span>
                    <button onClick={() => handleDelete(item.content)} className="hidden group-hover:block text-red-500 ml-2">×</button>
                  </li>
                ))}
                {getRules("QUALITY", "NORMAL").length === 0 && <li className="italic text-gray-400">Trống</li>}
              </ul>
            </div>
          </div>

          {/* CỘT TUÂN THỦ (C) */}
          <div className="p-4 bg-white rounded-xl border border-red-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-red-700">2. Lỗi Tuân thủ (C)</h4>
              <div className="flex gap-1">
                <button onClick={() => handleAdd("COMPLIANCE", "SEVERE")} className="btn btn-xs bg-red-500 text-white hover:bg-red-600 border-none"> + Nghiêm trọng</button>
                <button onClick={() => handleAdd("COMPLIANCE", "NORMAL")} className="btn btn-xs bg-red-100 text-red-700 hover:bg-red-200 border-none"> + Thường</button>
              </div>
            </div>
            <ul className="list-disc pl-5 text-[11px] space-y-1 text-gray-700">
              <li className="text-red-700 font-bold uppercase">Lỗi loại A (Nghiêm trọng):</li>
              <ul className="list-circle pl-5 mb-1">
                {getRules("COMPLIANCE", "SEVERE").map((item, idx) => (
                  <li key={idx} className="group flex items-center justify-between">
                    <span>{item.content}</span>
                    <button onClick={() => handleDelete(item.content)} className="hidden group-hover:block text-red-500 ml-2">×</button>
                  </li>
                ))}
              </ul>
              <li className="text-gray-900 font-bold uppercase">Lỗi loại B (Bình thường):</li>
              <ul className="list-circle pl-5">
                {getRules("COMPLIANCE", "NORMAL").map((item, idx) => (
                  <li key={idx} className="group flex items-center justify-between">
                    <span>{item.content}</span>
                    <button onClick={() => handleDelete(item.content)} className="hidden group-hover:block text-red-500 ml-2">×</button>
                  </li>
                ))}
              </ul>
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-4 pt-2 border-t border-blue-200 text-sm font-medium text-blue-900">
        CÔNG THỨC: Tổng điểm = P (max 7) + Q (max 5) + C (max 3) = Tối đa 15 điểm.
      </div>
    </div>
  );
}
