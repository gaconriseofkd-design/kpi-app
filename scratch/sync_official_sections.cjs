const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://doyipagavbxupiwbitgi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const officialSections = [
  { id: "Raw Material & FGs Warehouse", name: "RAW MATERIAL & FGS WAREHOUSE", sort_order: 10 },
  { id: "Lamination", name: "LAMINATION", sort_order: 20 },
  { id: "Saw Cutting (Pre-fitting)", name: "SAW CUTTING (PRE-FITTING)", sort_order: 30 },
  { id: "Moulding (Hot-Press)", name: "MOULDING (HOT-PRESS)", sort_order: 40 },
  { id: "Lean line DC", name: "LEAN LINE DC", sort_order: 50 },
  { id: "Lean line Molded", name: "LEAN LINE MOLDED", sort_order: 60 },
  { id: "Logo WIP Inventory Management", name: "LOGO WIP INVENTORY MANAGEMENT", sort_order: 70 },
  { id: "Cutting Die and Board Managemen", name: "CUTTING DIE & BOARD MANAGEMENT", sort_order: 80 },
  { id: "Laboratory", name: "LABORATORY", sort_order: 90 },
];

async function syncSections() {
  for (const sec of officialSections) {
    const { error } = await supabase.from('mqaa_patrol_sections').upsert(sec, { onConflict: 'id' });
    if (error) console.error("Error upserting section:", sec.id, error);
    else console.log("Synced section:", sec.id);
  }
}

syncSections();
