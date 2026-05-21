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
