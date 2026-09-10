const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://doyipagavbxupiwbitgi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixHistory() {
  console.log("Fetching logs from the last 7 days...");
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: logs, error } = await supabase
    .from('mqaa_patrol_logs')
    .select('*')
    .gte('created_at', sevenDaysAgo.toISOString());
    
  if (error) {
    console.error("Error fetching logs:", error);
    return;
  }
  
  console.log(`Found ${logs.length} logs in the last 7 days.`);
  
  let updatedCount = 0;
  
  for (const log of logs) {
    if (log.evaluation_data && Array.isArray(log.evaluation_data)) {
      let changed = false;
      let newTotalMaxScore = 0;
      let newTotalAuditScore = 0;
      
      const updatedEvalData = log.evaluation_data.map(item => {
        let maxScoreVal = item.max_score;
        let auditScoreVal = item.audit_score !== undefined ? item.audit_score : item.level;
        
        if (maxScoreVal !== "N/A") {
          // If auditScore is empty, undefined, or null (but not explicitly 0)
          if (auditScoreVal === "" || auditScoreVal === undefined || auditScoreVal === null) {
            auditScoreVal = maxScoreVal;
            changed = true;
          }
          
          newTotalMaxScore += Number(maxScoreVal) || 0;
          newTotalAuditScore += Number(auditScoreVal) || 0;
        }
        
        return {
          ...item,
          audit_score: auditScoreVal,
          level: auditScoreVal,
          score: maxScoreVal // Ensure score is sync'd too
        };
      });
      
      // If we noticed empty scores being filled, OR if the overall performance was 0 due to the old calculation bug
      if (changed || log.overall_performance === 0) {
          // It's possible the audit scores were just 'N/A' and empty, leading to 0 performance.
          // Calculate new performance
          let newPerformance = newTotalMaxScore > 0 ? Number(((newTotalAuditScore / newTotalMaxScore) * 100).toFixed(1)) : 0;
          
          if (newPerformance !== log.overall_performance || changed) {
              console.log(`Fixing log ID: ${log.id} (${log.section}) - Old Perf: ${log.overall_performance}%, New Perf: ${newPerformance}%`);
              
              const { error: updateError } = await supabase
                .from('mqaa_patrol_logs')
                .update({
                  evaluation_data: updatedEvalData,
                  overall_performance: newPerformance,
                  total_score: newTotalMaxScore,
                  total_level: newTotalAuditScore
                })
                .eq('id', log.id);
                
              if (updateError) {
                  console.error(`Failed to update log ${log.id}:`, updateError);
              } else {
                  updatedCount++;
              }
          }
      }
    }
  }
  
  console.log(`Finished fixing ${updatedCount} logs.`);
}

fixHistory();
