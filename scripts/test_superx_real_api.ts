/**
 * Real API test using the actual SuperX packaging photo against /api/scan-guard
 */

import * as fs from "fs";
import * as path from "path";
import { POST } from "../src/app/api/scan-guard/route";
import { NextRequest } from "next/server";

// Load local environment variables
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

async function testSuperXPackaging() {
  console.log("==================================================================");
  console.log("TESTING ACTUAL SUPERX PACKAGING PHOTO AGAINST /api/scan-guard");
  console.log("==================================================================\n");

  const imagePath = path.resolve(process.cwd(), "tests/fixtures/superx_packaging.jpg");
  if (!fs.existsSync(imagePath)) {
    console.error("❌ Test fixture not found at:", imagePath);
    process.exit(1);
  }

  const fileBytes = fs.readFileSync(imagePath);
  console.log(`Loaded SuperX packaging photo (${fileBytes.length} bytes)`);
  const base64 = fileBytes.toString("base64");

  // Sample inventory context for matching
  const sampleInventory = [
    { box: "BOX 001", title: "iPhone 13 / 13 Pro", models: "iPhone 13, iPhone 13 Pro" },
    { box: "BOX 018", title: "Redmi Note 13 4G / 5G", models: "Redmi Note 13, Redmi Note 13 4G, Redmi Note 13 5G" },
    { box: "BOX 048", title: "Samsung Galaxy A05", models: "Samsung Galaxy A05, A055F" },
    { box: "BOX 072", title: "Samsung Galaxy A51", models: "Samsung Galaxy A51, SAM A51, OnePlus Nord" },
    { box: "BOX 085", title: "Google Pixel 8 Pro", models: "Pixel 8 Pro, Google Pixel 8 Pro" },
  ];

  const req = new NextRequest("http://localhost:3000/api/scan-guard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: base64,
      mimeType: "image/jpeg",
      inventorySummary: sampleInventory,
    }),
  });

  console.log("Invoking POST /api/scan-guard...");
  const startTime = Date.now();
  const res = await POST(req);
  const elapsedMs = Date.now() - startTime;

  console.log(`\nHTTP Status: ${res.status} ${res.statusText || ""} (completed in ${elapsedMs}ms)`);
  const json = await res.json();

  console.log("\n--- RESULT PAYLOAD ---");
  console.log(JSON.stringify(json, null, 2));

  if (!res.ok || json.success === false) {
    console.error("\n❌ Live SuperX packaging scan FAILED:", json.error || "Unknown error");
    process.exit(1);
  }

  console.log("\n==================================================================");
  console.log("✅ LIVE SUPERX PACKAGING TEST PASSED SUCCESSFULLY");
  console.log(` - Matched Box: ${json.matchedBoxNumber}`);
  console.log(` - Match Confidence: ${json.confidence}`);
  console.log(` - Detected Finish: ${json.detectedFinish}`);
  console.log(` - Extracted Models Count: ${json.extractedModels?.length || 0}`);
  console.log(` - Extracted Models: ${(json.extractedModels || []).join(", ")}`);
  console.log(` - Reasoning: ${json.data?.reasoning || json.reasoning}`);
  console.log("==================================================================");
}

testSuperXPackaging().catch((err) => {
  console.error("Test threw error:", err);
  process.exit(1);
});

