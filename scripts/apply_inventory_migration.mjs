import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SUPABASE_URL = "https://alqdlwwccejxykulolhh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_amEQhxzFogq16u4U4bbNng_cy1447k3";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log("Checking Supabase connection and schema state...");

  // 1. Check if boxes table can be queried
  const { data: boxes, error } = await supabase.from("boxes").select("id, box_number, display_size").limit(5);
  if (error) {
    console.error("Error querying boxes:", error.message);
    process.exit(1);
  }
  console.log(`✅ Supabase query succeeded (${boxes.length} sample rows returned).`);

  // 2. Check if stock_quantity column is accessible
  const { data: stockTest, error: stockErr } = await supabase.from("boxes").select("id, stock_quantity").limit(1);
  if (stockErr) {
    console.log("⚠️ Column 'stock_quantity' not yet active on live Supabase table:", stockErr.message);
  } else {
    console.log("✅ Column 'stock_quantity' is active on live Supabase.");
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
