import "dotenv/config";
import { fileURLToPath } from "node:url";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { MODULES, WorldConfig } from "../utils/config";
import { deriveObjectId } from "../utils/derive-object-id";
import {
    getEnvConfig,
    handleError,
    hydrateWorldConfig,
    initializeContext,
    requireEnv,
} from "../utils/helper";
import { executeSponsoredTransaction } from "../utils/transaction";
import { getOwnerCap as getStorageUnitOwnerCap } from "../helpers/storage-unit-extension";
import { buildSupplyTerminalListings } from "./listing-config";

const DEFAULT_PRODUCT_ITEM_ID_BASE = 8_420_000_000_000_000n;
const DEFAULT_PRODUCT_VOLUME = 10n;
const DEFAULT_STOCK_PURCHASE_COUNT = 10;

export type ProductSeed = {
    productTypeId: bigint;
    productItemId: bigint;
    volume: bigint;
    quantity: number;
};

export type InventorySeedConfig = {
    storageUnitItemId: bigint;
    characterItemId: bigint;
    products: ProductSeed[];
};

type EnvLike = Record<string, string | undefined>;

export function buildInventorySeedConfig(
    env: EnvLike = process.env,
    nowMs: number = Date.now()
): InventorySeedConfig {
    const baseProductItemId = readOptionalBigInt(
        env,
        "SUPPLY_TERMINAL_PRODUCT_ITEM_ID",
        DEFAULT_PRODUCT_ITEM_ID_BASE + BigInt(nowMs)
    );
    const productVolume = readOptionalBigInt(
        env,
        "SUPPLY_TERMINAL_PRODUCT_VOLUME",
        DEFAULT_PRODUCT_VOLUME
    );
    const stockPurchaseCount = readOptionalPositiveInteger(
        env,
        "SUPPLY_TERMINAL_STOCK_PURCHASE_COUNT",
        DEFAULT_STOCK_PURCHASE_COUNT
    );

    return {
        storageUnitItemId: readRequiredBigInt(env, "STORAGE_UNIT_ITEM_ID"),
        characterItemId: readRequiredBigInt(env, "CHARACTER_ITEM_ID"),
        products: buildSupplyTerminalListings(env).map((listing, index) => ({
            productTypeId: listing.productTypeId,
            productItemId: baseProductItemId + BigInt(index),
            volume: productVolume,
            quantity: multiplySafePositiveIntegers(
                listing.productQuantity,
                stockPurchaseCount,
                `SUPPLY_TERMINAL_LISTINGS[${index}].productQuantity * SUPPLY_TERMINAL_STOCK_PURCHASE_COUNT`
            ),
        })),
    };
}

async function seedInventory(
    client: SuiJsonRpcClient,
    adminKeypair: Ed25519Keypair,
    ownerKeypair: Ed25519Keypair,
    ownerAddress: string,
    adminAddress: string,
    worldConfig: WorldConfig,
    seedConfig: InventorySeedConfig
) {
    const characterId = deriveObjectId(
        worldConfig.objectRegistry,
        seedConfig.characterItemId,
        worldConfig.packageId
    );
    const storageUnitId = deriveObjectId(
        worldConfig.objectRegistry,
        seedConfig.storageUnitItemId,
        worldConfig.packageId
    );

    const ownerCapId = await getStorageUnitOwnerCap(
        storageUnitId,
        client,
        worldConfig,
        ownerAddress
    );
    if (!ownerCapId) {
        throw new Error(`StorageUnit OwnerCap not found for storage unit ${storageUnitId}`);
    }

    const tx = new Transaction();
    tx.setSender(ownerAddress);
    tx.setGasOwner(adminAddress);

    const [ownerCap, receipt] = tx.moveCall({
        target: `${worldConfig.packageId}::${MODULES.CHARACTER}::borrow_owner_cap`,
        typeArguments: [`${worldConfig.packageId}::${MODULES.STORAGE_UNIT}::StorageUnit`],
        arguments: [tx.object(characterId), tx.object(ownerCapId)],
    });

    for (const product of seedConfig.products) {
        tx.moveCall({
            target: `${worldConfig.packageId}::${MODULES.STORAGE_UNIT}::game_item_to_chain_inventory`,
            typeArguments: [`${worldConfig.packageId}::${MODULES.STORAGE_UNIT}::StorageUnit`],
            arguments: [
                tx.object(storageUnitId),
                tx.object(worldConfig.adminAcl),
                tx.object(characterId),
                ownerCap,
                tx.pure.u64(product.productItemId),
                tx.pure.u64(product.productTypeId),
                tx.pure.u64(product.volume),
                tx.pure.u32(product.quantity),
            ],
        });
    }

    tx.moveCall({
        target: `${worldConfig.packageId}::${MODULES.CHARACTER}::return_owner_cap`,
        typeArguments: [`${worldConfig.packageId}::${MODULES.STORAGE_UNIT}::StorageUnit`],
        arguments: [tx.object(characterId), ownerCap, receipt],
    });

    const result = await executeSponsoredTransaction(
        tx,
        client,
        ownerKeypair,
        adminKeypair,
        ownerAddress,
        adminAddress,
        { showEffects: true, showEvents: true }
    );

    console.log("Product item(s) seeded successfully!");
    console.log("StorageUnit:", storageUnitId);
    console.log("Owner character:", characterId);
    for (const product of seedConfig.products) {
        console.log(
            `Product type ${product.productTypeId.toString()} x${product.quantity}, ` +
                `item id ${product.productItemId.toString()}`
        );
    }
    console.log("Transaction digest:", result.digest);
}

async function main() {
    console.log("============= Seed Supply Terminal Inventory ==============\n");
    try {
        const env = getEnvConfig();
        const adminCtx = initializeContext(env.network, env.adminExportedKey);
        await hydrateWorldConfig(adminCtx);

        const ownerKey = requireEnv("PLAYER_A_PRIVATE_KEY");
        const ownerCtx = initializeContext(env.network, ownerKey);
        ownerCtx.config = adminCtx.config;

        await seedInventory(
            adminCtx.client,
            adminCtx.keypair,
            ownerCtx.keypair,
            ownerCtx.address,
            adminCtx.address,
            adminCtx.config,
            buildInventorySeedConfig()
        );
    } catch (error) {
        handleError(error);
    }
}

function readRequiredBigInt(env: EnvLike, name: string): bigint {
    const value = env[name];
    if (!value) throw new Error(`${name} is required`);
    return parsePositiveBigInt(value, name);
}

function readOptionalBigInt(env: EnvLike, name: string, defaultValue: bigint): bigint {
    const value = env[name];
    return value ? parsePositiveBigInt(value, name) : defaultValue;
}

function readOptionalPositiveInteger(env: EnvLike, name: string, defaultValue: number): number {
    const value = env[name];
    if (!value) return defaultValue;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }
    return parsed;
}

function parsePositiveBigInt(value: string, name: string): bigint {
    if (!/^[0-9]+$/.test(value)) {
        throw new Error(`${name} must be a positive integer`);
    }
    const parsed = BigInt(value);
    if (parsed <= 0n) {
        throw new Error(`${name} must be a positive integer`);
    }
    return parsed;
}

function multiplySafePositiveIntegers(left: number, right: number, name: string): number {
    const result = left * right;
    if (!Number.isSafeInteger(result) || result <= 0) {
        throw new Error(`${name} must be a positive safe integer`);
    }
    return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
