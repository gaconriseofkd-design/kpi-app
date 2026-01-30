// src/pages/ViewRulesQuality.jsx
import React, { useState } from 'react';

// 1. DATA CHO DEFAULT (LEANLINE DC / MOLDING / PREFITTING / BÀO / TÁCH)
const DEFAULT_Q_RULES = [
  { label: "0 đôi", score: 10, note: "Không có phế" },
  { label: "Từ 0.5 đến 2 đôi", score: 8, note: "Tối đa 2 phế" },
  { label: "Từ 2.5 đến 4 đôi", score: 6, note: "Tối đa 4 phế" },
  { label: "Từ 4.5 đến 6 đôi", score: 4, note: "Tối đa 6 phế" },
  { label: "Trên 6 đôi", score: 0, note: "Nhiều hơn 6 phế" },
];

export default function ViewRulesQuality() {
  const [activeTab, setActiveTab] = useState("DEFAULT");

  return (
    <div className="p-4 sm:p-6 bg-white rounded-lg shadow-sm">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Quy tắc tính điểm Chất lượng & Tuân thủ
      </h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b pb-2 overflow-x-auto">
        <TabButton label="Mặc định (DC/Molding...)" active={activeTab === "DEFAULT"} onClick={() => setActiveTab("DEFAULT")} />
        <TabButton label="Leanline Molded" active={activeTab === "MOLDED"} onClick={() => setActiveTab("MOLDED")} />
        <TabButton label="Lamination" active={activeTab === "LAMINATION"} onClick={() => setActiveTab("LAMINATION")} />
      </div>

      {/* Content */}
      <div className="min-h-[300px]">
        {activeTab === "DEFAULT" && <DefaultRules />}
        {activeTab === "MOLDED" && <MoldedRules />}
        {activeTab === "LAMINATION" && <LaminationRules />}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${active
          ? "bg-blue-600 text-white shadow"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
    >
      {label}
    </button>
  );
}

// --- 1. DEFAULT RULES ---
function DefaultRules() {
  return (
    <div>
      <h3 className="text-lg font-bold text-blue-700 mb-2">Bảng điểm Chất lượng (Q-Score) chung</h3>
      <p className="text-sm text-gray-500 mb-4">Áp dụng cho: Leanline DC, Molding, Prefitting, Bào, Tách...</p>

      <div className="overflow-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="p-3 text-left border-r">Số lượng Phế</th>
              <th className="p-3 text-left border-r">Điểm Q</th>
              <th className="p-3 text-left">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {DEFAULT_Q_RULES.map((r, i) => (
              <tr key={i} className="border-b last:border-b-0 hover:bg-blue-50">
                <td className="p-3 border-r">{r.label}</td>
                <td className="p-3 border-r font-bold text-blue-600">{r.score}</td>
                <td className="p-3 text-gray-500">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- 2. LEANLINE MOLDED RULES ---
function MoldedRules() {
  return (
    <div className="space-y-6">
      <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
        <h3 className="font-bold text-blue-800 mb-2">1. Logic tính điểm cơ bản</h3>
        <p className="text-sm">Điểm bắt đầu: <b>10 điểm</b>.</p>
        <p className="text-sm">Các lỗi sẽ bị trừ điểm theo mức độ nghiêm trọng.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <h4 className="font-bold text-red-600 mb-3 border-b pb-1">Các lỗi Trừ điểm Nặng</h4>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li>
              <b>Phàn nàn Khách hàng:</b>
              <span className="block font-bold text-red-700 ml-2">→ Trừ 8 điểm (Còn 2 điểm)</span>
            </li>
            <li>
              <b>Vi phạm Tuân thủ khác...:</b>
              <span className="block font-bold text-red-700 ml-2">→ Trừ 2 điểm</span>
            </li>
            <li>
              <b>Lỗi Nghiêm trọng (Nhóm A):</b>
              <p className="text-xs text-gray-500">(Sai Tech, In sai Logo/Phân đoạn, Sai Dao...)</p>
              <ul className="list-circle pl-5 mt-1 text-gray-700">
                <li>1 đôi: <b>Còn 4 điểm</b></li>
                <li>≥ 2 đôi: <b>0 điểm</b></li>
              </ul>
            </li>
          </ul>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-bold text-orange-600 mb-3 border-b pb-1">Các lỗi Thường (Nhóm B)</h4>
          <p className="text-xs text-gray-500 mb-2">(Đóng gói sai/thiếu, Dán nhầm tem, Lỗi in/đóng gói khác...)</p>
          <p className="text-sm mb-2">Trừ điểm trực tiếp dựa trên số lượng vi phạm:</p>
          <div className="bg-orange-50 p-2 rounded text-sm font-medium">
            Điểm trừ = (Số đôi làm tròn lên chẵn)
          </div>
          <p className="text-xs mt-2 italic text-gray-500">Ví dụ: 1 đôi - tính 2 đôi (trừ 2đ), 3 đôi - tính 4 đôi (trừ 4đ)...</p>
        </div>
      </div>
    </div>
  );
}

// --- 3. LAMINATION RULES ---
function LaminationRules() {
  return (
    <div className="space-y-6">
      {/* Q-Score */}
      <div className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
        <h3 className="font-bold text-orange-800 mb-3 border-b border-orange-300 pb-2">1. Điểm Chất lượng (Q - Max 5)</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-sm mb-2">Hàng Fail Bonding / Dry:</h4>
            <p className="text-red-600 font-bold bg-white p-2 border rounded inline-block">0 điểm</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-2">Hàng Phế (Scrap):</h4>
            <table className="w-full text-sm bg-white border">
              <thead><tr className="bg-gray-100"><th className="p-2 border">Số đôi</th><th className="p-2 border">Điểm</th></tr></thead>
              <tbody>
                <tr><td className="p-2 border">0 - 1 đôi</td><td className="p-2 border font-bold">5</td></tr>
                <tr><td className="p-2 border">2 - 3 đôi</td><td className="p-2 border font-bold">4</td></tr>
                <tr><td className="p-2 border">4 - 5 đôi</td><td className="p-2 border font-bold">2</td></tr>
                <tr><td className="p-2 border">&gt; 5 đôi</td><td className="p-2 border font-bold text-red-600">0</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* C-Score */}
      <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
        <h3 className="font-bold text-green-800 mb-3 border-b border-green-300 pb-2">2. Điểm Tuân thủ (C - Max 3)</h3>
        <ul className="list-disc pl-5 space-y-2 text-sm">
          <li>Điểm khởi đầu: <b className="text-green-700">3 điểm</b>.</li>
          <li>Mỗi lỗi vi phạm: <b className="text-red-600">Trừ 1 điểm</b>.</li>
          <li>Giới hạn: <b>Không trừ quá hết điểm (Tối thiểu 0)</b>.</li>
          <li>
            Logic đặc biệt: <span className="italic text-gray-600">"Vi phạm khác"</span> sẽ không bị trừ điểm.
          </li>
        </ul>
      </div>

      <div className="text-center text-sm font-bold text-gray-500 mt-4 border-t pt-2">
        Tổng điểm KPI Lamination = P (Max 7) + Q (Max 5) + C (Max 3) = 15 điểm
      </div>
    </div>
  );
}