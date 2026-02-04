
import { supabase } from "./src/lib/supabaseClient.js";

async function checkTable() {
    const { data, error } = await supabase.from('kpi_compliance_rules').select('*').limit(1);
    if (error) {
        console.log("Table 'kpi_compliance_rules' does not exist or error:", error.message);
    } else {
        console.log("Table 'kpi_compliance_rules' exists. Data:", data);
    }
}
checkTable();
