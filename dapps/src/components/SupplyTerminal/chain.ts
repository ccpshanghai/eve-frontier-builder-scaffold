import { SuiJsonRpcClient, type DynamicFieldName } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { SUPPLY_TERMINAL_CONFIG } from "./config";
import type {
  ListingConfig,
  SupplyTerminalChainEnv,
  SupplyTerminalChainSnapshot,
  SupplyTerminalCharacterSnapshot,
  SupplyTerminalInventoryItem,
  SupplyTerminalInventorySnapshot,
  SupplyTerminalPreflightView,
  SupplyTerminalStorageSnapshot,
} from "./types";

const DEFAULT_RPC_URL = "http://127.0.0.1:9000";
const SUPPLY_TERMINAL_AUTH_SUFFIX = "::config::SupplyTerminalAuth";
const LISTING_CONFIG_SUFFIX = "::supply_terminal::ListingConfig";
const INVENTORY_SUFFIX = "::inventory::Inventory";
const CHARACTER_TYPE = "character::Character";
const CHARACTER_MODULE_TARGET = "character";
const SUPPLY_TERMINAL_MODULE_TARGET = "supply_terminal";

type MoveFields = Record<string, unknown>;

type DynamicFieldInfo = {
  name: DynamicFieldName;
  objectType?: string | null;
};

export type LoadSupplyTerminalSnapshotParams = {
  env?: SupplyTerminalChainEnv;
  client?: SuiJsonRpcClient;
  accountAddress?: string | null;
};

export type BuildSupplyTerminalExchangeTransactionParams = {
  env: SupplyTerminalChainEnv;
  snapshot: SupplyTerminalChainSnapshot;
  sender: string;
};

export function readSupplyTerminalEnv(
  env: Partial<ImportMetaEnv> = import.meta.env,
): SupplyTerminalChainEnv {
  const storageObjectId = readRequiredEnv(env, "VITE_OBJECT_ID");
  const worldPackageId = readRequiredEnv(env, "VITE_EVE_WORLD_PACKAGE_ID");
  const supplyTerminalPackageId = readRequiredEnv(
    env,
    "VITE_SUPPLY_TERMINAL_PACKAGE_ID",
  );
  const supplyTerminalConfigId = readRequiredEnv(
    env,
    "VITE_SUPPLY_TERMINAL_CONFIG_ID",
  );

  return {
    storageObjectId,
    worldPackageId,
    supplyTerminalPackageId,
    supplyTerminalConfigId,
    rpcUrl: env.VITE_SUI_RPC_URL?.trim() || DEFAULT_RPC_URL,
  };
}

export function createSupplyTerminalRpcClient(
  env: SupplyTerminalChainEnv = readSupplyTerminalEnv(),
): SuiJsonRpcClient {
  return new SuiJsonRpcClient({
    network: "localnet",
    url: env.rpcUrl,
  });
}

export function parseInventoryItems(
  contents: unknown[],
): SupplyTerminalInventoryItem[] {
  return contents.flatMap((entry) => {
    const fields = getTypedFields(entry);
    const value = getTypedFields(fields?.value);
    const item = getTypedFields(value?.value) ?? value;
    const typeId = toFiniteNumber(
      item?.type_id ?? value?.type_id ?? fields?.key,
    );
    const quantity = toFiniteNumber(
      item?.quantity ?? value?.quantity ?? fields?.quantity,
    );

    if (typeId === null || quantity === null) {
      return [];
    }

    return [{ typeId, quantity }];
  });
}

export function selectInventoryForKey(
  inventories: SupplyTerminalInventorySnapshot[],
  key: string | null | undefined,
): SupplyTerminalInventoryItem[] {
  const normalizedKey = key?.toLowerCase();
  if (!normalizedKey) return [];

  return (
    inventories.find(
      (inventory) => inventory.key.toLowerCase() === normalizedKey,
    )?.items ?? []
  );
}

export function validateSupplyTerminalSnapshot(
  snapshot: SupplyTerminalChainSnapshot,
): SupplyTerminalPreflightView {
  const listing = snapshot.listing;
  const extensionAuthorized = snapshot.storage.extension.includes(
    SUPPLY_TERMINAL_AUTH_SUFFIX,
  );

  if (!listing?.enabled) {
    return {
      paymentAvailable: false,
      machineStockAvailable: false,
      listingEnabled: false,
      extensionAuthorized,
      disabledReason: "Listing disabled",
    };
  }

  const machineStockAvailable = hasItem(
    snapshot.machineInventory,
    listing.productTypeId,
    listing.productQuantity,
  );
  const paymentAvailable =
    Boolean(snapshot.character) &&
    hasItem(
      snapshot.buyerInventory,
      listing.paymentTypeId,
      listing.paymentQuantity,
    );

  return {
    paymentAvailable,
    machineStockAvailable,
    listingEnabled: true,
    extensionAuthorized,
    disabledReason: !extensionAuthorized
      ? "Extension authorization required"
      : !machineStockAvailable
        ? `${SUPPLY_TERMINAL_CONFIG.product.name} unavailable`
        : !snapshot.character
          ? "Connected wallet does not own a Character OwnerCap"
          : !paymentAvailable
            ? `Requires ${SUPPLY_TERMINAL_CONFIG.payment.name} x${listing.paymentQuantity}`
            : undefined,
  };
}

