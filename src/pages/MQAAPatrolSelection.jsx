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
        const { data } = await supabase
            .from("mqaa_patrol_criteria")
            .select("*")
            .eq("section_id", sectionId)
            .order("sort_order", { ascending: true });
        if (data) setCurrentCriteria(data.map(d => ({
            ...d,
            subLabel: d.sub_label,
            maxScore: d.max_score,
            isHeader: d.is_header
        })));
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
            sort_order: (editingItem?.sort_order) ?? (currentCriteria.length * 10 + 10)
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
        if (!confirm("Nạp dữ liệu mặc định từ hệ thống vào Database?")) return;
        for (const sid in ALL_CRITERIA) {
            const items = ALL_CRITERIA[sid];
            const payload = items.map((item, idx) => ({
                section_id: sid,
                no: item.no,
                label: item.label,
                sub_label: item.subLabel,
                is_header: item.isHeader || false,
                max_score: item.isHeader ? 0 : 6,
                sort_order: idx * 10
            }));
            await supabase.from("mqaa_patrol_criteria").insert(payload);
        }
        alert("Done!");
        fetchCriteria(selectedSectionId);
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
                    <button onClick={() => navigate("/mqaa-patrol/dashboard")} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg active:scale-95 transition-all">Dashboard</button>
                    <button onClick={() => navigate("/mqaa-patrol/report")} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg active:scale-95 transition-all">Report</button>
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
            </div>

            {showSettings && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-white">

                        {/* Tab Switcher */}
                        <div className="px-8 pt-8 flex justify-between items-center">
                            <div className="bg-slate-100 p-1.5 rounded-[22px] flex gap-1">
                                <button onClick={() => setActiveTab("auditor")} className={`px-8 py-3 rounded-[18px] text-sm font-black tracking-tighter transition-all ${activeTab === 'auditor' ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}>1. AUDITORS</button>
                                <button onClick={() => setActiveTab("form")} className={`px-8 py-3 rounded-[18px] text-sm font-black tracking-tighter transition-all ${activeTab === 'form' ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}>2. MANAGE FORMS</button>
                            </div>
                            <button onClick={() => setShowSettings(false)} className="bg-slate-100 p-3 rounded-full text-slate-400 hover:text-slate-900 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10">
                            {activeTab === "auditor" ? (
                                <div className="space-y-10">
                                    <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                                        <h3 className="text-xl font-black text-slate-800 mb-6 tracking-tight">Add Auditor Profile</h3>
                                        <div className="flex gap-4">
                                            <input type="text" placeholder="MSNV (ID)" className="w-1/3 p-4 bg-white border-none rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-100 outline-none" value={newAuditor.id} onChange={(e) => setNewAuditor({ ...newAuditor, id: e.target.value })} />
                                            <input type="text" placeholder="Auditor Name" className="flex-1 p-4 bg-white border-none rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-100 outline-none" value={newAuditor.name} onChange={(e) => setNewAuditor({ ...newAuditor, name: e.target.value })} />
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
                                    <button onClick={handleCleanup} disabled={cleaning} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all underline decoration-slate-300">Clean Old Image Storage</button>
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    {/* Section Selection Bar */}
                                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-slate-400 mb-2 tracking-widest uppercase">Target Business Unit</p>
                                            <select value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)} className="w-full bg-transparent text-2xl font-black text-indigo-950 outline-none cursor-pointer">
                                                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex gap-2 h-fit">
                                            <button onClick={handleAddSection} className="bg-white p-4 rounded-2xl shadow-sm text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                            </button>
                                            <button onClick={() => handleDeleteSection(selectedSectionId)} className="bg-white p-4 rounded-2xl shadow-sm text-red-500 hover:bg-red-500 hover:text-white transition-all">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Two Creation Boxes: Header vs Item */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Box 1: Add Header */}
                                        <div className="p-8 bg-indigo-50/50 rounded-[40px] border border-indigo-100 space-y-6">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="bg-indigo-600 text-white p-2 rounded-xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg></div>
                                                <h4 className="text-lg font-black text-indigo-900 tracking-tight">Add Category Header</h4>
                                            </div>
                                            <div className="space-y-4">
                                                <input type="text" placeholder="No. (e.g., 1.0)" className="w-full p-4 bg-white border-none rounded-2xl shadow-sm font-black text-indigo-700 outline-none" value={headerInput.no} onChange={(e) => setHeaderInput({ ...headerInput, no: e.target.value })} />
                                                <textarea placeholder="VN Header Name..." rows="2" className="w-full p-4 bg-white border-none rounded-2xl shadow-sm font-bold text-slate-700 outline-none resize-none" value={headerInput.label} onChange={(e) => setHeaderInput({ ...headerInput, label: e.target.value })} />
                                                <textarea placeholder="EN Header Name..." rows="2" className="w-full p-4 bg-white border-none rounded-2xl shadow-sm text-pink-500 italic font-medium outline-none resize-none" value={headerInput.subLabel} onChange={(e) => setHeaderInput({ ...headerInput, subLabel: e.target.value })} />
                                                <button onClick={() => handleSaveEntry('header')} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all">ADD HEADER ROW</button>
                                            </div>
                                        </div>

                                        {/* Box 2: Add Sub-item */}
                                        <div className="p-8 bg-emerald-50/50 rounded-[40px] border border-emerald-100 space-y-6">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="bg-emerald-600 text-white p-2 rounded-xl"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div>
                                                <h4 className="text-lg font-black text-emerald-900 tracking-tight">Add Check Criterion</h4>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex gap-3">
                                                    <input type="text" placeholder="No. (1.1.1)" className="w-2/3 p-4 bg-white border-none rounded-2xl shadow-sm font-black text-emerald-700 outline-none" value={itemInput.no} onChange={(e) => setItemInput({ ...itemInput, no: e.target.value })} />
                                                    <div className="w-1/3 bg-white p-2 rounded-2xl shadow-sm flex flex-col justify-center items-center">
                                                        <span className="text-[10px] font-black text-slate-300 uppercase">Weight</span>
                                                        <input type="number" className="w-full text-center font-black text-emerald-700 outline-none bg-transparent" value={itemInput.maxScore} onChange={(e) => setItemInput({ ...itemInput, maxScore: parseInt(e.target.value) })} />
                                                    </div>
                                                </div>
                                                <textarea placeholder="VN Criterion..." rows="2" className="w-full p-4 bg-white border-none rounded-2xl shadow-sm font-bold text-slate-700 outline-none resize-none" value={itemInput.label} onChange={(e) => setItemInput({ ...itemInput, label: e.target.value })} />
                                                <textarea placeholder="EN Criterion..." rows="2" className="w-full p-4 bg-white border-none rounded-2xl shadow-sm text-blue-500 italic font-medium outline-none resize-none" value={itemInput.subLabel} onChange={(e) => setItemInput({ ...itemInput, subLabel: e.target.value })} />
                                                <button onClick={() => handleSaveEntry('item')} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 active:scale-[0.98] transition-all">ADD CRITERIA ITEM</button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Visual Criteria List */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center mb-6">
                                            <h4 className="text-2xl font-black text-slate-800 tracking-tighter">Current Checklist Preview</h4>
                                            {currentCriteria.length === 0 && (
                                                <button onClick={handleImportDefaults} className="text-xs font-black text-indigo-500 hover:underline tracking-widest uppercase">Emergency Load Defaults</button>
                                            )}
                                        </div>
                                        {currentCriteria.map((item) => (
                                            <div key={item.id} className={`p-5 rounded-3xl border transition-all flex items-center gap-6 group ${item.isHeader ? 'bg-indigo-600 text-white border-indigo-700 shadow-xl' : 'bg-white border-slate-100 hover:shadow-md'}`}>
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg ${item.isHeader ? 'bg-indigo-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                                    {item.no}
                                                </div>
                                                <div className="flex-1">
                                                    <p className={`font-black text-lg leading-tight ${item.isHeader ? 'text-white' : 'text-slate-800'}`}>{item.label}</p>
                                                    <p className={`text-sm font-medium mt-1 leading-tight ${item.isHeader ? 'text-indigo-200' : 'text-slate-400 italic'}`}>{item.subLabel}</p>
                                                </div>
                                                {!item.isHeader && (
                                                    <div className="text-center px-4 border-l border-slate-100">
                                                        <p className="text-[10px] font-black opacity-30 uppercase">Score</p>
                                                        <p className="font-black text-slate-700">{item.maxScore}</p>
                                                    </div>
                                                )}
                                                <button onClick={() => handleDeleteCriteriaItem(item.id)} className={`p-3 rounded-2xl transition-all ${item.isHeader ? 'bg-red-500 hover:bg-white hover:text-red-500 text-white' : 'bg-red-50 text-red-100 hover:bg-red-500 hover:text-white text-red-500 opacity-0 group-hover:opacity-100'}`}>
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 bg-slate-50 border-t border-slate-100">
                            <button onClick={() => setShowSettings(false)} className="w-full py-5 bg-indigo-950 text-white rounded-[24px] font-black text-xl tracking-tighter hover:bg-black transition-all shadow-2xl active:scale-[0.98]">
                                SAVE CHANGES & CLOSE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
