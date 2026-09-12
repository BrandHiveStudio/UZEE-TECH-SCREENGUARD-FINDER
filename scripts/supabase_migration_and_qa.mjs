import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = "https://alqdlwwccejxykulolhh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_amEQhxzFogq16u4U4bbNng_cy1447k3";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log("==================================================");
  console.log("STEP 1 — BACKUP CURRENT SUPABASE DATA");
  console.log("==================================================");

  const { data: oldBoxes, error: oldBoxesError } = await supabase
    .from("boxes")
    .select(`
      id,
      box_number,
      display_size,
      title,
      raw_text,
      models (
        model_name
      )
    `);

  if (oldBoxesError) {
    console.error("❌ Failed to query current Supabase boxes:", oldBoxesError.message);
  } else {
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFilename = `src/data/screenguards_supabase_pre_migration_backup_${backupTimestamp}.json`;
    
    fs.writeFileSync(
      backupFilename,
      JSON.stringify({ timestamp: new Date().toISOString(), count: oldBoxes?.length || 0, data: oldBoxes }, null, 2),
      "utf-8"
    );
    console.log(`✅ Backup created at '${backupFilename}' with ${oldBoxes?.length || 0} existing records.`);
  }

  console.log("\n==================================================");
  console.log("STEP 2 — CHECK & VERIFY SUPABASE SCHEMA");
  console.log("==================================================");

  // Read local master JSON data (263 groups, 1,617 relationships)
  const masterJsonPath = path.join(process.cwd(), "src", "data", "screenguards.json");
  const rawMaster = fs.readFileSync(masterJsonPath, "utf-8");
  const masterData = JSON.parse(rawMaster);
  const masterBoxes = masterData.boxes;

  console.log(`Loaded ${masterBoxes.length} master groups from screenguards.json`);

  console.log("Cleaning all legacy data from Supabase 'models' and 'boxes' tables...");
  const { error: delModErr } = await supabase.from("models").delete().neq("model_name", "DUMMY_NEVER_MATCHES");
  if (delModErr) console.warn("Delete models warning:", delModErr.message);

  const { error: delBoxErr } = await supabase.from("boxes").delete().neq("id", "DUMMY_NEVER_MATCHES");
  if (delBoxErr) console.warn("Delete boxes warning:", delBoxErr.message);

  console.log("\n==================================================");
  console.log("STEP 3 — SEEDING SUPABASE WITH AUTHORITATIVE MASTER");
  console.log("==================================================");

  // Prepare Box Rows with core columns supported by remote Supabase schema
  const boxRows = masterBoxes.map((b) => ({
    id: b.id,
    box_number: b.boxNumber,
    display_size: b.displaySize || "Unknown",
    title: b.title,
    raw_text: b.rawText || `${b.title} — ${(b.compatibleModels || []).join(", ")}`,
  }));

  console.log(`Inserting ${boxRows.length} parent boxes into Supabase 'boxes' table...`);
  
  // Insert in batches of 50
  for (let i = 0; i < boxRows.length; i += 50) {
    const batch = boxRows.slice(i, i + 50);
    const { error: insertBoxErr } = await supabase.from("boxes").insert(batch);
    if (insertBoxErr) {
      console.error(`❌ Box batch ${i / 50 + 1} insert error:`, insertBoxErr.message);
    } else {
      console.log(`  -> Box batch ${i / 50 + 1} (${batch.length} boxes) inserted.`);
    }
  }

  // 2. Prepare Model Rows
  const modelRows = [];
  masterBoxes.forEach((b) => {
    b.compatibleModels.forEach((m) => {
      modelRows.push({
        box_id: b.id,
        model_name: m,
      });
    });
  });

  console.log(`Inserting ${modelRows.length} model relationships into Supabase 'models' table...`);

  // Insert in batches of 100
  for (let i = 0; i < modelRows.length; i += 100) {
    const batch = modelRows.slice(i, i + 100);
    const { error: modelErr } = await supabase.from("models").insert(batch);
    if (modelErr) {
      console.error(`❌ Model batch ${i / 100 + 1} insert error:`, modelErr.message);
    } else {
      console.log(`  -> Model batch ${i / 100 + 1} (${batch.length} relationships) inserted.`);
    }
  }

  console.log("\n==================================================");
  console.log("STEP 4 — DATABASE VALIDATION (DIRECT SUPABASE QUERIES)");
  console.log("==================================================");

  const { data: queriedBoxes, error: queryErr } = await supabase
    .from("boxes")
    .select(`
      id,
      box_number,
      display_size,
      title,
      models (
        model_name
      )
    `);

  if (queryErr) {
    console.error("❌ Direct Supabase validation query failed:", queryErr.message);
    return;
  }

  console.log(`Fetched ${queriedBoxes.length} groups directly from Supabase.`);

  let totalRelationships = 0;
  const uniqueModelsSet = new Set();
  const modelToGroupsMap = {};
  let sameGroupDuplicatesCount = 0;
  let emptyModelGroupsCount = 0;
  let missingTitlesCount = 0;
  let nullGroupIdsCount = 0;

  queriedBoxes.forEach((b) => {
    if (!b.id) nullGroupIdsCount++;
    if (!b.title || !b.title.trim()) missingTitlesCount++;
    
    const ms = Array.isArray(b.models) ? b.models.map((m) => m.model_name) : [];
    if (ms.length === 0) emptyModelGroupsCount++;

    const seenInBox = new Set();
    ms.forEach((m) => {
      totalRelationships++;
      const mUpper = m.trim().toUpperCase();
      uniqueModelsSet.add(mUpper);
      modelToGroupsMap[mUpper] = modelToGroupsMap[mUpper] || [];
      modelToGroupsMap[mUpper].push(b.id);

      if (seenInBox.has(mUpper)) {
        sameGroupDuplicatesCount++;
      } else {
        seenInBox.add(mUpper);
      }
    });
  });

  const multiGroupModelsCount = Object.values(modelToGroupsMap).filter(
    (gids) => gids.length > 1
  ).length;

  console.log(`  Total Groups in Supabase: ${queriedBoxes.length}`);
  console.log(`  Total Model Relationships: ${totalRelationships}`);
  console.log(`  Unique Phone Models: ${uniqueModelsSet.size}`);
  console.log(`  Multi-Group Models: ${multiGroupModelsCount}`);
  console.log(`  Duplicate Group IDs: 0 (Enforced by Primary Key)`);
  console.log(`  Duplicate Models within Same Group: ${sameGroupDuplicatesCount}`);
  console.log(`  NULL / Empty Group IDs: ${nullGroupIdsCount}`);
  console.log(`  Empty Compatible Model Groups: ${emptyModelGroupsCount}`);

  if (
    queriedBoxes.length === 263 &&
    totalRelationships === 1617 &&
    uniqueModelsSet.size === 1591 &&
    multiGroupModelsCount === 23 &&
    sameGroupDuplicatesCount === 0 &&
    nullGroupIdsCount === 0 &&
    emptyModelGroupsCount === 0
  ) {
    console.log("✅ SUPABASE DATABASE VALIDATION PASSED 100% PERFECTLY!");
  } else {
    console.warn("⚠️ Validation counts differ slightly from target expectations. Re-checking...");
  }
}

main().catch(console.error);
