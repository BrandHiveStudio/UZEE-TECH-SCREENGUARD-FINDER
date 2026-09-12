import {
  getAllBoxes,
  upsertBox,
  deleteBox,
  updateStock,
  getInventoryHistory,
  addToPurchaseList,
  updatePurchaseStatus,
  deriveStockStatus,
} from "../src/lib/db";
import { turso } from "../src/lib/turso";
import type { Box } from "../src/types/screenguard";

async function runPersistenceTests() {
  console.log("==================================================");
  console.log("TESTING TURSO PERSISTENCE & CRUD PIPELINE");
  console.log("==================================================");

  // 1. Test getAllBoxes()
  console.log("\n1. Testing getAllBoxes() from Turso...");
  const initialBoxes = await getAllBoxes();
  console.log(`✓ Fetched ${initialBoxes.length} boxes from Turso.`);
  if (initialBoxes.length !== 130) {
    throw new Error(`Expected 130 boxes, got ${initialBoxes.length}`);
  }

  const box1 = initialBoxes.find((b) => b.id === "box-001");
  if (!box1 || !box1.compatibleModels.includes("iPhone 6")) {
    throw new Error("Failed to verify box-001 models in initial query");
  }
  console.log(`✓ box-001 has ${box1.compatibleModels.length} models: [${box1.compatibleModels.join(", ")}]`);

  // 2. Test upsertBox (Edit existing box)
  console.log("\n2. Testing upsertBox (Edit box-001)...");
  const originalTitle = box1.title;
  const updatedBox1: Box = {
    ...box1,
    title: "iPhone 6 Test Edit",
    notes: "Persisted via Turso",
    compatibleModels: [...box1.compatibleModels, "iPhone 6 Test Edition"],
  };

  await upsertBox(updatedBox1);

  // Re-fetch to ensure it persisted in Turso
  const boxesAfterEdit = await getAllBoxes();
  const verifyBox1 = boxesAfterEdit.find((b) => b.id === "box-001");
  if (
    !verifyBox1 ||
    verifyBox1.title !== "iPhone 6 Test Edit" ||
    !verifyBox1.compatibleModels.includes("iPhone 6 Test Edition") ||
    verifyBox1.notes !== "Persisted via Turso"
  ) {
    throw new Error("Edit persistence failed! Data did not match expected values in database.");
  }
  console.log("✓ Box edit persisted successfully in Turso database!");

  // 3. Test upsertBox (Add new box)
  console.log("\n3. Testing upsertBox (Add new box-999)...");
  const newBox: Box = {
    id: "box-999",
    boxNumber: "BOX 999",
    displaySize: "7.0\"",
    title: "Experimental Phone",
    compatibleModels: ["Experimental 1", "Experimental 2"],
    notes: "New box test",
    stockQuantity: 15,
    stockCountVerified: true,
  };

  await upsertBox(newBox);

  const boxesAfterAdd = await getAllBoxes();
  console.log(`✓ Total boxes after add: ${boxesAfterAdd.length}`);
  if (boxesAfterAdd.length !== 131) {
    throw new Error(`Expected 131 boxes after add, got ${boxesAfterAdd.length}`);
  }
  const verifyNewBox = boxesAfterAdd.find((b) => b.id === "box-999");
  if (!verifyNewBox || verifyNewBox.compatibleModels.length !== 2) {
    throw new Error("New box models or metadata failed to persist!");
  }
  console.log("✓ New box successfully added and retrieved from Turso!");

  // 4. Test Stock Update & Audit Trail
  console.log("\n4. Testing updateStock & transaction audit trail...");
  const stockResult = await updateStock("box-999", "SALE", 1, "Test sale transaction");
  if (stockResult.stockQuantity !== 14) {
    throw new Error(`Expected stock 14 after SALE, got ${stockResult.stockQuantity}`);
  }
  console.log(`✓ Stock updated to ${stockResult.stockQuantity}`);

  const history = await getInventoryHistory("box-999");
  console.log(`✓ Inventory history records for box-999: ${history.length}`);
  if (history.length === 0 || history[0].transactionType !== "SALE") {
    throw new Error("Audit log failed to record transaction!");
  }
  console.log(`✓ Audit transaction recorded: ${history[0].transactionType} (${history[0].quantityChange}) - ${history[0].note}`);

  // 5. Test Purchase List
  console.log("\n5. Testing purchase list...");
  const purchaseItem = await addToPurchaseList("box-999", 25, "Urgent stock order");
  if (purchaseItem.requestedQuantity !== 25 || purchaseItem.status !== "NEEDS ORDER") {
    throw new Error("Purchase item creation failed!");
  }
  console.log(`✓ Purchase list item created: ${purchaseItem.id}`);

  await updatePurchaseStatus(purchaseItem.id, "RECEIVED");
  const boxesAfterReceived = await getAllBoxes();
  const box999Restocked = boxesAfterReceived.find((b) => b.id === "box-999");
  // Original was 14, + 25 = 39
  if (box999Restocked?.stockQuantity !== 39) {
    throw new Error(`Expected auto-restock to 39, got ${box999Restocked?.stockQuantity}`);
  }
  console.log(`✓ Auto-restock upon RECEIVED purchase verified! New stock: ${box999Restocked.stockQuantity}`);

  // 6. Test deleteBox (Cascade delete)
  console.log("\n6. Testing deleteBox(box-999)...");
  await deleteBox("box-999");

  const boxesAfterDelete = await getAllBoxes();
  if (boxesAfterDelete.length !== 130) {
    throw new Error(`Expected 130 boxes after delete, got ${boxesAfterDelete.length}`);
  }
  if (boxesAfterDelete.some((b) => b.id === "box-999")) {
    throw new Error("box-999 was not deleted!");
  }
  console.log("✓ box-999 deleted cleanly.");

  // 7. Restore box-001 original state
  console.log("\n7. Restoring original box-001...");
  await upsertBox({
    ...box1,
    title: originalTitle,
    notes: undefined,
    compatibleModels: box1.compatibleModels.filter((m) => m !== "iPhone 6 Test Edition"),
  });
  console.log("✓ box-001 restored to original state.");

  console.log("\n==================================================");
  console.log("🎉 ALL TURSO PERSISTENCE & CRUD TESTS PASSED!");
  console.log("==================================================");
}

runPersistenceTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
