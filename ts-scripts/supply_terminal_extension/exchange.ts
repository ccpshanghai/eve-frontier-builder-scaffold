import "dotenv/config";
import { Transaction } from "@mysten/sui/transactions";
import { MODULES } from "../utils/config";
import { MODULE } from "./modules";
import { requireBuilderPackageId } from "./extension-ids";
import { deriveObjectId } from "../utils/derive-object-id";
import {
    getEnvConfig,
    handleError,
    hydrateWorldConfig,
    initializeContext,
    requireEnv,
} from "../utils/helper";
import { getCharacterOwnerCap } from "../helpers/character";
import { getSelectedExchangeProductTypeId } from "./listing-config";
import { assertSupplyTerminalExchangeReady } from "./preflight";

async function exchange(
    ctx: ReturnType<typeof initializeContext>,
    storageUnitItemId: bigint,
    characterItemId: bigint,
    productTypeId: bigint
) {
    const { client, keypair, config } = ctx;
    const builderPackageId = requireBuilderPackageId();
    const extensionConfigId = requireEnv("SUPPLY_TERMINAL_CONFIG_ID");

    const characterId = deriveObjectId(config.objectRegistry, characterItemId, config.packageId);
    const storageUnitId = deriveObjectId(
        config.objectRegistry,
        storageUnitItemId,
        config.packageId
    );

    const playerOwnerCapId = await getCharacterOwnerCap(characterId, client, config);
    if (!playerOwnerCapId) {
        throw new Error(`Character OwnerCap not found for character ${characterId}`);
    }

    await assertSupplyTerminalExchangeReady(client, config, {
        builderPackageId,
        extensionConfigId,
        storageUnitId,
        storageUnitItemId,
        characterId,
        characterItemId,
        characterOwnerCapId: playerOwnerCapId,
        productTypeId,
    });

    const tx = new Transaction();

    // Borrow Character OwnerCap
    const [ownerCap, returnReceipt] = tx.moveCall({
        target: `${config.packageId}::${MODULES.CHARACTER}::borrow_owner_cap`,
        typeArguments: [`${config.packageId}::${MODULES.CHARACTER}::Character`],
        arguments: [tx.object(characterId), tx.object(playerOwnerCapId)],
    });

    // Call exchange
    tx.moveCall({
        target: `${builderPackageId}::${MODULE.SUPPLY_TERMINAL}::exchange`,
        typeArguments: [`${config.packageId}::${MODULES.CHARACTER}::Character`],
        arguments: [
            tx.object(extensionConfigId),
            tx.object(storageUnitId),
            tx.object(characterId),
            ownerCap,
            tx.pure.u64(productTypeId),
        ],
    });

    // Return Character OwnerCap
    tx.moveCall({
        target: `${config.packageId}::${MODULES.CHARACTER}::return_owner_cap`,
        typeArguments: [`${config.packageId}::${MODULES.CHARACTER}::Character`],
        arguments: [tx.object(characterId), ownerCap, returnReceipt],
    });

    const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: { showEffects: true, showEvents: true },
    });

    console.log("Exchange executed successfully!");
    console.log("Transaction digest:", result.digest);

    // Look for SupplyTerminalExchangeEvent
    if (result.events) {
        for (const event of result.events) {
            const parsed = event.parsedJson as Record<string, unknown> | undefined;
            if (parsed && parsed["payment_type_id"] !== undefined) {
                console.log("Exchange event:", parsed);
            }
        }
    }
}

async function main() {
    console.log("============= Supply Terminal Exchange ==============\n");
    try {
        const env = getEnvConfig();
        const playerKey = requireEnv("PLAYER_A_PRIVATE_KEY");
        const ctx = initializeContext(env.network, playerKey);
        await hydrateWorldConfig(ctx);

        const storageUnitItemId = BigInt(requireEnv("STORAGE_UNIT_ITEM_ID"));
        const characterItemId = BigInt(requireEnv("CHARACTER_ITEM_ID"));
        const productTypeId = getSelectedExchangeProductTypeId();

        await exchange(ctx, storageUnitItemId, characterItemId, productTypeId);
    } catch (error) {
        handleError(error);
    }
}

main();
