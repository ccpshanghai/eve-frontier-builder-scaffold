export interface ListingConfig {
    enabled: boolean;
    productTypeId: number;
    productQuantity: number;
    paymentTypeId: number;
    paymentQuantity: number;
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
    canTrade: boolean;
    disabledReason?: string;
}

export interface BuildSupplyTerminalSlotsInput {
    paymentAvailable: boolean;
    machineStockAvailable: boolean;
    listingEnabled: boolean;
    extensionAuthorized: boolean;
    submitting: boolean;
    sold: boolean;
}
