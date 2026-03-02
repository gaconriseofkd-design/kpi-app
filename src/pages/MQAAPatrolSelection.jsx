import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { ALL_CRITERIA } from "../data/mqaaPatrolCriteria";

export default function MQAAPatrolSelection() {
    const navigate = useNavigate();
    const [showSettings, setShowSettings] = useState(false);
    const [activeTab, setActiveTab] = useState("auditor"); // 'auditor' or 'form'

    // Auditors State
    const [auditorList, setAuditorList] = useState([]);
    const [newAuditor, setNewAuditor] = useState({ id: "", name: "" });
    const [cleaning, setCleaning] = useState(false);

    // Form Management State
    const [sections, setSections] = useState([]);
    const [selectedSectionId, setSelectedSectionId] = useState("");
    const [currentCriteria, setCurrentCriteria] = useState([]);
    const [editingItem, setEditingItem] = useState(null); // for editing a criterion
    const [newItem, setNewItem] = useState({ no: "", label: "", subLabel: "", isHeader: false, maxScore: 6 });
    const [editingSection, setEditingSection] = useState(null); // for adding/editing a section

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
        const { data } = await supabase.from("mqaa_patrol_sections").select("*").order("sort_order", { ascending: true });
        if (data) {
            setSections(data);
            if (data.length > 0 && !selectedSectionId) setSelectedSectionId(data[0].id);
        }
    };

    const fetchCriteria = async (sectionId) => {
        const { data } = await supabase
            .from("mqaa_patrol_criteria")
            .select("*")
            .eq("section_id", sectionId)
            .order("sort_order", { ascending: true });
        if (data) setCurrentCriteria(data.map(d => ({
            ...d,
            subLabel: d.sub_label, // map from DB snake_case to app camelCase
            maxScore: d.max_score,
            isHeader: d.is_header
        })));
    };

    const handleAddAuditor = async () => {
        if (!newAuditor.id || !newAuditor.name) return alert("Vui lòng nhập đủ ID và Tên");
        const { error } = await supabase.from("mqaa_patrol_auditors").insert([newAuditor]);
        if (error) alert("Lỗi: " + error.message);
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

    // --- Form Management Handlers ---

    const handleAddSection = async () => {
        const id = prompt("Nhập ID cho Section (Dùng gạch dưới thay dấu cách, VD: My_New_Section):");
        if (!id) return;
        const name = prompt("Nhập tên hiển thị của Section:");
        if (!name) return;

        const { error } = await supabase.from("mqaa_patrol_sections").insert([{ id, name, sort_order: sections.length * 10 + 10 }]);
        if (error) alert(error.message);
        else fetchSections();
    };

    const handleDeleteSection = async (id) => {
        if (!confirm(`Xóa Section "${id}" và toàn bộ tiêu chí bên trong?`)) return;
        const { error } = await supabase.from("mqaa_patrol_sections").delete().eq("id", id);
        if (error) alert(error.message);
        else {
            fetchSections();
            setSelectedSectionId("");
        }
    };

    const handleSaveCriteriaItem = async () => {
        if (!newItem.no || !newItem.label) return alert("Vui lòng nhập No. và Nội dung");

        const payload = {
            section_id: selectedSectionId,
            no: newItem.no,
            label: newItem.label,
            sub_label: newItem.subLabel,
            is_header: newItem.isHeader,
            max_score: newItem.isHeader ? 0 : newItem.maxScore,
            sort_order: currentCriteria.length * 10 + 10
        };

        let error;
        if (editingItem) {
            const { error: err } = await supabase.from("mqaa_patrol_criteria").update(payload).eq("id", editingItem.id);
            error = err;
        } else {
            const { error: err } = await supabase.from("mqaa_patrol_criteria").insert([payload]);
            error = err;
        }

        if (error) alert(error.message);
        else {
            setNewItem({ no: "", label: "", subLabel: "", isHeader: false, maxScore: 6 });
            setEditingItem(null);
            fetchCriteria(selectedSectionId);
        }
    };

    const handleDeleteCriteriaItem = async (id) => {
        if (!confirm("Xóa tiêu chí này?")) return;
        const { error } = await supabase.from("mqaa_patrol_criteria").delete().eq("id", id);
        if (!error) fetchCriteria(selectedSectionId);
    };

    const handleImportDefaults = async () => {
        if (!confirm("Hệ thống sẽ nạp dữ liệu tiêu chí mặc định từ tệp cấu hình vào Database. Tiếp tục?")) return;

        for (const sectionId in ALL_CRITERIA) {
            const items = ALL_CRITERIA[sectionId];
            const criteriaPayload = items.map((item, idx) => ({
                section_id: sectionId,
                no: item.no,
                label: item.label,
                sub_label: item.subLabel,
                is_header: item.isHeader || false,
                max_score: item.isHeader ? 0 : 6,
                sort_order: idx * 10
            }));

            await supabase.from("mqaa_patrol_criteria").insert(criteriaPayload);
        }
        alert("Đã nhập dữ liệu mặc định thành công!");
        fetchCriteria(selectedSectionId);
    };

    const handleCleanup = async () => {
        const days = prompt("Xóa tất cả ảnh vật lý cũ hơn bao nhiêu ngày?", "30");
        if (!days) return;
        setCleaning(true);
        try {
            const { data: files } = await supabase.storage.from("mqaa-images").list("mqaa_patrol");
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
            const filesToDelete = (files || [])
                .filter(f => f.created_at && new Date(f.created_at) < cutoffDate)
                .map(f => `mqaa_patrol/${f.name}`);

            if (filesToDelete.length > 0 && confirm(`Xóa ${filesToDelete.length} ảnh cũ?`)) {
                await supabase.storage.from("mqaa-images").remove(filesToDelete);
                alert("Đã dọn dẹp!");
            } else {
                alert("Không có ảnh nào cần dọn.");
            }
        } finally { setCleaning(false); }
    };

    const handleOpenSettings = () => {
        const pw = prompt("Nhập mật mã để vào Cài đặt:");
        if (pw === "04672") setShowSettings(true);
        else if (pw !== null) alert("Sai mật mã!");
    };

    return (
        <div className="max-w-4xl mx-auto p-6 min-h-screen bg-slate-50">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate("/")} className="bg-white hover:bg-slate-100 text-slate-600 p-3 rounded-xl shadow-sm border border-slate-200 transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-indigo-950 tracking-tight">MQAA PATROL</h1>
                        <p className="text-slate-500 font-medium">Insole Production Quality Check</p>
                    </div>
                </div>

                <div className="flex gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                    <button onClick={handleOpenSettings} className="p-3 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Settings">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                    <button onClick={() => navigate("/mqaa-patrol/dashboard")} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95">
                        Dashboard
                    </button>
                    <button onClick={() => navigate("/mqaa-patrol/report")} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-green-200 transition-all active:scale-95">
                        Report
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sections.map((section) => (
                    <button
                        key={section.id}
                        onClick={() => navigate(`/mqaa-patrol/entry/${section.id}`)}
                        className="group relative overflow-hidden bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-2xl hover:border-indigo-500 transition-all duration-300 text-left"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150"></div>
                        <span className="relative z-10 text-xl font-black text-slate-800 group-hover:text-indigo-700 transition-colors uppercase leading-tight">
                            {section.name}
                        </span>
                        <div className="mt-4 flex items-center gap-2 relative z-10">
                            <span className="text-xs font-bold text-slate-400 group-hover:text-indigo-400 transition-colors">START PATROL</span>
                            <svg className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        </div>
                    </button>
                ))}
            </div>

            {/* SETTINGS MODAL */}
            {showSettings && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">

                        {/* Modal Header & Tabs */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex gap-1 p-1 bg-slate-200 rounded-2xl w-fit">
                                <button
                                    onClick={() => setActiveTab("auditor")}
                                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'auditor' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Auditor Settings
                                </button>
                                <button
                                    onClick={() => setActiveTab("form")}
                                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'form' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Manage MQAA Form
                                </button>
                            </div>
                            <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8">
                            {activeTab === "auditor" ? (
                                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 mb-4">Add New Auditor</h3>
                                        <div className="flex gap-3">
                                            <input type="text" placeholder="ID (MSNV)" className="w-1/3 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={newAuditor.id} onChange={(e) => setNewAuditor({ ...newAuditor, id: e.target.value })} />
                                            <input type="text" placeholder="Full Name" className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" value={newAuditor.name} onChange={(e) => setNewAuditor({ ...newAuditor, name: e.target.value })} />
                                            <button onClick={handleAddAuditor} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Add</button>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 mb-4">Auditor List ({auditorList.length})</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {auditorList.map((a) => (
                                                <div key={a.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
                                                    <span className="font-medium text-slate-700"><strong>{a.id}</strong> - {a.name}</span>
                                                    <button onClick={() => handleDeleteAuditor(a.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-amber-900">Storage Cleanup</h4>
                                                <p className="text-sm text-amber-700/80 mb-4">Giải phóng bộ nhớ bằng cách xóa các ảnh rác đã cũ.</p>
                                                <button onClick={handleCleanup} disabled={cleaning} className="bg-white text-amber-700 px-6 py-2.5 rounded-xl font-bold shadow-sm hover:shadow-md transition-all">
                                                    {cleaning ? "Wait..." : "Clean Storage"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                                    {/* Section Selection */}
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                                        <div className="w-full md:w-1/2">
                                            <label className="block text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">Select Section to Edit</label>
                                            <select
                                                value={selectedSectionId}
                                                onChange={(e) => setSelectedSectionId(e.target.value)}
                                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                                            >
                                                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={handleAddSection} className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-6 py-3.5 rounded-2xl font-bold hover:bg-indigo-100 transition-all flex items-center gap-2">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                                Add Section
                                            </button>
                                            <button onClick={() => handleDeleteSection(selectedSectionId)} className="bg-red-50 text-red-700 border border-red-100 px-6 py-3.5 rounded-2xl font-bold hover:bg-red-100 transition-all flex items-center gap-2">
                                                Delete Section
                                            </button>
                                        </div>
                                    </div>

                                    {/* Criteria Editor */}
                                    {selectedSectionId && (
                                        <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 space-y-6">
                                            <h4 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                                Manage Criteria: {sections.find(s => s.id === selectedSectionId)?.name}
                                            </h4>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                                <div className="col-span-1">
                                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">NO.</label>
                                                    <input type="text" value={newItem.no} onChange={(e) => setNewItem({ ...newItem, no: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="1.1.1" />
                                                </div>
                                                <div className="col-span-1 flex items-center pt-5">
                                                    <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-slate-600">
                                                        <input type="checkbox" checked={newItem.isHeader} onChange={(e) => setNewItem({ ...newItem, isHeader: e.target.checked })} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                                        Is Header?
                                                    </label>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">WEIGHT / SCORE</label>
                                                    <input type="number" disabled={newItem.isHeader} value={newItem.maxScore} onChange={(e) => setNewItem({ ...newItem, maxScore: parseInt(e.target.value) })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50" />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">LABEL (VN)</label>
                                                    <textarea rows="2" value={newItem.label} onChange={(e) => setNewItem({ ...newItem, label: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Tiếng Việt..."></textarea>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">SUB-LABEL (EN)</label>
                                                    <textarea rows="2" value={newItem.subLabel} onChange={(e) => setNewItem({ ...newItem, subLabel: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="English Description..."></textarea>
                                                </div>
                                                <div className="col-span-4 flex justify-end gap-2 pt-2 border-t border-slate-50">
                                                    {editingItem && (
                                                        <button onClick={() => { setEditingItem(null); setNewItem({ no: "", label: "", subLabel: "", isHeader: false, maxScore: 6 }); }} className="px-6 py-3 text-slate-500 font-bold hover:text-slate-800 transition-colors">Cancel</button>
                                                    )}
                                                    <button onClick={handleSaveCriteriaItem} className="bg-indigo-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95">
                                                        {editingItem ? "Update Item" : "Add to List"}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Criteria List */}
                                            <div className="space-y-3 pt-4">
                                                {currentCriteria.map((item) => (
                                                    <div key={item.id} className={`p-4 rounded-2xl border transition-all ${item.isHeader ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-slate-100'} flex justify-between items-center group shadow-sm hover:shadow-md`}>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${item.isHeader ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-500'}`}>{item.no}</span>
                                                                <h5 className={`font-bold ${item.isHeader ? 'text-indigo-900' : 'text-slate-800'}`}>{item.label}</h5>
                                                            </div>
                                                            {!item.isHeader && <p className="text-xs text-slate-400 mt-1 italic leading-relaxed">{item.subLabel}</p>}
                                                        </div>
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all pl-4">
                                                            <button onClick={() => { setEditingItem(item); setNewItem({ ...item }); }} className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                            </button>
                                                            <button onClick={() => handleDeleteCriteriaItem(item.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {currentCriteria.length === 0 && (
                                                    <div className="text-center py-20 bg-slate-100/50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center">
                                                        <p className="text-slate-400 font-bold mb-4">No criteria found for this section</p>
                                                        <button onClick={handleImportDefaults} className="bg-indigo-100 text-indigo-700 px-8 py-3 rounded-2xl font-bold hover:bg-indigo-200 transition-all flex items-center gap-2">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 5l-4-4-4 4M12 1v13" /></svg>
                                                            Import Default Setup
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-200">
                            <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-lg shadow-xl shadow-slate-200 hover:bg-slate-900 transition-all active:scale-[0.98]">
                                DONE & CLOSE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
