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
import { getCharacterOwnerCap } from "../helpers/character";
import { buildSupplyTerminalListings } from "./listing-config";

const DEFAULT_PAYMENT_ITEM_ID_BASE = 7_780_000_000_000_000n;

export type PaymentSeed = {
    paymentTypeId: bigint;
    paymentItemId: bigint;
    volume: bigint;
    quantity: number;
};

export type PaymentSeedConfig = {
    storageUnitItemId: bigint;
    characterItemId: bigint;
    payments: PaymentSeed[];
};

type EnvLike = Record<string, string | undefined>;

export function buildPaymentSeedConfig(
    env: EnvLike = process.env,
    nowMs: number = Date.now()
): PaymentSeedConfig {
    const basePaymentItemId = readOptionalBigInt(
        env,
        "SUPPLY_TERMINAL_PAYMENT_ITEM_ID",
        DEFAULT_PAYMENT_ITEM_ID_BASE + BigInt(nowMs)
    );

    return {
        storageUnitItemId: readRequiredBigInt(env, "STORAGE_UNIT_ITEM_ID"),
        characterItemId: readRequiredBigInt(env, "CHARACTER_ITEM_ID"),
        payments: buildSupplyTerminalListings(env).map((listing, index) => ({
            paymentTypeId: listing.paymentTypeId,
            paymentItemId: basePaymentItemId + BigInt(index),
            volume: listing.paymentVolume,
            quantity: listing.paymentQuantity,
        })),
    };
}

async function seedPayment(
    client: SuiJsonRpcClient,
    adminKeypair: Ed25519Keypair,
    playerKeypair: Ed25519Keypair,
    playerAddress: string,
    adminAddress: string,
    worldConfig: WorldConfig,
    seedConfig: PaymentSeedConfig
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

    const ownerCapId = await getCharacterOwnerCap(characterId, client, worldConfig, playerAddress);
    if (!ownerCapId) {
        throw new Error(`Character OwnerCap not found for character ${characterId}`);
    }

    const tx = new Transaction();
    tx.setSender(playerAddress);
    tx.setGasOwner(adminAddress);

    const [ownerCap, receipt] = tx.moveCall({
        target: `${worldConfig.packageId}::${MODULES.CHARACTER}::borrow_owner_cap`,
        typeArguments: [`${worldConfig.packageId}::${MODULES.CHARACTER}::Character`],
        arguments: [tx.object(characterId), tx.object(ownerCapId)],
    });

    for (const payment of seedConfig.payments) {
        tx.moveCall({
            target: `${worldConfig.packageId}::${MODULES.STORAGE_UNIT}::game_item_to_chain_inventory`,
            typeArguments: [`${worldConfig.packageId}::${MODULES.CHARACTER}::Character`],
            arguments: [
                tx.object(storageUnitId),
                tx.object(worldConfig.adminAcl),
                tx.object(characterId),
                ownerCap,
                tx.pure.u64(payment.paymentItemId),
                tx.pure.u64(payment.paymentTypeId),
                tx.pure.u64(payment.volume),
                tx.pure.u32(payment.quantity),
            ],
        });
    }

    tx.moveCall({
        target: `${worldConfig.packageId}::${MODULES.CHARACTER}::return_owner_cap`,
        typeArguments: [`${worldConfig.packageId}::${MODULES.CHARACTER}::Character`],
        arguments: [tx.object(characterId), ownerCap, receipt],
    });

    const result = await executeSponsoredTransaction(
        tx,
        client,
        playerKeypair,
        adminKeypair,
        playerAddress,
        adminAddress,
        { showEffects: true, showEvents: true }
    );

    console.log("Payment item(s) seeded successfully!");
    console.log("StorageUnit:", storageUnitId);
    console.log("Character:", characterId);
    for (const payment of seedConfig.payments) {
        console.log(
            `Payment type ${payment.paymentTypeId.toString()} x${payment.quantity}, ` +
                `item id ${payment.paymentItemId.toString()}`
        );
    }
    console.log("Transaction digest:", result.digest);
}

async function main() {
    console.log("============= Seed Supply Terminal Payment ==============\n");
    try {
        const env = getEnvConfig();
        const adminCtx = initializeContext(env.network, env.adminExportedKey);
        await hydrateWorldConfig(adminCtx);

        const playerKey = requireEnv("PLAYER_A_PRIVATE_KEY");
        const playerCtx = initializeContext(env.network, playerKey);
        playerCtx.config = adminCtx.config;

        await seedPayment(
            adminCtx.client,
            adminCtx.keypair,
            playerCtx.keypair,
            playerCtx.address,
            adminCtx.address,
            adminCtx.config,
            buildPaymentSeedConfig()
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
