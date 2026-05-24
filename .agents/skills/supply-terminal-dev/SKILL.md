---
name: supply-terminal-dev
description: Inspect and troubleshoot builder-scaffold Supply Terminal extension development on Sui localnet. Use when Codex needs to check local deployment artifacts, .env wiring, Supply Terminal package/AdminCap/ExtensionConfig objects, listing config dynamic fields, StorageUnit authorization, or the configure/authorise/exchange scripts under move-contracts/supply_terminal_extension and ts-scripts/supply_terminal_extension.
---

# Supply Terminal Dev

## Ground Rules

Work from the `builder-scaffold` repo root unless the user says otherwise.

Never print private keys, recovery phrases, or full unfiltered `.env` contents. When reading env files, filter to public deployment variables only.

Prefer current artifacts and chain queries over remembered IDs. Localnet can be regenerated, so stale object IDs are common.

Do not confuse Sui client env with Move build env. `sui client active-env` controls the RPC target; `sui move test -e testnet` selects the `Move.toml` dependency environment and does not mean the package is deployed to public testnet.

## Quick Localnet Check

Confirm the Docker localnet and active client target:

```bash
docker ps --format '{{.Names}} {{.Ports}}' | rg '9000|sui'
sui client envs
sui client active-env
sui client active-address
```

For this repo's local deployment flow, the active env should usually be `local` and point to `http://127.0.0.1:9000`.

## Verify dApp UI with Playwright

When checking the Supply Terminal dapp UI, prefer Playwright through `pnpx` first. Do not start with a bare `playwright-cli` command because it is not guaranteed to be on `PATH` in this workspace.

Start the dapp from the repo root:

```bash
pnpm --dir dapps dev --host 127.0.0.1 --port 5173
```

Then try Playwright with `pnpx`:

```bash
pnpx playwright open http://127.0.0.1:5173/
pnpx playwright test <spec-file>
```

For Supply Terminal UI checks, verify `dapps/.env` has `VITE_OBJECT_ID` set to the current StorageUnit object ID, then confirm the page renders storage-backed slots and disconnected wallet trade actions are disabled.

If `pnpx playwright ...` is unavailable, fall back to the repo-local Playwright binary only after noting the fallback.

## Read Deployment IDs Safely

Inspect only public deployment variables:

```bash
rg -n '^(SUI_NETWORK|WORLD_PACKAGE_ID|BUILDER_PACKAGE_ID|EXTENSION_CONFIG_ID|SUPPLY_TERMINAL_(PACKAGE|ADMIN_CAP|CONFIG)_ID|STORAGE_UNIT_ITEM_ID|CHARACTER_ITEM_ID)=' .env .env.example docker/.env.sui
```

Inspect deployment artifacts:

```bash
jq . deployments/localnet/world_package.json
jq . deployments/localnet/extracted-object-ids.json
jq . deployments/localnet/supply_terminal_extension_package.json
jq . test-resources.json
```

Expected wiring for Supply Terminal:

- `SUI_NETWORK` is `localnet`.
- `BUILDER_PACKAGE_ID` equals `SUPPLY_TERMINAL_PACKAGE_ID`.
- `EXTENSION_CONFIG_ID` equals `SUPPLY_TERMINAL_CONFIG_ID`.
- `test-resources.json.storageUnit.itemId` matches `STORAGE_UNIT_ITEM_ID`.
- `deployments/localnet/supply_terminal_extension_package.json` records publish, configure, and authorise digests when this local deployment has been completed.

## Verify On-Chain Objects

Load `.env` without printing secrets:

```bash
set -a; source .env; set +a
```

Verify the published package:

```bash
sui client object "$SUPPLY_TERMINAL_PACKAGE_ID" --json |
  jq -r '.objType, .objectId, .prevTx'
```

Verify the shared `ExtensionConfig`:

