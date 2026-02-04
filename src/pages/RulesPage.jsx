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
      .eq("section", dbSection)
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
              {needsCategory ? "Thiết lập Ngưỡng Sản lượng" : "Thiết lập tỷ lệ %OE"}
            </h3>
            <div className="flex items-center gap-2">
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
          <div className="overflow-auto pb-4 bg-white rounded-2xl border shadow-sm">
            {needsCategory ? (
              <table className="table table-sm w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="p-3">Loại hàng/Line</th>
                    <th className="p-3">Ngưỡng (≥)</th>
                    <th className="p-3">Điểm</th>
                    <th className="p-3">Ghi chú</th>
                    <th className="p-3 text-center">Active</th>
                    <th className="p-3 text-center">Xoá</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.id ?? `new-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2">
                        <input
                          className="input input-sm input-bordered w-full"
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
                          className="input input-sm input-bordered w-24"
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
                          className="input input-sm input-bordered w-16"
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
                          className="input input-sm input-bordered w-full"
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
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary"
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
                      <td className="p-2 text-center">
                        <button className="btn btn-ghost btn-xs text-red-500 hover:bg-red-50" onClick={() => delRow(r.id, idx)}>
                          Xoá
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="table table-sm w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="p-3">Ngưỡng %OE (≥)</th>
                    <th className="p-3">Điểm</th>
                    <th className="p-3">Ghi chú</th>
                    <th className="p-3 text-center">Active</th>
                    <th className="p-3 text-center">Xoá</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.id ?? `new-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2">
                        <input
                          type="number"
                          className="input input-sm input-bordered w-32"
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
                          className="input input-sm input-bordered w-20"
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
                          className="input input-sm input-bordered w-full"
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
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary"
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
                      <td className="p-2 text-center">
                        <button className="btn btn-ghost btn-xs text-red-500 hover:bg-red-50" onClick={() => delRow(r.id, idx)}>
                          Xoá
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!rows.length && (
              <div className="p-10 text-center text-gray-400 italic">Chưa có dữ liệu cấu hình.</div>
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
          <div className="space-y-3">
            <h4 className="font-semibold text-orange-700">1. Điểm Chất lượng (Q) - Tối đa 5 đ</h4>
            <ul className="list-disc pl-5 text-[11px] space-y-1 text-gray-700">
              <li><b>Hàng phế (Scrap):</b> Theo bảng bên dưới.</li>
              <li><b>Fail Bonding (Dry):</b> 0 điểm.</li>
            </ul>
            <table className="text-xs border mt-1 bg-white">
              <thead><tr className="bg-orange-100"><th className="p-1 px-3 border">Số đôi phế</th><th className="p-1 px-3 border">Điểm Q</th></tr></thead>
              <tbody>
                <tr><td className="p-1 px-3 border">0 - 1 đôi</td><td className="p-1 px-3 border font-bold">5</td></tr>
                <tr><td className="p-1 px-3 border">2 - 3 đôi</td><td className="p-1 px-3 border font-bold">4</td></tr>
                <tr><td className="p-1 px-3 border">4 - 5 đôi</td><td className="p-1 px-3 border font-bold">2</td></tr>
                <tr><td className="p-1 px-3 border">&gt; 5 đôi</td><td className="p-1 px-3 border font-bold text-red-600">0</td></tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-orange-700">2. Điểm Tuân thủ (C) - Tối đa 3 đ</h4>
              <div className="flex gap-1">
                <button onClick={handleSeed} className="btn btn-xs btn-ghost text-[10px] opacity-20 hover:opacity-100">Seed</button>
                <button onClick={() => handleAdd("NORMAL")} className="btn btn-xs bg-orange-200 text-orange-800 hover:bg-orange-300 border-none">+ Lỗi mới</button>
              </div>
            </div>
            <ul className="list-disc pl-5 text-[11px] space-y-1 text-gray-700">
              <li>Mặc định ban đầu: <b>3 điểm</b>.</li>
              {getRules("COMPLIANCE", "NORMAL").map((item, idx) => (
                <li key={idx} className="group flex items-center justify-between">
                  <span><b>{item.content}:</b> Trừ <b>1 điểm/lần</b>.</span>
                  <button onClick={() => handleDelete(item.content)} className="hidden group-hover:block text-red-500 ml-2">×</button>
                </li>
              ))}
              {getRules("COMPLIANCE", "NORMAL").length === 0 && <li className="italic text-gray-400">Vui lòng nhấn Seed để nạp dữ liệu...</li>}
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
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-teal-700">2. Điểm Tuân thủ (C) - Tối đa 3 đ</h4>
              <div className="flex gap-1">
                <button onClick={() => handleAdd("SEVERE")} className="btn btn-xs bg-red-100 text-red-700 hover:bg-red-200 border-none"> + Nghiêm trọng</button>
                <button onClick={() => handleAdd("NORMAL")} className="btn btn-xs bg-teal-100 text-teal-700 hover:bg-teal-200 border-none"> + Thường</button>
              </div>
            </div>
            <ul className="list-disc pl-5 text-[11px] space-y-1 text-gray-700">
              <li>Mặc định ban đầu: <b>3 điểm</b>.</li>
              <li className="text-red-700 font-bold flex items-center justify-between">
                Lỗi Nghiêm trọng (Về 0):
              </li>
              <ul className="list-circle pl-5 mb-1">
                {getRules("SEVERE").map((item, idx) => (
                  <li key={idx} className="group flex items-center justify-between">
                    <span>{item.content}</span>
                    <button onClick={() => handleDelete(item.content)} className="hidden group-hover:block text-red-500 ml-2">×</button>
                  </li>
                ))}
              </ul>
              <li className="text-teal-700 font-bold">Lỗi Bình thường (-1đ):</li>
              <ul className="list-circle pl-5">
                {getRules("NORMAL").map((item, idx) => (
                  <li key={idx} className="group flex items-center justify-between">
                    <span>{item.content}</span>
                    <button onClick={() => handleDelete(item.content)} className="hidden group-hover:block text-red-500 ml-2">×</button>
                  </li>
                ))}
              </ul>
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

        <div className="grid md:grid-cols-2 gap-6">
          {/* CỘT CHẤT LƯỢNG (Q) */}
          <div className="p-4 bg-white rounded-xl border border-blue-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-blue-700">1. Lỗi Chất lượng (Q)</h4>
              <button onClick={() => handleAdd("QUALITY", "NORMAL")} className="btn btn-xs btn-outline btn-info text-[10px]">+ Thêm lỗi Q</button>
            </div>
            <ul className="list-disc pl-5 text-[11px] space-y-1 text-gray-700">
              {getRules("QUALITY", "NORMAL").map((item, idx) => (
                <li key={idx} className="group flex items-center justify-between">
                  <span>{item.content}</span>
                  <button onClick={() => handleDelete(item.content)} className="hidden group-hover:block text-red-500 ml-2">×</button>
                </li>
              ))}
              {getRules("QUALITY", "NORMAL").length === 0 && <li className="italic text-gray-400">Trống</li>}
            </ul>
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
