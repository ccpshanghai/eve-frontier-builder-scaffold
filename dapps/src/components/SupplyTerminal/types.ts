export interface ListingConfig {
  enabled: boolean;
  productTypeId: number;
  productQuantity: number;
  paymentTypeId: number;
  paymentQuantity: number;
}

export interface SupplyTerminalInventoryItem {
  typeId: number;
  quantity: number;
}

export interface SupplyTerminalInventorySnapshot {
  key: string;
  items: SupplyTerminalInventoryItem[];
}

export interface SupplyTerminalStorageSnapshot {
  id: string;
  ownerCapId: string;
  status: string;
  extension: string;
}

export interface SupplyTerminalCharacterSnapshot {
  id: string;
  ownerCapId: string;
}

export interface SupplyTerminalChainSnapshot {
  storage: SupplyTerminalStorageSnapshot;
  listings: ListingConfig[];
  machineInventory: SupplyTerminalInventoryItem[];
  buyerInventory: SupplyTerminalInventoryItem[];
  character: SupplyTerminalCharacterSnapshot | null;
}

export interface SupplyTerminalPreflightView {
  listing: ListingConfig;
  paymentAvailable: boolean;
  machineStockAvailable: boolean;
  listingEnabled: boolean;
  extensionAuthorized: boolean;
  disabledReason?: string;
}

export interface SupplyTerminalChainEnv {
  storageObjectId: string;
  worldPackageId: string;
  supplyTerminalPackageId: string;
  supplyTerminalConfigId: string;
  rpcUrl: string;
}

export type ExchangeState =
  | "idle"
  | "selected"
  | "payment_staged"
  | "submitting"
  | "completed"
  | "failed";

export interface ExchangeEvent {
  type: "local" | "chain";
  message: string;
  digest?: string;
  timestamp: number;
}

export type SupplyTerminalSlotStatus =
  | "ready"
  | "wallet_disconnected"
  | "insufficient_payment"
  | "extension_not_authorized"
  | "out_of_stock"
  | "listing_disabled"
  | "submitting"
  | "empty"
  | "sold";

export interface SupplyTerminalSlotItem {
  readonly name: string;
  readonly sandboxItemId: number;
  readonly quantity: number;
}

export interface SupplyTerminalSlot {
  id: string;
  index: number;
  label: string;
  status: SupplyTerminalSlotStatus;
  reward?: SupplyTerminalSlotItem;
  price?: SupplyTerminalSlotItem;
  productTypeId?: number;
  canTrade: boolean;
  disabledReason?: string;
  machineStockQuantity?: number;
}

export interface BuildSupplyTerminalSlotsInput {
  preflightViews: SupplyTerminalPreflightView[];
  submitting: boolean;
  soldProductTypeIds?: readonly number[];
  walletConnected?: boolean;
  machineInventory?: SupplyTerminalInventoryItem[];
}
