import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Reuses the existing publishable anon key already committed in this repo's
// migration scripts (scripts/supabase_migration_and_qa.mjs) — not read from .env.local.
const SUPABASE_URL = "https://alqdlwwccejxykulolhh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_amEQhxzFogq16u4U4bbNng_cy1447k3";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 70 display-size updates derived from UZEE_TECH_SUPER_D_MASTER_263_WITH_DISPLAY_SIZE_QA.xlsx
// (sheet MASTER_263), diffed against current data. Only rows currently "Unknown" are touched.
const updates = JSON.parse(fs.readFileSync(new URL("./display_size_updates.json", import.meta.url)));

async function main() {
  console.log(`Loaded ${updates.length} display-size updates to apply.`);

  // 1. Backup current state first
  const { data: before, error: beforeErr } = await supabase
    .from("boxes")
    .select(`id, box_number, display_size, title, raw_text, models ( model_name )`)
    .order("id", { ascending: true });

  if (beforeErr) {
    console.error("❌ Backup query failed, aborting (no changes made):", beforeErr.message);
    process.exit(1);
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = `src/data/pre_263qa_display_size_update_backup_${ts}.json`;
  fs.writeFileSync(backupFile, JSON.stringify({ timestamp: new Date().toISOString(), count: before.length, data: before }, null, 2), "utf-8");
  console.log(`✅ Backup written: ${backupFile} (${before.length} groups)`);

  if (before.length !== 263) {
    console.error(`❌ Expected 263 groups before update, found ${before.length}. Aborting to avoid acting on unexpected state.`);
    process.exit(1);
  }

  // 2. Apply updates one at a time, only where display_size is still 'Unknown' (idempotent + safe)
  let applied = 0, skipped = 0, failed = 0;
  const failures = [];

  for (const u of updates) {
    const { data, error } = await supabase
      .from("boxes")
      .update({ display_size: u.new_display_size })
      .eq("id", u.gid)
      .eq("display_size", "Unknown")
      .select("id, display_size");

    if (error) {
      failed++;
      failures.push({ gid: u.gid, error: error.message });
      console.error(`❌ ${u.gid} update failed:`, error.message);
    } else if (!data || data.length === 0) {
      skipped++;
      console.warn(`⚠️  ${u.gid} skipped (display_size was not 'Unknown' at update time — no overwrite performed)`);
    } else {
      applied++;
      console.log(`✅ ${u.gid}: Unknown -> ${u.new_display_size}`);
    }
  }

  console.log(`\nApplied: ${applied}, Skipped (already set): ${skipped}, Failed: ${failed}`);
  if (failed > 0) {
    console.error("Some updates failed:", JSON.stringify(failures, null, 2));
  }

  // 3. Post-update verification
  const { data: after, error: afterErr } = await supabase
    .from("boxes")
    .select(`id, box_number, display_size, models ( model_name )`)
    .order("id", { ascending: true });

  if (afterErr) {
    console.error("❌ Post-update verification query failed:", afterErr.message);
    process.exit(1);
  }

  let totalRel = 0;
  const uniqueModels = new Set();
  const modelGroups = {};
  after.forEach((b) => {
    const ms = Array.isArray(b.models) ? b.models.map((m) => m.model_name) : [];
    totalRel += ms.length;
    ms.forEach((m) => {
      const k = m.trim().toUpperCase();
      uniqueModels.add(k);
      modelGroups[k] = modelGroups[k] || new Set();
      modelGroups[k].add(b.id);
    });
  });
  const multiGroup = Object.values(modelGroups).filter((s) => s.size > 1).length;
  const filled = after.filter((b) => b.display_size && b.display_size !== "Unknown").length;

  console.log("\n=== POST-UPDATE VERIFICATION ===");
  console.log("Total groups:", after.length, "(expected 263)");
  console.log("Total relationships:", totalRel, "(expected 1617)");
  console.log("Unique models:", uniqueModels.size, "(expected 1591)");
  console.log("Multi-group models:", multiGroup, "(expected 23)");
  console.log("Groups with display size filled:", filled, "(expected 140 = 70 previous + 70 new)");

  // Box numbers must be unchanged vs backup
  const beforeMap = Object.fromEntries(before.map((b) => [b.id, b.box_number]));
  const boxNumberChanges = after.filter((b) => beforeMap[b.id] !== b.box_number);
  console.log("Box numbers changed (expected 0):", boxNumberChanges.length);
  if (boxNumberChanges.length > 0) {
    console.error("⚠️ Unexpected box_number changes:", JSON.stringify(boxNumberChanges, null, 2));
  }
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
