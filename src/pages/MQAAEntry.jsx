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
    issue_type: "Tuân thủ", // This was changed to image_types in the instruction, but keeping issue_type as it's used in the select and insert.
    description: "",
    images: [], // Changed from image: null
  });
  const [previews, setPreviews] = useState([]); // Changed from preview: null
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
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setFormData((prev) => ({ ...prev, images: [...prev.images, ...files] }));
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Image compression helper
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
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

          // Convert to blob (JPG, quality 0.7 to 0.8)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                // Return a new File object
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error("Canvas toBlob failed"));
              }
            },
            "image/jpeg",
            0.75
          );
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      let image_urls = [];

      // 1. Upload all images
      if (formData.images.length > 0) {
        for (const file of formData.images) {
          const compressedFile = await compressImage(file);
          const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("mqaa-images")
            .upload(fileName, compressedFile);

          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase.storage
            .from("mqaa-images")
            .getPublicUrl(fileName);

          image_urls.push(publicUrlData.publicUrl);
        }
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
          image_url: image_urls, // Now sending an array
        },
      ]);

      if (insertError) throw insertError;

      setMessage({ type: "success", text: `Đã lưu thành công với ${image_urls.length} hình ảnh!` });
      // Reset form (keep date and line for convenience)
      setFormData((prev) => ({
        ...prev,
        worker_id: "",
        worker_name: "",
        leader_name: "",
        description: "",
        images: [],
      }));
      setPreviews([]);
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
          <label className="text-sm font-semibold text-gray-700 block">Hình ảnh bằng chứng (Có thể chọn nhiều)</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            {previews.map((src, index) => (
              <div key={index} className="relative group aspect-square">
                <img src={src} alt={`Preview ${index}`} className="w-full h-full object-cover rounded-lg shadow-sm border" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md"
                >
                  ×
                </button>
              </div>
            ))}
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl aspect-square bg-gray-50 hover:bg-gray-100 transition cursor-pointer relative">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="text-center text-gray-400">
                <p className="text-2xl mt-[-4px]">+</p>
                <p className="text-[10px]">Thêm ảnh</p>
              </div>
            </label>
          </div>
          <p className="text-xs text-gray-400">Hỗ trợ chụp nhiều ảnh bằng camera hoặc chọn từ thư viện.</p>
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
