// src/pages/QuickEntryLPS.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { scoreByQuality, scoreByProductivityLPSQuick } from "../lib/scoring";
// import { useKpiSection } from "../context/KpiSectionContext"; // Không cần thiết ở đây vì đã nhận prop section

/* ===== Helpers ===== */
const COMPLIANCE_OPTIONS = [
    { value: "NONE", label: "Không vi phạm" },
    { value: "Ký mẫu đầu chuyền trước khi sử dụng", label: "Ký mẫu đầu chuyền trước khi sử dụng" },
    { value: "Quy định về kiểm tra điều kiện máy trước/trong khi sản xuất", label: "Quy định về kiểm tra điều kiện máy trước/trong khi sản xuất" },
    { value: "Quy định về kiểm tra nguyên liệu trước/trong khi sản xuất", label: "Quy định về kiểm tra nguyên liệu trước/trong khi sản xuất" },
    { value: "Quy định về kiểm tra quy cách/tiêu chuẩn sản phẩm trước/trong khi sản xuất", label: "Quy định về kiểm tra quy cách/tiêu chuẩn sản phẩm trước/trong khi sản xuất" },
    { value: "Vi phạm nội quy bộ phận/công ty", label: "Vi phạm nội quy bộ phận/công ty" },
];
const cx = (...classes) => classes.filter(Boolean).join(" ");
const currentMachines = {
    LAMINATION: ["Dán 1", "Dán 2", "Dán 3"],
    PREFITTING: ["Line 1", "Line 2", "Line 3", "Line 4", "Line 5"],
    BÀO: ["Bào 1", "Bào 2"],
    TÁCH: ["Tách 1", "Tách 2"],
};
const defaultCategoryBySection = {
    LAMINATION: 'Lượt dán/giờ',
    PREFITTING: 'Sản lượng/giờ',
    BÀO: 'Sản lượng/giờ',
    TÁCH: 'Sản lượng/giờ',
};


/* ================= Approver Mode HYBRID ================= */

