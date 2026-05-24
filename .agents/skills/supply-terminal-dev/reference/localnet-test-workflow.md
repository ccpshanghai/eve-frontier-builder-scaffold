# Supply Terminal Extension Localnet Test Workflow

End-to-end testing checklist for Supply Terminal extension on localnet. Covers publish, configure, authorise, seed inventory, seed payment, and exchange.

## Prerequisites

1. World contracts deployed and configured on localnet Docker
2. `SuiJsonRpcClient` pointing to `http://127.0.0.1:9000` (`sui client active-env` = `local`)
3. `.env` populated with world package IDs and key variables (see [Read Deployment IDs Safely](#read-deployment-ids) below)
4. `ADMIN_PRIVATE_KEY` set — the world admin key used for localnet seeding

## Required Env Vars Checklist

Confirm `.env` has all of these before starting:

```bash
rg -n '^(SUI_NETWORK|ADMIN_PRIVATE_KEY|PLAYER_A_PRIVATE_KEY|WORLD_PACKAGE_ID|SUPPLY_TERMINAL_(PACKAGE|ADMIN_CAP|CONFIG)_ID|STORAGE_UNIT_ITEM_ID|CHARACTER_ITEM_ID)=' .env
```

## Read Deployment IDs

Inspect public deployment variables without printing secrets:

```bash
rg -n '^(SUI_NETWORK|WORLD_PACKAGE_ID|BUILDER_PACKAGE_ID|EXTENSION_CONFIG_ID|SUPPLY_TERMINAL_(PACKAGE|ADMIN_CAP|CONFIG)_ID|STORAGE_UNIT_ITEM_ID|CHARACTER_ITEM_ID)=' .env .env.example docker/.env.sui
```

## Step 1 — Publish Supply Terminal Extension to Localnet

Package must be published to the target network before other scripts. Steps:

1. Confirm active env points to localnet:
   ```bash
   sui client active-env    # should be "local"
   sui client active-address
   ```

2. Publish the extension package:
   ```bash
   sui client publish --skip-dependency-verification
   ```
   Run this from `move-contracts/supply_terminal_extension/`.

3. Extract from the publish output:
   - `SUPPLY_TERMINAL_PACKAGE_ID` — the published package ID
   - `SUPPLY_TERMINAL_ADMIN_CAP_ID` — the `AdminCap` created object
   - `SUPPLY_TERMINAL_CONFIG_ID` — the shared `ExtensionConfig` created object

4. Update `.env`:
   ```bash
   SUPPLY_TERMINAL_PACKAGE_ID=<package-id>
   SUPPLY_TERMINAL_CONFIG_ID=<extension-config-object-id>
   SUPPLY_TERMINAL_ADMIN_CAP_ID=<admin-cap-object-id>
   ```

5. Verify published objects:
   ```bash
   set -a; source .env; set +a
   sui client object "$SUPPLY_TERMINAL_PACKAGE_ID" --json | jq -r '.objType, .objectId'
   sui client object "$SUPPLY_TERMINAL_CONFIG_ID" --json | jq -r '.objType, (.owner.Shared.initial_shared_version | tostring)'
   sui client object "$SUPPLY_TERMINAL_ADMIN_CAP_ID" --json | jq -r '.objType, .owner.AddressOwner'
   ```

Expected:
- Package type ends with `supply_terminal_extension`
- `ExtensionConfig` has a shared owner with initial_shared_version
- `AdminCap` owner matches the publisher address

## Step 2 — Configure Listing

Sets product/payment rules on the shared `ExtensionConfig`.

```bash
pnpm configure-supply-terminal
```

Default listing (single): product `84210` x1 for payment `77800` x10.

For multi-listing, set `SUPPLY_TERMINAL_LISTINGS` in `.env`:
```bash
SUPPLY_TERMINAL_LISTINGS='[{"productTypeId":"84210","productQuantity":1,"paymentTypeId":"77800","paymentQuantity":10},{"productTypeId":"84211","productQuantity":3,"paymentTypeId":"77801","paymentQuantity":25}]'
```

**Verify:**
```bash
set -a; source .env; set +a
sui client dynamic-field "$SUPPLY_TERMINAL_CONFIG_ID" --json |
  jq '.dynamicFields[] | {product: .fieldObject.json.value.product_type_id, payment: .fieldObject.json.value.payment_type_id, enabled: .fieldObject.json.value.enabled}'
```

Expected output shows all configured listings with `enabled: true`.

## Step 3 — Authorise Extension

Grants `SupplyTerminalAuth` to the StorageUnit so it can participate in exchange transactions.

```bash
pnpm authorise-supply-terminal
```

If the storage unit owner cap belongs to player A (not admin), use:
```bash
ADMIN_PRIVATE_KEY="$PLAYER_A_PRIVATE_KEY" pnpm authorise-supply-terminal
```

**Verify:**
```bash
STORAGE_UNIT_ID=$(pnpm exec tsx -e 'import "dotenv/config"; import { deriveObjectId } from "./ts-scripts/utils/derive-object-id"; import { loadExtractedObjectIds, requireEnv } from "./ts-scripts/utils/helper"; const network = process.env.SUI_NETWORK ?? "localnet"; const extracted = loadExtractedObjectIds(network); if (!extracted) throw new Error("missing extracted ids"); console.log(deriveObjectId(extracted.world.objectRegistry, BigInt(requireEnv("STORAGE_UNIT_ITEM_ID")), requireEnv("WORLD_PACKAGE_ID")));')
sui client object "$STORAGE_UNIT_ID" --json |
  jq -r '.objType, .content.extension, .content.status.status."@variant"'
```

Expected: extension ends with `::config::SupplyTerminalAuth`, status is `ONLINE`.

## Step 4 — Seed Product Inventory

Populates the StorageUnit machine inventory with product stock. Uses sponsored tx (player signs, admin sponsors gas).

```bash
pnpm seed-supply-terminal-inventory
```

Optional overrides:
```bash
SUPPLY_TERMINAL_PRODUCT_ITEM_ID=842100000000001 \
SUPPLY_TERMINAL_PRODUCT_VOLUME=10 \
SUPPLY_TERMINAL_STOCK_PURCHASE_COUNT=10 \
pnpm seed-supply-terminal-inventory
```

`STOCK_PURCHASE_COUNT` (default 10) determines how much stock is seeded — `productQuantity * STOCK_PURCHASE_COUNT` for each listing.

**Verify:**
```bash
sui client dynamic-field "$STORAGE_UNIT_ID" --json |
  jq '.dynamicFields[] | select(.fieldObject.json.value.items.contents != null) | {inventory_key: .fieldObject.json.name, contents: .fieldObject.json.value.items.contents}'
```

Expected: machine inventory (keyed by storage unit owner cap ID) contains entries with product type IDs matching configured listings.

## Step 5 — Seed Payment Inventory

Populates the player's character-owned inventory in the StorageUnit with payment items.

```bash
pnpm seed-supply-terminal-payment
```

Optional override:
```bash
SUPPLY_TERMINAL_PAYMENT_ITEM_ID=778000000000001 pnpm seed-supply-terminal-payment
```

**Verify:**
```bash
sui client dynamic-field "$STORAGE_UNIT_ID" --json |
  jq '.dynamicFields[] | select(.fieldObject.json.value.items.contents != null) | {inventory_key: .fieldObject.json.name, contents: .fieldObject.json.value.items.contents}'
```

Expected: character inventory (keyed by character owner cap ID) contains entries with payment type IDs matching configured listings.

## Step 6 — Execute Exchange

Runs a test exchange as the player. Preflight validates inventory, listing config, and authorization before proceeding.

```bash
# Exchange default product (84210)
pnpm supply-terminal-exchange

# Exchange specific product
SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID=84211 pnpm supply-terminal-exchange
```

**Expected output:**
```
Exchange executed successfully!
Transaction digest: 0x...
Exchange event: {
  buyer_character_id: '0x...',
  payment_quantity: ...,
  payment_type_id: '77800',
  product_quantity: ...,
  product_type_id: '84210',
  storage_unit_id: '0x...'
}
```

## One-Liner Full Test

After publish and env setup, run all steps:
```bash
pnpm configure-supply-terminal && \
pnpm authorise-supply-terminal && \
pnpm seed-supply-terminal-inventory && \
pnpm seed-supply-terminal-payment && \
pnpm supply-terminal-exchange
```

## Troubleshooting

### MoveAbort code 1 in `borrow_child_object_mut`

Buyer inventory missing under StorageUnit. Check with:
```bash
sui client dynamic-field "$STORAGE_UNIT_ID" --json |
  jq '.dynamicFields[] | {inventory_key: .fieldObject.json.name, items: .fieldObject.json.value.items.contents}'
```

- Missing character owner cap inventory → run `seed-supply-terminal-payment`
- Missing machine owner inventory → run `seed-supply-terminal-inventory`
- Missing or mismatched payment/product type IDs → check listing config

### Package publish fails

Ensure active env is `local` and Docker localnet is running:
```bash
docker ps --format '{{.Names}} {{.Ports}}' | rg '9000|sui'
sui client active-env
```

### Dynamic fields show empty inventory

Seeding scripts rely on `test-resources.json` and `.env` values matching world contract IDs. Verify:
```bash
jq . test-resources.json
rg '^(STORAGE_UNIT_ITEM_ID|CHARACTER_ITEM_ID|WORLD_PACKAGE_ID)=' .env
```

### Script Error: "OwnerCap not found"

Authorisation or seeding scripts can't find the owner cap. Debug by deriving the owner cap ID and checking chain state:
```bash
pnpm exec tsx -e 'import "dotenv/config"; import { deriveObjectId } from "./ts-scripts/utils/derive-object-id"; import { loadExtractedObjectIds, requireEnv } from "./ts-scripts/utils/helper"; import { createClient, getConfig } from "./ts-scripts/utils/config"; import { getOwnerCap } from "./ts-scripts/helpers/storage-unit-extension"; void (async () => { const network = process.env.SUI_NETWORK ?? "localnet"; const worldPackageId = requireEnv("WORLD_PACKAGE_ID"); const extracted = loadExtractedObjectIds(network); if (!extracted) throw new Error("missing extracted ids"); const client = createClient(network as any); const config = getConfig(network as any) as any; config.packageId = worldPackageId; const storageUnitId = deriveObjectId(extracted.world.objectRegistry, BigInt(requireEnv("STORAGE_UNIT_ITEM_ID")), worldPackageId); console.log("StorageUnit ID:", storageUnitId); const oc = await getOwnerCap(storageUnitId, client as any, config); console.log("OwnerCap:", oc); })();'
```
