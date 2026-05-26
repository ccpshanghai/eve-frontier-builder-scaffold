import { bcs } from "@mysten/sui/bcs";
import { deriveObjectID } from "@mysten/sui/utils";

const TenantItemId = bcs.struct("TenantItemId", {
  id: bcs.u64(),
  tenant: bcs.string(),
});

export function deriveTenantObjectId({
  registryId,
  itemId,
  packageId,
  tenant,
}: {
  registryId: string;
  itemId: string;
  packageId: string;
  tenant: string;
}): string {
  const serializedKey = TenantItemId.serialize({
    id: BigInt(itemId),
    tenant,
  }).toBytes();
  const typeTag = `${packageId}::in_game_id::TenantItemId`;

  return deriveObjectID(registryId, typeTag, serializedKey);
}