export default function ApproverModeHybrid({ section }) {
    
    const [step, setStep] = useState(1);
    const [prodRules, setProdRules] = useState([]); 
    const [selectedWorkers, setSelectedWorkers] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [approverIdInput, setApproverIdInput] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [searchAllSections, setSearchAllSections] = useState(false);
    const [lineFilter, setLineFilter] = useState("");
    const [tplTargetValue, setTplTargetValue] = useState(0); 
    const [tplDefects, setTplDefects] = useState(0); 
    const defaultCategory = defaultCategoryBySection[section] || '';
    const [tplLine, setTplLine] = useState(currentMachines[section]?.[0] || ""); 
    const [tplCategory, setTplCategory] = useState(defaultCategory);
    const [saving, setSaving] = useState(false);
    const pageSize = 50;
    const [page, setPage] = useState(1);
    const selectedIds = useMemo(() => new Set(selectedWorkers.map(w => w.msnv)), [selectedWorkers]);
    
    // Thêm hàm xoá tất cả
    function removeAllWorkers() {
        if (window.confirm(`Bạn có chắc muốn xoá ${selectedWorkers.length} nhân viên đã chọn?`)) {
            setSelectedWorkers([]);
        }
    }

    const filteredSearchResults = useMemo(() => {
        if (!lineFilter) return searchResults;
        return searchResults.filter(w => w.line === lineFilter);
    }, [searchResults, lineFilter]);

    const calculateScores = (targetValue, defects, rules, sec, category) => {
        const q = scoreByQuality(defects);
        const p = scoreByProductivityLPSQuick(targetValue, rules, sec, category);
        const total = q + p;
        return { qScore: q, pScore: p, kpi: Math.min(15, total), rawTotal: total };
    };

    const reviewRows = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return selectedWorkers.map(w => {
            const { qScore, pScore, kpi } = calculateScores(tplTargetValue, tplDefects, prodRules, section, tplCategory);
            return {
                ...w,
                date: today,
                section,
                line: tplLine,
                category: tplCategory,
                target_value: tplTargetValue,
                defects: tplDefects,
                q_score: qScore,
                p_score: pScore,
                day_score: kpi,
                compliance_code: w.compliance_code || "NONE" // Lấy compliance_code từ selectedWorkers
            };
        });
    }, [selectedWorkers, tplTargetValue, tplDefects, tplLine, tplCategory, prodRules, section]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(reviewRows.length / pageSize)), [reviewRows.length]);
    const pageRows = useMemo(
        () => reviewRows.slice((page - 1) * pageSize, page * pageSize),
        [reviewRows, page]
    );

    useEffect(() => {
        let cancelled = false;
        async function loadRules() {
            const { data: rules, error } = await supabase
                .from("kpi_rules_prod_lps")
                .select("*")
                .eq("section", section);
            if (!cancelled) {
                if (error) {
                    console.error("Lỗi tải rules:", error);
                } else {
                    setProdRules(rules || []);
                }
            }
        }
        loadRules();
        
        // Reset template category khi section thay đổi
        setTplCategory(defaultCategoryBySection[section] || '');
        setTplLine(currentMachines[section]?.[0] || "");
        
        return () => { cancelled = true; };
    }, [section]);
    useEffect(() => setPage(1), [reviewRows.length]);

    function addWorker(worker) {
        if (!selectedIds.has(worker.msnv)) {
            setSelectedWorkers(prev => [...prev, worker]);
        }
    }

    function removeWorker(msnv) {
        setSelectedWorkers(prev => prev.filter(w => w.msnv !== msnv));
    }
    
    function addAllResults() {
        setSelectedWorkers(prev => {
            const existingIds = new Set(prev.map(w => w.msnv));
            const newWorkersToAdd = filteredSearchResults.filter(
                worker => !existingIds.has(worker.msnv)
            );
            return [...prev, ...newWorkersToAdd];
        });
    }

    function proceedToTemplate() {
        if (selectedWorkers.length === 0) return alert("Vui lòng chọn nhân viên.");
        setStep(2);
    }

    function buildReviewRows() {
        setStep(3);
    }

    async function searchByApprover() {
        const q = approverIdInput.trim();
        if (!q) return alert("Nhập Tên hoặc MSNV người duyệt.");
        setLoadingSearch(true);
        let query;
        if (isNaN(Number(q))) {
            query = supabase.from("users")
                .select("msnv, full_name, section, line, approver_msnv, approver_name")
                .ilike("approver_name", `%${q}%`);
        } else {
            query = supabase.from("users")
                .select("msnv, full_name, section, line, approver_msnv, approver_name")
                .eq("approver_msnv", q);
        }
        if (!searchAllSections) {
            query = query.eq("section", section); 
        }
        // ĐÃ XOÁ .limit(100)
        const { data, error } = await query;
        setLoadingSearch(false);
        if (error) return alert("Lỗi tải nhân viên: " + error.message);
        setSearchResults(data || []); 
        setSearchInput("");
        setLineFilter("");
    }

    async function searchGlobal() {
        const q = searchInput.trim();
        if (!q) return alert("Nhập Tên hoặc MSNV nhân viên.");
        setLoadingSearch(true);
        let query;
        if (isNaN(Number(q))) {
            query = supabase.from("users").select("msnv, full_name, section, line, approver_msnv, approver_name").ilike("full_name", `%${q}%`);
        } else {
            query = supabase.from("users").select("msnv, full_name, section, line, approver_msnv, approver_name").eq("msnv", q);
        }
        if (!searchAllSections) {
            query = query.eq("section", section);
        }
        // ĐÃ XOÁ .limit(50)
        const { data, error } = await query;
        setLoadingSearch(false);
        if (error) return alert("Lỗi tìm nhân viên: " + error.message);
        setSearchResults(data || []);
        setApproverIdInput("");
        setLineFilter("");
    }

    async function saveEntry() {
        setSaving(true);
        const records = reviewRows.map(r => ({
            ...r,
            approver_id: r.approver_msnv,
            compliance_code: r.compliance_code || "NONE",
            date: new Date(r.date).toISOString().split('T')[0]
        }));

        const { error } = await supabase
            .from("kpi_quick_entry_lps")
            .insert(records);

        setSaving(false);
        if (error) {
            alert("Lỗi lưu KPI: " + error.message);
        } else {
            alert(`Đã lưu thành công ${records.length} bản ghi.`);
            setStep(1);
            setSelectedWorkers([]);
        }
    }

    function updateCompliance(msnv, value) {
        setSelectedWorkers(prev => prev.map(w => w.msnv === msnv ? { ...w, compliance_code: value } : w));
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold">Nhập KPI Nhanh - {section}</h2>
            
            {step === 1 && (
                <>
                    <div className="flex justify-end">
                        <button className="btn btn-primary" onClick={proceedToTemplate} disabled={selectedWorkers.length === 0}>
                            Tiếp tục ({selectedWorkers.length} nhân viên)
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ minHeight: '400px' }}>
                        {/* KHỐI ĐÃ CHỌN */}
                        <div className="border rounded p-3 bg-white space-y-2 flex flex-col">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold text-lg">Đã chọn ({selectedWorkers.length})</h3>
                                {selectedWorkers.length > 0 && (
                                    <button 
                                        className="btn bg-red-100 text-red-700 hover:bg-red-200" 
                                        style={{padding: '4px 8px'}} 
                                        onClick={removeAllWorkers}
                                    >
                                        Xoá tất cả
                                    </button>
                                )}
                            </div>
                            <div className="overflow-auto flex-1">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr><th className="p-2 text-left">MSNV</th><th className="p-2 text-left">Họ & tên</th><th className="p-2 text-center">Line</th><th className="p-2 text-center">Xoá</th></tr>
                                    </thead>
                                    <tbody>
                                        {selectedWorkers.map((w) => (
                                            <tr key={w.msnv} className="border-t hover:bg-gray-50">
                                                <td className="p-2">{w.msnv}</td>
                                                <td className="p-2">{w.full_name}</td>
                                                <td className="p-2 text-center">{w.line || "N/A"}</td>
                                                <td className="p-2 text-center">
                                                    <button className="text-red-500 hover:text-red-700" onClick={() => removeWorker(w.msnv)}>Xoá</button>
                                                </td>
                                            </tr>
                                        ))}
                                        {!selectedWorkers.length && (<tr><td colSpan={4} className="p-4 text-center text-gray-500">Chưa chọn nhân viên nào.</td></tr>)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        {/* KHỐI KẾT QUẢ TÌM KIẾM */}
                        <div className="md:col-span-1 border rounded p-3 bg-white space-y-2 flex flex-col">
                            <h3 className="font-semibold text-lg">Tìm kiếm nhân viên</h3>
                            
                            {/* Form tìm kiếm theo Người duyệt (Cách 1) */}
                            <div className="space-y-2 p-2 border rounded">
                                <h4 className="font-medium">Cách 1: Tìm theo MSNV/Tên người duyệt</h4>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="input flex-1"
                                        placeholder="MSNV hoặc Tên người duyệt"
                                        value={approverIdInput}
                                        onChange={(e) => setApproverIdInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && searchByApprover()}
                                    />
                                    <button className="btn btn-primary" onClick={searchByApprover} disabled={loadingSearch}>
                                        {loadingSearch ? "Đang tìm..." : "Tìm"}
                                    </button>
                                </div>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={searchAllSections} onChange={(e) => setSearchAllSections(e.target.checked)} />
                                    Tìm kiếm toàn bộ Section
                                </label>
                            </div>

                            {/* Form tìm kiếm toàn cục (Cách 2) */}
                            <div className="space-y-2 p-2 border rounded">
                                <h4 className="font-medium">Cách 2: Tìm theo MSNV/Tên nhân viên (Toàn cục)</h4>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="input flex-1"
                                        placeholder="MSNV hoặc Tên nhân viên"
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && searchGlobal()}
                                    />
                                    <button className="btn btn-primary" onClick={searchGlobal} disabled={loadingSearch}>
                                        {loadingSearch ? "Đang tìm..." : "Tìm"}
                                    </button>
                                </div>
                            </div>

                            {/* Filter theo Line */}
                            {searchResults.length > 0 && (
                                <div className="flex gap-2 items-center text-sm">
                                    <label>Lọc theo Line:</label>
                                    <select className="input" value={lineFilter} onChange={(e) => setLineFilter(e.target.value)}>
                                        <option value="">Tất cả ({searchResults.length})</option>
                                        {[...new Set(searchResults.map(w => w.line))].sort().filter(Boolean).map(line => (
                                            <option key={line} value={line}>{line} ({searchResults.filter(w => w.line === line).length})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="flex justify-end">
                                <button 
                                    className="btn" 
                                    onClick={addAllResults} 
                                    disabled={!filteredSearchResults.length}
                                >
                                    + Thêm tất cả ({filteredSearchResults.length})
                                </button>
                            </div>

                            <div className="overflow-auto flex-1">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="p-2 text-left">MSNV</th>
                                            <th className="p-2 text-left">Họ & tên</th>
                                            <th className="p-2 text-center">Line</th> 
                                            <th className="p-2 text-center">Thêm</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSearchResults.map((w) => { 
                                            const isSelected = selectedIds.has(w.msnv);
                                            return (
                                                <tr key={w.msnv} className={cx("border-t", isSelected ? "bg-gray-100 opacity-50" : "hover:bg-gray-50")}>
                                                    <td className="p-2">{w.msnv}</td>
                                                    <td className="p-2">{w.full_name}</td>
                                                    <td className="p-2 text-center">{w.line || "N/A"}</td> 
                                                    <td className="p-2 text-center">
                                                        <button 
                                                            className="btn" 
                                                            style={{padding: '4px 8px'}} 
                                                            onClick={() => addWorker(w)} 
                                                            disabled={isSelected}
                                                        >
                                                            {isSelected ? "Đã chọn" : "+"}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {!filteredSearchResults.length && (<tr><td colSpan={4} className="p-4 text-center text-gray-500">Không có kết quả.</td></tr>)} 
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {step === 2 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Bước 2: Nhập dữ liệu KPI mẫu</h3>
                    <div className="space-y-3 p-4 border rounded bg-gray-50">
                        <h4 className="font-medium">Áp dụng cho {selectedWorkers.length} nhân viên</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div><label className="block text-sm font-medium">Line</label>
                                <select className="input w-full" value={tplLine} onChange={(e) => setTplLine(e.target.value)}>
                                    {currentMachines[section]?.map(m => (<option key={m} value={m}>{m}</option>))}
                                </select>
                            </div>
                            <div><label className="block text-sm font-medium">Chỉ tiêu (Ví dụ: Lượt dán/giờ)</label>
                                <select className="input w-full" value={tplCategory} onChange={(e) => setTplCategory(e.target.value)}>
                                    <option value="Lượt dán/giờ">Lượt dán/giờ</option>
                                    <option value="Sản lượng/giờ">Sản lượng/giờ</option>
                                </select>
                            </div>
                            <div><label className="block text-sm font-medium">Giá trị ({tplCategory.split('/')[0]})</label>
                                <input type="number" className="input w-full" value={tplTargetValue} onChange={(e) => setTplTargetValue(Number(e.target.value))} />
                            </div>
                            <div><label className="block text-sm font-medium">Defects (pcs)</label>
                                <input type="number" className="input w-full" value={tplDefects} onChange={(e) => setTplDefects(Number(e.target.value))} />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between">
                        <button className="btn btn-secondary" onClick={() => setStep(1)}>Quay lại</button>
                        <button className="btn btn-primary" onClick={buildReviewRows}>Xem trước và Xác nhận</button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Bước 3: Xác nhận & Lưu KPI</h3>
                    <p className="text-sm text-red-500">LƯU Ý: Vui lòng kiểm tra kỹ trước khi lưu! Điểm sẽ được tính theo công thức của Section **{section}**.</p>
                    
                    <div className="overflow-auto max-h-[60vh] border rounded">
                        <table className="min-w-full text-sm">
                            <thead className="sticky top-0 bg-gray-200">
                                <tr>
                                    <th className="p-2 text-left">MSNV</th>
                                    <th className="p-2 text-left">Họ & tên</th>
                                    <th className="p-2 text-center">Line</th>
                                    <th className="p-2 text-center">{tplCategory}</th>
                                    <th className="p-2 text-center">Defects</th>
                                    <th className="p-2 text-center">Q-Score</th>
                                    <th className="p-2 text-center">P-Score</th>
                                    <th className="p-2 text-center">KPI</th>
                                    <th className="p-2 text-left">Code Vi phạm</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.map((r) => (
                                    <tr key={r.msnv} className="border-t">
                                        <td className="p-2">{r.msnv}</td>
                                        <td className="p-2">{r.full_name}</td>
                                        <td className="p-2 text-center">{r.line}</td>
                                        <td className="p-2 text-center">{r.target_value}</td>
                                        <td className="p-2 text-center">{r.defects}</td>
                                        <td className="p-2 text-center">{r.q_score.toFixed(1)}</td>
                                        <td className="p-2 text-center">{r.p_score.toFixed(1)}</td>
                                        <td className="p-2 text-center font-semibold">{r.day_score.toFixed(1)}</td>
                                        <td className="p-2">
                                            <select className="input text-center" value={r.compliance_code} onChange={(e) => updateCompliance(r.msnv, e.target.value)}>
                                                {COMPLIANCE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-3">
                            <button className="btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                                ‹ Trước
                            </button>
                            <span>
                                Trang {page}/{totalPages}
                            </span>
                            <button className="btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                                Sau ›
                            </button>
                        </div>
                    )}

                    <div className="flex justify-between mt-4">
                        <button className="btn btn-secondary" onClick={() => setStep(2)}>Quay lại</button>
                        <button className="btn btn-success" onClick={saveEntry} disabled={saving}>
                            {saving ? "Đang lưu..." : `Lưu ${reviewRows.length} Bản Ghi`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}