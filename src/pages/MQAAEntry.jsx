// src/pages/MQAAEntry.jsx
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export default function MQAAEntry() {
  const [loading, setLoading] = useState(false);

  // Logic tính Ca mặc định dựa trên giờ hiện tại
  const getDefaultShift = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) return "Ca 1";
    if (hour >= 14 && hour < 22) return "Ca 2";
    return "Ca 3";
  };

  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    line: "",
    shift: getDefaultShift(),
    leader_name: "",
    worker_id: "", // MSNV
    worker_name: "", // Họ tên
    issue_type: "Tuân thủ",
    description: "",
    images: [],
  });
  const [previews, setPreviews] = useState([]);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [password, setPassword] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [settings, setSettings] = useState({
    report_time: "08:00",
    zalo_group: "MQAA",
    image_limit: 10
  });

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("mqaa_settings").select("*").eq("id", 1).single();
      if (data) {
        setSettings({
          report_time: data.report_time,
          zalo_group: data.zalo_group,
          image_limit: data.image_limit
        });
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    const { error } = await supabase.from("mqaa_settings").update(settings).eq("id", 1);
    if (!error) {
      alert("Đã lưu cài đặt!");
      setShowSettings(false);
      setIsAuthorized(false);
      setPassword("");
    } else {
      alert("Lỗi khi lưu: " + error.message);
    }
  };

  const checkPassword = () => {
    if (password === "0364592629") {
      setIsAuthorized(true);
    } else {
      alert("Sai mật khẩu!");
    }
  };

  // Tự động tìm thông tin khi nhập MSNV (Nếu có)
  useEffect(() => {
    const fetchWorkerInfo = async () => {
      if (formData.worker_id.length >= 4) {
        const { data } = await supabase
          .from("users")
          .select("full_name, approver_name")
          .eq("msnv", formData.worker_id)
          .single();

        if (data) {
          setFormData((prev) => ({
            ...prev,
            worker_name: data.full_name,
            leader_name: data.approver_name || prev.leader_name,
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
      const remainingSlots = settings.image_limit - formData.images.length;
      if (remainingSlots <= 0) {
        alert(`Bạn chỉ được phép tải tối đa ${settings.image_limit} ảnh.`);
        return;
      }

      const filesToAdd = files.slice(0, remainingSlots);
      if (files.length > remainingSlots) {
        alert(`Chỉ có thể thêm ${remainingSlots} ảnh do giới hạn ${settings.image_limit} ảnh.`);
      }

      setFormData((prev) => ({ ...prev, images: [...prev.images, ...filesToAdd] }));
      const newPreviews = filesToAdd.map(file => URL.createObjectURL(file));
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
          shift: formData.shift,
          line: formData.line,
          leader_name: formData.leader_name,
          worker_id: formData.worker_id || null,
          worker_name: formData.worker_name || null,
          issue_type: formData.issue_type,
          description: formData.description,
          image_url: image_urls,
        },
      ]);

      if (insertError) throw insertError;

      setMessage({ type: "success", text: `Đã lưu thành công với ${image_urls.length} hình ảnh!` });
      // Reset form (keep date, shift and line for convenience)
      setFormData((prev) => ({
        ...prev,
        leader_name: "",
        worker_id: "",
        worker_name: "",
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
    <div className="max-w-2xl mx-auto p-4 sm:p-6 bg-white shadow-lg rounded-xl mt-6 relative">
      <div className="flex justify-between items-center mb-6 border-b pb-2">
        <h2 className="text-2xl font-bold text-indigo-800">MQAA - Ghi nhận Bất thường</h2>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 text-gray-400 hover:text-indigo-600 transition"
          title="Cài đặt hệ thống"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            {!isAuthorized ? (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800">Xác thực Admin</h3>
                <input
                  type="password"
                  placeholder="Nhập mã pin..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <button onClick={checkPassword} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold">OK</button>
                  <button onClick={() => setShowSettings(false)} className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold">Hủy</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800">Cài đặt Hệ thống</h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-600">Thời điểm báo cáo (Giờ:Phút)</label>
                    <input
                      type="time"
                      value={settings.report_time}
                      onChange={(e) => setSettings({ ...settings, report_time: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-600">Tên nhóm Zalo</label>
                    <input
                      type="text"
                      value={settings.zalo_group}
                      onChange={(e) => setSettings({ ...settings, zalo_group: e.target.value })}
                      placeholder="Tên chính xác của nhóm"
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-600">Giới hạn số ảnh / 1 lần</label>
                    <input
                      type="number"
                      value={settings.image_limit}
                      onChange={(e) => setSettings({ ...settings, image_limit: parseInt(e.target.value) })}
                      className="w-full p-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleSaveSettings} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold">Lưu</button>
                  <button onClick={() => { setShowSettings(false); setIsAuthorized(false); setPassword(""); }} className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold">Đóng</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {message.text && (
        <div className={`p-3 mb-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Ngày vi phạm</label>
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
            <label className="text-sm font-semibold text-gray-700">Ca làm việc</label>
            <select
              name="shift"
              value={formData.shift}
              onChange={handleInputChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            >
              <option value="Ca 1">Ca 1 (06:00 - 14:00)</option>
              <option value="Ca 2">Ca 2 (14:00 - 22:00)</option>
              <option value="Ca 3">Ca 3 (22:00 - 06:00)</option>
              <option value="Ca HC">Ca HC (Hành chính)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700">Tên Leader phụ trách</label>
            <input
              type="text"
              name="leader_name"
              value={formData.leader_name}
              onChange={handleInputChange}
              placeholder="Nhập tên Leader"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 text-gray-500">MSNV Vi phạm (Nếu có)</label>
            <input
              type="text"
              name="worker_id"
              value={formData.worker_id}
              onChange={handleInputChange}
              placeholder="Không bắt buộc"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-gray-700 text-gray-500">Họ tên nhân viên (Nếu có)</label>
            <input
              type="text"
              name="worker_name"
              value={formData.worker_name}
              onChange={handleInputChange}
              placeholder="Không bắt buộc"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
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
      </form >
    </div >
  );
}
