import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
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
    const [loadingCriteria, setLoadingCriteria] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // Split forms for Header and Item
    const [headerInput, setHeaderInput] = useState({ no: "", label: "", subLabel: "" });
    const [itemInput, setItemInput] = useState({ no: "", label: "", subLabel: "", maxScore: 6 });

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
        setLoadingCriteria(true);
        const { data } = await supabase
            .from("mqaa_patrol_criteria")
            .select("*")
            .eq("section_id", sectionId)
            .order("sort_order", { ascending: true });
        if (data) {
            setCurrentCriteria(data.map(d => ({
                ...d,
                subLabel: d.sub_label,
                maxScore: d.max_score,
                isHeader: d.is_header
            })));
        }
        setLoadingCriteria(false);
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

    // --- Dynamic Form Handlers ---
    const handleAddSection = async () => {
        const name = prompt("Nhập tên hiển thị của Section mới:");
        if (!name) return;
        const id = name.replace(/\s+/g, '_');

        const { error } = await supabase.from("mqaa_patrol_sections").insert([{ id, name, sort_order: sections.length * 10 + 10 }]);
        if (error) alert("Section ID đã tồn tại hoặc lỗi: " + error.message);
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

    const handleEditCriteriaItem = (item) => {
        setEditingItem(item);
        if (item.isHeader) {
            setHeaderInput({ no: item.no, label: item.label, subLabel: item.subLabel });
            // Scroll to header input box
            document.getElementById('header-input-box')?.scrollIntoView({ behavior: 'smooth' });
        } else {
            setItemInput({ no: item.no, label: item.label, subLabel: item.subLabel, maxScore: item.maxScore });
            // Scroll to item input box
            document.getElementById('item-input-box')?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleSaveEntry = async (type) => {
        const isHeader = type === 'header';
        const input = isHeader ? headerInput : itemInput;

        if (!input.no || !input.label) return alert("Vui lòng nhập No. và Nội dung");

        const payload = {
            section_id: selectedSectionId,
            no: input.no,
            label: input.label,
            sub_label: input.subLabel,
            is_header: isHeader,
            max_score: isHeader ? 0 : input.maxScore,
            sort_order: (editingItem?.sort_order) ?? (currentCriteria.length === 0 ? 0 : currentCriteria[currentCriteria.length - 1].sort_order + 10)
        };

        let res;
        if (editingItem) {
            res = await supabase.from("mqaa_patrol_criteria").update(payload).eq("id", editingItem.id);
        } else {
            res = await supabase.from("mqaa_patrol_criteria").insert([payload]);
        }

        if (res.error) alert(res.error.message);
        else {
            if (isHeader) setHeaderInput({ no: "", label: "", subLabel: "" });
            else setItemInput({ ...itemInput, no: "", label: "", subLabel: "" });
            setEditingItem(null);
            fetchCriteria(selectedSectionId);
        }
    };

    const handleDeleteCriteriaItem = async (id) => {
        if (!confirm("Xóa mục này?")) return;
        const { error } = await supabase.from("mqaa_patrol_criteria").delete().eq("id", id);
        if (!error) fetchCriteria(selectedSectionId);
    };

    const handleImportDefaults = async () => {
        const targetSid = selectedSectionId;
        if (!targetSid) return alert("Vui lòng chọn Section");
        if (!confirm(`Nạp dữ liệu mặc định hệ thống cho Section "${targetSid}"?`)) return;

        const items = ALL_CRITERIA[targetSid];
        if (!items) return alert("Không tìm thấy dữ liệu mẫu cho Section này.");

        const payload = items.map((item, idx) => ({
            section_id: targetSid,
            no: item.no,
            label: item.label,
            sub_label: item.subLabel,
            is_header: item.isHeader || false,
            max_score: item.isHeader ? 0 : 6,
            sort_order: idx * 10
        }));

        const { error } = await supabase.from("mqaa_patrol_criteria").insert(payload);
        if (error) alert(error.message);
        else fetchCriteria(targetSid);
    };

    const handleCleanup = async () => {
        const days = prompt("Xóa ảnh cũ hơn bao nhiêu ngày?", "30");
        if (!days) return;
        setCleaning(true);
        try {
            const { data: files } = await supabase.storage.from("mqaa-images").list("mqaa_patrol");
            const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - parseInt(days));
            const toDel = (files || []).filter(f => f.created_at && new Date(f.created_at) < cutoff).map(f => `mqaa_patrol/${f.name}`);
            if (toDel.length > 0 && confirm(`Xóa ${toDel.length} ảnh?`)) await supabase.storage.from("mqaa-images").remove(toDel);
        } finally { setCleaning(false); }
    };

    const handleOpenSettings = () => {
        if (prompt("Mật mã:") === "04672") setShowSettings(true);
        else alert("Sai mật mã!");
    };

    return (
        <div className="max-w-4xl mx-auto p-6 min-h-screen bg-slate-50 font-sans">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate("/")} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-indigo-950 tracking-tight">MQAA PATROL</h1>
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Insole Production Quality</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={handleOpenSettings} className="p-3 bg-white text-slate-400 rounded-2xl border shadow-sm hover:text-indigo-600 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                    <button onClick={() => navigate("/mqaa-patrol/dashboard")} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg active:scale-95 transition-all text-sm">Dashboard</button>
                    <button onClick={() => navigate("/mqaa-patrol/report")} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg active:scale-95 transition-all text-sm">Report</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sections.map((s) => (
                    <button key={s.id} onClick={() => navigate(`/mqaa-patrol/entry/${s.id}`)} className="group relative bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-2xl hover:border-indigo-500 transition-all text-left overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150"></div>
                        <span className="relative z-10 text-xl font-black text-slate-800 group-hover:text-indigo-700 uppercase leading-snug">{s.name}</span>
                        <div className="mt-4 flex items-center gap-2 relative z-10 text-[10px] font-black tracking-widest text-slate-400 group-hover:text-indigo-400 uppercase">
                            Start Checklist
                            <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        </div>
                    </button>
                ))}
                {sections.length === 0 && (
                    <div className="col-span-full p-10 text-center text-slate-400 italic bg-white rounded-3xl border border-dashed border-slate-200 uppercase font-black text-sm tracking-widest">No sections configured. Click Gear icon to add.</div>
                )}
            </div>

            {showSettings && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-white">

                        {/* Tab Switcher */}
                        <div className="px-8 pt-6 flex justify-between items-center">
                            <div className="bg-slate-100 p-1.5 rounded-[22px] flex gap-1">
                                <button onClick={() => setActiveTab("auditor")} className={`px-8 py-3 rounded-[18px] text-xs font-black tracking-widest transition-all ${activeTab === 'auditor' ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}>1. AUDITORS</button>
                                <button onClick={() => setActiveTab("form")} className={`px-8 py-3 rounded-[18px] text-xs font-black tracking-widest transition-all ${activeTab === 'form' ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}>2. MANAGE FORMS</button>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => fetchCriteria(selectedSectionId)} className="p-3 bg-slate-100 rounded-full text-slate-400 hover:text-indigo-600 transition-colors" title="Refresh list">
                                    <svg className={`w-5 h-5 ${loadingCriteria ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                </button>
                                <button onClick={() => setShowSettings(false)} className="bg-slate-100 p-3 rounded-full text-slate-400 hover:text-slate-900 transition-colors">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
                            {activeTab === "auditor" ? (
                                <div className="space-y-10">
                                    <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                                        <h3 className="text-xl font-black text-slate-800 mb-6 tracking-tight">Add Auditor Profile</h3>
                                        <div className="flex gap-4">
                                            <input type="text" placeholder="MSNV (ID)" className="w-1/3 p-4 bg-white border-none rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-100 outline-none font-bold" value={newAuditor.id} onChange={(e) => setNewAuditor({ ...newAuditor, id: e.target.value })} />
                                            <input type="text" placeholder="Auditor Name" className="flex-1 p-4 bg-white border-none rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-100 outline-none font-bold" value={newAuditor.name} onChange={(e) => setNewAuditor({ ...newAuditor, name: e.target.value })} />
                                            <button onClick={handleAddAuditor} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-indigo-200 active:scale-95 transition-all uppercase text-sm">Create</button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {auditorList.map((a) => (
                                            <div key={a.id} className="p-5 bg-white border border-slate-100 rounded-3xl flex justify-between items-center group hover:border-indigo-200 transition-all shadow-sm">
                                                <div>
                                                    <p className="text-[10px] font-black text-indigo-500 uppercase">{a.id}</p>
                                                    <p className="font-bold text-slate-700">{a.name}</p>
                                                </div>
                                                <button onClick={() => handleDeleteAuditor(a.id)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={handleCleanup} disabled={cleaning} className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all underline decoration-slate-300">Clean Old Image Storage</button>
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    {/* Section Selection Bar */}
                                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-slate-400 mb-2 tracking-widest uppercase">Target Section</p>
                                            <select value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)} className="w-full bg-transparent text-2xl font-black text-indigo-950 outline-none cursor-pointer">
                                                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex gap-2 h-fit">
                                            <button onClick={handleAddSection} className="bg-white p-4 rounded-2xl shadow-sm text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-indigo-50" title="Add Section">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                            </button>
                                            <button onClick={() => handleDeleteSection(selectedSectionId)} className="bg-white p-4 rounded-2xl shadow-sm text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-red-50" title="Delete Section">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Two Creation Boxes: Header vs Item */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Box 1: Header */}
                                        <div id="header-input-box" className={`p-8 rounded-[40px] border transition-all space-y-6 ${editingItem?.isHeader ? 'bg-amber-100 border-amber-300 ring-4 ring-amber-50' : 'bg-indigo-50/50 border-indigo-100'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-indigo-600 text-white p-2 rounded-xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg></div>
                                                    <h4 className="text-lg font-black text-indigo-900 tracking-tight">{editingItem?.isHeader ? "Edit Header" : "Add Header Row"}</h4>
                                                </div>
                                                {editingItem?.isHeader && <button onClick={() => { setEditingItem(null); setHeaderInput({ no: "", label: "", subLabel: "" }) }} className="text-[10px] font-black uppercase text-amber-700 bg-white px-3 py-1 rounded-full shadow-sm">Cancel Edit</button>}
                                            </div>
                                            <div className="space-y-4">
                                                <input type="text" placeholder="No. (VD: 1.0)" className="w-full p-4 bg-white border-none rounded-2xl shadow-sm font-black text-indigo-700 outline-none" value={headerInput.no} onChange={(e) => setHeaderInput({ ...headerInput, no: e.target.value })} />
                                                <textarea placeholder="VN Header..." rows="2" className="w-full p-4 bg-white border-none rounded-2xl shadow-sm font-bold text-slate-700 outline-none resize-none" value={headerInput.label} onChange={(e) => setHeaderInput({ ...headerInput, label: e.target.value })} />
                                                <textarea placeholder="EN Header..." rows="2" className="w-full p-4 bg-white border-none rounded-2xl shadow-sm text-pink-500 italic font-medium outline-none resize-none" value={headerInput.subLabel} onChange={(e) => setHeaderInput({ ...headerInput, subLabel: e.target.value })} />
                                                <button onClick={() => handleSaveEntry('header')} className={`w-full py-4 text-white rounded-2xl font-black shadow-lg transition-all ${editingItem?.isHeader ? 'bg-amber-600 shadow-amber-100' : 'bg-indigo-600 shadow-indigo-100'}`}>
                                                    {editingItem?.isHeader ? 'UPDATE HEADER' : 'ADD HEADER'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Box 2: Sub-item */}
                                        <div id="item-input-box" className={`p-8 rounded-[40px] border transition-all space-y-6 ${editingItem && !editingItem.isHeader ? 'bg-emerald-100 border-emerald-300 ring-4 ring-emerald-50' : 'bg-emerald-50/50 border-emerald-100'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-emerald-600 text-white p-2 rounded-xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div>
                                                    <h4 className="text-lg font-black text-emerald-900 tracking-tight">{editingItem && !editingItem.isHeader ? "Edit Criterion" : "Add Criterion"}</h4>
                                                </div>
                                                {editingItem && !editingItem.isHeader && <button onClick={() => { setEditingItem(null); setItemInput({ no: "", label: "", subLabel: "", maxScore: 6 }) }} className="text-[10px] font-black uppercase text-emerald-700 bg-white px-3 py-1 rounded-full shadow-sm">Cancel Edit</button>}
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex gap-3">
                                                    <input type="text" placeholder="No. (VD: 1.1.1)" className="w-2/3 p-4 bg-white border-none rounded-2xl shadow-sm font-black text-emerald-700 outline-none" value={itemInput.no} onChange={(e) => setItemInput({ ...itemInput, no: e.target.value })} />
                                                    <div className="w-1/3 bg-white p-2 rounded-2xl shadow-sm flex flex-col justify-center items-center">
                                                        <span className="text-[10px] font-black text-slate-300 uppercase">Points</span>
                                                        <input type="number" className="w-full text-center font-black text-emerald-700 outline-none bg-transparent" value={itemInput.maxScore} onChange={(e) => setItemInput({ ...itemInput, maxScore: parseInt(e.target.value) })} />
                                                    </div>
                                                </div>
                                                <textarea placeholder="VN Content..." rows="2" className="w-full p-4 bg-white border-none rounded-2xl shadow-sm font-bold text-slate-700 outline-none resize-none" value={itemInput.label} onChange={(e) => setItemInput({ ...itemInput, label: e.target.value })} />
                                                <textarea placeholder="EN Content..." rows="2" className="w-full p-4 bg-white border-none rounded-2xl shadow-sm text-blue-500 italic font-medium outline-none resize-none" value={itemInput.subLabel} onChange={(e) => setItemInput({ ...itemInput, subLabel: e.target.value })} />
                                                <button onClick={() => handleSaveEntry('item')} className={`w-full py-4 text-white rounded-2xl font-black shadow-lg transition-all ${editingItem && !editingItem.isHeader ? 'bg-emerald-600 shadow-emerald-100' : 'bg-emerald-700 shadow-emerald-100'}`}>
                                                    {editingItem && !editingItem.isHeader ? 'UPDATE CRITERION' : 'ADD TO LIST'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Visual Criteria List Preview */}
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                            <div>
                                                <h4 className="text-xl font-black text-slate-800 tracking-tight">Form Preview: {sections.find(s => s.id === selectedSectionId)?.name}</h4>
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{currentCriteria.length} items configured</p>
                                            </div>
                                            <button onClick={handleImportDefaults} className="bg-indigo-50 text-indigo-600 px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-indigo-600 hover:text-white transition-all active:scale-95 shadow-sm">
                                                Import Default Setup
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            {loadingCriteria && <div className="p-20 flex justify-center"><div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full font-black"></div></div>}

                                            {!loadingCriteria && currentCriteria.length === 0 && (
                                                <div className="p-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
                                                    <p className="text-slate-400 font-black text-sm uppercase tracking-widest italic mb-6">List is empty for this section.</p>
                                                    <button onClick={handleImportDefaults} className="bg-indigo-600 text-white px-10 py-5 rounded-[24px] font-black text-lg shadow-xl shadow-indigo-100 active:scale-95 transition-all">LOAD DEFAULT SYSTEM CRITERIA</button>
                                                </div>
                                            )}

                                            {currentCriteria.map((item) => (
                                                <div key={item.id} className={`p-5 rounded-3xl border transition-all flex items-center gap-6 group ${item.isHeader ? 'bg-indigo-500 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white border-slate-100 hover:shadow-xl hover:border-indigo-200'}`}>
                                                    <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black leading-none ${item.isHeader ? 'bg-indigo-600 text-white border border-indigo-400' : 'bg-slate-50 text-indigo-600'}`}>
                                                        <span className="text-[10px] opacity-40 mb-1">No.</span>
                                                        <span className="text-lg">{item.no}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className={`font-black text-lg leading-tight uppercase ${item.isHeader ? 'text-white' : 'text-slate-800'}`}>{item.label}</p>
                                                        <p className={`text-sm font-medium mt-1 leading-tight ${item.isHeader ? 'text-indigo-100' : 'text-slate-400 italic'}`}>{item.subLabel}</p>
                                                    </div>
                                                    {!item.isHeader && (
                                                        <div className="text-center px-4 border-l border-slate-100 group-hover:border-indigo-100">
                                                            <p className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-1">Score</p>
                                                            <p className="font-black text-slate-700">{item.maxScore}</p>
                                                        </div>
                                                    )}
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                        <button onClick={() => handleEditCriteriaItem(item)} className={`p-3 rounded-2xl transition-all ${item.isHeader ? 'bg-white/20 text-white hover:bg-white hover:text-indigo-600' : 'bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'}`} title="Edit">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        </button>
                                                        <button onClick={() => handleDeleteCriteriaItem(item.id)} className={`p-3 rounded-2xl transition-all ${item.isHeader ? 'bg-white/20 text-white hover:bg-red-500 hover:text-white' : 'bg-red-50 text-red-400 hover:bg-red-500 hover:text-white'}`} title="Delete">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 italic px-20">Click SAVE to finalize and return to selection screen. All criteria changes are saved instantly to database.</p>
                            <button onClick={() => setShowSettings(false)} className="w-full py-5 bg-indigo-950 text-white rounded-[24px] font-black text-xl tracking-tighter hover:bg-black transition-all shadow-2xl active:scale-[0.98]">
                                DONE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
