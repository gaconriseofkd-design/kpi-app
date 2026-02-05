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
 * Lỗi 1-7: Trừ 3 | Lỗi 8-13: Trừ 1
 */
export function getLeanlineCompliancePenalty(code) {
  const severe = [
    "Không có/không có mẫu đầu chuyền",
    "Không thực hiện checklist trước khi làm việc",
    "Không thực hiện checklist dò kim",
    "Không có mộc dò kim",
    "Dao chặt không có thông tin",
    "Không tuân thủ/không đo nhiệt độ tiêu chuẩn máy",
    "Không sử dụng bảo hộ lao động, chắn lối thoát hiểm"
  ];
  if (code === "NONE") return 0;
  if (severe.includes(code)) return 3;
  return 1; // 8-13
}

/**
 * Molding Compliance Penalty Logic
 * Lỗi 1: Trừ 3 | Lỗi 2: Trừ 1
 */
export function getMoldingCompliancePenalty(code) {
  if (code === "NONE") return 0;
  if (code === "Không kiểm soát nhiệt độ theo quy định") return 3;
  return 1;
}

