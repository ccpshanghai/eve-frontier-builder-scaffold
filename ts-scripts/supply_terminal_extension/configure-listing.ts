import "dotenv/config";
import { Transaction } from "@mysten/sui/transactions";
import { MODULE } from "./modules";
import { requireBuilderPackageId } from "./extension-ids";
import {
    getEnvConfig,
    handleError,
    hydrateWorldConfig,
    initializeContext,
    requireEnv,
} from "../utils/helper";

async function configureListing(ctx: ReturnType<typeof initializeContext>) {
    const { client, keypair, config: worldConfig } = ctx;
    const builderPackageId = requireBuilderPackageId();
    const extensionConfigId = requireEnv("SUPPLY_TERMINAL_CONFIG_ID");
    const adminCapId = requireEnv("SUPPLY_TERMINAL_ADMIN_CAP_ID");

    // Hardcoded per spec: Carbon Weave (84210) x1 for Feldspar Crystals (77800) x10
    const tx = new Transaction();

    tx.moveCall({
        target: `${builderPackageId}::${MODULE.CONFIG}::add_rule`,
        typeArguments: [
            `${builderPackageId}::${MODULE.SUPPLY_TERMINAL}::ListingConfigKey`,
            `${builderPackageId}::${MODULE.SUPPLY_TERMINAL}::ListingConfig`,
        ],
        arguments: [
            tx.object(extensionConfigId),
            tx.object(adminCapId),
            tx.pure.vector("u8", []), // ListingConfigKey {}
            tx.pure.vector("u8", [
                1,  // enabled: true
                50, 82, 1, 0, 0, 0, 0, 0,  // product_type_id: 84210 (u64 LE)
                1, 0, 0, 0,                   // product_quantity: 1 (u32 LE)
                248, 47, 1, 0, 0, 0, 0, 0,  // payment_type_id: 77800 (u64 LE)
                10, 0, 0, 0,                  // payment_quantity: 10 (u32 LE)
            ]),
        ],
    });

    const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: { showEffects: true, showEvents: true },
    });

    console.log("Listing configured successfully!");
    console.log("Transaction digest:", result.digest);
}

async function main() {
    console.log("============= Configure Supply Terminal Listing ==============\n");
    try {
        const env = getEnvConfig();
        const adminKey = requireEnv("ADMIN_PRIVATE_KEY");
        const ctx = initializeContext(env.network, adminKey);
        await hydrateWorldConfig(ctx);
        await configureListing(ctx);
    } catch (error) {
        handleError(error);
    }
}

main();
