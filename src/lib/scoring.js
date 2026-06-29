// src/lib/scoring.js

/** rules: mảng [{threshold:number, score:number, active:boolean}], sort desc theo threshold */
export function scoreByProductivity(oe, rules) {
  const val = Number(oe ?? 0);
  const list = (rules || [])
    .filter(r => r.active !== false)
    .sort((a, b) => Number(b.threshold) - Number(a.threshold));
  for (const r of list) {
    if (val >= Number(r.threshold)) return Number(r.score || 0);
  }
  return 0;
}

export function scoreByQuality(defects) {
  // giữ tạm cách cũ; sau này bạn thích cũng tách rule tương tự như productivity
  const d = Number(defects || 0);
  if (d === 0) return 10;
  if (d <= 2) return 8;
  if (d <= 4) return 6;
  if (d <= 6) return 4;
  return 0;
}

export function deriveDayScores({ oe, defects }, rules) {
  const p = scoreByProductivity(oe, rules);
  const q = scoreByQuality(defects);
  const total = p + q;
  return {
    p_score: p,
    q_score: q,
    day_score: Math.min(15, total),
    overflow: Math.max(0, total - 15),
  };
}

/* --- NEW SCORING LOGIC (Update) --- */

/**
 * Leanline / Prefitting / Tach / Bao Quality Score
 * Max 5 points.
 * 0-1: 5 | 1.5-2: 4 | 2.5-3: 3 | 3.5-4: 2 | 4.5-5: 1 | >5: 0
 */
export function scoreByQualityLeanline(defects) {
  const d = Number(defects || 0);
  if (d <= 1) return 5;
  if (d <= 2) return 4;
  if (d <= 3) return 3;
  if (d <= 4) return 2;
  if (d <= 5) return 1;
  return 0;
}

/**
 * Molding Quality Score
 * Max 5 points.
 * 0-1: 5 | 1.5-2: 4 | 2.5-3: 3 | 3.5-4: 2 | 4.5-5: 1 | >5: 0
 */
export function scoreByQualityMolding(defects) {
  const d = Number(defects || 0);
  if (d <= 1) return 5;
  if (d <= 2) return 4;
  if (d <= 3) return 3;
  if (d <= 4) return 2;
  if (d <= 5) return 1;
  return 0;
}

/**
 * Compliance Score (Generic)
 * Max 3 points.
 * Score = Max(0, 3 - penalty)
 */
export function scoreByCompliance(penalty) {
  return Math.max(0, 3 - Number(penalty || 0));
}

/**
 * Leanline Compliance Penalty Logic
 * Lỗi nghiêm trọng: Trừ 3 | Lỗi thường: Trừ 1
 */
export function getLeanlineCompliancePenalty(code) {
  const severe = [
    "Không có/không có mẫu đầu chuyền",
    "No first sample of the production line (Không có mẫu đầu chuyền)",
    "Không thực hiện checklist trước khi làm việc",
    "No checklist performed before work (Không có checklist tại nơi làm việc)",
    "Không thực hiện checklist dò kim",
    "Không thực hiện checklist dò kim loại",
    "No metal detection checklist performed (Không thực hiện checklist dò kim loại)",
    "Không có mộc dò kim",
    "Không có mộc dò kim loại",
    "No metal detector stamp (Không có mộc dò kim loại)",
    "Dao chặt không có thông tin",
    "Cutting last without information (Dao chặt không có thông tin)",
    "Không tuân thủ/không đo nhiệt độ tiêu chuẩn máy",
    "Không tuân thủ đo nhiệt độ máy in logo theo tiêu chuẩn",
    "Failure to comply with/measure logo machine temperature standards (Không tuân thủ đo nhiệt độ máy in logo theo tiêu chuẩn)",
    "Không sử dụng bảo hộ lao động, chắn lối thoát hiểm",
    "Safety violations (Vi phạm an toàn)",
    "Production process violations (Vi phạm quy trình sản xuất)",
    "Asset/material management violations (Vi phạm quản lý tài sản/nguyên vật liệu)"
  ];
  if (code === "NONE") return 0;
  if (severe.includes(code)) return 3;
  return 1; // Lỗi thường
}

/**
 * Molding Compliance Penalty Logic
 * Lỗi nghiêm trọng: Trừ 3 | Lỗi thường: Trừ 1
 */
export function getMoldingCompliancePenalty(code) {
  const severe = [
    "Không kiểm soát nhiệt độ theo quy định",
    "Failure to control temperature as required (Vi phạm kiểm soát nhiệt độ theo quy định)",
    "Safety violations (Vi phạm an toàn)",
    "Production process violations (Vi phạm quy trình sản xuất)",
    "Asset/material management violations (Vi phạm quản lý tài sản/nguyên vật liệu)"
  ];
  if (code === "NONE") return 0;
  if (severe.includes(code)) return 3;
  return 1; // Lỗi thường
}

/**
 * Lamination / Prefitting / Tách / Bào Compliance Penalty Logic
 * Lỗi nghiêm trọng: Trừ 3 | Lỗi thường: Trừ 1
 */
export function getLaminationCompliancePenalty(code) {
  const severe = [
    "Rework (Fail test Dry) (Rớt hạng mục test Khô)",
    "Saw cutting not according to the required specifications. (Cắt không theo điều kiện tiêu chuẩn)",
    "Safety violations (Vi phạm an toàn)",
    "Production process violations (Vi phạm quy trình sản xuất)",
    "Asset/material management violations (Vi phạm quản lý tài sản/nguyên vật liệu)"
  ];
  if (code === "NONE") return 0;
  if (severe.includes(code)) return 3;
  return 1; // Lỗi thường
}


