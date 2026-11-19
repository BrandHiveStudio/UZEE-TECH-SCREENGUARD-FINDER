import { getAllBoxes, upsertBox } from "../src/lib/db";
import { matchesBox, parseBoxQuery } from "../src/lib/searchNormalizer";
import { normalizeVariants, calculateTotalStock } from "../src/lib/screenguard";

async function runTests() {
  console.log("=== Testing Search Queries & Box Resolution ===");
  const boxes = await getAllBoxes();
  console.log(`Loaded ${boxes.length} boxes from database.`);

  const box001 = boxes.find((b) => b.id === "box-001");
  if (!box001) throw new Error("BOX 001 not found!");

  console.log(`BOX 001 Box Number: '${box001.boxNumber}'`);

  const testQueries = [
    "BOX 001",
    "001",
    "1",
    "BOX 001 PRIVACY/CLEAR/MATTE/BORDERLESS",
    "box 1 privacy",
    "BOX 048",
    "048",
    "48",
    "A05",
    "A05s",
    "apple 7 plus"
  ];

  for (const q of testQueries) {
    const matchedBoxes = boxes.filter((b) => matchesBox(b, q));
    console.log(`Query "${q}" -> ${matchedBoxes.length} matched (Top: ${matchedBoxes[0]?.boxNumber})`);
    if (q.includes("001") || q === "1" || q === "box 1 privacy") {
      if (!matchedBoxes.some((b) => b.id === "box-001")) {
        throw new Error(`Query "${q}" failed to match BOX 001!`);
      }
    }
  }
  console.log("✓ All search normalizer queries passed successfully!");

  console.log("\n=== Testing Variant Stocks Persistence ===");
  // Test updating BOX 001 with distinct variants
  const testVariants = {
    super_d: 5,
    privacy: 3,
    matte: 2,
    borderless: 1,
  };
  const expectedTotal = 5 + 3 + 2 + 1; // 11

  const updatedBox = {
    ...box001,
    variants: testVariants,
    stockQuantity: expectedTotal,
    stockCountVerified: true,
  };

  await upsertBox(updatedBox);
  console.log("✓ Upserted BOX 001 with variants:", testVariants);

  // Re-fetch all boxes to confirm persistence
  const freshBoxes = await getAllBoxes();
  const freshBox001 = freshBoxes.find((b) => b.id === "box-001");
  if (!freshBox001) throw new Error("Could not re-fetch BOX 001!");

  console.log(`Fresh BOX 001 stockQuantity: ${freshBox001.stockQuantity} (Expected: ${expectedTotal})`);
  console.log("Fresh BOX 001 variants:", freshBox001.variants);
  console.log(`Fresh BOX 001 stockStatus: ${freshBox001.stockStatus}`);

  if (freshBox001.stockQuantity !== expectedTotal) {
    throw new Error(`Stock quantity mismatch: got ${freshBox001.stockQuantity}, expected ${expectedTotal}`);
  }
  if (
    freshBox001.variants?.super_d !== 5 ||
    freshBox001.variants?.privacy !== 3 ||
    freshBox001.variants?.matte !== 2 ||
    freshBox001.variants?.borderless !== 1
  ) {
    throw new Error("Variant breakdown mismatch after persistence!");
  }

  console.log("✓ All finish variant persistence tests passed perfectly!");
}

runTests().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
