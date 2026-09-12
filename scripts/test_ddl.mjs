import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://alqdlwwccejxykulolhh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_amEQhxzFogq16u4U4bbNng_cy1447k3";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  console.log("Testing DDL / table creation via Supabase...");
  // Test if inventory_transactions table exists or can be queried
  const { data: tx, error: txErr } = await supabase.from("inventory_transactions").select("*").limit(1);
  if (txErr) {
    console.log("inventory_transactions query result:", txErr.message);
  } else {
    console.log("inventory_transactions table exists! Rows:", tx.length);
  }

  const { data: pl, error: plErr } = await supabase.from("purchase_list").select("*").limit(1);
  if (plErr) {
    console.log("purchase_list query result:", plErr.message);
  } else {
    console.log("purchase_list table exists! Rows:", pl.length);
  }
}

test().catch(console.error);
