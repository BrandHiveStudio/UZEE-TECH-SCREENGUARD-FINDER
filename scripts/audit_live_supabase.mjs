import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SUPABASE_URL = "https://alqdlwwccejxykulolhh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_amEQhxzFogq16u4U4bbNng_cy1447k3";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function audit() {
  console.log("=== LIVE SUPABASE AUDIT ===");

  const { data: boxes, error } = await supabase
    .from("boxes")
    .select(`id, box_number, display_size, title, raw_text, models ( model_name )`)
    .order("id", { ascending: true });

  if (error) {
    console.error("❌ Supabase query failed:", error.message);
    process.exit(1);
  }

  console.log(`Live Supabase total groups: ${boxes.length}`);

  let totalRelationships = 0;
  const uniqueModels = new Set();
  const modelToGroups = {};

  let filledDisplaySizes = 0;
  let unknownDisplaySizes = 0;

  for (const b of boxes) {
    const models = Array.isArray(b.models) ? b.models.map((m) => m.model_name) : [];
    totalRelationships += models.length;

    for (const m of models) {
      const key = m.trim().toUpperCase();
      uniqueModels.add(key);
      modelToGroups[key] = modelToGroups[key] || new Set();
      modelToGroups[key].add(b.id);
    }

    if (b.display_size && b.display_size !== "Unknown") {
      filledDisplaySizes++;
    } else {
      unknownDisplaySizes++;
    }
  }

  const multiGroupModelsCount = Object.values(modelToGroups).filter((s) => s.size > 1).length;

  console.log(`Model-group relationships: ${totalRelationships}`);
  console.log(`Unique models: ${uniqueModels.size}`);
  console.log(`Multi-group models: ${multiGroupModelsCount}`);
  console.log(`Groups with display_size NOT 'Unknown': ${filledDisplaySizes}`);
  console.log(`Groups with display_size STILL 'Unknown': ${unknownDisplaySizes}`);

  // Save live snapshot for python comparison
  fs.writeFileSync("scripts/live_supabase_snapshot.json", JSON.stringify(boxes, null, 2), "utf-8");
  console.log("Saved live snapshot to scripts/live_supabase_snapshot.json.");
}

audit().catch((e) => {
  console.error(e);
  process.exit(1);
});
