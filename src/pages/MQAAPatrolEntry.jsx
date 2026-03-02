import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

import { ALL_CRITERIA } from "../data/mqaaPatrolCriteria";


export default function MQAAPatrolEntry() {
    const { section, id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [isScoreEditable, setIsScoreEditable] = useState(false);

    const [headerData, setHeaderData] = useState({
        auditor: "",
        auditorId: "",
        date: new Date().toISOString().split("T")[0],
    });

    const handleUnlockScore = () => {
        if (isScoreEditable) {
            setIsScoreEditable(false);
            return;
        }
        const pw = prompt("Nhập mật mã để mở khóa chỉnh sửa điểm (Score):");
        if (pw === "04672") {
            setIsScoreEditable(true);
        } else if (pw !== null) {
            alert("Sai mật mã!");
        }
    };

    // Auto-lookup Auditor by ID
    useEffect(() => {
        const fetchAuditor = async () => {
            if (headerData.auditorId.length >= 4) {
                const { data } = await supabase
                    .from("mqaa_patrol_auditors")
                    .select("name")
                    .eq("id", headerData.auditorId)
                    .single();

                if (data) {
                    setHeaderData(prev => ({ ...prev, auditor: data.name }));
                }
            }
        };
        const timer = setTimeout(fetchAuditor, 500);
        return () => clearTimeout(timer);
    }, [headerData.auditorId]);

    // Initialize rows state
    const [rows, setRows] = useState([]);

    useEffect(() => {
        const fetchRecordAndCriteria = async () => {
            setLoading(true);
            try {
                // Fetch dynamic criteria for this section
                const { data: dbCriteria, error: critError } = await supabase
                    .from("mqaa_patrol_criteria")
                    .select("*")
                    .eq("section_id", section)
                    .order("sort_order", { ascending: true });

                if (critError) throw critError;

                const formattedCriteria = dbCriteria.map(c => ({
                    ...c,
                    subLabel: c.sub_label,
                    maxScore: c.max_score,
                    isHeader: c.is_header
                }));

                if (id) {
                    // Edit Mode: Fetch existing record
                    const { data: record, error: recError } = await supabase
                        .from("mqaa_patrol_logs")
                        .select("*")
                        .eq("id", id)
                        .single();

                    if (recError) throw recError;

                    setHeaderData({
                        auditor: record.auditor_name,
                        auditorId: record.auditor_id,
                        date: record.date,
                    });

                    // Merge record data with current criteria (in case criteria changed or for subLabels)
                    const mergedRows = record.evaluation_data.map(r => {
                        const original = formattedCriteria.find(c => c.no === r.no);
                        return {
                            ...r,
                            isHeader: original?.isHeader ?? r.is_header,
                            subLabel: original?.subLabel || "",
                            imageUrl: r.image_url,
                        };
                    });
                    setRows(mergedRows);
                } else {
                    // New Entry Mode: Load criteria
                    setRows(formattedCriteria.map((item) => ({
                        ...item,
                        score: item.isHeader ? 0 : item.maxScore,
                        level: item.isHeader ? 0 : item.maxScore, // Default to full points
                        imageFile: null,
                        imageUrl: "",
                        description: "",
                    })));
                }
            } catch (error) {
                console.error("Error loading criteria:", error);
                alert("Lỗi khi tải biểu mẫu: " + error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchRecordAndCriteria();
    }, [id, section]);

    const totals = useMemo(() => {
        let totalScore = 0;
        let totalLevel = 0;
        rows.forEach((row) => {
            if (!row.isHeader) {
                totalScore += Number(row.score) || 0;
                totalLevel += Number(row.level) || 0;
            }
        });
        const performance = totalScore > 0 ? (totalLevel / totalScore) * 100 : 0;
        return { totalScore, totalLevel, performance: performance.toFixed(0) };
    }, [rows]);

    const handleRowChange = (index, field, value) => {
        const newRows = [...rows];
        newRows[index][field] = value;
        setRows(newRows);
    };

    const handleImageChange = (index, e) => {
        const file = e.target.files[0];
        if (file) {
            const newRows = [...rows];
            newRows[index].imageFile = file;
            newRows[index].imageUrl = URL.createObjectURL(file);
            setRows(newRows);
        }
    };

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_WIDTH = 1000;
                const MAX_HEIGHT = 1000;
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
                    0.6
                );
            };
            img.onerror = reject;
        });
    };

    const handleSave = async () => {
        if (!headerData.auditor || !headerData.auditorId) {
            alert("Vui lòng nhập tên Auditor và ID");
            return;
        }

        setLoading(true);
        try {
            const rowsWithRemoteUrls = [...rows];

            // Upload images
            for (let i = 0; i < rowsWithRemoteUrls.length; i++) {
                const row = rowsWithRemoteUrls[i];
                if (row.imageFile && !row.isHeader) {
                    const compressed = await compressImage(row.imageFile);
                    const fileName = `mqaa_patrol/${Date.now()}_${i}_${section}.jpg`;
                    const { data, error } = await supabase.storage
                        .from("mqaa-images")
                        .upload(fileName, compressed);

                    if (error) throw error;

                    const { data: { publicUrl } } = supabase.storage
                        .from("mqaa-images")
                        .getPublicUrl(fileName);

                    rowsWithRemoteUrls[i].imageUrl = publicUrl;
                }
            }

            // Prepare data for save
            const payload = {
                auditor_name: headerData.auditor,
                auditor_id: headerData.auditorId,
                date: headerData.date,
                section: section,
                overall_performance: totals.performance,
                total_score: totals.totalScore,
                total_level: totals.totalLevel,
                evaluation_data: rowsWithRemoteUrls.map(r => ({
                    no: r.no,
                    label: r.label,
                    is_header: r.isHeader,
                    score: r.score,
                    level: r.level,
                    image_url: r.imageUrl,
                    description: r.description
                })),
            };

            if (id) {
                payload.id = id;
            }

            const { error } = await supabase.from("mqaa_patrol_logs").upsert([payload]);
            if (error) throw error;

            alert("Lưu thành công!");
            navigate("/mqaa-patrol");
        } catch (error) {
            console.error(error);
            alert("Lỗi khi lưu: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto p-4 bg-white shadow-xl rounded-lg my-8">
            <div className="flex items-center gap-4 mb-6 relative">
                <button
                    onClick={() => navigate("/mqaa-patrol")}
                    className="absolute left-0 bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg transition-all"
                    title="Quay lại"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <h1 className="text-2xl font-bold text-center w-full text-indigo-900 uppercase">
                    {id ? "CHỈNH SỬA" : "PHIẾU"} ĐÁNH GIÁ MQAA - SECTION {section?.replace("_", " ")}
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-gray-50 p-6 rounded-lg border">
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700">ID:</label>
                    <input
                        type="text"
                        className="p-2 border rounded shadow-sm focus:ring-2 focus:ring-indigo-500"
                        value={headerData.auditorId}
                        onChange={(e) => setHeaderData({ ...headerData, auditorId: e.target.value })}
                        placeholder="Nhập ID (Ví dụ: 04126)"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700">Auditor:</label>
                    <input
                        type="text"
                        className="p-2 border rounded shadow-sm focus:ring-2 focus:ring-indigo-500"
                        value={headerData.auditor}
                        onChange={(e) => setHeaderData({ ...headerData, auditor: e.target.value })}
                        placeholder="Tên người đánh giá (Tự động nếu có trong hệ thống)"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700">Date of Audit:</label>
                    <input
                        type="date"
                        className="p-2 border rounded shadow-sm focus:ring-2 focus:ring-indigo-500"
                        value={headerData.date}
                        onChange={(e) => setHeaderData({ ...headerData, date: e.target.value })}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700">Section Audit:</label>
                    <input
                        type="text"
                        className="p-2 border rounded bg-gray-200 cursor-not-allowed"
                        value={section?.replace("_", " ")}
                        readOnly
                    />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2 border-t pt-4 mt-2">
                    <div className="flex justify-between items-center text-xl">
                        <span className="font-bold text-indigo-800">Overall Performance:</span>
                        <span className={`font-black px-4 py-1 rounded-full ${Number(totals.performance) >= 90 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {totals.performance}%
                        </span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto shadow-sm border rounded">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-indigo-600 text-white font-bold">
                            <th className="border p-2 w-16">No.</th>
                            <th className="border p-2">Criteria</th>
                            <th className="border p-2 w-20 text-center relative group">
                                <div className="flex items-center justify-center gap-1">
                                    Score
                                    <button
                                        onClick={handleUnlockScore}
                                        className={`p-1 rounded hover:bg-indigo-500 transition-colors ${isScoreEditable ? 'text-yellow-300' : 'text-indigo-300'}`}
                                        title={isScoreEditable ? "Khóa chỉnh sửa" : "Mở khóa chỉnh sửa"}
                                    >
                                        {isScoreEditable ? (
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 016 0v2h2V7a5 5 0 00-5-5z" /></svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                        )}
                                    </button>
                                </div>
                            </th>
                            <th className="border p-2 w-24 text-center">Level</th>
                            <th className="border p-2 w-32 text-center">Reference Image</th>
                            <th className="border p-2">Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => (
                            <tr key={idx} className={`${row.isHeader ? 'bg-orange-400 font-bold' : 'hover:bg-indigo-50'}`}>
                                <td className="border p-2 text-center font-bold">{row.no}</td>
                                <td className="border p-2">
                                    <p className="font-medium">{row.label}</p>
                                    <p className="text-xs italic text-blue-600 mt-1">{row.subLabel}</p>
                                </td>
                                <td className={`border p-2 text-center ${row.isHeader ? 'bg-orange-400' : ''}`}>
                                    {!row.isHeader && (
                                        <input
                                            type="number"
                                            className={`w-full text-center p-1 border rounded ${!isScoreEditable ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white'}`}
                                            value={row.score}
                                            onChange={(e) => handleRowChange(idx, "score", e.target.value)}
                                            readOnly={!isScoreEditable}
                                        />
                                    )}
                                </td>
                                <td className={`border p-2 text-center ${row.isHeader ? 'bg-orange-400' : ''}`}>
                                    {!row.isHeader && (
                                        <input
                                            type="number"
                                            className="w-full text-center p-1 border rounded bg-yellow-50 font-bold"
                                            value={row.level}
                                            onChange={(e) => handleRowChange(idx, "level", e.target.value)}
                                        />
                                    )}
                                </td>
                                <td className={`border p-2 text-center ${row.isHeader ? 'bg-orange-400' : ''}`}>
                                    {!row.isHeader && (
                                        <div className="flex flex-col items-center gap-2">
                                            <label className="cursor-pointer bg-white border px-2 py-1 rounded text-xs hover:bg-gray-50 flex items-center gap-1 shadow-sm font-semibold">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 5l-4-4-4 4M12 1v13" /></svg>
                                                Upload
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageChange(idx, e)} />
                                            </label>
                                            {row.imageUrl && (
                                                <div className="relative w-16 h-16 border rounded shadow-inner overflow-hidden">
                                                    <img src={row.imageUrl} className="w-full h-full object-cover" alt="ref" />
                                                    <button onClick={() => handleRowChange(idx, "imageUrl", "")} className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 flex items-center justify-center text-[10px] rounded-bl">x</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td className={`border p-2 ${row.isHeader ? 'bg-orange-400' : ''}`}>
                                    {!row.isHeader && (
                                        <textarea
                                            rows="2"
                                            className="w-full p-1 border rounded text-xs"
                                            value={row.description}
                                            onChange={(e) => handleRowChange(idx, "description", e.target.value)}
                                            placeholder="Ghi chú..."
                                        />
                                    )}
                                </td>
                            </tr>
                        ))}
                        {/* Totals Row */}
                        <tr className="bg-yellow-100 font-black border-t-2 border-indigo-200">
                            <td colSpan="2" className="border p-3 text-right text-lg uppercase">Total:</td>
                            <td className="border p-3 text-center text-lg">{totals.totalScore}</td>
                            <td className="border p-3 text-center text-lg">{totals.totalLevel}</td>
                            <td className="border p-3 bg-white" colSpan="2"></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-6 pt-4 border-t text-center">
                <p className="text-2xl font-black text-indigo-900 bg-yellow-400 inline-block px-8 py-2 rounded-lg shadow-sm mb-4">
                    Overall MQAA Performance (2): {totals.performance}%
                </p>
            </div>

            <div className="mt-8 flex justify-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold transition-all shadow-md"
                >
                    QUAY LẠI
                </button>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className={`px-12 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg transform hover:scale-105 ${loading ? 'opacity-50' : ''}`}
                >
                    {loading ? "ĐANG LƯU..." : (id ? "CẬP NHẬT ĐÁNH GIÁ" : "LƯU ĐÁNH GIÁ")}
                </button>
            </div>

        </div>
    );
}
