import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const LAMINATION_CRITERIA = [
    {
        no: "2.1",
        label: "Đảm bảo tuân thủ nghiêm ngặt quy trình dán và kiểm soát chất lượng nguyên liệu để đảm bảo chất lượng sản phẩm đầu ra đạt yêu cầu",
        subLabel: "Ensure strict compliance with the gluing process and control the quality of raw materials to ensure the quality of output products meets requirements.",
        isHeader: true,
    },
    {
        no: "2.1.1",
        label: "Có chỉ lệnh sản xuất/ mẫu đầu chuyền/ đặc điểm kỹ thuật nguyên liệu của việc cán màng đã được xác nhận có sẵn trên chuyền sản xuất.",
        subLabel: "Confirmed P.O/ first sample/ specifications of upper for lamination available in producion the line.",
    },
    {
        no: "2.1.2",
        label: "Quy trình cán màng cho vật liệu tuân thủ theo chỉ định trên P.O/ đặc điểm kỹ thuật vật liệu.",
        subLabel: "Process for lamination of material follows standards as specified on P.O/ material specifications.",
    },
    {
        no: "2.1.3",
        label: "Nguyên vật liệu được kiểm tra đầy đủ theo tiêu chuẩn trước khi tiến hành dán",
        subLabel: "Raw materials are fully inspected according to standards before proceeding with laminating.",
    },
    {
        no: "2.1.4",
        label: "Vật liệu đã được dán màng có kết quả đạt, khi được kiểm tra bởi QC và các thí nghiệm từ phòng Lab",
        subLabel: "Upper material being laminated confirmed with the specification manual, had passed the QC and lab test.",
    },
    {
        no: "2.1.5",
        label: "Thường xuyên kiểm tra độ bám dính sản phẩm làm ra, cắt mẫu A4 gửi đến Lab thí nghiệm và có ghi chú kết quả rõ ràng",
        subLabel: "QC check adhesive of product, cut A4 size sample send to Lab for experiment and clear take note result.",
    },
    {
        no: "2.1.6",
        label: "Độ dày tổng thể của foam có dung sai là +/- 0.3 mm so với độ dày chuẩn trong biểu đồ minh họa quy trình.",
        subLabel: "Thickness of total Foam laminate is within +/- 0.3 mm of standard PFC",
    },
    {
        no: "2.2",
        label: "Kiểm soát điều kiện nhiệt độ/tốc độ, kiểm soát điều kiện máy móc hoạt động ổn định và tuân thủ quy định kiểm soát kim loại.",
        subLabel: "Control temperature/speed conditions, control stable machine operating conditions and comply with needle type control regulations.",
        isHeader: true,
    },
    {
        no: "2.2.1",
        label: "Tốc độ, nhiệt độ trục cán màng được kiểm tra và ghi nhận và kiểm tra.",
        subLabel: "The speed and temperature of the laminating roller are checked and recorded.",
    },
    {
        no: "2.2.2",
        label: "Có đủ hệ thống làm mát sau quy trình cán màng để ổn định tình trạng của thành phẩm.",
        subLabel: "Enough cooling system set after the lamination process to stabilize condition of finished products.",
    },
    {
        no: "2.2.3",
        label: "Sử dụng dụng cụ chuyên dụng để kiểm tra nhiệt độ thực tế trống nhiệt của máy dán.",
        subLabel: "Use a special tool to check the actual temperature of the thermal drum of the laminator.",
    },
    {
        no: "2.2.4",
        label: "Nhiệt độ của trục máy lamination được thực hiện theo như hướng dẫn trong bảng quy định về nhiệt độ cho các loại nguyên vật liệu",
        subLabel: "The temperature of the lamination machine shaft is set according to the guidelines in the temperature regulation table for different types of materials.",
    },
    {
        no: "2.2.5",
        label: "Gió của quạt không được thổi trực tiếp vào hệ thống trống nhiệt của máy dán",
        subLabel: "The fan's wind must not blow directly into the laminating machine's thermal drum system.",
    },
    {
        no: "2.2.6",
        label: "Máy móc thiết bị đo lường phải được kiểm tra và hiệu chuẩn định kỳ : Cân điện tử, thước đo điện tử, thước lá, ….",
        subLabel: "Measuring equipment must be regularly inspected and calibrated, including electronic scales, digital calipers, steel rulers, etc.",
    },
    {
        no: "2.2.7",
        label: "Tuân thủ quy định về sử dụng và kiểm soát các công cụ kim loại",
        subLabel: "Compliance with regulations on the use and control of metal tools.",
    },
    {
        no: "2.3",
        label: "Tuân thủ quy định đặt để hàng hóa đúng vị trí và có tem nhãn nhận diện đầy đủ",
        subLabel: "Comply with regulations on placing goods in the correct position and with full identification labels.",
        isHeader: true,
    },
    {
        no: "2.3.1",
        label: "Hàng không đạt phải được để tại khu vực riêng biệt, có tem nhận diện và ghi nhận hàng ngày.",
        subLabel: "Non-conformity goods must isolation and have identity label and record daily.",
    },
    {
        no: "2.3.2",
        label: "Nguyên liệu được để trên pallet tại khu vực quy định và có tem nhãn nhận diện rõ ràng",
        subLabel: "Raw materials are placed on pallets in designated areas and have clear identification labels.",
    },
    {
        no: "2.3.3",
        label: "Mỗi đơn hàng thành phẩm phải có giấy tờ thông tin đơn hàng và tem nhãn đầy đủ",
        subLabel: "Each finished product order must have complete order documentation and labeling.",
    },
    {
        no: "2.4",
        label: "Keo cán màng: Khả năng lưu trữ, chuẩn bị và sử dụng đúng keo trong suốt quá trình cán màng",
        subLabel: "Lamination cement: The ability to store, prepare and correct use of cement during lamination process.",
        isHeader: true,
    },
    {
        no: "2.4.1",
        label: "Keo cán màng cho vật liệu trong quy trình được xác nhận trong hướng dẫn đặc điểm kỹ thuật. MSDS có sẵn và được treo tại nơi làm việc.",
        subLabel: "Lamination cement for materials had been in process confirmed in the specification manual, MSDS is being available and posted.",
    },
    {
        no: "2.4.2",
        label: "Keo trên bồn tối thiểu đủ để phủ toàn bộ vật liệu trong quá trính cán màng.",
        subLabel: "Level of lamination cement on the hoofer minimum enough to cover the whole surface of material during lamination process.",
    },
    {
        no: "2.4.3",
        label: "Có công cụ điều chỉnh kiểm soát độ dày của keo được áp dụng ở phía trên trục keo",
        subLabel: "A tool for adjusting and controlling glue thickness is applied above the glue roller.",
    },
    {
        no: "2.4.4",
        label: "Keo trải đều trên bề mặt vật liệu bao phủ toàn bộ khu vực trong suốt quá trình cán màng.",
        subLabel: "Cenment evenly spread on the surface of upper materials covering the whole area during lamination process.",
    },
];

