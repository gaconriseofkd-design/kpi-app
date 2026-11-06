import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { usePatrolTarget } from "../utils/mqaaSettings";
import PasswordModal from "../components/PasswordModal";
import MQAASettingsModal from "../components/MQAASettingsModal";

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
    const [activeTab, setActiveTab] = useState("form");

    // Target Setting State for display
    const { targetScore } = usePatrolTarget();

    // Sections for the 9 cards
    const [sections, setSections] = useState([]);

    useEffect(() => {
        fetchSections();
    }, []);

    const fetchSections = async () => {
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
            setSections(valid);
        }
    };

    const handleOpenSettings = (tab = "form") => {
        setActiveTab(tab);
        setShowPasswordModal(true);
    };

    return (
        <div className="max-w-[1320px] mx-auto p-4 md:p-8 font-sans">
            <PasswordModal
                isOpen={showPasswordModal}
                onClose={() => setShowPasswordModal(false)}
                onSuccess={() => setShowSettings(true)}
                initialTitle="Cài đặt hệ thống MQAA"
            />

            <MQAASettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                initialTab={activeTab}
                initialFormMode="normal"
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
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl md:text-3xl font-black text-indigo-950 tracking-tight">
                                MQAA PATROL
                            </h1>
                            <span className="bg-indigo-100 text-indigo-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-indigo-200">
                                Chuẩn Mới 2026
                            </span>
                            <button
                                onClick={() => navigate("/mqaa-patrol/re-audit")}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black rounded-full shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer animate-pulse"
                                title="Mở trang MQAA Tái đánh giá"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Tái đánh giá</span>
                            </button>
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
                        onClick={() => handleOpenSettings("form")}
                        className="p-2.5 bg-white text-slate-500 hover:text-indigo-600 rounded-xl border border-slate-200 shadow-sm transition"
                        title="Cài đặt hệ thống (Manage Forms)"
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
        </div>
    );
}
