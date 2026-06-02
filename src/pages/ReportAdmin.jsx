import React, { useState, useEffect } from 'react';
import { supabase } from "../lib/supabaseClient";

export default function ReportAdmin() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [isReportEnabled, setIsReportEnabled] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState('');

  // Xử lý đăng nhập
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'Deplao.1305') {
      setIsAuthenticated(true);
      fetchSettings();
    } else {
      alert('Sai mật khẩu!');
    }
  };

  // Lấy trạng thái Bật/Tắt từ Supabase
  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('is_report_enabled')
      .eq('id', 1)
      .single();
      
    if (data) {
      setIsReportEnabled(data.is_report_enabled);
    }
  };

  // Cập nhật trạng thái Bật/Tắt
  const toggleReportStatus = async () => {
    const newValue = !isReportEnabled;
    const { error } = await supabase
      .from('system_settings')
      .upsert({ id: 1, is_report_enabled: newValue });
      
    if (!error) {
      setIsReportEnabled(newValue);
      showMessage(`Đã ${newValue ? 'BẬT' : 'TẮT'} báo cáo tự động thành công!`);
    } else {
      showMessage('Lỗi khi cập nhật cài đặt', true);
    }
  };

  // Gửi yêu cầu báo cáo vào queue
  const requestSendReport = async () => {
    setIsSending(true);
    const { error } = await supabase
      .from('report_requests')
      .insert([
        { report_type: 'daily_report', status: 'pending' }
      ]);
      
    if (!error) {
      showMessage('Đã gửi lệnh xuất báo cáo! Hệ thống máy chủ đang xử lý...');
    } else {
      showMessage('Lỗi khi gửi lệnh báo cáo: ' + error.message, true);
    }
    setIsSending(false);
  };

  const showMessage = (msg, isError = false) => {
    setMessage({ text: msg, isError });
    setTimeout(() => setMessage(null), 5000);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="bg-white p-8 rounded-lg shadow-md border w-full max-w-sm">
          <h2 className="text-2xl font-bold text-center text-indigo-700 mb-6">Quản Trị Báo Cáo</h2>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input 
              type="password" 
              placeholder="Nhập mật khẩu..." 
              className="px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded transition">
              Đăng Nhập
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-indigo-800 mb-8 border-b pb-4">Bảng Điều Khiển Báo Cáo</h1>
      
      {message && (
        <div className={`p-4 mb-6 rounded-md font-medium ${message.isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message.text}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        
        {/* Module 1: Bật/Tắt báo cáo tự động */}
        <div className="bg-white rounded-lg shadow border p-6 flex flex-col items-center text-center">
          <div className="text-5xl mb-4">
            {isReportEnabled ? '⏱️' : '⏸️'}
          </div>
          <h2 className="text-xl font-semibold mb-2">Báo Cáo Tự Động (Lịch)</h2>
          <p className="text-gray-500 text-sm mb-6 h-10">
            Trạng thái hiện tại: 
            <span className={`ml-1 font-bold ${isReportEnabled ? 'text-green-600' : 'text-red-500'}`}>
              {isReportEnabled ? 'ĐANG BẬT' : 'ĐÃ TẮT'}
            </span>
          </p>
          <button 
            onClick={toggleReportStatus}
            className={`mt-auto px-6 py-2 w-full font-bold rounded text-white shadow transition-colors ${isReportEnabled ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
          >
            {isReportEnabled ? 'TẮT BÁO CÁO' : 'BẬT LẠI BÁO CÁO'}
          </button>
        </div>

        {/* Module 2: Gửi báo cáo tùy chọn */}
        <div className="bg-white rounded-lg shadow border p-6 flex flex-col items-center text-center">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-xl font-semibold mb-2">Gửi Báo Cáo Ngay Lập Tức</h2>
          <p className="text-gray-500 text-sm mb-6 h-10">
            Kích hoạt gửi báo cáo vào nhóm Zalo ngay bây giờ (bỏ qua lịch trình).
          </p>
          <button 
            onClick={requestSendReport}
            disabled={isSending}
            className="mt-auto px-6 py-2 w-full font-bold rounded text-white bg-blue-600 hover:bg-blue-700 shadow transition-colors disabled:bg-gray-400"
          >
            {isSending ? 'ĐANG GỬI LỆNH...' : 'GỬI BÁO CÁO ZALO'}
          </button>
        </div>

      </div>
    </div>
  );
}
