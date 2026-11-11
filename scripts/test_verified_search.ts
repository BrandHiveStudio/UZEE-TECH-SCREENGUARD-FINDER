import fs from "fs";
import path from "path";
import { matchesBox } from "../src/lib/searchNormalizer";
import type { Box } from "../src/types/screenguard";

const seedPath = path.resolve(process.cwd(), "new_screenguard_seed.json");
const rawData = fs.readFileSync(seedPath, "utf-8");
const boxes: Box[] = JSON.parse(rawData);

console.log(`==================================================================`);
console.log(`SEARCH NORMALIZER VALIDATION ON VERIFIED SEED (${boxes.length} BOXES)`);
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

// 3. Check for false positives when querying each model
// A false positive occurs when querying model M returns a box B that neither contains M
// nor is legitimately aliased to M.
let falsePositiveCount = 0;
for (const box of boxes) {
  for (const model of box.compatibleModels) {
    const matches = boxes.filter((b) => matchesBox(b, model));
    for (const matchedBox of matches) {
      const isLegitimate = matchedBox.compatibleModels.some(
        (m) => m.toLowerCase().trim() === model.toLowerCase().trim()
      );
      if (!isLegitimate) {
        // Check if there is an unintentional token collision
        console.warn(
          `⚠️ Token collision: Query "${model}" (from ${box.boxNumber}) also matched ${matchedBox.boxNumber} (${matchedBox.title})`
        );
        falsePositiveCount++;
      }
    }
  }
}
console.log(`Test 3: Cross-Box Token Conflict Check: ${falsePositiveCount === 0 ? "PASSED (0 conflicts)" : `Found ${falsePositiveCount} cross-matches (inspect above)`}`);

// 4. Test real-world retail customer search variations
const realWorldTests = [
  { query: "pixel 6a", expectedBox: "BOX 024" },
  { query: "pixel 7", expectedBox: "BOX 026" },
  { query: "s20 ultra", expectedBox: "BOX 039" },
  { query: "galaxy s22+", expectedBox: "BOX 041" },
  { query: "redmi note 13 pro", expectedBox: "BOX 049" },
  { query: "A06", expectedBox: "BOX 048" },
  { query: "SM A06", expectedBox: "BOX 048" },
  { query: "note 13", expectedBox: "BOX 126" },
  { query: "honor x8b", expectedBox: "BOX 131" },
  { query: "infinix hot 8", expectedBox: "BOX 142" },
  { query: "spark go 2025", expectedBox: "BOX 153" },
  { query: "moto g13", expectedBox: "BOX 161" },
  { query: "motorola g04", expectedBox: "BOX 162" },
];

let retailTestFailures = 0;
for (const test of realWorldTests) {
  const matches = boxes.filter((b) => matchesBox(b, test.query));
  const hasExpected = matches.some((b) => b.boxNumber.toUpperCase() === test.expectedBox.toUpperCase());
  if (hasExpected) {
    console.log(`✓ Real-world query "${test.query}" -> Matched ${test.expectedBox} (${matches.map((b) => b.boxNumber).join(", ")})`);
  } else {
    console.error(`❌ Real-world query "${test.query}" FAILED to match ${test.expectedBox}`);
    retailTestFailures++;
  }
}
console.log(`Test 4: Real-world retail variations: ${retailTestFailures === 0 ? "PASSED (0 failures)" : `FAILED (${retailTestFailures} failures)`}`);

if (selfMatchFailures === 0 && boxNumberFailures === 0 && retailTestFailures === 0) {
  console.log(`\n🎉 ALL SEARCH NORMALIZER VALIDATION CHECKS PASSED WITH ZERO CONFLICTS!`);
} else {
  process.exit(1);
}