export async function loadSupplyTerminalSnapshot({
  env = readSupplyTerminalEnv(),
  client = createSupplyTerminalRpcClient(env),
  accountAddress,
}: LoadSupplyTerminalSnapshotParams = {}): Promise<SupplyTerminalChainSnapshot> {
  const [storage, listing, inventories] = await Promise.all([
    loadStorageUnit(client, env.storageObjectId),
    loadListingConfig(client, env),
    loadInventories(client, env.storageObjectId),
  ]);
  const character = await loadWalletCharacter(
    client,
    env,
    accountAddress,
    inventories,
  );

  return {
    storage,
    listing,
    machineInventory: selectInventoryForKey(inventories, storage.ownerCapId),
    buyerInventory: selectInventoryForKey(inventories, character?.ownerCapId),
    character,
  };
}

export function buildSupplyTerminalExchangeTransaction({
  env,
  snapshot,
  sender,
}: BuildSupplyTerminalExchangeTransactionParams): Transaction {
  const character = snapshot.character;
  if (!character) {
    throw new Error("Connected wallet does not own a Character OwnerCap");
  }

  const tx = new Transaction();
  tx.setSender(sender);

  const characterType = `${env.worldPackageId}::${CHARACTER_TYPE}`;
  const [ownerCap, returnReceipt] = tx.moveCall({
    target: `${env.worldPackageId}::${CHARACTER_MODULE_TARGET}::borrow_owner_cap`,
    typeArguments: [characterType],
    arguments: [tx.object(character.id), tx.object(character.ownerCapId)],
  });

  tx.moveCall({
    target: `${env.supplyTerminalPackageId}::${SUPPLY_TERMINAL_MODULE_TARGET}::exchange`,
    typeArguments: [characterType],
    arguments: [
      tx.object(env.supplyTerminalConfigId),
      tx.object(snapshot.storage.id),
      tx.object(character.id),
      ownerCap,
    ],
  });

  tx.moveCall({
    target: `${env.worldPackageId}::${CHARACTER_MODULE_TARGET}::return_owner_cap`,
    typeArguments: [characterType],
    arguments: [tx.object(character.id), ownerCap, returnReceipt],
  });

  return tx;
}

async function loadListingConfig(
  client: SuiJsonRpcClient,
  env: SupplyTerminalChainEnv,
): Promise<ListingConfig | null> {
  const fields = await getAllDynamicFields(client, env.supplyTerminalConfigId);
  const listingField = fields.find((field) =>
    String(field.objectType).endsWith(
      `${env.supplyTerminalPackageId}${LISTING_CONFIG_SUFFIX}`,
    ),
  );

  if (!listingField) return null;

  const fieldObject = await client.getDynamicFieldObject({
    parentId: env.supplyTerminalConfigId,
    name: listingField.name,
  });
  const root = getMoveObjectFields(fieldObject);
  const listing = getTypedFields(root?.value);

  if (!listing) return null;

  return {
    enabled: Boolean(listing.enabled),
    productTypeId: Number(listing.product_type_id),
    productQuantity: Number(listing.product_quantity),
    paymentTypeId: Number(listing.payment_type_id),
    paymentQuantity: Number(listing.payment_quantity),
  };
}

async function loadStorageUnit(
  client: SuiJsonRpcClient,
  storageObjectId: string,
): Promise<SupplyTerminalStorageSnapshot> {
  const result = await client.getObject({
    id: storageObjectId,
    options: { showContent: true },
  });
  const fields = getMoveObjectFields(result);

  if (!fields) {
    throw new Error(
      `StorageUnit object ${storageObjectId} was not found or has no Move content`,
    );
  }

  return {
    id: storageObjectId,
    ownerCapId: String(fields.owner_cap_id ?? ""),
    status: getStatusVariant(fields.status) ?? "UNKNOWN",
    extension: getTypeName(fields.extension),
  };
}

