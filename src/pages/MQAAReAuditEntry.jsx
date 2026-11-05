import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { MQAA_RE_AUDIT_SECTIONS, MQAA_RE_AUDIT_CRITERIA } from "../data/mqaaReAuditCriteria";
import { usePatrolScoreSettings, DEFAULT_NORMAL_SCORES, DEFAULT_CRITICAL_SCORES } from "../utils/mqaaSettings";

const DEFAULT_AUDITOR_NAME = "Ngô Thị Bích Ngọc";
const AUDITOR_STORAGE_KEY = "mqaa_reassessment_auditor_name";

export default function MQAAReAuditEntry() {
    const { section: rawSection, id } = useParams();
    const navigate = useNavigate();
    const section = decodeURIComponent(rawSection || "");

    const { normalScores, criticalScores } = usePatrolScoreSettings();

    // Section Meta
    const sectionMeta = useMemo(() => {
        return MQAA_RE_AUDIT_SECTIONS.find((s) => s.id === section) || {
            id: section,
            name: section,
            vnName: section,
        };
    }, [section]);

    // Header State
    const [headerData, setHeaderData] = useState(() => ({
        auditor: localStorage.getItem(AUDITOR_STORAGE_KEY) || DEFAULT_AUDITOR_NAME,
        date: new Date().toISOString().split("T")[0],
    }));

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

    useEffect(() => {
        loadData();
    }, [section, id]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Get base criteria for this section
            const baseItems = MQAA_RE_AUDIT_CRITERIA[section]?.items || [];

            let initialRows = baseItems.map((item, idx) => ({
                index: idx + 1,
                excelRow: item.excelRow,
                no: item.no,
                titleVn: item.titleVn,
                titleEn: item.titleEn,
                maxScore: item.maxScore,
                isCritical: Boolean(item.isCritical),
                score: item.maxScore === "N/A" ? "N/A" : "",
                notes: "",
                images: [], // { file, url }
            }));

            // If editing an existing record by id
            if (id) {
                const { data: record, error } = await supabase
                    .from("mqaa_patrol_logs")
                    .select("*")
                    .eq("id", id)
                    .single();

                if (!error && record) {
                    setHeaderData({
                        auditor: record.auditor_name || DEFAULT_AUDITOR_NAME,
                        date: record.date || new Date().toISOString().split("T")[0],
                    });

                    const savedItems = Array.isArray(record.evaluation_data) ? record.evaluation_data : [];
                    const savedByNo = {};
                    savedItems.forEach((si) => {
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
                                score: found.score !== undefined ? found.score : r.score,
                                notes: found.notes || found.problemDescription || found.problem_description || "",
                                images: rawUrls.map((u) => ({ file: null, url: u })),
                            };
                        }
                        return r;
                    });
                }
            } else {
                // Check if there is already a record for today for this section
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

    // Calculate score totals
    const calculation = useMemo(() => {
        let totalMax = 0;
        let totalActual = 0;
        let answeredCount = 0;
        let totalScorable = 0;

        rows.forEach((r) => {
            if (r.maxScore === "N/A") return;
            const maxVal = Number(r.maxScore) || 4;
            totalMax += maxVal;
            totalScorable++;

            if (r.score !== "" && r.score !== "N/A" && r.score !== undefined) {
                totalActual += Number(r.score);
                answeredCount++;
            }
        });

        const percent = totalMax > 0 ? Math.round((totalActual / totalMax) * 100) : 0;
        const isComplete = totalScorable > 0 && answeredCount >= totalScorable;

        return {
            totalMax,
            totalActual,
            percent,
            isComplete,
            answeredCount,
            totalScorable,
        };
    }, [rows]);

    // Handle Score change
    const handleScoreSelect = (idx, scoreVal) => {
        setRows((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], score: scoreVal };
            return next;
        });
    };

    // Handle Notes change
    const handleNotesChange = (idx, val) => {
        setRows((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], notes: val };
            return next;
        });
    };

    // Compress Image
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

    // Handle Images
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
        setRows((prev) =>
            prev.map((r) => {
                if (r.maxScore === "N/A") return r;
                let s = scoreVal;
                if (scoreVal === "max") {
                    s = Number(r.maxScore) || 4;
                }
                return { ...r, score: s };
            })
        );
    };

    // Save
    const handleSave = async () => {
        if (!calculation.isComplete) {
            const confirmSave = confirm(
                `Bạn chưa chấm hết tất cả các tiêu chí (${calculation.answeredCount}/${calculation.totalScorable}). Bạn có chắc muốn lưu tạm không?`
            );
            if (!confirmSave) return;
        }

        setSaving(true);
        try {
            // Save auditor name to localStorage
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
                    score: row.score,
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
                total_score: calculation.totalMax,
                total_level: calculation.totalActual,
                overall_performance: calculation.percent,
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
            <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm text-center">
                    <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-slate-600 font-bold text-sm">Đang tải biểu mẫu Tái đánh giá...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 pb-28 font-sans">
            {/* Header Sticky Bar */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 py-3.5 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate("/mqaa-patrol/re-audit")}
                            className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-500"
                            title="Quay lại danh sách"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="bg-amber-100 text-amber-800 text-[11px] font-black px-2 py-0.5 rounded-full border border-amber-200">
                                    TÁI ĐÁNH GIÁ
                                </span>
                                <h1 className="text-lg md:text-xl font-black text-slate-800">
                                    {section}
                                </h1>
                            </div>
                            <p className="text-xs font-bold text-slate-400">{sectionMeta.vnName}</p>
                        </div>
                    </div>

                    {/* Metadata & Quick Score */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold">
                            <span className="text-slate-400">Auditor:</span>
                            <input
                                type="text"
                                value={headerData.auditor}
                                onChange={(e) => setHeaderData((p) => ({ ...p, auditor: e.target.value }))}
                                className="bg-transparent font-black text-amber-950 focus:outline-none w-36"
                                title="Tên Auditor tái đánh giá (tự lưu)"
                            />
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold">
                            <span className="text-slate-400">Ngày:</span>
                            <input
                                type="date"
                                value={headerData.date}
                                onChange={(e) => setHeaderData((p) => ({ ...p, date: e.target.value }))}
                                className="bg-transparent font-black text-slate-800 focus:outline-none"
                            />
                        </div>

                        {/* Quick score button */}
                        <button
                            type="button"
                            onClick={() => handleQuickScoreAll("max")}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl font-black text-xs transition active:scale-95"
                            title="Chấm 4 điểm cho tất cả"
                        >
                            ⚡ Chấm 4 Tất Cả
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Checklist Container */}
            <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6">
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-black text-slate-800">
                                Bảng Tiêu Chí Chấm Điểm
                            </h2>
                            <p className="text-xs font-medium text-slate-500 mt-0.5">
                                Điểm tối đa mỗi mục là 4. Hạng mục trọng yếu có đánh dấu (*).
                            </p>
                        </div>

                        {/* Live Score Summary Badge */}
                        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="text-right">
                                <div className="text-[10px] uppercase font-bold text-slate-400">Điểm Đạt / Tối Đa</div>
                                <div className="text-sm font-black text-slate-800">
                                    {calculation.totalActual} / {calculation.totalMax}
                                </div>
                            </div>
                            <div className="h-8 w-px bg-slate-200"></div>
                            <div className="text-center">
                                <div className="text-[10px] uppercase font-bold text-slate-400">Tuân Thủ</div>
                                <div className={`text-base font-black ${calculation.percent >= 80 ? "text-emerald-600" : "text-rose-600"}`}>
                                    {calculation.percent}%
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Table / Cards */}
                    <div className="divide-y divide-slate-100">
                        {rows.map((row, idx) => {
                            const isCrit = row.isCritical;
                            const isNA = row.maxScore === "N/A";
                            const scoreOptions = isNA
                                ? ["N/A"]
                                : isCrit
                                ? (criticalScores?.length ? criticalScores : DEFAULT_CRITICAL_SCORES)
                                : (normalScores?.length ? normalScores : DEFAULT_NORMAL_SCORES);

                            return (
                                <div
                                    key={row.excelRow || idx}
                                    className={`p-4 md:p-6 transition ${
                                        row.score === 0 || row.score === -4 || (row.score !== "" && row.score < 4 && !isNA)
                                            ? "bg-amber-50/30"
                                            : "hover:bg-slate-50/50"
                                    }`}
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                        {/* Left: Criteria text */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                                    {row.no}
                                                </span>
                                                {isCrit && (
                                                    <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-200">
                                                        ★ Trọng Yếu (Critical)
                                                    </span>
                                                )}
                                                {isNA && (
                                                    <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2 py-0.5 rounded-full">
                                                        N/A
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className="text-sm font-bold text-slate-800 leading-snug">
                                                {row.titleVn}
                                            </h3>
                                            {row.titleEn && (
                                                <p className="text-xs font-normal text-slate-500 mt-1 italic">
                                                    {row.titleEn}
                                                </p>
                                            )}
                                        </div>

                                        {/* Right: Score Options */}
                                        <div className="shrink-0 flex flex-col items-end gap-2">
                                            <div className="text-[11px] font-bold text-slate-400">Điểm đánh giá:</div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {scoreOptions.map((opt) => {
                                                    const isSelected = String(row.score) === String(opt);
                                                    let btnStyle = "bg-white text-slate-700 border-slate-200 hover:border-amber-400";
                                                    if (isSelected) {
                                                        if (opt === 4 || opt === "4") {
                                                            btnStyle = "bg-emerald-600 text-white border-emerald-600 shadow-sm";
                                                        } else if (opt === 0 || opt === "0" || opt === -4 || opt === "-4") {
                                                            btnStyle = "bg-rose-600 text-white border-rose-600 shadow-sm";
                                                        } else {
                                                            btnStyle = "bg-amber-500 text-white border-amber-500 shadow-sm";
                                                        }
                                                    }

                                                    return (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            onClick={() => handleScoreSelect(idx, opt)}
                                                            className={`w-11 h-9 rounded-xl font-black text-xs border transition active:scale-95 ${btnStyle}`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Issue Notes & Image Attachment Area */}
                                    <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                                                Mô tả vấn đề / Ghi chú lỗi (Cột K)
                                            </label>
                                            <input
                                                type="text"
                                                value={row.notes}
                                                onChange={(e) => handleNotesChange(idx, e.target.value)}
                                                placeholder={row.score === 0 || row.score === -4 || (row.score !== "" && row.score < 4 && !isNA) ? "Bắt buộc: Nhập mô tả lỗi phát hiện..." : "Ghi chú bổ sung (nếu có)..."}
                                                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1 transition ${
                                                    (row.score === 0 || row.score === -4 || (row.score !== "" && row.score < 4 && !isNA)) && !row.notes
                                                        ? "border-amber-400 bg-amber-50/50 focus:ring-amber-500"
                                                        : "border-slate-200 bg-white focus:ring-slate-400"
                                                }`}
                                            />
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                                                    Hình ảnh hiện trạng (Cột J)
                                                </label>
                                                <span className="text-[11px] text-slate-400">
                                                    {row.images?.length || 0}/5 ảnh
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap">
                                                {/* Upload button */}
                                                {(!row.images || row.images.length < 5) && (
                                                    <label className="cursor-pointer bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 hover:border-amber-400 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition">
                                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                        <span>Thêm ảnh</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            multiple
                                                            className="hidden"
                                                            onChange={(e) => handleImageChange(idx, e)}
                                                        />
                                                    </label>
                                                )}

                                                {/* Thumbnail preview list */}
                                                {row.images && row.images.map((img, imgIdx) => (
                                                    <div key={imgIdx} className="relative group/thumb w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-sm shrink-0">
                                                        <img
                                                            src={img.url}
                                                            alt="condition"
                                                            className="w-full h-full object-cover cursor-pointer"
                                                            onClick={() => setPreviewImage(img.url)}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveImage(idx, imgIdx)}
                                                            className="absolute top-0 right-0 bg-rose-600 text-white w-4 h-4 rounded-bl text-[10px] flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition"
                                                            title="Xóa ảnh"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Bottom Floating Save Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 md:px-8 py-3.5 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <button
                        type="button"
                        onClick={() => navigate("/mqaa-patrol/re-audit")}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs md:text-sm hover:bg-slate-50 transition"
                    >
                        Hủy / Quay lại
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:block text-right">
                            <span className="text-xs text-slate-400 font-bold">Tiến độ: </span>
                            <span className="text-xs font-black text-slate-700">
                                {calculation.answeredCount}/{calculation.totalScorable} mục
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className={`px-6 py-2.5 rounded-xl font-black text-sm text-white shadow-md active:scale-95 transition flex items-center gap-2 ${
                                saving
                                    ? "bg-slate-400 cursor-not-allowed"
                                    : "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
                            }`}
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Đang lưu...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Lưu Phiếu Tái Đánh Giá</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Image Modal */}
            {previewImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <img
                            src={previewImage}
                            alt="preview"
                            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
                        />
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-800 font-black shadow-lg flex items-center justify-center"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