```bash
sui client object "$SUPPLY_TERMINAL_CONFIG_ID" --json |
  jq -r '.objType, (.owner.Shared.initial_shared_version | tostring), .prevTx'
```

Verify the `AdminCap` owner:

```bash
sui client object "$SUPPLY_TERMINAL_ADMIN_CAP_ID" --json |
  jq -r '.objType, .owner.AddressOwner'
```

## Verify Listing Config

The listing set by `pnpm configure-supply-terminal` is stored as a dynamic field under `SUPPLY_TERMINAL_CONFIG_ID`.

```bash
set -a; source .env; set +a
sui client dynamic-field "$SUPPLY_TERMINAL_CONFIG_ID" --json |
  jq '.dynamicFields[] | {fieldId, valueType, config: .fieldObject.json.value, previousTransaction: .fieldObject.previousTransaction}'
```

The configured local listing should show:

- `enabled: true`
- `product_type_id: "84210"`
- `product_quantity: 1`
- `payment_type_id: "77800"`
- `payment_quantity: 10`

## Verify StorageUnit Authorization

Derive the StorageUnit object ID from the object registry and `STORAGE_UNIT_ITEM_ID`:

```bash
pnpm exec tsx -e 'import "dotenv/config"; import { deriveObjectId } from "./ts-scripts/utils/derive-object-id"; import { loadExtractedObjectIds, requireEnv } from "./ts-scripts/utils/helper"; const network = process.env.SUI_NETWORK ?? "localnet"; const worldPackageId = requireEnv("WORLD_PACKAGE_ID"); const extracted = loadExtractedObjectIds(network); if (!extracted) throw new Error(`missing deployments/${network}/extracted-object-ids.json`); console.log(deriveObjectId(extracted.world.objectRegistry, BigInt(requireEnv("STORAGE_UNIT_ITEM_ID")), worldPackageId));'
```

Then query the object:

```bash
STORAGE_UNIT_ID=<derived-object-id>
sui client object "$STORAGE_UNIT_ID" --json |
  jq -r '.objType, .content.extension, .content.status.status."@variant", .prevTx'
```

A configured Supply Terminal StorageUnit should have an extension ending in `::config::SupplyTerminalAuth` and status `ONLINE`.

## Diagnose Exchange Abort

For this error:

```text
MoveAbort in 2nd command, abort code: 1, in '0x2::dynamic_field::borrow_child_object_mut'
```

Treat the 2nd command as the `supply_terminal::exchange` move call in `ts-scripts/supply_terminal_extension/exchange.ts`. First check whether the buyer Character-owned inventory exists under the StorageUnit.

Get the buyer Character OwnerCap ID:

```bash
pnpm exec tsx -e 'import "dotenv/config"; import { deriveObjectId } from "./ts-scripts/utils/derive-object-id"; import { loadExtractedObjectIds, requireEnv } from "./ts-scripts/utils/helper"; import { createClient, getConfig } from "./ts-scripts/utils/config"; import { getCharacterOwnerCap } from "./ts-scripts/helpers/character"; void (async () => { const network = process.env.SUI_NETWORK ?? "localnet"; const worldPackageId = requireEnv("WORLD_PACKAGE_ID"); const extracted = loadExtractedObjectIds(network); if (!extracted) throw new Error("missing extracted ids"); const client = createClient(network as any); const config = getConfig(network as any) as any; config.packageId = worldPackageId; const characterId = deriveObjectId(extracted.world.objectRegistry, BigInt(requireEnv("CHARACTER_ITEM_ID")), worldPackageId); const storageUnitId = deriveObjectId(extracted.world.objectRegistry, BigInt(requireEnv("STORAGE_UNIT_ITEM_ID")), worldPackageId); const ownerCapId = await getCharacterOwnerCap(characterId, client as any, config); console.log(JSON.stringify({characterId, characterOwnerCapId: ownerCapId, storageUnitId}, null, 2)); })();'
```

List StorageUnit inventory dynamic fields:

