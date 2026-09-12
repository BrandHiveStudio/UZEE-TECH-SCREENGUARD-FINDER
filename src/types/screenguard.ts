export interface Box {
  id: string;
  boxNumber: string;
  displaySize?: string;
  title: string;
  compatibleModels: string[];
  rawText?: string;
  category?: string;
  notes?: string;
  source?: string;
  verification?: string;
  stockQuantity?: number;
  stockCountVerified?: boolean;
  stockStatus?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "NOT_COUNTED";
  purchaseStatus?: "NEEDS ORDER" | "ORDERED" | "RECEIVED" | "CANCELLED" | "NONE";
  unitsSold?: number;
}

export interface InventoryTransaction {
  id: string;
  groupId: string;
  transactionType: "SALE" | "RESTOCK" | "ADJUSTMENT" | "INITIAL_STOCK";
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  boxNumber: string;
  note?: string;
  createdAt: string;
}

export interface PurchaseItem {
  id: string;
  groupId: string;
  boxNumber?: string;
  title?: string;
  compatibleModels?: string[];
  currentQuantity?: number;
  requestedQuantity: number;
  status: "NEEDS ORDER" | "ORDERED" | "RECEIVED" | "CANCELLED";
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenguardData {
  version: string;
  lastUpdated: string;
  totalBoxes: number;
  boxes: Box[];
  inventoryTransactions?: InventoryTransaction[];
  purchaseList?: PurchaseItem[];
}

export interface SearchResultItem {
  item: Box;
  score?: number;
  matchedModel?: string;
}

