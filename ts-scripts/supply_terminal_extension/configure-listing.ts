import "dotenv/config";
import { Transaction } from "@mysten/sui/transactions";
import { buildSupplyTerminalListings } from "./listing-config";
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
    const listings = buildSupplyTerminalListings();

    const tx = new Transaction();

    for (const listing of listings) {
        tx.moveCall({
            target: `${builderPackageId}::${MODULE.SUPPLY_TERMINAL}::set_listing_config`,
            arguments: [
                tx.object(extensionConfigId),
                tx.object(adminCapId),
                tx.pure.bool(true),
                tx.pure.u64(listing.productTypeId),
                tx.pure.u32(listing.productQuantity),
                tx.pure.u64(listing.paymentTypeId),
                tx.pure.u32(listing.paymentQuantity),
            ],
        });
    }

    const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: { showEffects: true, showEvents: true },
    });

    console.log(`Configured ${listings.length} Supply Terminal listing(s) successfully!`);
    for (const listing of listings) {
        console.log(
            `Product ${listing.productTypeId.toString()} x${listing.productQuantity} for payment ` +
                `${listing.paymentTypeId.toString()} x${listing.paymentQuantity}`
        );
    }
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