export default function MQAAPatrolEntry() {
    const { section } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const [headerData, setHeaderData] = useState({
        auditor: "",
        auditorId: "",
        date: new Date().toISOString().split("T")[0],
    });

    // Initialize rows state
    const [rows, setRows] = useState(() => {
        return LAMINATION_CRITERIA.map((item) => ({
            ...item,
            score: item.isHeader ? 0 : 6,
            level: item.isHeader ? 0 : 6,
            imageFile: null,
            imageUrl: "",
            description: "",
        }));
    });

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
                    0.7
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
                    score: r.score,
                    level: r.level,
                    image_url: r.imageUrl,
                    description: r.description
                })),
            };

            const { error } = await supabase.from("mqaa_patrol_logs").insert([payload]);
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
                    PHIẾU ĐÁNH GIÁ MQAA - SECTION {section?.replace("_", " ")}
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-gray-50 p-6 rounded-lg border">
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700">Auditor:</label>
                    <input
                        type="text"
                        className="p-2 border rounded shadow-sm focus:ring-2 focus:ring-indigo-500"
                        value={headerData.auditor}
                        onChange={(e) => setHeaderData({ ...headerData, auditor: e.target.value })}
                        placeholder="Nhập tên người đánh giá"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="font-semibold text-gray-700">ID:</label>
                    <input
                        type="text"
                        className="p-2 border rounded shadow-sm focus:ring-2 focus:ring-indigo-500"
                        value={headerData.auditorId}
                        onChange={(e) => setHeaderData({ ...headerData, auditorId: e.target.value })}
                        placeholder="Mã số nhân viên"
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
                            <th className="border p-2 w-20 text-center">Score</th>
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
                                            className="w-full text-center p-1 border rounded"
                                            value={row.score}
                                            onChange={(e) => handleRowChange(idx, "score", e.target.value)}
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
                    {loading ? "ĐANG LƯU..." : "LƯU ĐÁNH GIÁ"}
                </button>
            </div>

            <div className="mt-8 pt-4 border-t text-center">
                <p className="text-xl font-bold text-indigo-900">Overall MQAA Performance (2): {totals.performance}%</p>
            </div>
        </div>
    );
}