async function loadInventories(
  client: SuiJsonRpcClient,
  storageObjectId: string,
): Promise<SupplyTerminalInventorySnapshot[]> {
  const fields = await getAllDynamicFields(client, storageObjectId);
  const inventoryFields = fields.filter((field) =>
    String(field.objectType).endsWith(INVENTORY_SUFFIX),
  );

  return Promise.all(
    inventoryFields.map(async (field) => {
      const fieldObject = await client.getDynamicFieldObject({
        parentId: storageObjectId,
        name: field.name,
      });
      const root = getMoveObjectFields(fieldObject);
      const inventory = getTypedFields(root?.value);
      const items = getTypedFields(inventory?.items);
      const contents = Array.isArray(items?.contents) ? items.contents : [];

      return {
        key: readDynamicFieldName(root?.name ?? field.name),
        items: parseInventoryItems(contents),
      };
    }),
  );
}

async function loadWalletCharacter(
  client: SuiJsonRpcClient,
  env: SupplyTerminalChainEnv,
  accountAddress: string | null | undefined,
  inventories: SupplyTerminalInventorySnapshot[],
): Promise<SupplyTerminalCharacterSnapshot | null> {
  const owner = accountAddress?.trim();
  if (!owner) return null;

  const result = await client.getOwnedObjects({
    owner,
    filter: {
      StructType: `${env.worldPackageId}::access::OwnerCap<${env.worldPackageId}::${CHARACTER_TYPE}>`,
    },
    options: { showContent: true },
  });
  const candidates = result.data.flatMap((entry) => {
    const data = getRecord(entry.data);
    const ownerCapId =
      typeof data?.objectId === "string" ? data.objectId : null;
    const fields = getMoveObjectFields(entry);
    const characterId = readObjectId(
      fields?.authorized_object_id ?? fields?.object_id ?? owner,
    );

    if (!ownerCapId || !characterId) return [];

    return [{ id: characterId, ownerCapId }];
  });

  return (
    candidates.find((candidate) =>
      inventories.some(
        (inventory) =>
          inventory.key.toLowerCase() === candidate.ownerCapId.toLowerCase(),
      ),
    ) ??
    candidates[0] ??
    null
  );
}

async function getAllDynamicFields(
  client: SuiJsonRpcClient,
  parentId: string,
): Promise<DynamicFieldInfo[]> {
  const fields: DynamicFieldInfo[] = [];
  let cursor: string | null | undefined;

  do {
    const page = await client.getDynamicFields({ parentId, cursor });
    fields.push(...(page.data as DynamicFieldInfo[]));
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);

  return fields;
}

function hasItem(
  inventory: SupplyTerminalInventoryItem[],
  typeId: number,
  quantity: number,
): boolean {
  return inventory.some(
    (item) => item.typeId === typeId && item.quantity >= quantity,
  );
}

function readRequiredEnv(
  env: Partial<ImportMetaEnv>,
  key: keyof ImportMetaEnv,
): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${String(key)} is not configured`);
  }

  return value;
}

function getMoveObjectFields(response: unknown): MoveFields | null {
  const root = getRecord(response);
  const data = getRecord(root?.data) ?? root;
  const fieldObjectData = getRecord(getRecord(root?.fieldObject)?.data);
  const content =
    getRecord(data?.content) ?? getRecord(fieldObjectData?.content);

  return getTypedFields(content?.fields ?? content);
}

function getTypedFields(value: unknown): MoveFields | null {
  const record = getRecord(value);
  if (!record) return null;

  return getRecord(record.fields) ?? record;
}

function getRecord(value: unknown): MoveFields | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as MoveFields;
}

function getStatusVariant(value: unknown): string | null {
  if (typeof value === "string") return value;

  const fields = getTypedFields(value);
  if (!fields) return null;

  const variant = fields.variant ?? fields["@variant"];
  if (typeof variant === "string") return variant;

  return getStatusVariant(fields.status);
}

function getTypeName(value: unknown): string {
  if (typeof value === "string") return value;

  const fields = getTypedFields(value);
  if (!fields) return "";

  const name = fields.name ?? fields.repr;
  return typeof name === "string" ? name : "";
}

function readDynamicFieldName(value: unknown): string {
  if (typeof value === "string") return value;

  const fields = getTypedFields(value);
  const nameValue = fields?.value ?? fields?.name ?? fields?.id ?? value;
  const objectId = readObjectId(nameValue);

  return objectId ?? String(nameValue ?? "");
}

function readObjectId(value: unknown): string | null {
  if (typeof value === "string") return value;

  const fields = getTypedFields(value);
  const id = fields?.id ?? fields?.bytes ?? fields?.value;

  return typeof id === "string" ? id : null;
}

function toFiniteNumber(value: unknown): number | null {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}
