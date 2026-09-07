import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { MQAA_NEW_CRITERIA, MQAA_NEW_SECTIONS } from "../data/mqaaNewChecklistCriteria";
import { usePatrolTarget } from "../utils/mqaaSettings";

// Helper to normalize section names from URLs or legacy names
function normalizeSectionName(sec) {
    if (!sec) return "Raw Material & FGs Warehouse";
    const decoded = decodeURIComponent(sec);
    if (decoded === "Raw_Material_Warehouse" || decoded === "Finished_Goods_Warehouse") {
        return "Raw Material & FGs Warehouse";
    }
    if (decoded === "Prefitting") return "Saw Cutting (Pre-fitting)";
    if (decoded === "Molding") return "Moulding (Hot-Press)";
    if (decoded === "Leanline_DC") return "Lean line DC";
    if (decoded === "Leanline_Molded") return "Lean line Molded";
    if (decoded === "Cutting_Die_Warehouse") return "Cutting Die and Board Managemen";
    if (decoded === "Logo_Warehouse") return "Logo WIP Inventory Management";
    return decoded;
}

export default function MQAAPatrolEntry() {
    const { section: rawSection, id } = useParams();
    const navigate = useNavigate();
    const section = useMemo(() => normalizeSectionName(rawSection), [rawSection]);

    const { targetScore } = usePatrolTarget();

    const [loading, setLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

    const [headerData, setHeaderData] = useState({
        auditor: "",
        auditorId: "",
        date: new Date().toISOString().split("T")[0],
    });

    const [rows, setRows] = useState([]);

    // Auto-lookup Auditor by ID
    useEffect(() => {
        const fetchAuditor = async () => {
            if (headerData.auditorId && headerData.auditorId.length >= 4) {
                try {
                    const { data } = await supabase
                        .from("mqaa_patrol_auditors")
                        .select("name")
                        .eq("id", headerData.auditorId)
                        .single();

                    if (data && data.name) {
                        setHeaderData((prev) => ({ ...prev, auditor: data.name }));
                    }
                } catch (err) {
                    console.error("Auditor lookup error:", err);
                }
            }
        };
        const timer = setTimeout(fetchAuditor, 400);
        return () => clearTimeout(timer);
    }, [headerData.auditorId]);

    // Load criteria and existing record (if editing)
    useEffect(() => {
        const fetchRecordAndCriteria = async () => {
            setLoading(true);
            try {
                // 1. Fetch criteria from Supabase
                const { data: dbCriteria, error: critError } = await supabase
                    .from("mqaa_patrol_criteria")
                    .select("*")
                    .eq("section_id", section)
                    .order("sort_order", { ascending: true });

                let criteriaList = [];
                if (dbCriteria && dbCriteria.length > 0) {
                    criteriaList = dbCriteria.map((c, idx) => {
                        const isNA = c.max_score <= 0;
                        const isCrit = c.is_header || (c.no && c.no.startsWith("*"));
                        return {
                            index: idx + 1,
                            no: c.no,
                            titleVn: c.label,
                            titleEn: c.sub_label || "",
                            maxScore: isNA ? "N/A" : c.max_score,
                            isCritical: isCrit,
                            defaultAuditScore: isNA ? "N/A" : "",
                        };
                    });
                } else {
                    // Fallback to static checklist data from excel
                    const staticSec = MQAA_NEW_CRITERIA[section] || MQAA_NEW_CRITERIA["Raw Material & FGs Warehouse"];
                    criteriaList = staticSec.items || [];
                }

                if (id) {
                    // 2. Edit Mode: Fetch existing record
                    const { data: record, error: recError } = await supabase
                        .from("mqaa_patrol_logs")
                        .select("*")
                        .eq("id", id)
                        .single();

                    if (recError) throw recError;

                    setHeaderData({
                        auditor: record.auditor_name || "",
                        auditorId: record.auditor_id || "",
                        date: record.date || new Date().toISOString().split("T")[0],
                    });

                    // Merge record evaluation data with criteria
                    const savedData = Array.isArray(record.evaluation_data) ? record.evaluation_data : [];
                    
                    if (savedData.length > 0) {
                        const merged = savedData.map((item, idx) => {
                            const isNA = item.max_score === "N/A" || item.maxScore === "N/A" || item.score === "N/A";
                            const isCrit = Boolean(item.is_critical || item.isCritical || (item.no && item.no.startsWith("*")));
                            
                            const urls = Array.isArray(item.image_urls)
                                ? item.image_urls
                                : item.image_url
                                ? [item.image_url]
                                : [];
                            const images = urls.map((url) => ({ file: null, url }));

                            return {
                                index: idx + 1,
                                no: item.no || `${idx + 1}`,
                                titleVn: item.titleVn || item.label || "",
                                titleEn: item.titleEn || item.sub_label || item.subLabel || "",
                                maxScore: isNA ? "N/A" : (item.max_score || item.maxScore || item.score || 4),
                                isCritical: isCrit,
                                auditScore: isNA ? "N/A" : (item.audit_score !== undefined ? item.audit_score : (item.level !== undefined ? item.level : "")),
                                images: images,
                                description: item.description || "",
                            };
                        });
                        setRows(merged);
                    } else {
                        // Init new rows from criteria
                        initRowsFromCriteria(criteriaList);
                    }
                } else {
                    // 3. New Entry Mode
                    initRowsFromCriteria(criteriaList);
                }
            } catch (error) {
                console.error("Error loading criteria:", error);
                // Fallback to static checklist
                const staticSec = MQAA_NEW_CRITERIA[section] || MQAA_NEW_CRITERIA["Raw Material & FGs Warehouse"];
                initRowsFromCriteria(staticSec.items || []);
            } finally {
                setLoading(false);
            }
        };

        const initRowsFromCriteria = (list) => {
            setRows(
                list.map((item) => {
                    const isNA = item.maxScore === "N/A";
                    return {
                        ...item,
                        auditScore: isNA ? "N/A" : (item.defaultAuditScore || ""),
                        images: [],
                        description: "",
                    };
                })
            );
        };

        fetchRecordAndCriteria();
    }, [section, id]);

    // Section header & footer from static data
    const sectionConfig = useMemo(() => {
        return MQAA_NEW_CRITERIA[section] || MQAA_NEW_CRITERIA["Raw Material & FGs Warehouse"];
    }, [section]);

    // Score Calculations: Strictly ignore N/A items
    const totals = useMemo(() => {
        let totalMaxScore = 0;
        let totalAuditScore = 0;
        let scoredItemsCount = 0;
        let totalEvaluatedItems = 0;

        rows.forEach((row) => {
            if (row.maxScore !== "N/A") {
                totalEvaluatedItems += 1;
                const maxVal = Number(row.maxScore) || 0;
                totalMaxScore += maxVal;

                if (row.auditScore !== "" && row.auditScore !== "N/A" && row.auditScore !== undefined) {
                    const auditVal = Number(row.auditScore) || 0;
                    totalAuditScore += auditVal;
                    scoredItemsCount += 1;
                }
            }
        });

        const performance = totalMaxScore > 0 ? ((totalAuditScore / totalMaxScore) * 100).toFixed(1) : "0.0";

        return {
            totalMaxScore,
            totalAuditScore,
            performance,
            scoredItemsCount,
            totalEvaluatedItems,
        };
    }, [rows]);

    const handleAuditScoreChange = (index, value) => {
        const newRows = [...rows];
        const row = newRows[index];

        if (row.maxScore === "N/A") return;

        if (value === "") {
            row.auditScore = "";
        } else {
            let num = Number(value);
            if (isNaN(num)) return;
            row.auditScore = num;
        }

        setRows(newRows);
    };

    const handleDescriptionChange = (index, value) => {
        const newRows = [...rows];
        newRows[index].description = value;
        setRows(newRows);
    };

    const handleImageChange = (index, e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            const newRows = [...rows];
            const currentImages = newRows[index].images || [];

            if (currentImages.length + files.length > 5) {
                alert("Tối đa chỉ được đính kèm 5 ảnh cho mỗi hạng mục.");
                return;
            }

            const newImagesAdded = files.map((file) => ({
                file,
                url: URL.createObjectURL(file),
            }));

            newRows[index].images = [...currentImages, ...newImagesAdded];
            setRows(newRows);
        }
        e.target.value = "";
    };

    const handleRemoveImage = (rowIndex, imageIndex) => {
        const newRows = [...rows];
        const currentImages = [...(newRows[rowIndex].images || [])];
        currentImages.splice(imageIndex, 1);
        newRows[rowIndex].images = currentImages;
        setRows(newRows);
    };

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
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
                        if (blob) {
                            const compressedFile = new File([blob], file.name, { type: "image/jpeg" });
                            resolve(compressedFile);
                        } else {
                            reject(new Error("Compression failed"));
                        }
                    },
                    "image/jpeg",
                    0.65
                );
            };
            img.onerror = reject;
        });
    };

    const handleSave = async () => {
        if (!headerData.auditor || !headerData.auditorId) {
            alert("Vui lòng nhập đầy đủ Mã số Auditor (ID) và Tên người đánh giá!");
            return;
        }

        const activeCriteria = rows.filter((r) => r.maxScore !== "N/A");
        if (activeCriteria.length === 0) {
            alert("Không thể lưu phiếu đánh giá vì không có hạng mục nào.");
            return;
        }

        setLoading(true);
        try {
            const rowsWithRemoteUrls = [...rows];

            // Process image uploads
            for (let i = 0; i < rowsWithRemoteUrls.length; i++) {
                const row = rowsWithRemoteUrls[i];
                if (row.images && row.images.length > 0) {
                    const finalUrls = [];
                    for (let j = 0; j < row.images.length; j++) {
                        const imgObj = row.images[j];
                        if (imgObj.file) {
                            try {
                                const compressed = await compressImage(imgObj.file);
                                const fileName = `mqaa_patrol/${Date.now()}_${i}_${j}_${section.replace(/\s+/g, "_")}.jpg`;
                                const { error: upErr } = await supabase.storage
                                    .from("mqaa-images")
                                    .upload(fileName, compressed);

                                if (!upErr) {
                                    const { data: { publicUrl } } = supabase.storage
                                        .from("mqaa-images")
                                        .getPublicUrl(fileName);
                                    finalUrls.push(publicUrl);
                                } else {
                                    console.warn("Storage upload failed, fallback:", upErr);
                                    finalUrls.push(imgObj.url);
                                }
                            } catch (e) {
                                console.warn("Image upload error:", e);
                                finalUrls.push(imgObj.url);
                            }
                        } else {
                            finalUrls.push(imgObj.url);
                        }
                    }
                    rowsWithRemoteUrls[i].imageUrls = finalUrls;
                } else {
                    rowsWithRemoteUrls[i].imageUrls = [];
                }
            }

            const payload = {
                auditor_name: headerData.auditor,
                auditor_id: headerData.auditorId,
                date: headerData.date,
                section: section,
                overall_performance: Number(totals.performance),
                total_score: totals.totalMaxScore,
                total_level: totals.totalAuditScore,
                evaluation_data: rowsWithRemoteUrls.map((r) => ({
                    index: r.index,
                    no: r.no,
                    titleVn: r.titleVn,
                    titleEn: r.titleEn,
                    label: r.titleVn,
                    sub_label: r.titleEn,
                    max_score: r.maxScore,
                    score: r.maxScore,
                    audit_score: r.auditScore,
                    level: r.auditScore,
                    is_critical: r.isCritical,
                    image_urls: r.imageUrls || [],
                    image_url: r.imageUrls && r.imageUrls.length > 0 ? r.imageUrls[0] : "",
                    description: r.description || "",
                })),
            };

            if (id) {
                payload.id = id;
            }

            const { error } = await supabase.from("mqaa_patrol_logs").upsert([payload]);
            if (error) throw error;

            alert("🎉 Lưu phiếu đánh giá MQAA thành công!");
            navigate("/mqaa-patrol");
        } catch (error) {
            console.error("Save error:", error);
            alert("Lỗi khi lưu phiếu: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickScoreAll = (scoreVal) => {
        const newRows = rows.map((r) => {
            if (r.maxScore === "N/A") return r;
            const targetScore = scoreVal === "max" ? r.maxScore : scoreVal;
            return {
                ...r,
                auditScore: targetScore,
            };
        });
        setRows(newRows);
    };

    const isPerformancePass = Number(totals.performance) >= Number(targetScore);

    return (
        <div className="max-w-[1360px] mx-auto p-4 md:p-6 bg-white shadow-2xl rounded-2xl my-6 border border-slate-100">
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
                        onClick={() => navigate("/mqaa-patrol")}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-xl transition shadow-sm"
                        title="Quay lại danh sách Section"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-indigo-950 uppercase tracking-tight">
                            {id ? "CHỈNH SỬA" : "PHIẾU"} ĐÁNH GIÁ MQAA - {section}
                        </h1>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">
                            OrthoLite Insole Quality Audit Standard Checklist
                        </p>
                    </div>
                </div>

                {/* Section Selector Dropdown */}
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap pl-1">Đổi Section:</span>
                    <select
                        value={section}
                        onChange={(e) => navigate(`/mqaa-patrol/entry/${encodeURIComponent(e.target.value)}`)}
                        className="bg-white border border-slate-300 text-indigo-900 font-bold text-sm rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer shadow-sm"
                    >
                        {MQAA_NEW_SECTIONS.map((sec) => (
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
                        className="p-2.5 border border-slate-300 rounded-xl bg-white shadow-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        value={headerData.auditorId}
                        onChange={(e) => setHeaderData({ ...headerData, auditorId: e.target.value })}
                        placeholder="Ví dụ: 04126..."
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Tên người đánh giá:</label>
                    <input
                        type="text"
                        className="p-2.5 border border-slate-300 rounded-xl bg-white shadow-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                        value={headerData.auditor}
                        onChange={(e) => setHeaderData({ ...headerData, auditor: e.target.value })}
                        placeholder="Tự động tra cứu từ ID"
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
                                onClick={() => handleQuickScoreAll("max")}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition border border-indigo-200"
                                title="Gán tất cả mục bằng điểm tối đa"
                            >
                                Max Điểm
                            </button>
                            <button
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

            {/* Main Evaluation Table */}
            <div className="overflow-x-auto shadow-sm border border-slate-200 rounded-2xl bg-white">
                <table className="w-full border-collapse text-left text-xs md:text-sm">
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

                                    {/* Content (B-F) */}
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
                                                {(isCrit ? [-4, 0, 4] : [0, 1, 2, 3, 4]).map((pts) => (
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

                                    {/* Description (K) */}
                                    <td className="p-3 align-top">
                                        <textarea
                                            rows="2"
                                            className="w-full p-2 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
                                            value={row.description}
                                            onChange={(e) => handleDescriptionChange(idx, e.target.value)}
                                            placeholder="Ghi chú / mô tả vấn đề..."
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

            {/* Bottom Actions */}
            <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                    type="button"
                    onClick={() => navigate("/mqaa-patrol")}
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
                                    description: "",
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
                        disabled={loading}
                        className={`px-10 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-all shadow-xl shadow-indigo-200 transform hover:scale-[1.02] active:scale-95 ${
                            loading ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                    >
                        {loading ? "ĐANG LƯU..." : (id ? "CẬP NHẬT ĐÁNH GIÁ" : "LƯU ĐÁNH GIÁ")}
                    </button>
                </div>
            </div>
        </div>
    );
}
