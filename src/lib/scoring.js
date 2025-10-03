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
