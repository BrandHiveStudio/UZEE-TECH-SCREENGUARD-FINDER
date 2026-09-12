import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Reusing the existing publishable anon key already committed in this repo's
// migration scripts (scripts/supabase_migration_and_qa.mjs) — not read from .env.local.
const SUPABASE_URL = "https://alqdlwwccejxykulolhh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_amEQhxzFogq16u4U4bbNng_cy1447k3";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  const { data: boxes, error } = await supabase
    .from("boxes")
    .select(`
      id, box_number, display_size, title, raw_text, category, notes, source, verification,
      models ( model_name )
    `)
    .order("id", { ascending: true });

  if (error) {
    console.error("BACKUP_FAILED:", error.message);
    process.exit(1);
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `src/data/pre_263qa_import_backup_${ts}.json`;
  fs.writeFileSync(
    filename,
    JSON.stringify({ timestamp: new Date().toISOString(), count: boxes.length, data: boxes }, null, 2),
    "utf-8"
  );

  let totalRel = 0;
  const uniqueModels = new Set();
  const modelGroups = {};
  boxes.forEach((b) => {
    const ms = Array.isArray(b.models) ? b.models.map((m) => m.model_name) : [];
    totalRel += ms.length;
    ms.forEach((m) => {
      const key = m.trim().toUpperCase();
      uniqueModels.add(key);
      modelGroups[key] = modelGroups[key] || new Set();
      modelGroups[key].add(b.id);
    });
  });
  const multiGroup = Object.values(modelGroups).filter((s) => s.size > 1).length;

  console.log("BACKUP_FILE:", filename);
  console.log("CURRENT_LIVE_GROUPS:", boxes.length);
  console.log("CURRENT_LIVE_RELATIONSHIPS:", totalRel);
  console.log("CURRENT_LIVE_UNIQUE_MODELS:", uniqueModels.size);
  console.log("CURRENT_LIVE_MULTI_GROUP_MODELS:", multiGroup);

  const displayFilled = boxes.filter((b) => b.display_size && b.display_size !== "Unknown").length;
  console.log("CURRENT_LIVE_DISPLAY_SIZE_FILLED:", displayFilled);
  console.log("CURRENT_LIVE_DISPLAY_SIZE_UNKNOWN:", boxes.length - displayFilled);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
