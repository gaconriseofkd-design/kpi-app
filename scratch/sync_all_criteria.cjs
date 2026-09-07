const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const rawJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'extracted_mqaa_new.json'), 'utf8'));

async function syncCriteria() {
  for (const sectionId of Object.keys(rawJson)) {
    const sec = rawJson[sectionId];
    console.log(`Syncing criteria for section: ${sectionId} (${sec.criteria.length} items)...`);

    // Remove existing criteria for this sectionId only
    await supabase.from('mqaa_patrol_criteria').delete().eq('section_id', sectionId);

    const rows = sec.criteria.map((c, idx) => {
      let vn = c.lines[0] || c.rawText;
      let en = c.lines.slice(1).join(' ') || '';
      if (!en && vn.includes(' / ')) {
        const parts = vn.split(' / ');
        vn = parts[0].trim();
        en = parts.slice(1).join(' / ').trim();
      }

      const isNA = c.maxScore === 'N/A' || c.maxScore === 'n/a';
      const maxScoreVal = isNA ? -1 : (Number(c.maxScore) || 4);

      return {
        section_id: sectionId,
        no: c.no ? (c.isCritical && !c.no.startsWith('*') ? `*${c.no}` : c.no) : `${idx+1}`,
        label: vn,
        sub_label: en,
        is_header: c.isCritical, // Use is_header column to flag critical items!
        max_score: maxScoreVal,
        sort_order: (idx + 1) * 10
      };
    });

    const { error } = await supabase.from('mqaa_patrol_criteria').insert(rows);
    if (error) {
      console.error(`Error syncing ${sectionId}:`, error);
    } else {
      console.log(`Synced ${rows.length} items for ${sectionId}`);
    }
  }
}

syncCriteria();
