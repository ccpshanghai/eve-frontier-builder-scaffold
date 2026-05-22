import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { requireEnv } from "../utils/helper";
import { MODULE } from "./modules";

export type SupplyTerminalExtensionIds = {
    builderPackageId: string;
    adminCapId: string;
    extensionConfigId: string;
};

export function requireBuilderPackageId(): string {
    return requireEnv("SUPPLY_TERMINAL_PACKAGE_ID");
}

export function resolveIdsFromEnv(): {
    builderPackageId: string;
    extensionConfigId: string;
} {
    return {
        builderPackageId: requireBuilderPackageId(),
        extensionConfigId: requireEnv("SUPPLY_TERMINAL_CONFIG_ID"),
    };
}

export async function resolveSupplyTerminalExtensionIds(
    client: SuiJsonRpcClient,
    ownerAddress: string
): Promise<SupplyTerminalExtensionIds> {
    const { builderPackageId, extensionConfigId } = resolveIdsFromEnv();
    const adminCapType = `${builderPackageId}::${MODULE.CONFIG}::AdminCap`;
    const result = await client.getOwnedObjects({
        owner: ownerAddress,
        filter: { StructType: adminCapType },
        limit: 1,
    });

    const adminCapId = result.data[0]?.data?.objectId;
    if (!adminCapId) {
        throw new Error(
            `AdminCap not found for ${ownerAddress}. ` +
                `Make sure this address published the supply_terminal_extension package.`
        );
    }

    return { builderPackageId, adminCapId, extensionConfigId };
}
