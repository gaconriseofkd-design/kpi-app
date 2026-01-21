// src/pages/MQAAEntry.jsx
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function MQAAEntry() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    line: "",
    worker_id: "",
    worker_name: "",
    leader_name: "",
    issue_type: "Tuân thủ",
    description: "",
    image: null,
  });
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Auto-fetch worker & leader info when worker_id changes
  useEffect(() => {
    const fetchWorkerInfo = async () => {
      if (formData.worker_id.length >= 4) {
        const { data, error } = await supabase
          .from("users")
          .select("full_name, approver_name")
          .eq("msnv", formData.worker_id)
          .single();

        if (data) {
          setFormData((prev) => ({
            ...prev,
            worker_name: data.full_name,
            leader_name: data.approver_name || "",
          }));
        }
      }
    };

    const timer = setTimeout(fetchWorkerInfo, 500);
    return () => clearTimeout(timer);
  }, [formData.worker_id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, image: file }));
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      let image_url = "";

      // 1. Upload image if exists
      if (formData.image) {
        const fileExt = formData.image.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("mqaa-images")
          .upload(fileName, formData.image);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("mqaa-images")
          .getPublicUrl(fileName);
        
        image_url = publicUrlData.publicUrl;
      }

      // 2. Insert record into mqaa_logs
      const { error: insertError } = await supabase.from("mqaa_logs").insert([
        {
          date: formData.date,
          line: formData.line,
          worker_id: formData.worker_id,
          worker_name: formData.worker_name,
          leader_name: formData.leader_name,
          issue_type: formData.issue_type,
          description: formData.description,
          image_url,
        },
      ]);

      if (insertError) throw insertError;

      setMessage({ type: "success", text: "Đã lưu bản ghi MQAA thành công!" });
      // Reset form (keep date and line for convenience)
      setFormData((prev) => ({
        ...prev,
        worker_id: "",
        worker_name: "",
        leader_name: "",
        description: "",
        image: null,
      }));
      setPreview(null);
    } catch (error) {
      console.error("Error saving MQAA:", error);
      setMessage({ type: "error", text: "Lỗi: " + error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 bg-white shadow-lg rounded-xl mt-6">
      <h2 className="text-2xl font-bold text-indigo-800 mb-6 border-b pb-2">MQAA - Ghi nhận Bất thường</h2>
      
      {message.text && (
        <div className={`p-3 mb-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Ngày</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Line/Vị trí</label>
            <input
              type="text"
              name="line"
              value={formData.line}
              onChange={handleInputChange}
              placeholder="Vd: D1A, M3..."
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">MSNV Vi phạm</label>
            <input
              type="text"
              name="worker_id"
              value={formData.worker_id}
              onChange={handleInputChange}
              placeholder="Nhập mã nhân viên"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Họ tên (Tự động)</label>
            <input
              type="text"
              name="worker_name"
              value={formData.worker_name}
              readOnly
              className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600 outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Tên Leader (Tự động)</label>
          <input
            type="text"
            name="leader_name"
            value={formData.leader_name}
            readOnly
            className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600 outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Loại vấn đề</label>
          <select
            name="issue_type"
            value={formData.issue_type}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="Tuân thủ">Tuân thủ</option>
            <option value="Chất lượng">Chất lượng</option>
            <option value="Bất thường">Bất thường</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Mô tả chi tiết</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows="3"
            placeholder="Mô tả sự việc..."
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          ></textarea>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 block">Hình ảnh bằng chứng</label>
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-4 bg-gray-50 hover:bg-gray-100 transition cursor-pointer relative">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {preview ? (
              <img src={preview} alt="Preview" className="max-h-48 rounded-lg shadow-md" />
            ) : (
              <div className="text-center text-gray-500">
                <p className="text-lg">📷 Chụp ảnh hoặc Chọn file</p>
                <p className="text-xs">Hỗ trợ mở camera trên điện thoại</p>
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 px-4 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-700 transition duration-200 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {loading ? "Đang xử lý..." : "GỬI BÁO CÁO MQAA"}
        </button>
      </form>
    </div>
  );
}
