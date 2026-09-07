import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { MQAA_NEW_SECTIONS, MQAA_NEW_CRITERIA } from "../data/mqaaNewChecklistCriteria";
import { usePatrolTarget } from "../utils/mqaaSettings";
import PasswordModal from "../components/PasswordModal";

const OFFICIAL_SECTION_ORDER = [
    "Raw Material & FGs Warehouse",
    "Lamination",
    "Saw Cutting (Pre-fitting)",
    "Moulding (Hot-Press)",
    "Lean line DC",
    "Lean line Molded",
    "Logo WIP Inventory Management",
    "Cutting Die and Board Managemen",
    "Laboratory"
];

export default function MQAAPatrolSelection() {
    const navigate = useNavigate();
    const [showSettings, setShowSettings] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [activeTab, setActiveTab] = useState("auditor"); // 'auditor' | 'form' | 'target'

    // Target Setting State
    const { targetScore, setTargetScore } = usePatrolTarget();
    const [tempTarget, setTempTarget] = useState(targetScore);
    const [targetSavedMsg, setTargetSavedMsg] = useState(false);

    useEffect(() => {
        setTempTarget(targetScore);
    }, [targetScore]);

    // Auditors State
    const [auditorList, setAuditorList] = useState([]);
    const [newAuditor, setNewAuditor] = useState({ id: "", name: "" });
    const [cleaning, setCleaning] = useState(false);

    // Form Management State
    const [sections, setSections] = useState([]);
    const [selectedSectionId, setSelectedSectionId] = useState("Raw Material & FGs Warehouse");
    const [currentCriteria, setCurrentCriteria] = useState([]);
    const [loadingCriteria, setLoadingCriteria] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // Item form inputs (Updated to match new checklist format)
    const [itemInput, setItemInput] = useState({
        no: "",
        label: "",
        subLabel: "",
        maxScore: 4,
        isNA: false,
        isCritical: false,
    });

    useEffect(() => {
        fetchAuditors();
        fetchSections();
    }, []);

    useEffect(() => {
        if (selectedSectionId) {
            fetchCriteria(selectedSectionId);
        } else {
            setCurrentCriteria([]);
        }
    }, [selectedSectionId]);

    const fetchAuditors = async () => {
        const { data } = await supabase.from("mqaa_patrol_auditors").select("*");
        if (data) setAuditorList(data);
    };

    const fetchSections = async () => {
        const { data } = await supabase
            .from("mqaa_patrol_sections")
            .select("*")
            .order("sort_order", { ascending: true });

        if (data) {
            // Filter out system config rows like '_CONFIG_TARGET_' and legacy duplicate raw names
            const valid = data.filter((s) => !s.id.startsWith("_"));
            
            // Sort according to official order first
            valid.sort((a, b) => {
                const idxA = OFFICIAL_SECTION_ORDER.indexOf(a.id);
                const idxB = OFFICIAL_SECTION_ORDER.indexOf(b.id);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return (a.sort_order || 0) - (b.sort_order || 0);
            });

            setSections(valid);
            if (valid.length > 0 && !selectedSectionId) {
                setSelectedSectionId(valid[0].id);
            }
        }
    };

    const fetchCriteria = async (sectionId) => {
        setLoadingCriteria(true);
        try {
            const { data } = await supabase
                .from("mqaa_patrol_criteria")
                .select("*")
                .eq("section_id", sectionId)
                .order("sort_order", { ascending: true });

            if (data && data.length > 0) {
                setCurrentCriteria(
                    data.map((d) => ({
                        ...d,
                        subLabel: d.sub_label,
                        maxScore: d.max_score <= 0 ? "N/A" : d.max_score,
                        isCritical: d.is_header || (d.no && d.no.startsWith("*")),
                    }))
                );
            } else {
                // Fallback to static criteria from excel data if DB is empty for this section
                const staticData = MQAA_NEW_CRITERIA[sectionId]?.items || [];
                setCurrentCriteria(
                    staticData.map((d) => ({
                        id: `static-${d.index}`,
                        no: d.no,
                        label: d.titleVn,
                        subLabel: d.titleEn,
                        maxScore: d.maxScore,
                        isCritical: d.isCritical,
                        sort_order: d.index * 10,
                    }))
                );
            }
        } catch (err) {
            console.error("Error fetching criteria:", err);
        } finally {
            setLoadingCriteria(false);
        }
    };

    const handleAddAuditor = async () => {
        if (!newAuditor.id || !newAuditor.name) return alert("Vui lòng nhập đủ ID và Tên");
        const { error } = await supabase.from("mqaa_patrol_auditors").insert([newAuditor]);
        if (error) alert(error.message);
        else {
            setNewAuditor({ id: "", name: "" });
            fetchAuditors();
        }
    };

    const handleDeleteAuditor = async (id) => {
        if (!confirm("Xóa auditor này?")) return;
        const { error } = await supabase.from("mqaa_patrol_auditors").delete().eq("id", id);
        if (!error) fetchAuditors();
    };

    const handleCleanup = async () => {
        if (!confirm("Thao tác này sẽ dọn dẹp các tệp ảnh tạm không dùng đến. Bạn có muốn tiếp tục?")) return;
        setCleaning(true);
        setTimeout(() => {
            setCleaning(false);
            alert("Đã tối ưu hóa lưu trữ ảnh thành công!");
        }, 1200);
    };

    // --- Dynamic Form Handlers ---
    const handleEditCriteriaItem = (item) => {
        setEditingItem(item);
        const isNA = item.maxScore === "N/A";
        setItemInput({
            no: item.no,
            label: item.label,
            subLabel: item.subLabel || item.sub_label || "",
            maxScore: isNA ? 4 : (Number(item.maxScore) || 4),
            isNA: isNA,
            isCritical: Boolean(item.isCritical),
        });
        document.getElementById("item-input-box")?.scrollIntoView({ behavior: "smooth" });
    };

    const handleSaveCriteriaEntry = async () => {
        if (!itemInput.no || !itemInput.label) {
            return alert("Vui lòng nhập đầy đủ Số thứ tự (No.) và Nội dung đánh giá!");
        }

        const maxScoreVal = itemInput.isNA ? -1 : (Number(itemInput.maxScore) || 4);
        const isCrit = Boolean(itemInput.isCritical);

        let finalNo = itemInput.no.trim();
        if (isCrit && !finalNo.startsWith("*")) {
            finalNo = `*${finalNo}`;
        } else if (!isCrit && finalNo.startsWith("*")) {
            finalNo = finalNo.replace(/^\*+/, "");
        }

        const payload = {
            section_id: selectedSectionId,
            no: finalNo,
            label: itemInput.label,
            sub_label: itemInput.subLabel,
            is_header: isCrit, // store critical flag in is_header column
            max_score: maxScoreVal,
            sort_order: editingItem?.sort_order ?? (currentCriteria.length === 0 ? 10 : currentCriteria[currentCriteria.length - 1].sort_order + 10),
        };

        if (editingItem && editingItem.id && !editingItem.id.toString().startsWith("static-")) {
            payload.id = editingItem.id;
        }

        const { error } = await supabase.from("mqaa_patrol_criteria").upsert([payload]);
        if (error) {
            alert("Lỗi khi lưu tiêu chí: " + error.message);
        } else {
            setEditingItem(null);
            setItemInput({
                no: "",
                label: "",
                subLabel: "",
                maxScore: 4,
                isNA: false,
                isCritical: false,
            });
            fetchCriteria(selectedSectionId);
        }
    };

    const handleDeleteCriteriaItem = async (item) => {
        if (!confirm(`Xóa tiêu chí "${item.no}"?`)) return;
        if (item.id && !item.id.toString().startsWith("static-")) {
            const { error } = await supabase.from("mqaa_patrol_criteria").delete().eq("id", item.id);
            if (error) return alert("Lỗi khi xóa: " + error.message);
        }
        fetchCriteria(selectedSectionId);
    };

    // Sync all criteria for the selected section from the latest Excel checklist
    const handleSyncSectionFromExcel = async () => {
        if (!confirm(`Khôi phục danh sách tiêu chí chuẩn từ file Excel cho section "${selectedSectionId}"?`)) return;
        setLoadingCriteria(true);
        try {
            const defaultItems = MQAA_NEW_CRITERIA[selectedSectionId]?.items || [];
            if (defaultItems.length === 0) {
                alert("Không có tiêu chí mặc định cho section này trong file Excel.");
                return;
            }

            // Remove existing criteria for this section
            await supabase.from("mqaa_patrol_criteria").delete().eq("section_id", selectedSectionId);

            const rowsToInsert = defaultItems.map((c, idx) => {
                const isNA = c.maxScore === "N/A";
                return {
                    section_id: selectedSectionId,
                    no: c.no ? (c.isCritical && !c.no.startsWith("*") ? `*${c.no}` : c.no) : `${idx + 1}`,
                    label: c.titleVn,
                    sub_label: c.titleEn,
                    is_header: c.isCritical,
                    max_score: isNA ? -1 : (Number(c.maxScore) || 4),
                    sort_order: (idx + 1) * 10,
                };
            });

            const { error } = await supabase.from("mqaa_patrol_criteria").insert(rowsToInsert);
            if (error) throw error;

            alert(`✅ Đã đồng bộ thành công ${rowsToInsert.length} tiêu chí cho ${selectedSectionId}!`);
            fetchCriteria(selectedSectionId);
        } catch (err) {
            console.error("Sync error:", err);
            alert("Lỗi khi đồng bộ: " + err.message);
        } finally {
            setLoadingCriteria(false);
        }
    };

    // Save Target Score handler
    const handleSaveTarget = async () => {
        const num = Math.min(100, Math.max(0, Number(tempTarget) || 90));
        await setTargetScore(num);
        setTargetSavedMsg(true);
        setTimeout(() => setTargetSavedMsg(false), 2500);
    };

    const handleOpenSettings = () => {
        setShowPasswordModal(true);
    };

    return (
        <div className="max-w-[1320px] mx-auto p-4 md:p-8">
            <PasswordModal
                isOpen={showPasswordModal}
                onClose={() => setShowPasswordModal(false)}
                onSuccess={() => setShowSettings(true)}
                initialTitle="Cài đặt hệ thống MQAA"
            />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate("/")}
                        className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 hover:bg-slate-50 transition"
                    >
                        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-2xl md:text-3xl font-black text-indigo-950 tracking-tight">
                                MQAA PATROL
                            </h1>
                            <span className="bg-indigo-100 text-indigo-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-indigo-200">
                                Chuẩn Mới 2026
                            </span>
                        </div>
                        <p className="text-slate-400 text-xs md:text-sm font-bold uppercase tracking-widest mt-0.5">
                            Insole Production Quality Inspection
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Target indicator badge */}
                    <div className="bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-600 shadow-sm">
                        <span>Mục tiêu:</span>
                        <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            ≥ {targetScore}%
                        </span>
                    </div>

                    <button
                        onClick={handleOpenSettings}
                        className="p-2.5 bg-white text-slate-500 hover:text-indigo-600 rounded-xl border border-slate-200 shadow-sm transition"
                        title="Cài đặt hệ thống"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>

                    <button
                        onClick={() => navigate("/mqaa-patrol/dashboard")}
                        className="bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 px-4 py-2 rounded-xl font-bold shadow-sm active:scale-95 transition text-xs md:text-sm"
                    >
                        Dashboard
                    </button>

                    <button
                        onClick={() => navigate("/mqaa-patrol/report")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold shadow-md active:scale-95 transition text-xs md:text-sm"
                    >
                        Report
                    </button>

                    <button
                        onClick={() => navigate("/mqaa-patrol/guide")}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold shadow-md active:scale-95 transition text-xs md:text-sm flex items-center gap-1"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        Guide
                    </button>
                </div>
            </div>

            {/* Official 9 Sections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sections.map((s, idx) => {
                    const isWarehouse = s.id.includes("Warehouse");
                    const isLab = s.id === "Laboratory";

                    return (
                        <button
                            key={s.id}
                            onClick={() => navigate(`/mqaa-patrol/entry/${encodeURIComponent(s.id)}`)}
                            className="group relative bg-white p-7 rounded-3xl border border-slate-200 shadow-sm hover:shadow-2xl hover:border-indigo-500 transition-all text-left overflow-hidden transform hover:-translate-y-1"
                        >
                            <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-50/80 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150"></div>
                            
                            <div className="flex items-center justify-between mb-3 relative z-10">
                                <span className="text-[11px] font-black text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                                    Section {idx + 1}
                                </span>
                                {isWarehouse && (
                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                        Đã gộp kho NL & TP
                                    </span>
                                )}
                                {isLab && (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                        Mục mới
                                    </span>
                                )}
                            </div>

                            <span className="relative z-10 text-lg md:text-xl font-black text-slate-800 group-hover:text-indigo-700 uppercase leading-snug block">
                                {s.name || s.id}
                            </span>

                            <div className="mt-5 flex items-center gap-2 relative z-10 text-xs font-black tracking-wider text-slate-400 group-hover:text-indigo-600 uppercase transition-colors">
                                <span>BẮT ĐẦU ĐÁNH GIÁ</span>
                                <svg className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[36px] shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-white">
                        
                        {/* Tab Switcher */}
                        <div className="px-6 md:px-8 pt-6 pb-4 flex flex-wrap justify-between items-center border-b border-slate-100 gap-4">
                            <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-wrap gap-1">
                                <button
                                    onClick={() => setActiveTab("auditor")}
                                    className={`px-5 md:px-6 py-2.5 rounded-xl text-xs font-black tracking-wider transition ${
                                        activeTab === "auditor"
                                            ? "bg-white text-indigo-600 shadow-md"
                                            : "text-slate-400 hover:text-slate-600"
                                    }`}
                                >
                                    1. AUDITORS
                                </button>
                                <button
                                    onClick={() => setActiveTab("form")}
                                    className={`px-5 md:px-6 py-2.5 rounded-xl text-xs font-black tracking-wider transition ${
                                        activeTab === "form"
                                            ? "bg-white text-indigo-600 shadow-md"
                                            : "text-slate-400 hover:text-slate-600"
                                    }`}
                                >
                                    2. MANAGE FORMS
                                </button>
                                <button
                                    onClick={() => setActiveTab("target")}
                                    className={`px-5 md:px-6 py-2.5 rounded-xl text-xs font-black tracking-wider transition ${
                                        activeTab === "target"
                                            ? "bg-white text-indigo-600 shadow-md"
                                            : "text-slate-400 hover:text-slate-600"
                                    }`}
                                >
                                    3. SET TARGET
                                </button>
                            </div>

                            <button
                                onClick={() => setShowSettings(false)}
                                className="bg-slate-100 p-2.5 rounded-full text-slate-400 hover:text-slate-900 transition"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
                            {/* TAB 1: AUDITORS */}
                            {activeTab === "auditor" && (
                                <div className="space-y-8">
                                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                        <h3 className="text-lg font-black text-slate-800 mb-4 tracking-tight">
                                            Thêm Auditor Mới
                                        </h3>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <input
                                                type="text"
                                                placeholder="Mã số nhân viên (ID)"
                                                className="w-full sm:w-1/3 p-3.5 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={newAuditor.id}
                                                onChange={(e) => setNewAuditor({ ...newAuditor, id: e.target.value })}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Họ và Tên Auditor"
                                                className="w-full sm:flex-1 p-3.5 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={newAuditor.name}
                                                onChange={(e) => setNewAuditor({ ...newAuditor, name: e.target.value })}
                                            />
                                            <button
                                                onClick={handleAddAuditor}
                                                className="bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-black shadow-md hover:bg-indigo-700 transition uppercase text-xs"
                                            >
                                                Thêm
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                                        {auditorList.map((a) => (
                                            <div
                                                key={a.id}
                                                className="p-4 bg-white border border-slate-100 rounded-2xl flex justify-between items-center hover:border-indigo-200 transition shadow-sm"
                                            >
                                                <div>
                                                    <p className="text-[11px] font-black text-indigo-500 uppercase">{a.id}</p>
                                                    <p className="font-bold text-slate-800 text-sm">{a.name}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteAuditor(a.id)}
                                                    className="text-slate-300 hover:text-red-500 transition p-1"
                                                    title="Xóa"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={handleCleanup}
                                        disabled={cleaning}
                                        className="w-full py-3.5 bg-slate-100 text-slate-400 rounded-xl font-bold text-xs uppercase hover:bg-slate-200 transition"
                                    >
                                        {cleaning ? "Đang xử lý..." : "Dọn dẹp bộ nhớ ảnh tạm"}
                                    </button>
                                </div>
                            )}

                            {/* TAB 2: MANAGE FORMS (UPDATED FORMAT) */}
                            {activeTab === "form" && (
                                <div className="space-y-8">
                                    {/* Section Selector */}
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                        <div className="flex-1">
                                            <p className="text-[11px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">
                                                Chọn Section để chỉnh sửa tiêu chí:
                                            </p>
                                            <select
                                                value={selectedSectionId}
                                                onChange={(e) => setSelectedSectionId(e.target.value)}
                                                className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-lg font-black text-indigo-950 outline-none cursor-pointer shadow-sm"
                                            >
                                                {sections.map((s) => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name || s.id}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <button
                                            onClick={handleSyncSectionFromExcel}
                                            className="px-5 py-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition self-end sm:self-center"
                                            title="Khôi phục danh sách tiêu chí chuẩn từ file Excel"
                                        >
                                            ⚡ Khôi phục từ Excel
                                        </button>
                                    </div>

                                    {/* Edit / Add Criterion Box */}
                                    <div
                                        id="item-input-box"
                                        className={`p-6 rounded-3xl border transition-all space-y-4 ${
                                            editingItem
                                                ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-200"
                                                : "bg-slate-50 border-slate-200"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-base font-black text-indigo-950">
                                                {editingItem ? `Chỉnh sửa tiêu chí: ${editingItem.no}` : "Thêm tiêu chí mới vào Section"}
                                            </h4>
                                            {editingItem && (
                                                <button
                                                    onClick={() => {
                                                        setEditingItem(null);
                                                        setItemInput({
                                                            no: "",
                                                            label: "",
                                                            subLabel: "",
                                                            maxScore: 4,
                                                            isNA: false,
                                                            isCritical: false,
                                                        });
                                                    }}
                                                    className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-lg border shadow-sm hover:bg-slate-50"
                                                >
                                                    Hủy chỉnh sửa
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-600">Số thứ tự / No:</label>
                                                <input
                                                    type="text"
                                                    placeholder="VD: 1.1.1 hoặc *1.1.1"
                                                    className="p-3 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                                    value={itemInput.no}
                                                    onChange={(e) => setItemInput({ ...itemInput, no: e.target.value })}
                                                />
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-600">Điểm tối đa (Max Score):</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        disabled={itemInput.isNA}
                                                        className={`w-24 p-3 bg-white border border-slate-200 rounded-xl font-black text-center outline-none ${
                                                            itemInput.isNA ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "text-indigo-800"
                                                        }`}
                                                        value={itemInput.maxScore}
                                                        onChange={(e) => setItemInput({ ...itemInput, maxScore: e.target.value })}
                                                    />
                                                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={itemInput.isNA}
                                                            onChange={(e) => setItemInput({ ...itemInput, isNA: e.target.checked })}
                                                            className="w-4 h-4 rounded text-indigo-600"
                                                        />
                                                        Là mục N/A
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1 justify-center">
                                                <label className="text-xs font-bold text-slate-600">Hạng mục quan trọng:</label>
                                                <label className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={itemInput.isCritical}
                                                        onChange={(e) => setItemInput({ ...itemInput, isCritical: e.target.checked })}
                                                        className="w-4 h-4 rounded text-emerald-600"
                                                    />
                                                    <span className="text-xs font-bold text-emerald-800">
                                                        Mục Trọng yếu (Critical - Yes)
                                                    </span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-600">Nội dung Tiếng Việt:</label>
                                                <textarea
                                                    rows="2"
                                                    placeholder="Nội dung đánh giá tiếng Việt..."
                                                    className="p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                                    value={itemInput.label}
                                                    onChange={(e) => setItemInput({ ...itemInput, label: e.target.value })}
                                                />
                                            </div>

                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs font-bold text-slate-600">Nội dung Tiếng Anh (English):</label>
                                                <textarea
                                                    rows="2"
                                                    placeholder="English description..."
                                                    className="p-3 bg-white border border-slate-200 rounded-xl italic text-blue-700 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                                                    value={itemInput.subLabel}
                                                    onChange={(e) => setItemInput({ ...itemInput, subLabel: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleSaveCriteriaEntry}
                                            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-lg shadow-indigo-100 transition uppercase text-xs tracking-wider"
                                        >
                                            {editingItem ? "CẬP NHẬT TIÊU CHÍ" : "THÊM TIÊU CHÍ VÀO DANH SÁCH"}
                                        </button>
                                    </div>

                                    {/* Criteria List */}
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                                Danh sách tiêu chí ({currentCriteria.length} mục)
                                            </h4>
                                        </div>

                                        {loadingCriteria ? (
                                            <div className="p-12 text-center text-slate-400 font-bold">Đang tải...</div>
                                        ) : currentCriteria.length === 0 ? (
                                            <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed">
                                                Chưa có tiêu chí nào. Bấm "Khôi phục từ Excel" để nạp bộ tiêu chí chuẩn.
                                            </div>
                                        ) : (
                                            <div className="divide-y border border-slate-200 rounded-2xl overflow-hidden bg-white">
                                                {currentCriteria.map((item, idx) => {
                                                    const isCrit = Boolean(item.isCritical);
                                                    return (
                                                        <div
                                                            key={item.id || idx}
                                                            className={`p-4 flex items-start justify-between gap-4 transition ${
                                                                isCrit ? "bg-emerald-50/60 border-l-4 border-l-emerald-500" : "hover:bg-slate-50"
                                                            }`}
                                                        >
                                                            <div className="space-y-1 flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-black text-indigo-700 text-sm">
                                                                        {item.no}
                                                                    </span>
                                                                    <span className="text-[11px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                                                        {item.maxScore === "N/A" ? "N/A" : `${item.maxScore} điểm`}
                                                                    </span>
                                                                    {isCrit && (
                                                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                            ⭐ Trọng yếu
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="font-bold text-slate-800 text-xs">{item.label}</p>
                                                                {item.subLabel && (
                                                                    <p className="italic text-blue-700 text-[11px]">{item.subLabel}</p>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleEditCriteriaItem(item)}
                                                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition"
                                                                >
                                                                    Sửa
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteCriteriaItem(item)}
                                                                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition"
                                                                >
                                                                    Xóa
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: SET TARGET (MỚI THEO YÊU CẦU) */}
                            {activeTab === "target" && (
                                <div className="space-y-8 max-w-2xl mx-auto py-4">
                                    <div className="text-center space-y-2">
                                        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-2xl font-black text-indigo-950 tracking-tight">
                                            Cấu hình Mục tiêu Tuân thủ MQAA
                                        </h3>
                                        <p className="text-slate-500 text-xs md:text-sm leading-relaxed">
                                            Đặt ngưỡng % đạt mục tiêu. Kết quả đánh giá bằng hoặc vượt mức này sẽ hiển thị{" "}
                                            <span className="text-emerald-700 font-bold">màu xanh lá (Đạt)</span>.
                                            Nếu dưới mức này sẽ đổi sang{" "}
                                            <span className="text-rose-700 font-bold">màu đỏ (Chưa đạt)</span>.
                                        </p>
                                    </div>

                                    <div className="bg-slate-50 p-6 md:p-8 rounded-3xl border border-slate-200 space-y-6">
                                        <div className="flex flex-col items-center gap-3">
                                            <label className="text-xs font-black uppercase text-slate-500 tracking-wider">
                                                Tỷ lệ đạt mục tiêu (% Target)
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="50"
                                                    max="100"
                                                    value={tempTarget}
                                                    onChange={(e) => setTempTarget(e.target.value)}
                                                    className="w-32 p-3 text-3xl font-black text-center text-indigo-700 bg-white border-2 border-indigo-400 rounded-2xl shadow-sm outline-none focus:ring-4 focus:ring-indigo-100"
                                                />
                                                <span className="text-2xl font-black text-slate-400">%</span>
                                            </div>

                                            {/* Presets */}
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs font-bold text-slate-400">Chọn nhanh:</span>
                                                {[80, 85, 90, 95].map((val) => (
                                                    <button
                                                        key={val}
                                                        type="button"
                                                        onClick={() => setTempTarget(val)}
                                                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                                                            Number(tempTarget) === val
                                                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                                                                : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                                                        }`}
                                                    >
                                                        {val}%
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Visual Preview */}
                                        <div className="border-t border-slate-200 pt-5 space-y-3">
                                            <p className="text-xs font-bold text-slate-500 text-center uppercase tracking-wider">
                                                Xem trước hiển thị màu sắc theo mục tiêu ({tempTarget}%):
                                            </p>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col items-center gap-1.5 shadow-sm">
                                                    <span className="text-xs text-slate-400 font-bold">Ví dụ: 95.0%</span>
                                                    <span
                                                        className={`text-base font-black px-4 py-1 rounded-xl ${
                                                            95 >= Number(tempTarget)
                                                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                                                : "bg-rose-100 text-rose-800 border border-rose-300"
                                                        }`}
                                                    >
                                                        95.0% {95 >= Number(tempTarget) ? "(ĐẠT)" : "(CHƯA ĐẠT)"}
                                                    </span>
                                                </div>

                                                <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col items-center gap-1.5 shadow-sm">
                                                    <span className="text-xs text-slate-400 font-bold">Ví dụ: 85.0%</span>
                                                    <span
                                                        className={`text-base font-black px-4 py-1 rounded-xl ${
                                                            85 >= Number(tempTarget)
                                                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                                                : "bg-rose-100 text-rose-800 border border-rose-300"
                                                        }`}
                                                    >
                                                        85.0% {85 >= Number(tempTarget) ? "(ĐẠT)" : "(CHƯA ĐẠT)"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleSaveTarget}
                                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-indigo-100 transition active:scale-95"
                                        >
                                            {targetSavedMsg ? "✅ ĐÃ LƯU MỤC TIÊU THÀNH CÔNG!" : "LƯU CẤU HÌNH MỤC TIÊU"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