```bash
set -a; source .env; set +a
STORAGE_UNIT_ID=$(pnpm exec tsx -e 'import "dotenv/config"; import { deriveObjectId } from "./ts-scripts/utils/derive-object-id"; import { loadExtractedObjectIds, requireEnv } from "./ts-scripts/utils/helper"; const network = process.env.SUI_NETWORK ?? "localnet"; const extracted = loadExtractedObjectIds(network); if (!extracted) throw new Error("missing extracted ids"); console.log(deriveObjectId(extracted.world.objectRegistry, BigInt(requireEnv("STORAGE_UNIT_ITEM_ID")), requireEnv("WORLD_PACKAGE_ID")));')
sui client dynamic-field "$STORAGE_UNIT_ID" --json |
  jq '.dynamicFields[] | {inventory_key: .fieldObject.json.name, items: .fieldObject.json.value.items.contents}'
```

If `characterOwnerCapId` is missing from `inventory_key`, the buyer has no owned inventory in this StorageUnit. If it exists but lacks `payment_type_id`, the payment item has not been seeded. Also verify the machine owner inventory, keyed by the StorageUnit `owner_cap_id`, has the configured `product_type_id`.

## Seed Spec Inventory Locally

Use this only for Docker localnet test data. It does not change source files.

Run world seeding scripts inside the Sui dev container. The copied `docker/world-contracts/node_modules` may contain Linux esbuild binaries and can fail on macOS, so do not run those scripts directly on the host.

```bash
docker exec docker_sui-dev_run_db7aa44c6a45 sh -lc '
set -e
cd /workspace/builder-scaffold
tmp_product=$(mktemp /tmp/supply-terminal-product.XXXXXX.json)
tmp_payment=$(mktemp /tmp/supply-terminal-payment.XXXXXX.json)
jq ".item.typeId = 84210 | .item.itemId = 842100001" test-resources.json > "$tmp_product"
jq ".character.gameCharacterBId = .character.gameCharacterId | .item.typeId = 77800 | .item.itemId = 778000001" test-resources.json > "$tmp_payment"
set -a
. /workspace/builder-scaffold/.env
set +a
cd /workspace/world-contracts
TEST_RESOURCES_PATH="$tmp_product" pnpm game-item-to-chain
PLAYER_B_PRIVATE_KEY="$PLAYER_A_PRIVATE_KEY" TEST_RESOURCES_PATH="$tmp_payment" pnpm deposit-to-ephemeral-inventory
'
```

This seeds:

- machine main inventory: Carbon Weave `84210`
- current `.env` player A Character-owned inventory: Feldspar Crystals `77800`

## End-to-End Test Workflow

Full publish-to-exchange test flow is documented in `reference/localnet-test-workflow.md`. Steps:

1. Publish package → configure listing → authorise extension → seed inventory → seed payment → exchange

Quick one-liner (after publish + env setup):
```bash
pnpm configure-supply-terminal && \
pnpm authorise-supply-terminal && \
pnpm seed-supply-terminal-inventory && \
pnpm seed-supply-terminal-payment && \
pnpm supply-terminal-exchange
```

Use `ADMIN_PRIVATE_KEY="$PLAYER_A_PRIVATE_KEY" pnpm authorise-supply-terminal` when the seeded local StorageUnit owner cap belongs to player A rather than the default admin key. Do not echo either key.

## Useful Source Files

Check these files when behavior and chain state disagree:

- `move-contracts/supply_terminal_extension/sources/supply_terminal.move`
- `move-contracts/supply_terminal_extension/sources/config.move`
- `move-contracts/supply_terminal_extension/tests/supply_terminal_tests.move`
- `ts-scripts/supply_terminal_extension/configure-listing.ts`
- `ts-scripts/supply_terminal_extension/authorise-extension.ts`
- `ts-scripts/supply_terminal_extension/exchange.ts`
- `ts-scripts/supply_terminal_extension/extension-ids.ts`
