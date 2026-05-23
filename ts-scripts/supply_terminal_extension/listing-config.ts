export type SupplyTerminalListingConfig = {
    productTypeId: bigint;
    productQuantity: number;
    paymentTypeId: bigint;
    paymentQuantity: number;
    paymentVolume: bigint;
};

type EnvLike = Record<string, string | undefined>;
type RawListing = Record<string, unknown>;

const DEFAULT_PAYMENT_VOLUME = 10n;

const DEFAULT_LISTINGS: SupplyTerminalListingConfig[] = [
    {
        productTypeId: 84210n,
        productQuantity: 1,
        paymentTypeId: 77800n,
        paymentQuantity: 10,
        paymentVolume: DEFAULT_PAYMENT_VOLUME,
    },
];

export function buildSupplyTerminalListings(
    env: EnvLike = process.env
): SupplyTerminalListingConfig[] {
    const value = env.SUPPLY_TERMINAL_LISTINGS;
    const listings = value ? parseListingsJson(value) : DEFAULT_LISTINGS;
    assertUniqueProductTypeIds(listings);
    return listings;
}

export function getSelectedExchangeProductTypeId(env: EnvLike = process.env): bigint {
    const listings = buildSupplyTerminalListings(env);
    const value = env.SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID;
    const selected = value
        ? parsePositiveBigInt(value, "SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID")
        : listings[0].productTypeId;

    if (!listings.some((listing) => listing.productTypeId === selected)) {
        throw new Error(
            `SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID ${selected.toString()} does not match a configured listing`
        );
    }

    return selected;
}

function parseListingsJson(value: string): SupplyTerminalListingConfig[] {
    let raw: unknown;
    try {
        raw = JSON.parse(value);
    } catch {
        throw new Error("SUPPLY_TERMINAL_LISTINGS must be valid JSON");
    }

    if (!Array.isArray(raw) || raw.length === 0) {
        throw new Error("SUPPLY_TERMINAL_LISTINGS must be a non-empty JSON array");
    }

    return raw.map((entry, index) => parseListing(entry, index));
}

function parseListing(entry: unknown, index: number): SupplyTerminalListingConfig {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(`SUPPLY_TERMINAL_LISTINGS[${index}] must be an object`);
    }

    const raw = entry as RawListing;

    return {
        productTypeId: readRequiredBigInt(raw, "productTypeId", index),
        productQuantity: readRequiredPositiveInteger(raw, "productQuantity", index),
        paymentTypeId: readRequiredBigInt(raw, "paymentTypeId", index),
        paymentQuantity: readRequiredPositiveInteger(raw, "paymentQuantity", index),
        paymentVolume: readOptionalBigInt(raw, "paymentVolume", DEFAULT_PAYMENT_VOLUME, index),
    };
}

function assertUniqueProductTypeIds(listings: SupplyTerminalListingConfig[]): void {
    const seen = new Set<string>();
    for (const listing of listings) {
        const key = listing.productTypeId.toString();
        if (seen.has(key)) {
            throw new Error(`Duplicate SUPPLY_TERMINAL_LISTINGS productTypeId ${key}`);
        }
        seen.add(key);
    }
}

function readRequiredBigInt(raw: RawListing, field: string, index: number): bigint {
    return parsePositiveBigInt(
        readRequiredValue(raw, field, index),
        `SUPPLY_TERMINAL_LISTINGS[${index}].${field}`
    );
}

function readOptionalBigInt(
    raw: RawListing,
    field: string,
    defaultValue: bigint,
    index: number
): bigint {
    const value = raw[field];
    return value === undefined
        ? defaultValue
        : parsePositiveBigInt(value, `SUPPLY_TERMINAL_LISTINGS[${index}].${field}`);
}

function readRequiredPositiveInteger(raw: RawListing, field: string, index: number): number {
    const parsed = Number(readRequiredValue(raw, field, index));
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new Error(`SUPPLY_TERMINAL_LISTINGS[${index}].${field} must be a positive integer`);
    }
    return parsed;
}

function readRequiredValue(raw: RawListing, field: string, index: number): unknown {
    const value = raw[field];
    if (value === undefined || value === null || value === "") {
        throw new Error(`SUPPLY_TERMINAL_LISTINGS[${index}].${field} is required`);
    }
    return value;
}

function parsePositiveBigInt(value: unknown, name: string): bigint {
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
        throw new Error(`${name} must be a positive integer`);
    }

    const text = String(value);
    if (!/^[0-9]+$/.test(text)) {
        throw new Error(`${name} must be a positive integer`);
    }

    const parsed = BigInt(text);
    if (parsed <= 0n) {
        throw new Error(`${name} must be a positive integer`);
    }
    return parsed;
}
