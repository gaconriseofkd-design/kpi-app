import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { MQAA_NEW_SECTIONS, MQAA_NEW_CRITERIA } from "../data/mqaaNewChecklistCriteria";
import { MQAA_RE_AUDIT_SECTIONS, MQAA_RE_AUDIT_CRITERIA } from "../data/mqaaReAuditCriteria";
import { usePatrolTarget, usePatrolScoreSettings, DEFAULT_NORMAL_SCORES, DEFAULT_CRITICAL_SCORES } from "../utils/mqaaSettings";

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

export default function MQAASettingsModal({
    isOpen,
    onClose,
    initialTab = "form",
    initialFormMode = "normal"
}) {
    // Main modal tabs: 'auditor' | 'form' | 'target' | 'scoring'
    const [activeTab, setActiveTab] = useState(initialTab);

    // Form sub-tabs: 'normal' (Form Thường) | 're_audit' (Form Tái Đánh Giá)
    const [formMode, setFormMode] = useState(initialFormMode);

    // Target Setting State
    const { targetScore, setTargetScore } = usePatrolTarget();
    const [tempTarget, setTempTarget] = useState(targetScore);
    const [targetSavedMsg, setTargetSavedMsg] = useState(false);

    useEffect(() => {
        setTempTarget(targetScore);
    }, [targetScore]);

    // Score Levels State
    const { normalScores, criticalScores, setScoreSettings } = usePatrolScoreSettings();
    const [tempNormalScores, setTempNormalScores] = useState(normalScores);
    const [tempCriticalScores, setTempCriticalScores] = useState(criticalScores);
    const [scoreSavedMsg, setScoreSavedMsg] = useState(false);

    useEffect(() => {
        setTempNormalScores(normalScores);
        setTempCriticalScores(criticalScores);
    }, [normalScores, criticalScores]);

    // Auditors State
    const [auditorList, setAuditorList] = useState([]);
    const [newAuditor, setNewAuditor] = useState({ id: "", name: "" });
    const [cleaning, setCleaning] = useState(false);

    // Form Management State
    const [normalSections, setNormalSections] = useState([]);
    const [selectedNormalSectionId, setSelectedNormalSectionId] = useState("Raw Material & FGs Warehouse");
    const [selectedReAuditSectionId, setSelectedReAuditSectionId] = useState("Raw Material & FGs Warehouse");

    const [currentCriteria, setCurrentCriteria] = useState([]);
    const [loadingCriteria, setLoadingCriteria] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // Item form inputs
    const [itemInput, setItemInput] = useState({
        no: "",
        label: "",
        subLabel: "",
        maxScore: 4,
        isNA: false,
        isCritical: false,
    });

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
            setFormMode(initialFormMode);
        }
    }, [isOpen, initialTab, initialFormMode]);

    useEffect(() => {
        if (isOpen) {
            fetchAuditors();
            fetchNormalSections();
        }
    }, [isOpen]);

    // Current Section ID and DB Section ID
    const currentSectionId = formMode === "re_audit" ? selectedReAuditSectionId : selectedNormalSectionId;
    const currentDbSectionId = formMode === "re_audit" ? `RE_AUDIT__${selectedReAuditSectionId}` : selectedNormalSectionId;

    useEffect(() => {
        if (isOpen && currentDbSectionId) {
            fetchCriteria(currentDbSectionId, formMode, currentSectionId);
            setEditingItem(null);
            setItemInput({
                no: "",
                label: "",
                subLabel: "",
                maxScore: 4,
                isNA: false,
                isCritical: false,
            });
        }
    }, [isOpen, currentDbSectionId, formMode]);

    const fetchAuditors = async () => {
        const { data } = await supabase.from("mqaa_patrol_auditors").select("*");
        if (data) setAuditorList(data);
    };

    const fetchNormalSections = async () => {
        const { data } = await supabase
            .from("mqaa_patrol_sections")
            .select("*")
            .order("sort_order", { ascending: true });

        if (data) {
            const valid = data.filter((s) => OFFICIAL_SECTION_ORDER.includes(s.id));
            valid.sort((a, b) => {
                const idxA = OFFICIAL_SECTION_ORDER.indexOf(a.id);
                const idxB = OFFICIAL_SECTION_ORDER.indexOf(b.id);
                return idxA - idxB;
            });
            setNormalSections(valid);
            if (valid.length > 0 && !selectedNormalSectionId) {
                setSelectedNormalSectionId(valid[0].id);
            }
        }
    };

    const fetchCriteria = async (dbSecId, mode, secId) => {
        setLoadingCriteria(true);
        try {
            const { data, error } = await supabase
                .from("mqaa_patrol_criteria")
                .select("*")
                .eq("section_id", dbSecId)
                .order("sort_order", { ascending: true });

            if (data && data.length > 0) {
                setCurrentCriteria(
                    data.map((d) => ({
                        ...d,
                        subLabel: d.sub_label,
                        maxScore: d.max_score <= 0 ? "N/A" : d.max_score,
                        isCritical: Boolean(d.is_header || (d.no && d.no.startsWith("*"))),
                    }))
                );
            } else {
                // Fallback to static checklist data from respective file
                if (mode === "re_audit") {
                    const staticData = MQAA_RE_AUDIT_CRITERIA[secId]?.items || [];
                    setCurrentCriteria(
                        staticData.map((d, idx) => ({
                            id: `static-re-${idx}`,
                            no: d.no ? (d.isCritical && !d.no.startsWith("*") ? `*${d.no}` : d.no) : `${idx + 1}`,
                            label: d.titleVn,
                            subLabel: d.titleEn,
                            maxScore: d.maxScore,
                            isCritical: Boolean(d.isCritical),
                            sort_order: (idx + 1) * 10,
                        }))
                    );
                } else {
                    const staticData = MQAA_NEW_CRITERIA[secId]?.items || [];
                    setCurrentCriteria(
                        staticData.map((d) => ({
                            id: `static-${d.index}`,
                            no: d.no,
                            label: d.titleVn,
                            subLabel: d.titleEn,
                            maxScore: d.maxScore,
                            isCritical: Boolean(d.isCritical),
                            sort_order: d.index * 10,
                        }))
                    );
                }
            }
        } catch (err) {
            console.error("Error fetching criteria:", err);
        } finally {
            setLoadingCriteria(false);
        }
    };

    // --- Auditors Handlers ---
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
        document.getElementById("settings-item-input-box")?.scrollIntoView({ behavior: "smooth" });
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

        try {
            // Check if current list has any static items. If so, materialize the entire list into DB first!
            const hasStatic = currentCriteria.some((c) => String(c.id).startsWith("static-"));
            if (hasStatic) {
                const rowsToInsert = currentCriteria.map((c, idx) => {
                    if (editingItem && c.id === editingItem.id) {
                        return {
                            section_id: currentDbSectionId,
                            no: finalNo,
                            label: itemInput.label,
                            sub_label: itemInput.subLabel,
                            is_header: isCrit,
                            max_score: maxScoreVal,
                            sort_order: (idx + 1) * 10,
                        };
                    }
                    const isNA = c.maxScore === "N/A";
                    return {
                        section_id: currentDbSectionId,
                        no: c.no,
                        label: c.label,
                        sub_label: c.subLabel,
                        is_header: Boolean(c.isCritical),
                        max_score: isNA ? -1 : (Number(c.maxScore) || 4),
                        sort_order: (idx + 1) * 10,
                    };
                });

                if (!editingItem) {
                    rowsToInsert.push({
                        section_id: currentDbSectionId,
                        no: finalNo,
                        label: itemInput.label,
                        sub_label: itemInput.subLabel,
                        is_header: isCrit,
                        max_score: maxScoreVal,
                        sort_order: (rowsToInsert.length + 1) * 10,
                    });
                }

                await supabase.from("mqaa_patrol_criteria").delete().eq("section_id", currentDbSectionId);
                const { error: insErr } = await supabase.from("mqaa_patrol_criteria").insert(rowsToInsert);
                if (insErr) throw insErr;
            } else {
                const payload = {
                    section_id: currentDbSectionId,
                    no: finalNo,
                    label: itemInput.label,
                    sub_label: itemInput.subLabel,
                    is_header: isCrit,
                    max_score: maxScoreVal,
                    sort_order: editingItem?.sort_order ?? (currentCriteria.length === 0 ? 10 : currentCriteria[currentCriteria.length - 1].sort_order + 10),
                };

                if (editingItem && editingItem.id && !editingItem.id.toString().startsWith("static-")) {
                    payload.id = editingItem.id;
                }

                const { error } = await supabase.from("mqaa_patrol_criteria").upsert([payload]);
                if (error) throw error;
            }

            setEditingItem(null);
            setItemInput({
                no: "",
                label: "",
                subLabel: "",
                maxScore: 4,
                isNA: false,
                isCritical: false,
            });
            fetchCriteria(currentDbSectionId, formMode, currentSectionId);
        } catch (err) {
            console.error("Save criteria error:", err);
            alert("Lỗi khi lưu tiêu chí: " + err.message);
        }
    };

    const handleDeleteCriteriaItem = async (item) => {
        if (!confirm(`Xóa tiêu chí "${item.no}"?`)) return;
        try {
            if (item.id && !item.id.toString().startsWith("static-")) {
                const { error } = await supabase.from("mqaa_patrol_criteria").delete().eq("id", item.id);
                if (error) throw error;
            } else {
                // Materialize remaining items
                const remaining = currentCriteria.filter((c) => c.id !== item.id);
                const rowsToInsert = remaining.map((c, idx) => {
                    const isNA = c.maxScore === "N/A";
                    return {
                        section_id: currentDbSectionId,
                        no: c.no,
                        label: c.label,
                        sub_label: c.subLabel,
                        is_header: Boolean(c.isCritical),
                        max_score: isNA ? -1 : (Number(c.maxScore) || 4),
                        sort_order: (idx + 1) * 10,
                    };
                });
                await supabase.from("mqaa_patrol_criteria").delete().eq("section_id", currentDbSectionId);
                if (rowsToInsert.length > 0) {
                    const { error } = await supabase.from("mqaa_patrol_criteria").insert(rowsToInsert);
                    if (error) throw error;
                }
            }
            fetchCriteria(currentDbSectionId, formMode, currentSectionId);
        } catch (err) {
            console.error("Delete error:", err);
            alert("Lỗi khi xóa: " + err.message);
        }
    };

    // Restore from Excel
    const handleSyncSectionFromExcel = async () => {
        const formTitle = formMode === "re_audit" ? "MQAA TÁI ĐÁNH GIÁ (10 công đoạn)" : "MQAA Patrol thường";
        if (!confirm(`Khôi phục danh sách tiêu chí chuẩn từ file Excel ${formTitle} cho section "${currentSectionId}"?`)) return;

        setLoadingCriteria(true);
        try {
            let defaultItems = [];
            if (formMode === "re_audit") {
                defaultItems = MQAA_RE_AUDIT_CRITERIA[selectedReAuditSectionId]?.items || [];
            } else {
                defaultItems = MQAA_NEW_CRITERIA[selectedNormalSectionId]?.items || [];
            }

            if (defaultItems.length === 0) {
                alert(`Không tìm thấy bộ tiêu chí chuẩn mặc định cho section "${currentSectionId}".`);
                return;
            }

            // Remove existing criteria for this section id in DB
            await supabase.from("mqaa_patrol_criteria").delete().eq("section_id", currentDbSectionId);

            const rowsToInsert = defaultItems.map((c, idx) => {
                const isNA = c.maxScore === "N/A";
                return {
                    section_id: currentDbSectionId,
                    no: c.no ? (c.isCritical && !c.no.startsWith("*") ? `*${c.no}` : c.no) : `${idx + 1}`,
                    label: c.titleVn,
                    sub_label: c.titleEn,
                    is_header: Boolean(c.isCritical),
                    max_score: isNA ? -1 : (Number(c.maxScore) || 4),
                    sort_order: (idx + 1) * 10,
                };
            });

            const { error } = await supabase.from("mqaa_patrol_criteria").insert(rowsToInsert);
            if (error) throw error;

            alert(`✅ Đã khôi phục thành công ${rowsToInsert.length} tiêu chí chuẩn cho ${currentSectionId} (${formMode === "re_audit" ? "Form Tái Đánh Giá" : "Form Thường"})!`);
            fetchCriteria(currentDbSectionId, formMode, currentSectionId);
        } catch (err) {
            console.error("Sync error:", err);
            alert("Lỗi khi khôi phục: " + err.message);
        } finally {
            setLoadingCriteria(false);
        }
    };

    // Sub-tab mode change
    const handleFormModeChange = (mode) => {
        if (mode === formMode) return;
        setFormMode(mode);
        setEditingItem(null);
        setItemInput({
            no: "",
            label: "",
            subLabel: "",
            maxScore: 4,
            isNA: false,
            isCritical: false,
        });
    };

    // Target Setting Handlers
    const handleSaveTarget = async () => {
        const num = Math.min(100, Math.max(0, Number(tempTarget) || 90));
        await setTargetScore(num);
        setTargetSavedMsg(true);
        setTimeout(() => setTargetSavedMsg(false), 2500);
    };

    // Scoring Settings Handlers
    const handleSetNormalCount = (count) => {
        const c = Math.max(1, Math.min(5, count));
        let arr = [...tempNormalScores];
        if (arr.length < c) {
            while (arr.length < c) {
                const last = arr.length > 0 ? (Number(arr[arr.length - 1]) || 0) : 0;
                arr.push(last + 2);
            }
        } else if (arr.length > c) {
            arr = arr.slice(0, c);
        }
        setTempNormalScores(arr);
    };

    const handleSetCriticalCount = (count) => {
        const c = Math.max(1, Math.min(5, count));
        let arr = [...tempCriticalScores];
        if (arr.length < c) {
            while (arr.length < c) {
                const last = arr.length > 0 ? (Number(arr[arr.length - 1]) || 0) : 0;
                arr.push(last + 2);
            }
        } else if (arr.length > c) {
            arr = arr.slice(0, c);
        }
        setTempCriticalScores(arr);
    };

    const handleNormalScoreChange = (index, val) => {
        const arr = [...tempNormalScores];
        arr[index] = val === "" ? "" : Number(val);
        setTempNormalScores(arr);
    };

    const handleCriticalScoreChange = (index, val) => {
        const arr = [...tempCriticalScores];
        arr[index] = val === "" ? "" : Number(val);
        setTempCriticalScores(arr);
    };

    const handleSaveScoreSettings = async () => {
        const cleanNormal = tempNormalScores
            .map((n) => (n === "" ? 0 : Number(n)))
            .filter((n) => !isNaN(n));
        const cleanCritical = tempCriticalScores
            .map((n) => (n === "" ? 0 : Number(n)))
            .filter((n) => !isNaN(n));

        await setScoreSettings({
            normalScores: cleanNormal.length > 0 ? cleanNormal : DEFAULT_NORMAL_SCORES,
            criticalScores: cleanCritical.length > 0 ? cleanCritical : DEFAULT_CRITICAL_SCORES,
        });
        setScoreSavedMsg(true);
        setTimeout(() => setScoreSavedMsg(false), 2500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-50 p-3 md:p-4 font-sans">
            <div className="bg-white rounded-[36px] shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-white">
                
                {/* Modal Tab Switcher */}
                <div className="px-6 md:px-8 pt-6 pb-4 flex flex-wrap justify-between items-center border-b border-slate-100 gap-4">
                    <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-wrap gap-1">
                        <button
                            onClick={() => setActiveTab("auditor")}
                            className={`px-4 md:px-6 py-2.5 rounded-xl text-xs font-black tracking-wider transition ${
                                activeTab === "auditor"
                                    ? "bg-white text-indigo-600 shadow-md"
                                    : "text-slate-400 hover:text-slate-600"
                            }`}
                        >
                            1. AUDITORS
                        </button>
                        <button
                            onClick={() => setActiveTab("form")}
                            className={`px-4 md:px-6 py-2.5 rounded-xl text-xs font-black tracking-wider transition ${
                                activeTab === "form"
                                    ? "bg-white text-indigo-600 shadow-md"
                                    : "text-slate-400 hover:text-slate-600"
                            }`}
                        >
                            2. MANAGE FORMS
                        </button>
                        <button
                            onClick={() => setActiveTab("target")}
                            className={`px-4 md:px-6 py-2.5 rounded-xl text-xs font-black tracking-wider transition ${
                                activeTab === "target"
                                    ? "bg-white text-indigo-600 shadow-md"
                                    : "text-slate-400 hover:text-slate-600"
                            }`}
                        >
                            3. SET TARGET
                        </button>
                        <button
                            onClick={() => setActiveTab("scoring")}
                            className={`px-4 md:px-6 py-2.5 rounded-xl text-xs font-black tracking-wider transition ${
                                activeTab === "scoring"
                                    ? "bg-white text-indigo-600 shadow-md"
                                    : "text-slate-400 hover:text-slate-600"
                            }`}
                        >
                            4. MỐC ĐIỂM (SCORING)
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="bg-slate-100 p-2.5 rounded-full text-slate-400 hover:text-slate-900 transition"
                        title="Đóng cửa sổ"
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

                    {/* TAB 2: MANAGE FORMS (WITH 2 SEPARATE TABS: FORM THƯỜNG & FORM TÁI ĐÁNH GIÁ) */}
                    {activeTab === "form" && (
                        <div className="space-y-6">
                            
                            {/* Sub-tab Switcher: Form Thường vs Form Tái Đánh Giá */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-100/80 rounded-2xl border border-slate-200">
                                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl shadow-sm border border-slate-200/80">
                                    <button
                                        type="button"
                                        onClick={() => handleFormModeChange("normal")}
                                        className={`px-4 py-2 rounded-lg text-xs font-black tracking-wider transition-all flex items-center gap-2 ${
                                            formMode === "normal"
                                                ? "bg-indigo-600 text-white shadow-sm"
                                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                        }`}
                                    >
                                        <span>📋</span>
                                        <span>FORM THƯỜNG</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                                            formMode === "normal" ? "bg-indigo-700 text-white" : "bg-slate-100 text-slate-600"
                                        }`}>
                                            9 Section
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleFormModeChange("re_audit")}
                                        className={`px-4 py-2 rounded-lg text-xs font-black tracking-wider transition-all flex items-center gap-2 ${
                                            formMode === "re_audit"
                                                ? "bg-amber-600 text-white shadow-sm"
                                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                        }`}
                                    >
                                        <span>🔄</span>
                                        <span>FORM TÁI ĐÁNH GIÁ</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                                            formMode === "re_audit" ? "bg-amber-700 text-white" : "bg-amber-100 text-amber-800"
                                        }`}>
                                            10 Section
                                        </span>
                                    </button>
                                </div>

                                <div className="text-xs font-bold px-2">
                                    {formMode === "normal" ? (
                                        <span className="text-indigo-700 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                                            Áp dụng cho Form thường (Leanline DC & Molded gộp)
                                        </span>
                                    ) : (
                                        <span className="text-amber-800 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                            Áp dụng cho Form Tái đánh giá (Cutting Pairs, Logo Printing, Packing riêng)
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Section Selector */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                <div className="flex-1">
                                    <p className="text-[11px] font-black text-slate-400 mb-1.5 uppercase tracking-wider">
                                        Chọn Section ({formMode === "re_audit" ? "Tái đánh giá" : "Form thường"}) để chỉnh sửa tiêu chí:
                                    </p>
                                    <select
                                        value={currentSectionId}
                                        onChange={(e) => {
                                            if (formMode === "re_audit") {
                                                setSelectedReAuditSectionId(e.target.value);
                                            } else {
                                                setSelectedNormalSectionId(e.target.value);
                                            }
                                        }}
                                        className={`w-full bg-white border p-2.5 rounded-xl text-base md:text-lg font-black outline-none cursor-pointer shadow-sm ${
                                            formMode === "re_audit"
                                                ? "border-amber-300 text-amber-950 focus:ring-2 focus:ring-amber-500"
                                                : "border-slate-200 text-indigo-950 focus:ring-2 focus:ring-indigo-500"
                                        }`}
                                    >
                                        {formMode === "normal" ? (
                                            normalSections.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name || s.id}
                                                </option>
                                            ))
                                        ) : (
                                            MQAA_RE_AUDIT_SECTIONS.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} ({s.vnName})
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                <button
                                    onClick={handleSyncSectionFromExcel}
                                    className={`px-5 py-3 border rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition self-end sm:self-center ${
                                        formMode === "re_audit"
                                            ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300"
                                            : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
                                    }`}
                                    title={`Khôi phục danh sách tiêu chí chuẩn từ file Excel cho ${currentSectionId}`}
                                >
                                    ⚡ Khôi phục từ Excel
                                </button>
                            </div>

                            {/* Edit / Add Criterion Box */}
                            <div
                                id="settings-item-input-box"
                                className={`p-6 rounded-3xl border transition-all space-y-4 ${
                                    editingItem
                                        ? "bg-amber-50/70 border-amber-300 ring-2 ring-amber-200"
                                        : "bg-slate-50 border-slate-200"
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <h4 className="text-base font-black text-indigo-950">
                                        {editingItem
                                            ? `Chỉnh sửa tiêu chí: ${editingItem.no} (${formMode === "re_audit" ? "Form Tái đánh giá" : "Form Thường"})`
                                            : `Thêm tiêu chí mới vào Section (${formMode === "re_audit" ? "Form Tái đánh giá" : "Form Thường"})`}
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
                                    className={`w-full py-3.5 text-white rounded-xl font-black shadow-lg transition uppercase text-xs tracking-wider ${
                                        formMode === "re_audit"
                                            ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
                                            : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                                    }`}
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
                                    <span className="text-xs text-slate-400 font-bold">
                                        Section: <strong>{currentSectionId}</strong> ({formMode === "re_audit" ? "Tái đánh giá" : "Form thường"})
                                    </span>
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

                    {/* TAB 3: SET TARGET */}
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

                            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
                                <div className="flex flex-col items-center gap-4">
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                        Mục tiêu hiện tại:
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={tempTarget}
                                            onChange={(e) => setTempTarget(e.target.value)}
                                            className="w-36 p-4 text-center text-4xl font-black text-indigo-700 bg-white border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 transition shadow-inner"
                                        />
                                        <span className="text-3xl font-black text-slate-400">%</span>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                                        {[70, 75, 80, 85, 90, 95].map((preset) => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => setTempTarget(preset)}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                                                    Number(tempTarget) === preset
                                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                                }`}
                                            >
                                                {preset}%
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveTarget}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-indigo-100 transition active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {targetSavedMsg ? "✅ ĐÃ LƯU MỤC TIÊU THÀNH CÔNG!" : "LƯU MỤC TIÊU MỚI"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: MỐC ĐIỂM (SCORING) */}
                    {activeTab === "scoring" && (
                        <div className="space-y-8 max-w-3xl mx-auto py-2">
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                                    </svg>
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                                    Cấu hình Mốc Điểm Nút Bấm
                                </h3>
                                <p className="text-slate-500 text-xs md:text-sm">
                                    Tùy chỉnh số lượng (1 - 5 mốc) và giá trị số điểm cho nút bấm chấm điểm.
                                </p>
                            </div>

                            <div className="space-y-6">
                                {/* Mục Thường */}
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200/80 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-black text-slate-800">1. Tiêu chí Bình Thường</h4>
                                            <p className="text-[11px] text-slate-400">Các mục không có dấu hoa thị (*)</p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-bold text-slate-500 mr-1">Số mốc:</span>
                                            {[1, 2, 3, 4, 5].map((cnt) => (
                                                <button
                                                    key={cnt}
                                                    type="button"
                                                    onClick={() => handleSetNormalCount(cnt)}
                                                    className={`w-7 h-7 rounded-lg text-xs font-black transition ${
                                                        tempNormalScores.length === cnt
                                                            ? "bg-indigo-600 text-white shadow-sm"
                                                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                                                    }`}
                                                >
                                                    {cnt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                                        {tempNormalScores.map((sc, i) => (
                                            <div key={i} className="flex flex-col gap-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">Mốc {i + 1}:</span>
                                                <input
                                                    type="number"
                                                    value={sc}
                                                    onChange={(e) => handleNormalScoreChange(i, e.target.value)}
                                                    className="p-3 bg-white border border-slate-200 rounded-xl font-black text-center text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-800"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Mục Trọng Yếu */}
                                <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-200/80 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-black text-emerald-900">2. Tiêu chí Trọng Yếu (⭐)</h4>
                                            <p className="text-[11px] text-emerald-700/70">Các mục có dấu hoa thị (*) hoặc gắn sao trọng yếu</p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-bold text-slate-500 mr-1">Số mốc:</span>
                                            {[1, 2, 3, 4, 5].map((cnt) => (
                                                <button
                                                    key={cnt}
                                                    type="button"
                                                    onClick={() => handleSetCriticalCount(cnt)}
                                                    className={`w-7 h-7 rounded-lg text-xs font-black transition ${
                                                        tempCriticalScores.length === cnt
                                                            ? "bg-emerald-600 text-white shadow-sm"
                                                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                                                    }`}
                                                >
                                                    {cnt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                                        {tempCriticalScores.map((sc, i) => (
                                            <div key={i} className="flex flex-col gap-1">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">Mốc {i + 1}:</span>
                                                <input
                                                    type="number"
                                                    value={sc}
                                                    onChange={(e) => handleCriticalScoreChange(i, e.target.value)}
                                                    className="p-3 bg-white border border-emerald-300 rounded-xl font-black text-center text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-emerald-900"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTempNormalScores(DEFAULT_NORMAL_SCORES);
                                        setTempCriticalScores(DEFAULT_CRITICAL_SCORES);
                                    }}
                                    className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-wider transition"
                                >
                                    Mặc định ban đầu
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveScoreSettings}
                                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-blue-100 transition active:scale-95"
                                >
                                    {scoreSavedMsg ? "✅ ĐÃ LƯU MỐC ĐIỂM THÀNH CÔNG!" : "LƯU CẤU HÌNH MỐC ĐIỂM"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

