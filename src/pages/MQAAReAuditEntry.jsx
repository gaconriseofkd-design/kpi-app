import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { MQAA_RE_AUDIT_SECTIONS, MQAA_RE_AUDIT_CRITERIA } from "../data/mqaaReAuditCriteria";
import { usePatrolTarget, usePatrolScoreSettings, DEFAULT_NORMAL_SCORES, DEFAULT_CRITICAL_SCORES } from "../utils/mqaaSettings";

const DEFAULT_AUDITOR_NAME = "Ngô Thị Bích Ngọc";
const AUDITOR_STORAGE_KEY = "mqaa_reassessment_auditor_name";

export default function MQAAReAuditEntry() {
    const { section: rawSection, id } = useParams();
    const navigate = useNavigate();
    const section = decodeURIComponent(rawSection || "");

    const { targetScore } = usePatrolTarget();
    const { normalScores, criticalScores } = usePatrolScoreSettings();

    // Section Meta & Header config from criteria
    const sectionConfig = useMemo(() => {
        return MQAA_RE_AUDIT_CRITERIA[section] || { header: { title: section }, items: [] };
    }, [section]);

    // Header State
    const [headerData, setHeaderData] = useState(() => ({
        auditorId: "RE_AUDIT",
        auditor: localStorage.getItem(AUDITOR_STORAGE_KEY) || DEFAULT_AUDITOR_NAME,
        date: new Date().toISOString().split("T")[0],
    }));

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "card" : "table"));
    const [previewImage, setPreviewImage] = useState(null);

    useEffect(() => {
        loadData();
    }, [section, id]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch dynamic criteria from Supabase for this Re-Audit section
            const dbSectionId = `RE_AUDIT__${section}`;
            const { data: dbCriteria, error: critErr } = await supabase
                .from("mqaa_patrol_criteria")
                .select("*")
                .eq("section_id", dbSectionId)
                .order("sort_order", { ascending: true });

            let baseItems = [];
            if (dbCriteria && dbCriteria.length > 0) {
                // Map static excelRow lookup if available
                const staticMap = {};
                (sectionConfig.items || []).forEach((it) => {
                    const clean = String(it.no || "").replace(/\*/g, "").trim();
                    if (clean) staticMap[clean] = it.excelRow;
                });

                baseItems = dbCriteria.map((c, idx) => {
                    const isCrit = Boolean(c.is_header || (c.no && c.no.startsWith("*")));
                    const isNA = c.max_score <= 0;
                    const cleanNo = String(c.no || "").replace(/\*/g, "").trim();
                    const excelRow = staticMap[cleanNo] || (sectionConfig.meta?.start_row ? sectionConfig.meta.start_row + idx : undefined);

                    return {
                        excelRow: excelRow,
                        no: c.no,
                        titleVn: c.label,
                        titleEn: c.sub_label || "",
                        maxScore: isNA ? "N/A" : c.max_score,
                        isCritical: isCrit,
                    };
                });
            } else {
                baseItems = sectionConfig.items || [];
            }

            let initialRows = baseItems.map((item, idx) => ({
                index: idx + 1,
                excelRow: item.excelRow,
                no: item.no,
                titleVn: item.titleVn,
                titleEn: item.titleEn,
                maxScore: item.maxScore,
                isCritical: Boolean(item.isCritical),
                auditScore: item.maxScore === "N/A" ? "N/A" : "",
                notes: "",
                images: [], // { file, url }
            }));

            // Edit Mode: Fetch existing record by id
            if (id) {
                const { data: record, error } = await supabase
                    .from("mqaa_patrol_logs")
                    .select("*")
                    .eq("id", id)
                    .single();

                if (!error && record) {
                    setHeaderData({
                        auditorId: "RE_AUDIT",
                        auditor: record.auditor_name || DEFAULT_AUDITOR_NAME,
                        date: record.date || new Date().toISOString().split("T")[0],
                    });

                    const savedData = Array.isArray(record.evaluation_data) ? record.evaluation_data : [];
                    const savedByNo = {};
                    savedData.forEach((si) => {
                        const cleanNo = String(si.no || "").replace(/\*/g, "").trim();
                        if (cleanNo) savedByNo[cleanNo] = si;
                        if (si.excelRow) savedByNo[si.excelRow] = si;
                    });

                    initialRows = initialRows.map((r) => {
                        const cleanNo = String(r.no || "").replace(/\*/g, "").trim();
                        const found = savedByNo[cleanNo] || savedByNo[r.excelRow];
                        if (found) {
                            const rawUrls = Array.isArray(found.image_urls)
                                ? found.image_urls
                                : Array.isArray(found.imageUrls)
                                ? found.imageUrls
                                : found.image_url
                                ? [found.image_url]
                                : [];
                            return {
                                ...r,
                                auditScore: found.auditScore !== undefined ? found.auditScore : (found.score !== undefined ? found.score : r.auditScore),
                                notes: found.notes || found.problemDescription || found.problem_description || "",
                                images: rawUrls.map((u) => ({ file: null, url: u })),
                            };
                        }
                        return r;
                    });
                }
            } else {
                // Check if already submitted today
                const { data: existingToday } = await supabase
                    .from("mqaa_patrol_logs")
                    .select("id")
                    .eq("auditor_id", "RE_AUDIT")
                    .eq("section", section)
                    .eq("date", headerData.date)
                    .limit(1);

                if (existingToday && existingToday.length > 0) {
                    navigate(`/mqaa-patrol/re-audit/entry/${encodeURIComponent(section)}/${existingToday[0].id}`, { replace: true });
                    return;
                }
            }

            setRows(initialRows);
        } catch (err) {
            console.error("Error loading criteria/data:", err);
        } finally {
            setLoading(false);
        }
    };

    // Score calculations
    const totals = useMemo(() => {
        let totalMaxScore = 0;
        let totalAuditScore = 0;
        let totalEvaluatedItems = 0;
        let scoredItemsCount = 0;

        rows.forEach((r) => {
            if (r.maxScore === "N/A") return;
            const maxVal = Number(r.maxScore) || 4;
            totalMaxScore += maxVal;
            totalEvaluatedItems++;

            if (r.auditScore !== "" && r.auditScore !== "N/A" && r.auditScore !== undefined) {
                totalAuditScore += Number(r.auditScore);
                scoredItemsCount++;
            }
        });

        const performance = totalMaxScore > 0 ? ((totalAuditScore / totalMaxScore) * 100).toFixed(0) : 0;
        const isComplete = totalEvaluatedItems > 0 && scoredItemsCount >= totalEvaluatedItems;

        return {
            totalMaxScore,
            totalAuditScore,
            performance,
            isComplete,
            totalEvaluatedItems,
            scoredItemsCount,
        };
    }, [rows]);

    const isPerformancePass = Number(totals.performance) >= Number(targetScore);

    // Audit Score Change
    const handleAuditScoreChange = (index, value) => {
        setRows((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], auditScore: value };
            return next;
        });
    };

    // Notes / Problem Description Change
    const handleNotesChange = (index, value) => {
        setRows((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], notes: value };
            return next;
        });
    };

    // Compress image
    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => {
                        if (!blob) return reject(new Error("Canvas toBlob failed"));
                        const compressedFile = new File([blob], file.name, { type: "image/jpeg" });
                        resolve(compressedFile);
                    },
                    "image/jpeg",
                    0.75
                );
            };
            img.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    };

    // Handle Image uploads
    const handleImageChange = (index, e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setRows((prev) => {
            const next = [...prev];
            const current = next[index].images || [];
            if (current.length + files.length > 5) {
                alert("Mỗi tiêu chí tối đa được thêm 5 hình ảnh!");
                return prev;
            }
            const newlyAdded = files.map((file) => ({
                file,
                url: URL.createObjectURL(file),
            }));
            next[index] = {
                ...next[index],
                images: [...current, ...newlyAdded],
            };
            return next;
        });
    };

    const handleRemoveImage = (rowIndex, imgIdx) => {
        setRows((prev) => {
            const next = [...prev];
            const imgs = [...next[rowIndex].images];
            imgs.splice(imgIdx, 1);
            next[rowIndex] = { ...next[rowIndex], images: imgs };
            return next;
        });
    };

    // Quick score actions
    const handleQuickScoreAll = (scoreVal) => {
        const newRows = rows.map((r) => {
            if (r.maxScore === "N/A") return r;
            let target;
            if (scoreVal === "max") {
                const isCrit = Boolean(r.isCritical);
                const scoreList = isCrit ? criticalScores : normalScores;
                target = scoreList && scoreList.length > 0 ? Math.max(...scoreList) : (Number(r.maxScore) || 4);
            } else {
                target = scoreVal;
            }
            return {
                ...r,
                auditScore: target,
            };
        });
        setRows(newRows);
    };

    // Save
    const handleSave = async () => {
        if (!totals.isComplete) {
            const confirmSave = confirm(
                `Bạn chưa chấm hết tất cả các mục (${totals.scoredItemsCount}/${totals.totalEvaluatedItems}). Bạn có chắc chắn muốn lưu phiếu này không?`
            );
            if (!confirmSave) return;
        }

        setSaving(true);
        try {
            const finalAuditor = headerData.auditor.trim() || DEFAULT_AUDITOR_NAME;
            localStorage.setItem(AUDITOR_STORAGE_KEY, finalAuditor);

            // Upload images into separate folder `mqaa_reassessment/...`
            const processedRows = [];
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const finalUrls = [];

                if (row.images && row.images.length > 0) {
                    for (let j = 0; j < row.images.length; j++) {
                        const imgObj = row.images[j];
                        if (imgObj.file) {
                            const compressed = await compressImage(imgObj.file);
                            const cleanSec = section.replace(/[^a-zA-Z0-9]/g, "_");
                            const fileName = `mqaa_reassessment/${Date.now()}_${i}_${j}_${cleanSec}.jpg`;

                            const { error: upErr } = await supabase.storage
                                .from("mqaa-images")
                                .upload(fileName, compressed);

                            if (upErr) {
                                console.warn("Upload image warning:", upErr.message);
                            } else {
                                const { data: pubData } = supabase.storage
                                    .from("mqaa-images")
                                    .getPublicUrl(fileName);
                                if (pubData?.publicUrl) finalUrls.push(pubData.publicUrl);
                            }
                        } else if (imgObj.url) {
                            finalUrls.push(imgObj.url);
                        }
                    }
                }

                processedRows.push({
                    excelRow: row.excelRow,
                    no: row.no,
                    titleVn: row.titleVn,
                    titleEn: row.titleEn,
                    maxScore: row.maxScore,
                    isCritical: row.isCritical,
                    auditScore: row.auditScore,
                    score: row.auditScore,
                    notes: row.notes,
                    problemDescription: row.notes,
                    image_urls: finalUrls,
                    imageUrls: finalUrls,
                    image_url: finalUrls[0] || "",
                });
            }

            const payload = {
                section: section,
                auditor_id: "RE_AUDIT",
                auditor_name: finalAuditor,
                date: headerData.date,
                total_score: totals.totalMaxScore,
                total_level: totals.totalAuditScore,
                overall_performance: totals.performance,
                evaluation_data: processedRows,
            };

            if (id) {
                payload.id = id;
            }

            const { error: saveError } = await supabase
                .from("mqaa_patrol_logs")
                .upsert([payload]);

            if (saveError) throw saveError;

            alert("✓ Đã lưu phiếu Tái đánh giá thành công!");
            navigate("/mqaa-patrol/re-audit");
        } catch (err) {
            console.error("Save error:", err);
            alert("Lỗi khi lưu phiếu tái đánh giá: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-[1360px] mx-auto p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                <div className="text-slate-600 font-bold text-sm">Đang tải dữ liệu Tái đánh giá...</div>
            </div>
        );
    }

    return (
        <div className="max-w-[1360px] mx-auto p-4 md:p-6 bg-white shadow-2xl rounded-2xl my-6 border border-slate-100 font-sans">
            {/* Modal preview image */}
            {previewImage && (
                <div
                    className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={previewImage}
                            alt="Enlarged preview"
                            className="max-h-[80vh] w-auto mx-auto object-contain rounded-lg"
                        />
                        <div className="flex justify-between items-center px-4 py-2 mt-1">
                            <span className="text-xs text-slate-500 font-medium">Click ngoài để đóng</span>
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate("/mqaa-patrol/re-audit")}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-xl transition shadow-sm"
                        title="Quay lại danh sách Section Tái đánh giá"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-amber-100 text-amber-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-amber-300">
                                TÁI ĐÁNH GIÁ
                            </span>
                            <h1 className="text-xl md:text-2xl font-black text-indigo-950 uppercase tracking-tight">
                                {id ? "CHỈNH SỬA" : "PHIẾU"} ĐÁNH GIÁ - {section}
                            </h1>
                        </div>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">
                            OrthoLite Insole Quality Audit Standard Checklist • Re-assessment
                        </p>
                    </div>
                </div>

                {/* Section Selector Dropdown (10 Sections) */}
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap pl-1">Đổi Section:</span>
                    <select
                        value={section}
                        onChange={(e) => navigate(`/mqaa-patrol/re-audit/entry/${encodeURIComponent(e.target.value)}`)}
                        className="bg-white border border-slate-300 text-indigo-900 font-bold text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer shadow-sm"
                    >
                        {MQAA_RE_AUDIT_SECTIONS.map((sec) => (
                            <option key={sec.id} value={sec.id}>
                                {sec.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Section Header Objective from Excel */}
            {sectionConfig.header && (
                <div className="mb-6 bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50/50 p-4 md:p-5 rounded-2xl border border-indigo-100 shadow-sm">
                    <div className="whitespace-pre-line text-slate-800 font-bold text-sm md:text-base leading-relaxed">
                        {sectionConfig.header.title}
                    </div>
                </div>
            )}

            {/* Auditor & Inspection Metadata Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Mã số Auditor (ID):</label>
                    <input
                        type="text"
                        readOnly
                        className="p-2.5 border border-slate-200 rounded-xl bg-slate-100 font-black text-amber-800 cursor-not-allowed shadow-inner"
                        value="RE_AUDIT (Tái Đánh Giá)"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Tên người đánh giá:</label>
                    <input
                        type="text"
                        className="p-2.5 border border-slate-300 rounded-xl bg-white shadow-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        value={headerData.auditor}
                        onChange={(e) => {
                            const val = e.target.value;
                            setHeaderData({ ...headerData, auditor: val });
                            localStorage.setItem(AUDITOR_STORAGE_KEY, val);
                        }}
                        placeholder="Mặc định: Ngô Thị Bích Ngọc"
                        title="Tự động lưu vào hệ thống"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Ngày đánh giá (Date):</label>
                    <input
                        type="date"
                        className="p-2.5 border border-slate-300 rounded-xl bg-white shadow-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        value={headerData.date}
                        onChange={(e) => setHeaderData({ ...headerData, date: e.target.value })}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Section Đánh giá:</label>
                    <div className="p-2.5 border border-slate-200 rounded-xl bg-slate-200/70 font-black text-indigo-900 text-sm truncate">
                        {section}
                    </div>
                </div>

                {/* Score Summary Quick Bar */}
                <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 mt-1">
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                        <span>
                            Điểm chuẩn: <strong className="text-indigo-700 text-sm">{totals.totalMaxScore}</strong>
                        </span>
                        <span>
                            Điểm đạt: <strong className="text-emerald-700 text-sm">{totals.totalAuditScore}</strong>
                        </span>
                        <span>
                            Đã chấm: <strong className="text-slate-900">{totals.scoredItemsCount}/{totals.totalEvaluatedItems}</strong> mục
                        </span>
                        <span className="text-slate-400">
                            | Mục tiêu: <strong>≥ {targetScore}%</strong>
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500 hidden md:inline">Chấm nhanh:</span>
                        <div className="flex gap-1.5">
                            <button
                                type="button"
                                onClick={() => handleQuickScoreAll("max")}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition border border-indigo-200"
                                title="Gán tất cả mục bằng điểm tối đa"
                            >
                                Max Điểm
                            </button>
                            <button
                                type="button"
                                onClick={() => handleQuickScoreAll(0)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition border border-slate-200"
                                title="Reset tất cả điểm về 0"
                            >
                                Về 0
                            </button>
                        </div>

                        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Tuân thủ:</span>
                            <span
                                className={`text-base font-black px-3 py-1 rounded-xl shadow-sm transition-colors ${
                                    isPerformancePass
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                        : "bg-rose-100 text-rose-800 border border-rose-300"
                                }`}
                                title={isPerformancePass ? "Đạt mục tiêu" : `Chưa đạt mục tiêu (${targetScore}%)`}
                            >
                                {totals.performance}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* View Mode Toggle (Mobile Cards vs Full Table) */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setViewMode("card")}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            viewMode === "card"
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span>📱 Dạng Thẻ (Dễ chấm trên ĐT)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setViewMode("table")}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            viewMode === "table"
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18M3 6h18M3 18h18" />
                        </svg>
                        <span>📋 Dạng Bảng (Xem toàn bộ)</span>
                    </button>
                </div>

                <div className="text-[11px] font-semibold text-slate-500 pr-2">
                    {viewMode === "card"
                        ? "✨ Hiển thị trọn vẹn màn hình - Chấm điểm cuộn dọc không cần kéo ngang"
                        : "💡 Kéo thanh trượt ngang để xem các cột bảng"}
                </div>
            </div>

            {/* Content Display: Card View or Table View */}
            {viewMode === "card" ? (
                <div className="space-y-4">
                    {rows.map((row, idx) => {
                        const isNA = row.maxScore === "N/A";
                        const isCrit = Boolean(row.isCritical);
                        const scoreOptions = isCrit
                            ? (criticalScores?.length ? criticalScores : DEFAULT_CRITICAL_SCORES)
                            : (normalScores?.length ? normalScores : DEFAULT_NORMAL_SCORES);

                        return (
                            <div
                                key={idx}
                                className={`p-4 rounded-2xl border transition-all shadow-sm ${
                                    isCrit
                                        ? "bg-emerald-50/70 border-emerald-300 border-l-4 border-l-emerald-600"
                                        : "bg-white border-slate-200 hover:border-indigo-200"
                                }`}
                            >
                                {/* Header: STT & Criteria Content */}
                                <div className="flex items-start gap-2.5 mb-3">
                                    <span className="flex-shrink-0 min-w-[32px] h-7 px-2 bg-indigo-100 text-indigo-900 rounded-lg flex items-center justify-center font-black text-xs">
                                        {row.no || idx + 1}
                                    </span>
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-800 text-sm leading-snug">
                                            {row.titleVn}
                                        </div>
                                        {row.titleEn && (
                                            <div className="text-xs italic text-blue-700 font-medium mt-1 leading-relaxed">
                                                {row.titleEn}
                                            </div>
                                        )}
                                        {isCrit && (
                                            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                                Hạng mục trọng yếu
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Scoring row: Max Score & Score Buttons */}
                                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50/90 rounded-xl border border-slate-200/80 mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase">Điểm chuẩn:</span>
                                        <span className="text-sm font-black px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-lg border border-indigo-200">
                                            {isNA ? "N/A" : row.maxScore}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase">Chấm điểm:</span>
                                        {isNA ? (
                                            <span className="px-3 py-1 bg-slate-200 text-slate-500 rounded-lg text-xs font-black">
                                                N/A
                                            </span>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                {scoreOptions.map((pts) => (
                                                    <button
                                                        key={pts}
                                                        type="button"
                                                        onClick={() => handleAuditScoreChange(idx, pts)}
                                                        className={`min-w-[38px] h-9 px-2 flex items-center justify-center text-sm font-black rounded-xl border transition-all ${
                                                            row.auditScore !== "" && Number(row.auditScore) === pts
                                                                ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-105"
                                                                : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm active:scale-95"
                                                        }`}
                                                    >
                                                        {pts}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Images & Notes Section */}
                                <div className="space-y-3 pt-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {(!row.images || row.images.length < 5) && (
                                            <label className="cursor-pointer bg-white border border-slate-300 hover:border-indigo-400 px-3 py-2 rounded-xl text-xs hover:bg-indigo-50 flex items-center gap-1.5 shadow-sm font-bold text-slate-700 transition">
                                                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                <span>+ Chụp / Thêm ảnh ({row.images ? row.images.length : 0}/5)</span>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    multiple
                                                    onChange={(e) => handleImageChange(idx, e)}
                                                />
                                            </label>
                                        )}

                                        {row.images && row.images.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {row.images.map((img, imgIdx) => (
                                                    <div
                                                        key={imgIdx}
                                                        className="relative w-12 h-12 border border-slate-200 rounded-xl shadow-inner overflow-hidden group cursor-pointer"
                                                        onClick={() => setPreviewImage(img.url)}
                                                        title="Click để phóng to ảnh"
                                                    >
                                                        <img
                                                            src={img.url}
                                                            className="w-full h-full object-cover group-hover:scale-110 transition"
                                                            alt={`ref-${imgIdx}`}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemoveImage(idx, imgIdx);
                                                            }}
                                                            className="absolute top-0 right-0 bg-red-600 hover:bg-red-700 text-white w-4 h-4 flex items-center justify-center text-[11px] font-black rounded-bl shadow"
                                                            title="Xoá ảnh"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <textarea
                                            rows={2}
                                            className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none font-medium placeholder-slate-400"
                                            placeholder="Mô tả vấn đề / Ghi chú (Nếu có)..."
                                            value={row.notes}
                                            onChange={(e) => handleNotesChange(idx, e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Mobile Summary Bottom Sticky Box */}
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 mt-6 shadow-sm">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-2">
                            <span>Đã chấm:</span>
                            <span className="font-black text-indigo-950">{totals.scoredItemsCount}/{totals.totalEvaluatedItems} mục</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-2">
                            <span>Điểm đạt / Tổng điểm:</span>
                            <span className="font-black text-emerald-800">{totals.totalAuditScore} / {totals.totalMaxScore}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-amber-200/60">
                            <span className="text-xs font-black text-indigo-950 uppercase">Tuân thủ tổng thể:</span>
                            <span className={`text-xl font-black px-4 py-1 rounded-xl shadow-sm ${
                                isPerformancePass ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                            }`}>
                                {totals.performance}%
                            </span>
                        </div>
                    </div>
                </div>
            ) : (
                /* Main Evaluation Table */
                <div className="overflow-x-auto shadow-sm border border-slate-200 rounded-2xl bg-white">
                    <table className="w-full border-collapse text-left text-xs md:text-sm min-w-[900px]">
                        <thead>
                            <tr className="bg-indigo-700 text-white font-bold divide-x divide-indigo-600 select-none">
                                <th className="p-3 w-14 text-center">STT</th>
                                <th className="p-3 min-w-[340px]">
                                    Hạng mục & Nội dung đánh giá
                                    <div className="text-[11px] font-normal text-indigo-200">
                                        (Tiêu chuẩn Việt - Anh)
                                    </div>
                                </th>
                                <th className="p-3 w-24 text-center">
                                    Điểm chuẩn
                                    <div className="text-[11px] font-normal text-indigo-200">Max Score (G)</div>
                                </th>
                                <th className="p-3 w-32 text-center">
                                    Điểm đạt
                                    <div className="text-[11px] font-normal text-indigo-200">Audit Score (H)</div>
                                </th>
                                <th className="p-3 w-28 text-center">
                                    Trọng yếu
                                    <div className="text-[11px] font-normal text-indigo-200">Critical (I)</div>
                                </th>
                                <th className="p-3 w-36 text-center">
                                    Ảnh hiện trạng
                                    <div className="text-[11px] font-normal text-indigo-200">Images (J)</div>
                                </th>
                                <th className="p-3 min-w-[200px]">
                                    Ghi chú / Mô tả vấn đề
                                    <div className="text-[11px] font-normal text-indigo-200">Description (K)</div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {rows.map((row, idx) => {
                                const isNA = row.maxScore === "N/A";
                                const isCrit = Boolean(row.isCritical);
                                const scoreOptions = isCrit
                                    ? (criticalScores?.length ? criticalScores : DEFAULT_CRITICAL_SCORES)
                                    : (normalScores?.length ? normalScores : DEFAULT_NORMAL_SCORES);

                                return (
                                    <tr
                                        key={idx}
                                        className={`transition-colors divide-x divide-slate-100 ${
                                            isCrit
                                                ? "bg-emerald-50/80 hover:bg-emerald-100/70 border-l-4 border-l-emerald-500"
                                                : "hover:bg-slate-50/80"
                                        }`}
                                    >
                                        {/* STT */}
                                        <td className="p-3 text-center font-black text-slate-600 align-top">
                                            {row.no || idx + 1}
                                        </td>

                                        {/* Title & Criteria */}
                                        <td className="p-3 align-top">
                                            <div className="font-bold text-slate-800 leading-snug">
                                                {row.titleVn}
                                            </div>
                                            {row.titleEn && (
                                                <div className="text-xs italic text-blue-700 font-medium mt-1 leading-relaxed">
                                                    {row.titleEn}
                                                </div>
                                            )}
                                            {isCrit && (
                                                <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                    Hạng mục trọng yếu
                                                </span>
                                            )}
                                        </td>

                                        {/* Max Score (G) */}
                                        <td className="p-3 text-center font-bold align-top">
                                            {isNA ? (
                                                <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-200 text-slate-500 font-black text-xs">
                                                    N/A
                                                </span>
                                            ) : (
                                                <span className="inline-block px-3 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-black text-sm border border-indigo-100">
                                                    {row.maxScore}
                                                </span>
                                            )}
                                        </td>

                                        {/* Audit Score (H) */}
                                        <td className="p-3 text-center align-top">
                                            {isNA ? (
                                                <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 font-black text-xs cursor-not-allowed">
                                                    N/A
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap justify-center gap-1.5 w-full">
                                                    {scoreOptions.map((pts) => (
                                                        <button
                                                            key={pts}
                                                            type="button"
                                                            onClick={() => handleAuditScoreChange(idx, pts)}
                                                            className={`w-7 h-7 flex items-center justify-center text-xs font-black rounded border transition ${
                                                                row.auditScore !== "" && Number(row.auditScore) === pts
                                                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105"
                                                                    : "bg-white hover:bg-slate-100 text-slate-600 border-slate-300 shadow-sm"
                                                            }`}
                                                        >
                                                            {pts}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </td>

                                        {/* Critical Column (I) */}
                                        <td className="p-3 text-center align-top">
                                            {isCrit ? (
                                                <span className="inline-block px-3 py-1 bg-emerald-600 text-white font-black text-xs rounded-lg shadow-sm">
                                                    Yes
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 font-bold text-xs">—</span>
                                            )}
                                        </td>

                                        {/* Images (J) */}
                                        <td className="p-3 text-center align-top">
                                            <div className="flex flex-col items-center gap-1.5">
                                                {(!row.images || row.images.length < 5) && (
                                                    <label className="cursor-pointer bg-white border border-slate-300 hover:border-indigo-400 px-2.5 py-1.5 rounded-xl text-xs hover:bg-indigo-50 flex items-center gap-1 shadow-sm font-bold text-slate-700 transition">
                                                        <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                        <span>Ảnh ({row.images ? row.images.length : 0}/5)</span>
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept="image/*"
                                                            multiple
                                                            onChange={(e) => handleImageChange(idx, e)}
                                                        />
                                                    </label>
                                                )}

                                                {row.images && row.images.length > 0 && (
                                                    <div className="flex flex-wrap justify-center gap-1 mt-1 max-w-[140px]">
                                                        {row.images.map((img, imgIdx) => (
                                                            <div
                                                                key={imgIdx}
                                                                className="relative w-10 h-10 border border-slate-200 rounded-lg shadow-inner overflow-hidden group cursor-pointer"
                                                                onClick={() => setPreviewImage(img.url)}
                                                                title="Click để phóng to ảnh"
                                                            >
                                                                <img
                                                                    src={img.url}
                                                                    className="w-full h-full object-cover group-hover:scale-110 transition"
                                                                    alt={`ref-${imgIdx}`}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRemoveImage(idx, imgIdx);
                                                                    }}
                                                                    className="absolute top-0 right-0 bg-red-600 hover:bg-red-700 text-white w-4 h-4 flex items-center justify-center text-[11px] font-black rounded-bl shadow"
                                                                    title="Xoá ảnh"
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* Problem description (K) */}
                                        <td className="p-3 align-top">
                                            <textarea
                                                rows={2}
                                                className="w-full p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition text-xs font-medium placeholder-slate-300 resize-none bg-slate-50/50 focus:bg-white"
                                                placeholder="Mô tả vấn đề / Ghi chú (Nếu có)..."
                                                value={row.notes}
                                                onChange={(e) => handleNotesChange(idx, e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}

                            {/* Excel Row Summary Footer */}
                            <tr className="bg-yellow-100/90 font-black border-t-2 border-indigo-400 text-slate-900 divide-x divide-yellow-200 select-none">
                                <td colSpan="2" className="p-4 text-right">
                                    <div className="text-xs uppercase text-slate-600 font-extrabold">
                                        {sectionConfig.footer?.sectionName || section}
                                    </div>
                                    <div className="text-sm md:text-base font-black text-indigo-950 uppercase mt-0.5">
                                        {sectionConfig.footer?.label?.replace(/\r?\n/g, " ") || "XẾP HẠNG TUÂN THỦ TỔNG THỂ % / OVERALL COMPLIANCE RATING:"}
                                    </div>
                                </td>

                                {/* Max Score Total (G) */}
                                <td className="p-4 text-center">
                                    <div className="text-[10px] text-slate-500 uppercase">Tổng chuẩn (G)</div>
                                    <div className="text-lg font-black text-indigo-900">{totals.totalMaxScore}</div>
                                </td>

                                {/* Audit Score Total (H) */}
                                <td className="p-4 text-center">
                                    <div className="text-[10px] text-slate-500 uppercase">Tổng đạt (H)</div>
                                    <div className="text-lg font-black text-emerald-900">{totals.totalAuditScore}</div>
                                </td>

                                {/* Overall % result = (H / G) * 100% */}
                                <td colSpan="3" className="p-4 text-center bg-yellow-200/80">
                                    <div className="flex flex-col md:flex-row items-center justify-center gap-2">
                                        <span className="text-xs uppercase font-extrabold text-indigo-950">
                                            % Kết quả (Cột F = H/G):
                                        </span>
                                        <span
                                            className={`text-xl md:text-2xl font-black px-4 py-1 rounded-xl shadow-md transition-colors ${
                                                isPerformancePass
                                                    ? "bg-emerald-600 text-white"
                                                    : "bg-rose-600 text-white"
                                            }`}
                                        >
                                            {totals.performance}%
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* Bottom Actions */}
            <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                    type="button"
                    onClick={() => navigate("/mqaa-patrol/re-audit")}
                    className="w-full sm:w-auto px-8 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition shadow-sm"
                >
                    ← QUAY LẠI
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            if (confirm("Làm mới lại tất cả điểm đã nhập trên biểu mẫu này?")) {
                                const resetRows = rows.map((r) => ({
                                    ...r,
                                    auditScore: r.maxScore === "N/A" ? "N/A" : "",
                                    images: [],
                                    notes: "",
                                }));
                                setRows(resetRows);
                            }
                        }}
                        className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition text-sm"
                    >
                        LÀM MỚI
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className={`px-10 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-all shadow-xl shadow-indigo-200 transform hover:scale-[1.02] active:scale-95 ${
                            saving ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                    >
                        {saving ? "ĐANG LƯU..." : (id ? "CẬP NHẬT ĐÁNH GIÁ" : "LƯU ĐÁNH GIÁ")}
                    </button>
                </div>
            </div>
        </div>
    );
}
