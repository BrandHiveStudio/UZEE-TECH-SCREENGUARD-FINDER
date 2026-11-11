import fs from "fs";
import path from "path";
import { matchesBox } from "../src/lib/searchNormalizer";
import type { Box } from "../src/types/screenguard";

const seedPath = path.resolve(process.cwd(), "new_screenguard_seed.json");
const rawData = fs.readFileSync(seedPath, "utf-8");
const boxes: Box[] = JSON.parse(rawData);

console.log(`==================================================================`);
console.log(`SEARCH NORMALIZER VALIDATION ON MERGED SEED (${boxes.length} BOXES)`);
console.log(`==================================================================\n`);

// 1. Direct Self-Match: Every single listed model in each box MUST match its box
let selfMatchFailures = 0;
let totalModelTests = 0;

for (const box of boxes) {
  for (const model of box.compatibleModels) {
    totalModelTests++;
    if (!matchesBox(box, model)) {
      console.error(`❌ FAILED: Box ${box.boxNumber} did not match its own model "${model}"`);
      selfMatchFailures++;
    }
  }
}
console.log(`Test 1: Self-Match across all ${totalModelTests} model aliases: ${selfMatchFailures === 0 ? "PASSED (0 failures)" : `FAILED (${selfMatchFailures} failures)`}`);

// 2. Direct Box Number Resolution
let boxNumberFailures = 0;
for (const box of boxes) {
  const digits = box.boxNumber.replace(/\D/g, "");
  const queries = [
    box.boxNumber,
    box.boxNumber.toLowerCase(),
    `box ${digits}`,
    `box${digits}`,
    `#${digits}`,
    digits,
  ];

  for (const q of queries) {
    if (!matchesBox(box, q)) {
      console.error(`❌ FAILED: Box ${box.boxNumber} did not match query "${q}"`);
      boxNumberFailures++;
    }
  }
}
console.log(`Test 2: Direct Box Number Resolution: ${boxNumberFailures === 0 ? "PASSED (0 failures)" : `FAILED (${boxNumberFailures} failures)`}`);

// 3. Mandatory Retail Tests Specified in Prompt
const mandatoryTests = [
  { query: "A05", expectedBox: "BOX 048" },
  { query: "A05s", expectedBox: "BOX 048" },
  { query: "A06", expectedBox: "BOX 048" },
  { query: "apple 7 plus", expectedBox: "BOX 002" },
  { query: "iPhone 6", expectedBox: "BOX 001" },
  { query: "pixel 6a", expectedBox: "BOX 024" },
  { query: "Google Pixel 6", expectedBox: "BOX 085" },
  { query: "Google Pixel 9a", expectedBox: "BOX 029" },
  { query: "OPPO F17", expectedBox: "BOX 098" },
];

console.log("\nTest 3: Mandatory Retail Core Queries:");
let mandatoryFailures = 0;
for (const test of mandatoryTests) {
  const matches = boxes.filter((b) => matchesBox(b, test.query));
  const hasExpected = matches.some((b) => b.boxNumber.toUpperCase() === test.expectedBox.toUpperCase());
  if (hasExpected) {
    console.log(`  ✓ '${test.query}' -> Matched ${test.expectedBox} (${matches.map((b) => b.boxNumber).join(", ")})`);
  } else {
    console.error(`  ❌ FAILED: Query '${test.query}' did not match expected ${test.expectedBox}!`);
    mandatoryFailures++;
  }
}

// 4. Extended Real-World Retail Customer Search Variations
const realWorldTests = [
  { query: "pixel 7", expectedBox: "BOX 026" },
  { query: "s20 ultra", expectedBox: "BOX 039" },
  { query: "galaxy s22+", expectedBox: "BOX 041" },
  { query: "redmi note 13 pro", expectedBox: "BOX 049" },
  { query: "SM A06", expectedBox: "BOX 048" },
  { query: "note 13", expectedBox: "BOX 126" },
  { query: "honor x8b", expectedBox: "BOX 131" },
  { query: "infinix hot 8", expectedBox: "BOX 142" },
  { query: "spark go 2025", expectedBox: "BOX 153" },
  { query: "moto g13", expectedBox: "BOX 161" },
  { query: "motorola g04", expectedBox: "BOX 162" },
];

console.log("\nTest 4: Extended Real-World Variations:");
let retailTestFailures = 0;
for (const test of realWorldTests) {
  const matches = boxes.filter((b) => matchesBox(b, test.query));
  const hasExpected = matches.some((b) => b.boxNumber.toUpperCase() === test.expectedBox.toUpperCase());
  if (hasExpected) {
    console.log(`  ✓ '${test.query}' -> Matched ${test.expectedBox} (${matches.map((b) => b.boxNumber).join(", ")})`);
  } else {
    console.error(`  ❌ FAILED: Query '${test.query}' did not match ${test.expectedBox}`);
    retailTestFailures++;
  }
}

if (selfMatchFailures === 0 && boxNumberFailures === 0 && mandatoryFailures === 0 && retailTestFailures === 0) {
  console.log(`\n🎉 ALL SEARCH NORMALIZER VALIDATION CHECKS PASSED WITH ZERO CONFLICTS!`);
} else {
  process.exit(1);
}
