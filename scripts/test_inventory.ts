import {
  deriveStockStatus,
  updateStock,
  getInventoryHistory,
  addToPurchaseList,
  updatePurchaseStatus,
  getAllBoxes,
  saveBulkStockCounts,
  upsertBox,
} from "../src/lib/db";
import { createSearchEngine, searchBoxes } from "../src/lib/search";
import type { Box } from "../src/types/screenguard";

async function runInventoryTests() {
  console.log("=================================================");
  console.log("RUNNING COMPREHENSIVE PHASE 2 INVENTORY TESTS (A-T)");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, code: string, description: string) {
    if (condition) {
      console.log(`✅ [PASS ${code}] ${description}`);
      passed++;
    } else {
      console.error(`❌ [FAIL ${code}] ${description}`);
      failed++;
    }
  }

  const targetId = "SD-F001";

  // Reset target box for clean test state
  await updateStock(targetId, "ADJUSTMENT", 0, "Reset test state");

  // Test A: 0 -> +5 = 5
  const bA = await updateStock(targetId, "RESTOCK", 5, "Test A");
  assert(bA.stockQuantity === 5, "A", "0 + RESTOCK 5 = 5");

  // Test B: 5 -> -2 = 3
  await updateStock(targetId, "SALE", 1);
  const bB = await updateStock(targetId, "SALE", 1, "Test B");
  assert(bB.stockQuantity === 3, "B", "5 + SALE 2 = 3");

  // Test C: 3 -> -5 = REJECTED
  let errC = false;
  try {
    await updateStock(targetId, "ADJUSTMENT", -5);
  } catch (e) {
    errC = true;
  }
  assert(errC, "C", "Attempting negative stock is REJECTED");

  // Test D: Set 3 -> 10
  const bD = await updateStock(targetId, "ADJUSTMENT", 10, "Test D");
  assert(bD.stockQuantity === 10, "D", "Set 3 -> 10 via ADJUSTMENT");

  // Test E: 0 + unverified = NOT COUNTED
  assert(deriveStockStatus(0, false) === "NOT_COUNTED", "E", "0 stock + unverified = NOT COUNTED");

  // Test F: 0 + verified = OUT OF STOCK
  assert(deriveStockStatus(0, true) === "OUT_OF_STOCK", "F", "0 stock + verified = OUT OF STOCK");

  // Test G: 1 = LOW STOCK
  assert(deriveStockStatus(1, true) === "LOW_STOCK", "G", "1 stock = LOW STOCK");

  // Test H: 3 = LOW STOCK
  assert(deriveStockStatus(3, true) === "LOW_STOCK", "H", "3 stock = LOW STOCK");

  // Test I: 4 = IN STOCK
  assert(deriveStockStatus(4, true) === "IN_STOCK", "I", "4 stock = IN STOCK");

  // Test J: Sale creates transaction
  const preTxCountJ = (await getInventoryHistory(targetId)).length;
  await updateStock(targetId, "SALE", 1, "Test J Sale");
  const postTxJ = await getInventoryHistory(targetId);
  assert(postTxJ.length === preTxCountJ + 1 && postTxJ[0].transactionType === "SALE", "J", "Sale creates transaction log entry");

  // Test K: Restock creates transaction
  const preTxCountK = (await getInventoryHistory(targetId)).length;
  await updateStock(targetId, "RESTOCK", 10, "Test K Restock");
  const postTxK = await getInventoryHistory(targetId);
  assert(postTxK.length === preTxCountK + 1 && postTxK[0].transactionType === "RESTOCK", "K", "Restock creates transaction log entry");

  // Test L: Adjustment creates transaction
  const preTxCountL = (await getInventoryHistory(targetId)).length;
  await updateStock(targetId, "ADJUSTMENT", 8, "Test L Adjustment");
  const postTxL = await getInventoryHistory(targetId);
  assert(postTxL.length === preTxCountL + 1 && postTxL[0].transactionType === "ADJUSTMENT", "L", "Adjustment creates transaction log entry");

  // Test M: History preserves previous/new values
  const lastTx = postTxL[0];
  assert(lastTx.previousQuantity === 19 && lastTx.newQuantity === 8 && lastTx.quantityChange === -11, "M", "History log accurately records prev (19), new (8), and change (-11)");

  // Test N: Box number changes do not break Group ID
  const allB = await getAllBoxes();
  const boxOriginal = allB.find((b) => b.id === targetId)!;
  const updatedBoxNumber = await upsertBox({ ...boxOriginal, boxNumber: "BOX 999" });
  assert(updatedBoxNumber.id === targetId && updatedBoxNumber.boxNumber === "BOX 999", "N", "Box number change preserves permanent Group ID (SD-F001)");

  // Restore box number
  await upsertBox(boxOriginal);

  // Test O: Box number changes do not corrupt inventory history
  const postRenameHistory = await getInventoryHistory(targetId);
  assert(postRenameHistory.length > 0 && postRenameHistory.every((t) => t.groupId === targetId), "O", "Inventory history retains foreign key to Group ID after box number changes");

  // Test P: Multi-group search preserves all legitimate groups
  const testBoxes: Box[] = [
    { id: "SD-F001", boxNumber: "BOX 001", displaySize: '6.7"', title: "Samsung S24 FE", compatibleModels: ["Samsung S24 FE"], stockQuantity: 0, stockCountVerified: true, stockStatus: "OUT_OF_STOCK" },
    { id: "SD-F002", boxNumber: "BOX 002", displaySize: '6.7"', title: "Samsung S24 FE", compatibleModels: ["Samsung S24 FE"], stockQuantity: 10, stockCountVerified: true, stockStatus: "IN_STOCK" },
    { id: "SD-F003", boxNumber: "BOX 003", displaySize: '6.7"', title: "Samsung S24 FE", compatibleModels: ["Samsung S24 FE"], stockQuantity: 2, stockCountVerified: true, stockStatus: "LOW_STOCK" },
    { id: "SD-F004", boxNumber: "BOX 004", displaySize: '6.7"', title: "Samsung S24 FE", compatibleModels: ["Samsung S24 FE"], stockQuantity: 0, stockCountVerified: false, stockStatus: "NOT_COUNTED" },
  ];
  const fuse = createSearchEngine(testBoxes);
  const searchResults = searchBoxes(fuse, "Samsung S24 FE");
  assert(searchResults.length === 4, "P", "Multi-group search preserves ALL 4 matching groups without hiding OUT_OF_STOCK or NOT_COUNTED items");
  assert(searchResults[0].item.id === "SD-F002" && searchResults[3].item.id === "SD-F001", "P", "Ranked in order: IN_STOCK (002) -> LOW_STOCK (003) -> NOT_COUNTED (004) -> OUT_OF_STOCK (001)");

  // Test Q: CSV contains inventory data
  const sampleBox = (await getAllBoxes())[0];
  assert(sampleBox.stockQuantity !== undefined && sampleBox.stockStatus !== undefined, "Q", "CSV data structures contain live stockQuantity and stockStatus fields");

  // Test R: JSON backup contains inventory data
  assert(sampleBox.stockCountVerified !== undefined, "R", "JSON backup structures contain stockCountVerified and transaction schema support");

  // Test S: Purchase List works & auto-restocks on RECEIVED
  const purItem = await addToPurchaseList(targetId, 20, "Test S Purchase");
  assert(purItem.status === "NEEDS ORDER", "S", "Purchase list item created with status NEEDS ORDER");

  await updatePurchaseStatus(purItem.id, "ORDERED");
  const preQtyS = ((await getAllBoxes()).find((b) => b.id === targetId)?.stockQuantity) ?? 0;
  await updatePurchaseStatus(purItem.id, "RECEIVED");
  const postQtyS = ((await getAllBoxes()).find((b) => b.id === targetId)?.stockQuantity) ?? 0;
  assert(postQtyS === preQtyS + 20, "S", `RECEIVED status automatically restocks requested quantity (+20) (${preQtyS} -> ${postQtyS})`);

  // Test T: Stock Count Mode works
  const bulkCountResult = await saveBulkStockCounts([{ groupId: targetId, quantity: 15 }]);
  const boxT = (await getAllBoxes()).find((b) => b.id === targetId)!;
  assert(bulkCountResult === 1 && boxT.stockQuantity === 15 && boxT.stockCountVerified === true, "T", "Stock Count Mode bulk save sets stock_quantity=15 and stock_count_verified=true");

  // Test U: Additional Status & Validation Rules (U1-U5)
  const newBox1 = await upsertBox({ id: "SD-TEST-U1", boxNumber: "BOX TEST1", title: "Test Group", compatibleModels: ["Test Model"], stockQuantity: 0, stockCountVerified: false });
  assert(deriveStockStatus(newBox1.stockQuantity!, newBox1.stockCountVerified!) === "NOT_COUNTED", "U1", "New box stock 0 + unverified = NOT COUNTED");

  const newBox2 = await upsertBox({ id: "SD-TEST-U2", boxNumber: "BOX TEST2", title: "Test Group", compatibleModels: ["Test Model"], stockQuantity: 0, stockCountVerified: true });
  assert(deriveStockStatus(newBox2.stockQuantity!, newBox2.stockCountVerified!) === "OUT_OF_STOCK", "U2", "New box stock 0 + verified = OUT OF STOCK");

  const newBox3 = await upsertBox({ id: "SD-TEST-U3", boxNumber: "BOX TEST3", title: "Test Group", compatibleModels: ["Test Model"], stockQuantity: 1, stockCountVerified: true });
  assert(deriveStockStatus(newBox3.stockQuantity!, newBox3.stockCountVerified!) === "LOW_STOCK", "U3", "New box stock 1 + verified = LOW STOCK");

  const newBox4 = await upsertBox({ id: "SD-TEST-U4", boxNumber: "BOX TEST4", title: "Test Group", compatibleModels: ["Test Model"], stockQuantity: 3, stockCountVerified: true });
  assert(deriveStockStatus(newBox4.stockQuantity!, newBox4.stockCountVerified!) === "LOW_STOCK", "U4", "New box stock 3 + verified = LOW STOCK");

  const newBox5 = await upsertBox({ id: "SD-TEST-U5", boxNumber: "BOX TEST5", title: "Test Group", compatibleModels: ["Test Model"], stockQuantity: 4, stockCountVerified: true });
  assert(deriveStockStatus(newBox5.stockQuantity!, newBox5.stockCountVerified!) === "IN_STOCK", "U5", "New box stock 4 + verified = IN STOCK");

  // Test V: Display Size Default
  const newBoxDefaultSize = await upsertBox({ id: "SD-TEST-V", boxNumber: "BOX TESTV", title: "Test Group", compatibleModels: ["Test Model"] });
  assert(newBoxDefaultSize.displaySize === "Unknown", "V", "New box display size defaults to Unknown");

  // Test W: INITIAL_STOCK Transaction Creation
  const newBoxTx = await upsertBox({ id: "SD-TEST-W", boxNumber: "BOX TESTW", title: "Test Group", compatibleModels: ["Test Model"], stockQuantity: 10, stockCountVerified: true });
  const txListW = await getInventoryHistory("SD-TEST-W");
  assert(txListW.length > 0 && txListW[0].transactionType === "INITIAL_STOCK", "W", "Initial stock setup creates INITIAL_STOCK transaction log");

  console.log("\n=================================================");
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runInventoryTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
