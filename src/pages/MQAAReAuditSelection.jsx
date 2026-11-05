import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { MQAA_RE_AUDIT_SECTIONS, MQAA_RE_AUDIT_CRITERIA } from "../data/mqaaReAuditCriteria";
import { usePatrolTarget } from "../utils/mqaaSettings";

const DEFAULT_AUDITOR_NAME = "Ngô Thị Bích Ngọc";
const AUDITOR_STORAGE_KEY = "mqaa_reassessment_auditor_name";

export default function MQAAReAuditSelection() {
    const navigate = useNavigate();
    const { targetScore } = usePatrolTarget();

    // Auditor State (persisted to localStorage)
    const [auditorName, setAuditorName] = useState(() => {
        return localStorage.getItem(AUDITOR_STORAGE_KEY) || DEFAULT_AUDITOR_NAME;
    });
    const [isEditingAuditor, setIsEditingAuditor] = useState(false);
    const [tempAuditorName, setTempAuditorName] = useState(auditorName);
    const [savedNotice, setSavedNotice] = useState(false);

    // Logs for today or recently
    const [todayLogs, setTodayLogs] = useState({});
    const [loading, setLoading] = useState(false);

    const todayStr = new Date().toISOString().split("T")[0];

    useEffect(() => {
        fetchTodayLogs();
    }, []);

    const fetchTodayLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("mqaa_patrol_logs")
                .select("id, section, overall_performance, total_score, total_level, date")
                .eq("auditor_id", "RE_AUDIT")
                .eq("date", todayStr);

            if (!error && data) {
                const map = {};
                data.forEach((log) => {
                    map[log.section] = log;
                });
                setTodayLogs(map);
            }
        } catch (err) {
            console.error("Error fetching re-audit logs:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAuditor = () => {
        const trimmed = tempAuditorName.trim() || DEFAULT_AUDITOR_NAME;
        setAuditorName(trimmed);
        localStorage.setItem(AUDITOR_STORAGE_KEY, trimmed);
        setIsEditingAuditor(false);
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2000);
    };

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate("/mqaa-patrol")}
                        className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 hover:bg-slate-50 transition"
                        title="Về trang MQAA Patrol gốc"
                    >
                        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl md:text-3xl font-black text-amber-950 tracking-tight">
                                MQAA TÁI ĐÁNH GIÁ
                            </h1>
                            <span className="bg-amber-100 text-amber-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-amber-300 shadow-sm">
                                Re-assessment
                            </span>
                            <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-emerald-300">
                                10 Công Đoạn Độc Lập
                            </span>
                        </div>
                        <p className="text-slate-400 text-xs md:text-sm font-bold uppercase tracking-widest mt-0.5">
                            Re-Audit Insole Quality Inspection • Tiêu chuẩn 2026
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Auditor Info Box */}
                    <div className="bg-white border border-amber-200 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold shadow-sm">
                        <span className="text-slate-500">Auditor:</span>
                        {isEditingAuditor ? (
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="text"
                                    value={tempAuditorName}
                                    onChange={(e) => setTempAuditorName(e.target.value)}
                                    placeholder="Nhập tên auditor..."
                                    className="px-2 py-0.5 text-xs font-bold text-amber-900 border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 w-44"
                                    autoFocus
                                    onKeyDown={(e) => e.key === "Enter" && handleSaveAuditor()}
                                />
                                <button
                                    onClick={handleSaveAuditor}
                                    className="bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded text-xs"
                                >
                                    Lưu
                                </button>
                                <button
                                    onClick={() => {
                                        setTempAuditorName(auditorName);
                                        setIsEditingAuditor(false);
                                    }}
                                    className="text-slate-400 hover:text-slate-600 px-1 text-xs"
                                >
                                    Hủy
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <span className="text-amber-900 font-black">{auditorName}</span>
                                <button
                                    onClick={() => {
                                        setTempAuditorName(auditorName);
                                        setIsEditingAuditor(true);
                                    }}
                                    className="text-slate-400 hover:text-amber-600 transition"
                                    title="Chỉnh sửa tên Auditor (tự lưu)"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                            </div>
                        )}
                        {savedNotice && (
                            <span className="text-emerald-600 font-black text-[11px] animate-fade-in">✓ Đã lưu!</span>
                        )}
                    </div>

                    {/* Navigation Buttons */}
                    <button
                        onClick={() => navigate("/mqaa-patrol")}
                        className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-xl font-bold shadow-sm active:scale-95 transition text-xs md:text-sm flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Trang gốc
                    </button>

                    <button
                        onClick={() => navigate("/mqaa-patrol/re-audit/dashboard")}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-bold shadow-md active:scale-95 transition text-xs md:text-sm flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Dashboard & Xuất Excel
                    </button>

                    <button
                        onClick={() => navigate("/mqaa-patrol/guide")}
                        className="bg-slate-600 hover:bg-slate-700 text-white px-3.5 py-2 rounded-xl font-bold shadow-sm active:scale-95 transition text-xs md:text-sm flex items-center gap-1"
                    >
                        Guide
                    </button>
                </div>
            </div>

            {/* Sub-header instruction banner */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 mb-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                        📋
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-amber-950">
                            Phân Hệ Tái Đánh Giá Độc Lập
                        </h3>
                        <p className="text-xs text-amber-900/80 mt-0.5">
                            Leanline DC và Molded đã được chia thành 3 công đoạn riêng biệt: <strong>Cutting Pairs</strong>, <strong>Logo Printing</strong>, và <strong>Packing</strong>. Mỗi bảng chấm chỉ hiển thị đúng các tiêu chí của section đó.
                        </p>
                    </div>
                </div>
                <div className="text-xs text-slate-500 font-medium shrink-0 flex items-center gap-2">
                    <span>Hôm nay: <strong className="text-slate-800">{todayStr}</strong></span>
                </div>
            </div>

            {/* 10 Sections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {MQAA_RE_AUDIT_SECTIONS.map((sec, idx) => {
                    const criteriaList = MQAA_RE_AUDIT_CRITERIA[sec.id]?.items || [];
                    const itemCount = criteriaList.length;
                    const log = todayLogs[sec.id];
                    const isEvaluated = Boolean(log);
                    const perf = log ? Number(log.overall_performance) : null;
                    const isPassed = perf !== null && perf >= targetScore;

                    // Tag specific sections that were split
                    const isSplit = ["Cutting Pairs", "Logo Printing", "Packing"].includes(sec.id);

                    return (
                        <div
                            key={sec.id}
                            className={`bg-white rounded-3xl p-6 border transition-all duration-300 hover:shadow-xl relative flex flex-col justify-between group ${
                                isEvaluated
                                    ? isPassed
                                        ? "border-emerald-300 shadow-emerald-50/50"
                                        : "border-rose-300 shadow-rose-50/50"
                                    : "border-slate-200/80 shadow-sm hover:border-amber-400"
                            }`}
                        >
                            {/* Card Header */}
                            <div>
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 text-xs font-black flex items-center justify-center border border-slate-200">
                                            {idx + 1}
                                        </span>
                                        {isSplit && (
                                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                                                Tách riêng
                                            </span>
                                        )}
                                    </div>
                                    {isEvaluated ? (
                                        <span
                                            className={`text-xs font-black px-2.5 py-1 rounded-full border ${
                                                isPassed
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                            }`}
                                        >
                                            {perf}% • {isPassed ? "Đạt" : "Cần cải thiện"}
                                        </span>
                                    ) : (
                                        <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                                            Chưa chấm hôm nay
                                        </span>
                                    )}
                                </div>

                                <h2 className="text-lg font-black text-slate-800 group-hover:text-amber-600 transition">
                                    {sec.id}
                                </h2>
                                <p className="text-xs font-bold text-slate-400 mt-0.5 line-clamp-1">
                                    {sec.vnName}
                                </p>

                                <div className="mt-4 flex items-center gap-3 text-xs text-slate-500 font-bold">
                                    <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        {itemCount} hạng mục kiểm tra
                                    </span>
                                </div>
                            </div>

                            {/* Card Action Button */}
                            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                                <button
                                    onClick={() => navigate(`/mqaa-patrol/re-audit/entry/${encodeURIComponent(sec.id)}${log ? `/${log.id}` : ""}`)}
                                    className={`w-full py-2.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-95 ${
                                        isEvaluated
                                            ? "bg-slate-800 hover:bg-slate-900 text-white"
                                            : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200"
                                    }`}
                                >
                                    <span>{isEvaluated ? "Xem / Chấm lại" : "Bắt đầu chấm điểm"}</span>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

