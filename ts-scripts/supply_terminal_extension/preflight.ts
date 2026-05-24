import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { MODULE } from "./modules";
import { WorldConfig } from "../utils/config";

export type ListingConfigSnapshot = {
    enabled: boolean;
    productTypeId: string;
    productQuantity: number;
    paymentTypeId: string;
    paymentQuantity: number;
};

export type InventoryItemSnapshot = {
    typeId: string;
    quantity: number;
};

export type InventorySnapshot = {
    key: string;
    items: InventoryItemSnapshot[];
};

export type SupplyTerminalPreflightState = {
    characterItemId: string;
    storageUnitItemId: string;
    characterId: string;
    storageUnitId: string;
    characterOwnerCapId: string;
    storageUnitOwnerCapId: string;
    storageUnitStatus: string;
    storageUnitExtension: string;
    expectedAuthType: string;
    selectedProductTypeId: string;
    listings: ListingConfigSnapshot[];
    inventories: InventorySnapshot[];
};

type MoveObjectFields = Record<string, unknown>;

export type SupplyTerminalPreflightParams = {
    builderPackageId: string;
    extensionConfigId: string;
    storageUnitId: string;
    storageUnitItemId: bigint;
    characterId: string;
    characterItemId: bigint;
    characterOwnerCapId: string;
    productTypeId: bigint;
};

export function validateSupplyTerminalPreflight(state: SupplyTerminalPreflightState): void {
    const listing =
        state.listings.find(
            (candidate) => candidate.productTypeId === state.selectedProductTypeId
        ) ?? null;
    if (!listing) {
        throw new Error(
            `Supply Terminal listing config is missing for product type ${state.selectedProductTypeId} on ${state.storageUnitId}`
        );
    }

    if (!listing.enabled) {
        throw new Error("Supply Terminal listing is disabled");
    }

    if (
        normalizeTypeName(state.storageUnitExtension) !== normalizeTypeName(state.expectedAuthType)
    ) {
        throw new Error(
            `StorageUnit ${state.storageUnitItemId} is not authorized for ${state.expectedAuthType}`
        );
    }

    if (state.storageUnitStatus !== "ONLINE") {
        throw new Error(
            `StorageUnit ${state.storageUnitItemId} is ${state.storageUnitStatus}, expected ONLINE`
        );
    }

    const buyerInventory = findInventory(state.inventories, state.characterOwnerCapId);
    if (!buyerInventory) {
        throw new Error(
            `Buyer owned inventory is not initialized for Character ${state.characterItemId} ` +
                `(${state.characterId}) in StorageUnit ${state.storageUnitItemId} ` +
                `(${state.storageUnitId}). Seed payment inventory before exchange.`
        );
    }

    assertInventoryHasItem(
        buyerInventory,
        listing.paymentTypeId,
        listing.paymentQuantity,
        `Buyer inventory does not contain payment type ${listing.paymentTypeId} x${listing.paymentQuantity}`
    );

    const machineInventory = findInventory(state.inventories, state.storageUnitOwnerCapId);
    if (!machineInventory) {
        throw new Error(
            `Machine inventory is not initialized for StorageUnit ${state.storageUnitItemId} ` +
                `(${state.storageUnitId})`
        );
    }

    assertInventoryHasItem(
        machineInventory,
        listing.productTypeId,
        listing.productQuantity,
        `Machine inventory does not contain product type ${listing.productTypeId} x${listing.productQuantity}`
    );
}

export async function assertSupplyTerminalExchangeReady(
    client: SuiJsonRpcClient,
    config: WorldConfig,
    params: SupplyTerminalPreflightParams
): Promise<void> {
    const state = await loadSupplyTerminalPreflightState(client, config, params);
    validateSupplyTerminalPreflight(state);
}

async function loadSupplyTerminalPreflightState(
    client: SuiJsonRpcClient,
    config: WorldConfig,
    params: SupplyTerminalPreflightParams
): Promise<SupplyTerminalPreflightState> {
    const [listings, storageUnit, inventories] = await Promise.all([
        loadListingConfigs(client, params.extensionConfigId, params.builderPackageId),
        loadStorageUnit(client, params.storageUnitId),
        loadInventories(client, params.storageUnitId),
    ]);

    return {
        characterItemId: params.characterItemId.toString(),
        storageUnitItemId: params.storageUnitItemId.toString(),
        characterId: params.characterId,
        storageUnitId: params.storageUnitId,
        characterOwnerCapId: params.characterOwnerCapId,
        storageUnitOwnerCapId: storageUnit.ownerCapId,
        storageUnitStatus: storageUnit.status,
        storageUnitExtension: storageUnit.extension,
        expectedAuthType: `${params.builderPackageId}::${MODULE.CONFIG}::SupplyTerminalAuth`,
        selectedProductTypeId: params.productTypeId.toString(),
        listings,
        inventories,
    };
}

