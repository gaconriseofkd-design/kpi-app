import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { MQAA_RE_AUDIT_SECTIONS, MQAA_RE_AUDIT_CRITERIA } from "../data/mqaaReAuditCriteria";
import { exportReAuditExcel } from "../utils/mqaaReAuditExcelExport";

const DEFAULT_AUDITOR_NAME = "Ngô Thị Bích Ngọc";
const AUDITOR_STORAGE_KEY = "mqaa_reassessment_auditor_name";

// Helper to get ISO week number
function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    return { year: date.getUTCFullYear(), week: weekNo };
}

// Suggest rating based on compliance ratio
function suggestRating(ratio) {
    if (ratio === null || ratio === undefined || isNaN(ratio)) return "Acceptable";
    if (ratio >= 1.0) return "Excellent";
    if (ratio >= 0.8) return "Acceptable";
    return "NI";
}

export default function MQAAReAuditDashboard() {
    const navigate = useNavigate();

    // Auditor Name
    const [auditorName, setAuditorName] = useState(() => {
        return localStorage.getItem(AUDITOR_STORAGE_KEY) || DEFAULT_AUDITOR_NAME;
    });

    // Dates available in DB
    const [availableDates, setAvailableDates] = useState([]);
    const [selectedPresentDates, setSelectedPresentDates] = useState([]);
    const [autoPreviousDates, setAutoPreviousDates] = useState([]);

    // Raw logs
    const [allLogs, setAllLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    // Rating overrides in UI (dropdowns)
    const [customPrevRatings, setCustomPrevRatings] = useState({});
    const [customPresRatings, setCustomPresRatings] = useState({});

    // Week labels
    const [prevWeekLabel, setPrevWeekLabel] = useState("Phase#2: Week 8");
    const [presWeekLabel, setPresWeekLabel] = useState("Phase#2: Week 9");

    useEffect(() => {
        loadReAuditLogs();
    }, []);

    const loadReAuditLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("mqaa_patrol_logs")
                .select("*")
                .eq("auditor_id", "RE_AUDIT")
                .order("date", { ascending: false });

            if (error) throw error;

            if (data && data.length > 0) {
                setAllLogs(data);
                const distinctDates = [...new Set(data.map((d) => d.date))].sort().reverse();
                setAvailableDates(distinctDates);

                // Default: Pick the latest date's week as current week
                if (distinctDates.length > 0) {
                    const latestDate = distinctDates[0];
                    const latestDateObj = new Date(latestDate);
                    const { year, week } = getWeekNumber(latestDateObj);

                    const presDates = distinctDates.filter((d) => {
                        const w = getWeekNumber(new Date(d));
                        return w.year === year && w.week === week;
                    });
                    setSelectedPresentDates(presDates);
                }
            } else {
                setAllLogs([]);
                setAvailableDates([]);
                // Fallback to today
                const today = new Date().toISOString().split("T")[0];
                setSelectedPresentDates([today]);
            }
        } catch (err) {
            console.error("Error loading re-audit logs:", err);
        } finally {
            setLoading(false);
        }
    };

    // Auto-detect previous week with data whenever selectedPresentDates changes
    useEffect(() => {
        if (selectedPresentDates.length === 0 || allLogs.length === 0) {
            setAutoPreviousDates([]);
            return;
        }

        const sortedPres = [...selectedPresentDates].sort();
        const earliestPresDate = sortedPres[0];

        // Find all logs with dates strictly before earliestPresDate
        const olderLogs = allLogs.filter((l) => l.date < earliestPresDate);
        if (olderLogs.length === 0) {
            setAutoPreviousDates([]);
            return;
        }

        // Get the latest date among older logs
        const prevLatestDate = olderLogs[0].date;
        const prevLatestObj = new Date(prevLatestDate);
        const { year: prevYear, week: prevWeek } = getWeekNumber(prevLatestObj);

        // Group all dates in that previous week
        const distinctPrevDates = [
            ...new Set(
                olderLogs
                    .filter((l) => {
                        const w = getWeekNumber(new Date(l.date));
                        return w.year === prevYear && w.week === prevWeek;
                    })
                    .map((l) => l.date)
            ),
        ].sort();

        setAutoPreviousDates(distinctPrevDates);

        // Update suggested week labels
        const presWeekInfo = getWeekNumber(new Date(earliestPresDate));
        setPresWeekLabel(`Phase#2: Week ${presWeekInfo.week}`);
        setPrevWeekLabel(`Phase#2: Week ${prevWeek}`);
    }, [selectedPresentDates, allLogs]);

    // Handle toggling present date checkbox
    const handleToggleDate = (d) => {
        setSelectedPresentDates((prev) => {
            if (prev.includes(d)) {
                return prev.filter((x) => x !== d);
            } else {
                return [...prev, d].sort();
            }
        });
    };

    // Aggregate summary for a set of dates
    const calculateWeekSummary = (dates) => {
        if (!dates || dates.length === 0) return { bySection: {}, overall: 0, count: 0 };

        const matchedLogs = allLogs.filter((l) => dates.includes(l.date));
        const bySection = {};

        MQAA_RE_AUDIT_SECTIONS.forEach((sec) => {
            const secLogs = matchedLogs.filter((l) => l.section === sec.id);
            if (secLogs.length > 0) {
                // Sum actual and max across matching logs
                let totalActual = 0;
                let totalMax = 0;
                secLogs.forEach((l) => {
                    totalActual += Number(l.total_level) || 0;
                    totalMax += Number(l.total_score) || 0;
                });
                const ratio = totalMax > 0 ? totalActual / totalMax : 0;
                bySection[sec.id] = {
                    ratio: ratio,
                    percent: Math.round(ratio * 100),
                    totalActual,
                    totalMax,
                    logs: secLogs,
                };
            }
        });

        // Overall average
        const ratios = Object.values(bySection).map((v) => v.ratio);
        const overall = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;

        return {
            bySection,
            overall,
            overallPercent: Math.round(overall * 100),
            count: ratios.length,
        };
    };

    // Calculate present & previous summaries
    const presentSummary = useMemo(() => calculateWeekSummary(selectedPresentDates), [selectedPresentDates, allLogs]);
    const previousSummary = useMemo(() => calculateWeekSummary(autoPreviousDates), [autoPreviousDates, allLogs]);

    // Comparison Table Rows
    const summaryRows = useMemo(() => {
        return MQAA_RE_AUDIT_SECTIONS.map((sec) => {
            const prev = previousSummary.bySection[sec.id];
            const pres = presentSummary.bySection[sec.id];

            const prevRatio = prev ? prev.ratio : null;
            const presRatio = pres ? pres.ratio : null;

            // Trend
            let trend = "Sustain";
            if (prevRatio !== null && presRatio !== null) {
                const diff = presRatio - prevRatio;
                if (diff > 0.005) trend = "Better";
                else if (diff < -0.005) trend = "Worse";
                else trend = "Sustain";
            }

            // Ratings (custom or auto-suggested)
            const prevRating = customPrevRatings[sec.id] || suggestRating(prevRatio);
            const presRating = customPresRatings[sec.id] || suggestRating(presRatio);

            return {
                section: sec,
                prevRatio,
                prevPercent: prev ? prev.percent : null,
                prevRating,
                presRatio,
                presPercent: pres ? pres.percent : null,
                presRating,
                trend,
            };
        });
    }, [previousSummary, presentSummary, customPrevRatings, customPresRatings]);

    // Overall summary calculation
    const overallComparison = useMemo(() => {
        const prevOverall = previousSummary.count > 0 ? previousSummary.overall : null;
        const presOverall = presentSummary.count > 0 ? presentSummary.overall : null;

        let trend = "Sustain";
        if (prevOverall !== null && presOverall !== null) {
            const diff = presOverall - prevOverall;
            if (diff > 0.005) trend = "Better";
            else if (diff < -0.005) trend = "Worse";
            else trend = "Sustain";
        }

        const prevRating = customPrevRatings["OVERALL"] || suggestRating(prevOverall);
        const presRating = customPresRatings["OVERALL"] || suggestRating(presOverall);

        return {
            prevPercent: prevOverall !== null ? Math.round(prevOverall * 100) : null,
            presPercent: presOverall !== null ? Math.round(presOverall * 100) : null,
            prevRating,
            presRating,
            trend,
        };
    }, [previousSummary, presentSummary, customPrevRatings, customPresRatings]);

    // Handle Rating dropdown change
    const handleRatingChange = (secId, type, val) => {
        if (type === "prev") {
            setCustomPrevRatings((prev) => ({ ...prev, [secId]: val }));
        } else {
            setCustomPresRatings((prev) => ({ ...prev, [secId]: val }));
        }
    };

    // Export Excel Handler
    const handleExportExcel = async () => {
        setExporting(true);
        try {
            // Gather section items from present logs
            const evaluationDataBySection = {};
            const presentLogs = allLogs.filter((l) => selectedPresentDates.includes(l.date));

            MQAA_RE_AUDIT_SECTIONS.forEach((sec) => {
                const logsForSec = presentLogs.filter((l) => l.section === sec.id);
                if (logsForSec.length > 0) {
                    // Use latest log or merge
                    const latest = logsForSec[0];
                    evaluationDataBySection[sec.id] = Array.isArray(latest.evaluation_data)
                        ? latest.evaluation_data
                        : [];
                }
            });

            // Map summaries
            const prevMap = {};
            const presMap = {};
            const prevRatMap = {};
            const presRatMap = {};
            const trendMap = {};

            summaryRows.forEach((r) => {
                if (r.prevRatio !== null) prevMap[r.section.id] = r.prevRatio;
                if (r.presRatio !== null) presMap[r.section.id] = r.presRatio;
                prevRatMap[r.section.id] = r.prevRating;
                presRatMap[r.section.id] = r.presRating;
                trendMap[r.section.id] = r.trend;
            });

            prevRatMap["OVERALL"] = overallComparison.prevRating;
            presRatMap["OVERALL"] = overallComparison.presRating;
            trendMap["OVERALL"] = overallComparison.trend;

            const dateStr = selectedPresentDates.sort().join(", ");
            const prevDateStr = autoPreviousDates.sort().join(", ");

            await exportReAuditExcel({
                auditorName: auditorName || DEFAULT_AUDITOR_NAME,
                auditDate: dateStr,
                prevWeekLabel: prevWeekLabel,
                prevPostDate: prevDateStr,
                presWeekLabel: presWeekLabel,
                presPostDate: dateStr,
                previousSummary: prevMap,
                presentSummary: presMap,
                previousRatings: prevRatMap,
                presentRatings: presRatMap,
                trends: trendMap,
                evaluationDataBySection,
            });
        } catch (err) {
            console.error("Export error:", err);
            alert("Lỗi khi xuất file Excel: " + err.message);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate("/mqaa-patrol/re-audit")}
                        className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 hover:bg-slate-50 transition"
                        title="Về danh sách Tái đánh giá"
                    >
                        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl md:text-3xl font-black text-amber-950 tracking-tight">
                                MQAA TÁI ĐÁNH GIÁ - DASHBOARD
                            </h1>
                            <span className="bg-amber-100 text-amber-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-amber-300">
                                QA.F-11 P-05
                            </span>
                        </div>
                        <p className="text-slate-400 text-xs md:text-sm font-bold uppercase tracking-widest mt-0.5">
                            So sánh Tuần hiện tại vs Tuần kế trước • Tự động xếp loại Trend
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportExcel}
                        disabled={exporting}
                        className={`px-5 py-2.5 rounded-xl font-black text-xs md:text-sm text-white shadow-md active:scale-95 transition flex items-center gap-2 ${
                            exporting
                                ? "bg-slate-400 cursor-not-allowed"
                                : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                        }`}
                        title="Tải về form kết quả tổng hợp đúng chuẩn MQAA TÁI ĐÁNH GIÁ.xlsx"
                    >
                        {exporting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Đang tạo Excel...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>Xuất Excel Chuẩn Mẫu</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Date Selection Box */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Select Current Week Dates */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 rounded-lg bg-amber-500 text-white font-black text-xs flex items-center justify-center">
                                1
                            </span>
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                Chọn các ngày của Tuần Hiện Tại (Present Week)
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                            Tick chọn các ngày bạn muốn tổng hợp điểm tuần này. Hệ thống sẽ tự động tìm tuần có data trước đó để so sánh:
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                            {availableDates.length > 0 ? (
                                availableDates.map((d) => {
                                    const isSelected = selectedPresentDates.includes(d);
                                    return (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => handleToggleDate(d)}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black border transition active:scale-95 ${
                                                isSelected
                                                    ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                            }`}
                                        >
                                            {isSelected ? "✓ " : ""}{d}
                                        </button>
                                    );
                                })
                            ) : (
                                <span className="text-xs text-slate-400 italic">
                                    Chưa có dữ liệu đánh giá nào trong hệ thống.
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Right: Auto Detected Previous Week Info */}
                    <div className="lg:border-l lg:border-slate-100 lg:pl-6 shrink-0">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                                2
                            </span>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                Tuần kế trước tự động so sánh
                            </h3>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs">
                            <div className="font-bold text-slate-600 flex items-center gap-2">
                                <span>Tuần trước:</span>
                                <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                    {autoPreviousDates.length > 0 ? autoPreviousDates.join(", ") : "Không có data trước"}
                                </span>
                            </div>
                            <div className="mt-1 text-[11px] text-slate-400">
                                {autoPreviousDates.length > 0
                                    ? `Tìm thấy ${autoPreviousDates.length} ngày chấm ở tuần kế trước.`
                                    : "Hệ thống sẽ lấy điểm hiện tại làm mốc ban đầu."}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* AUDIT SUMMARY Main Table (Matching User's Template Image) */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden mb-8">
                {/* Table Header Header Title */}
                <div className="p-4 md:p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-base">
                            📊
                        </span>
                        <div>
                            <h2 className="text-base md:text-lg font-black tracking-wide">
                                BẢNG TỔNG HỢP SO SÁNH (AUDIT SUMMARY)
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Tự động so sánh tỷ lệ tuân thủ giữa 2 tuần • Tự điền Trend Better / Sustain / Worse
                            </p>
                        </div>
                    </div>

                    <div className="text-xs text-slate-300 font-bold bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                        Auditor: <strong className="text-amber-400">{auditorName}</strong>
                    </div>
                </div>

                {/* Table Layout */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs md:text-sm">
                        <thead>
                            <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-black">
                                <th rowSpan={2} className="p-3.5 border-r border-slate-200 w-1/3">
                                    Process / Area
                                </th>
                                <th colSpan={2} className="p-2.5 text-center border-r border-slate-200 bg-indigo-50/70 text-indigo-950">
                                    <div className="text-xs font-black">{prevWeekLabel}</div>
                                    <div className="text-[11px] font-normal text-indigo-600">
                                        Post Date: {autoPreviousDates.join(", ") || "N/A"}
                                    </div>
                                </th>
                                <th colSpan={2} className="p-2.5 text-center border-r border-slate-200 bg-amber-50/70 text-amber-950">
                                    <div className="text-xs font-black">{presWeekLabel}</div>
                                    <div className="text-[11px] font-normal text-amber-700">
                                        Post Date: {selectedPresentDates.join(", ") || "N/A"}
                                    </div>
                                </th>
                                <th rowSpan={2} className="p-3.5 text-center border-r border-slate-200 w-24">
                                    Trend
                                </th>
                                <th rowSpan={2} className="p-3.5 text-slate-500 text-xs hidden lg:table-cell">
                                    Hướng Dẫn Xếp Loại / Rating Guidelines
                                </th>
                            </tr>
                            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs font-bold">
                                <th className="p-2 text-center border-r border-slate-200 w-24">Previous %</th>
                                <th className="p-2 text-center border-r border-slate-200 w-32">Previous Rating</th>
                                <th className="p-2 text-center border-r border-slate-200 w-24">Present %</th>
                                <th className="p-2 text-center border-r border-slate-200 w-32">Present Rating</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {summaryRows.map((r, idx) => {
                                // Trend style
                                let trendBadge = "bg-slate-100 text-slate-600";
                                if (r.trend === "Better") trendBadge = "bg-emerald-500 text-white font-black shadow-sm";
                                else if (r.trend === "Sustain") trendBadge = "bg-sky-600 text-white font-black shadow-sm";
                                else if (r.trend === "Worse") trendBadge = "bg-rose-500 text-white font-black shadow-sm";

                                return (
                                    <tr key={r.section.id} className="hover:bg-slate-50/80 transition">
                                        {/* Process name */}
                                        <td className="p-3 border-r border-slate-100 font-bold text-slate-800">
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400 text-xs font-mono">{idx + 1}.-/</span>
                                                <span>{r.section.id}</span>
                                            </div>
                                        </td>

                                        {/* Previous % */}
                                        <td className="p-2 text-center border-r border-slate-100 font-black text-slate-700 bg-slate-50/40">
                                            {r.prevPercent !== null ? (
                                                <span className={`px-2 py-0.5 rounded ${r.prevPercent >= 80 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                                    {r.prevPercent}%
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 font-normal">--</span>
                                            )}
                                        </td>

                                        {/* Previous Rating Dropdown */}
                                        <td className="p-2 text-center border-r border-slate-100 bg-slate-50/40">
                                            <select
                                                value={r.prevRating}
                                                onChange={(e) => handleRatingChange(r.section.id, "prev", e.target.value)}
                                                className={`px-2 py-1 text-xs font-black rounded-lg border focus:outline-none ${
                                                    r.prevRating === "Excellent"
                                                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                                        : r.prevRating === "NI"
                                                        ? "text-amber-800 bg-amber-100 border-amber-300"
                                                        : "text-slate-700 bg-white border-slate-200"
                                                }`}
                                            >
                                                <option value="Excellent">Excellent</option>
                                                <option value="Acceptable">Acceptable</option>
                                                <option value="NI">NI</option>
                                            </select>
                                        </td>

                                        {/* Present % */}
                                        <td className="p-2 text-center border-r border-slate-100 font-black text-slate-800 bg-amber-50/20">
                                            {r.presPercent !== null ? (
                                                <span className={`px-2 py-0.5 rounded ${r.presPercent >= 80 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                                    {r.presPercent}%
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 font-normal">--</span>
                                            )}
                                        </td>

                                        {/* Present Rating Dropdown */}
                                        <td className="p-2 text-center border-r border-slate-100 bg-amber-50/20">
                                            <select
                                                value={r.presRating}
                                                onChange={(e) => handleRatingChange(r.section.id, "pres", e.target.value)}
                                                className={`px-2 py-1 text-xs font-black rounded-lg border focus:outline-none ${
                                                    r.presRating === "Excellent"
                                                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                                        : r.presRating === "NI"
                                                        ? "text-amber-800 bg-amber-100 border-amber-300"
                                                        : "text-slate-700 bg-white border-slate-200"
                                                }`}
                                            >
                                                <option value="Excellent">Excellent</option>
                                                <option value="Acceptable">Acceptable</option>
                                                <option value="NI">NI</option>
                                            </select>
                                        </td>

                                        {/* Trend Badge */}
                                        <td className="p-2 text-center border-r border-slate-100">
                                            <span className={`inline-block px-3 py-1 rounded-full text-xs ${trendBadge}`}>
                                                {r.trend}
                                            </span>
                                        </td>

                                        {/* Guide Column */}
                                        {idx === 0 && (
                                            <td rowSpan={10} className="p-4 text-xs text-slate-600 align-top bg-slate-50/50 hidden lg:table-cell leading-relaxed border-l border-slate-200">
                                                <div className="font-black text-slate-800 mb-1">
                                                    Rating of Compliance (%):
                                                </div>
                                                <div className="space-y-2 text-[11px]">
                                                    <div>
                                                        <strong className="text-indigo-900">Phase#1: First 4 Weeks:</strong>
                                                        <br />a.-/ Acceptable ≥ 70% | b.-/ NI &lt; 70%
                                                    </div>
                                                    <div>
                                                        <strong className="text-indigo-900">Phase#2: Week#5 ~ #10:</strong>
                                                        <br />a.-/ Acceptable ≥ 80% | b.-/ NI &lt; 80%
                                                    </div>
                                                    <div>
                                                        <strong className="text-indigo-900">Phase#3: Week#11 Onward:</strong>
                                                        <br />a.-/ Acceptable ≥ 90% | b.-/ NI &lt; 90%
                                                    </div>
                                                    <div className="pt-2 border-t border-slate-200 font-black text-emerald-700">
                                                        * Overall Compliance: 100% → Rating: Excellent
                                                    </div>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}

                            {/* Overall Row */}
                            <tr className="bg-amber-100/70 text-slate-900 font-black border-t-2 border-slate-300">
                                <td className="p-3.5 border-r border-slate-200 uppercase tracking-wider">
                                    OVERALL COMPLIANCE (%)
                                </td>
                                <td className="p-2 text-center border-r border-slate-200 text-base text-indigo-950">
                                    {overallComparison.prevPercent !== null ? `${overallComparison.prevPercent}%` : "--"}
                                </td>
                                <td className="p-2 text-center border-r border-slate-200">
                                    <select
                                        value={overallComparison.prevRating}
                                        onChange={(e) => handleRatingChange("OVERALL", "prev", e.target.value)}
                                        className="px-2 py-1 text-xs font-black rounded-lg border border-slate-300 bg-white"
                                    >
                                        <option value="Excellent">Excellent</option>
                                        <option value="Acceptable">Acceptable</option>
                                        <option value="NI">NI</option>
                                    </select>
                                </td>
                                <td className="p-2 text-center border-r border-slate-200 text-base text-amber-950">
                                    {overallComparison.presPercent !== null ? `${overallComparison.presPercent}%` : "--"}
                                </td>
                                <td className="p-2 text-center border-r border-slate-200">
                                    <select
                                        value={overallComparison.presRating}
                                        onChange={(e) => handleRatingChange("OVERALL", "pres", e.target.value)}
                                        className="px-2 py-1 text-xs font-black rounded-lg border border-slate-300 bg-white"
                                    >
                                        <option value="Excellent">Excellent</option>
                                        <option value="Acceptable">Acceptable</option>
                                        <option value="NI">NI</option>
                                    </select>
                                </td>
                                <td className="p-2 text-center border-r border-slate-200">
                                    <span
                                        className={`inline-block px-3 py-1 rounded-full text-xs ${
                                            overallComparison.trend === "Better"
                                                ? "bg-emerald-600 text-white font-black"
                                                : overallComparison.trend === "Sustain"
                                                ? "bg-sky-600 text-white font-black"
                                                : "bg-rose-600 text-white font-black"
                                        }`}
                                    >
                                        {overallComparison.trend}
                                    </span>
                                </td>
                                <td className="hidden lg:table-cell bg-amber-50/50"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

