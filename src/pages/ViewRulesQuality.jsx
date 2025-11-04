// src/pages/ViewRulesQuality.jsx
import React from 'react';

// Đây là logic code cứng bạn đang dùng, được biểu diễn dưới dạng mảng
const HARDCODED_Q_RULES = [
  { threshold: 0, score: 10, note: "Không có phế" },
  { threshold: 2, score: 8, note: "Tối đa 2 phế" },
  { threshold: 4, score: 6, note: "Tối đa 4 phế" },
  { threshold: 6, score: 4, note: "Tối đa 6 phế" },
  { threshold: "Trên 6", score: 0, note: "Nhiều hơn 6 phế" },
];

// ----- THAY ĐỔI 1: Tạo mảng text mới cho cột "Số lượng phế" -----
// Dựa trên logic tính điểm (0.5, 1, 1.5, 2 -> 8 điểm), (2.5, 3, 3.5, 4 -> 6 điểm)
const Q_SCORE_LABELS = [
  "0 đôi",
  "Từ 0.5 đến 2 đôi",
  "Từ 2.5 đến 4 đôi",
  "Từ 4.5 đến 6 đôi",
  "Trên 6 đôi"
];
// ----------------------------------------------------------------

export default function ViewRulesQuality() {
  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-xl font-semibold mb-4">
        Quy tắc tính điểm Chất lượng (Q-Score)
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Đây là quy tắc tính điểm Q-score hiện tại đang được áp dụng trong hệ thống.
        <br/>
        (Trang này chỉ có tính chất tra cứu, không thể chỉnh sửa).
      </p>

      {/* Bảng Rule */}
      <div className="overflow-auto border rounded-lg shadow">
        <table className="min-w-[600px] w-full text-sm">
          <thead className="bg-gray-100">
            <tr className="text-left">
              <th className="p-3 font-semibold">Số lượng Phế (Đôi)</th>
              <th className="p-3 font-semibold">Điểm Q-Score</th>
              <th className="p-3 font-semibold">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {HARDCODED_Q_RULES.map((rule, idx) => (
              <tr 
                key={idx} 
                className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
              >
                {/* ----- THAY ĐỔI 2: Sử dụng mảng text mới ----- */}
                <td className="p-3">
                  {Q_SCORE_LABELS[idx] || rule.threshold}
                </td>
                {/* ------------------------------------------- */}
                
                <td className="p-3 font-semibold text-lg text-blue-600">{rule.score}</td>
                <td className="p-3 text-gray-700">{rule.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}