async function loadListingConfigs(
    client: SuiJsonRpcClient,
    extensionConfigId: string,
    builderPackageId: string
): Promise<ListingConfigSnapshot[]> {
    const fields = await getAllDynamicFields(client, extensionConfigId);
    const listingFields = fields.filter((field) =>
        String(field.objectType).endsWith(
            `${builderPackageId}::${MODULE.SUPPLY_TERMINAL}::ListingConfig`
        )
    );

    const listings = await Promise.all(
        listingFields.map(async (field) => {
            const fieldObject = await client.getDynamicFieldObject({
                parentId: extensionConfigId,
                name: field.name,
            });
            const value = getMoveObjectFields(fieldObject)?.value;
            const listing = getTypedFields(value);

            if (!listing) return null;

            return {
                enabled: Boolean(listing.enabled),
                productTypeId: String(listing.product_type_id),
                productQuantity: Number(listing.product_quantity),
                paymentTypeId: String(listing.payment_type_id),
                paymentQuantity: Number(listing.payment_quantity),
            };
        })
    );

    return listings.filter((listing): listing is ListingConfigSnapshot => listing !== null);
}

async function loadStorageUnit(
    client: SuiJsonRpcClient,
    storageUnitId: string
): Promise<{ ownerCapId: string; status: string; extension: string }> {
    const result = await client.getObject({
        id: storageUnitId,
        options: { showContent: true },
    });
    const fields = getMoveObjectFields(result);
    if (!fields) {
        throw new Error(`StorageUnit object ${storageUnitId} was not found or has no Move content`);
    }

    const status = getRecord(getTypedFields(fields.status)?.status)?.variant;
    const extension = getTypedFields(fields.extension)?.name;

    return {
        ownerCapId: String(fields.owner_cap_id ?? ""),
        status: String(status ?? "UNKNOWN"),
        extension: String(extension ?? ""),
    };
}

async function loadInventories(
    client: SuiJsonRpcClient,
    storageUnitId: string
): Promise<InventorySnapshot[]> {
    const fields = await getAllDynamicFields(client, storageUnitId);
    const inventoryFields = fields.filter((field) =>
        String(field.objectType).endsWith("::inventory::Inventory")
    );

    return Promise.all(
        inventoryFields.map(async (field) => {
            const fieldObject = await client.getDynamicFieldObject({
                parentId: storageUnitId,
                name: field.name,
            });
            const root = getMoveObjectFields(fieldObject);
            const key = String(root?.name ?? field.name.value ?? "");
            const inventoryFields = getTypedFields(root?.value);
            const contents = getTypedFields(inventoryFields?.items)?.contents;

            return {
                key,
                items: parseInventoryItems(Array.isArray(contents) ? contents : []),
            };
        })
    );
}

async function getAllDynamicFields(client: SuiJsonRpcClient, parentId: string) {
    const fields = [];
    let cursor: string | null | undefined;

    do {
        const page = await client.getDynamicFields({ parentId, cursor });
        fields.push(...page.data);
        cursor = page.hasNextPage ? page.nextCursor : null;
    } while (cursor);

    return fields;
}

function parseInventoryItems(contents: unknown[]): InventoryItemSnapshot[] {
    return contents.map((entry) => {
        const fields = getTypedFields(entry);
        const value = getTypedFields(fields?.value);
        const item = getTypedFields(value);

        return {
            typeId: String(item?.type_id ?? fields?.key ?? ""),
            quantity: Number(item?.quantity ?? 0),
        };
    });
}

function findInventory(inventories: InventorySnapshot[], key: string): InventorySnapshot | null {
    return (
        inventories.find((inventory) => inventory.key.toLowerCase() === key.toLowerCase()) ?? null
    );
}

function assertInventoryHasItem(
    inventory: InventorySnapshot,
    typeId: string,
    quantity: number,
    message: string
): void {
    const item = inventory.items.find((candidate) => candidate.typeId === typeId);
    if (!item || item.quantity < quantity) {
        throw new Error(message);
    }
}

function normalizeTypeName(typeName: string): string {
    return typeName.replace(/^0x/, "");
}

function getMoveObjectFields(response: unknown): MoveObjectFields | null {
    const data = getRecord(response)?.data;
    const content = getRecord(data)?.content;
    return getRecord(getRecord(content)?.fields);
}

function getTypedFields(value: unknown): MoveObjectFields | null {
    const record = getRecord(value);
    if (!record) return null;
    return getRecord(record.fields) ?? record;
}

function getRecord(value: unknown): MoveObjectFields | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as MoveObjectFields;
}
