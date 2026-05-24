import "dotenv/config";
import { Transaction } from "@mysten/sui/transactions";
import { MODULES } from "../utils/config";
import { deriveObjectId } from "../utils/derive-object-id";
import {
    getEnvConfig,
    handleError,
    hydrateWorldConfig,
    initializeContext,
    requireEnv,
} from "../utils/helper";
import { getOwnerCap as getStorageUnitOwnerCap } from "../helpers/storage-unit-extension";

async function onlineStorage(
    ctx: ReturnType<typeof initializeContext>,
    storageUnitItemId: bigint,
    characterItemId: bigint,
    networkNodeItemId: bigint,
) {
    const { client, keypair, config, address } = ctx;

    const characterId = deriveObjectId(config.objectRegistry, characterItemId, config.packageId);
    const storageUnitId = deriveObjectId(config.objectRegistry, storageUnitItemId, config.packageId);
    const networkNodeId = deriveObjectId(config.objectRegistry, networkNodeItemId, config.packageId);

    const storageUnitOwnerCapId = await getStorageUnitOwnerCap(storageUnitId, client, config, address);
    if (!storageUnitOwnerCapId) {
        throw new Error(`OwnerCap not found for storage unit ${storageUnitId}`);
    }

    const tx = new Transaction();

    const [storageUnitOwnerCap, returnReceipt] = tx.moveCall({
        target: `${config.packageId}::${MODULES.CHARACTER}::borrow_owner_cap`,
        typeArguments: [`${config.packageId}::${MODULES.STORAGE_UNIT}::StorageUnit`],
        arguments: [tx.object(characterId), tx.object(storageUnitOwnerCapId)],
    });

    tx.moveCall({
        target: `${config.packageId}::${MODULES.STORAGE_UNIT}::online`,
        arguments: [
            tx.object(storageUnitId),
            tx.object(networkNodeId),
            tx.object(config.energyConfig),
            storageUnitOwnerCap,
        ],
    });

    tx.moveCall({
        target: `${config.packageId}::${MODULES.CHARACTER}::return_owner_cap`,
        typeArguments: [`${config.packageId}::${MODULES.STORAGE_UNIT}::StorageUnit`],
        arguments: [tx.object(characterId), storageUnitOwnerCap, returnReceipt],
    });

    const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: { showEffects: true, showEvents: true },
    });

    console.log("Storage unit brought online!");
    console.log("StorageUnit:", storageUnitId);
    console.log("NetworkNode:", networkNodeId);
    console.log("Transaction digest:", result.digest);
}

async function main() {
    console.log("============= Online Storage Unit ==============\n");
    try {
        const env = getEnvConfig();
        const ownerKey = requireEnv("PLAYER_A_PRIVATE_KEY");
        const ctx = initializeContext(env.network, ownerKey);
        await hydrateWorldConfig(ctx);

        const storageUnitItemId = BigInt(requireEnv("STORAGE_UNIT_ITEM_ID"));
        const characterItemId = BigInt(requireEnv("CHARACTER_ITEM_ID"));
        const networkNodeItemId = BigInt(requireEnv("NETWORK_NODE_ITEM_ID"));

        await onlineStorage(ctx, storageUnitItemId, characterItemId, networkNodeItemId);
    } catch (error) {
        handleError(error);
    }
}

main();
