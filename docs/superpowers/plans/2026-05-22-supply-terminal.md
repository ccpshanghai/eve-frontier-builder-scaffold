# Supply Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Supply Terminal — an atomic item-for-item vending machine extension for StorageUnit, with Move contract, TS scripts, and dApp.

**Architecture:** Three units. Move contract (`supply_terminal_extension` package, config + supply_terminal modules) defines the extension witness and `exchange()` function. TS scripts configure listing and test exchange on localnet. dApp extends existing `dapps/` with dual-role UI — owner can authorize/configure via corner controls, all users can exchange.

**Tech Stack:** Move 2024 (Sui), TypeScript/Node.js (scripts), React 19 + Vite + Radix UI + @evefrontier/dapp-kit (dApp). Follows `smart_gate_extension` patterns throughout.

---

## Phase 1: Move Contract

### Task 1: Create package skeleton

**Files:**
- Create: `move-contracts/supply_terminal_extension/Move.toml`
- Create: `move-contracts/supply_terminal_extension/sources/config.move`
- Create: `move-contracts/supply_terminal_extension/sources/supply_terminal.move`

- [ ] **Step 1: Create Move.toml**

Reference `smart_gate_extension/Move.toml` for pattern. Package name `supply_terminal_extension`, edition `2024`. Dependency `world = { local = "../../../world-contracts/contracts/world" }`.

```toml
[package]
name = "supply_terminal_extension"
edition = "2024"

[dependencies]
world = { local = "../../../world-contracts/contracts/world" }

[addresses]
supply_terminal_extension = "0x0"
```

- [ ] **Step 2: Verify world dependency resolves**

```bash
cd move-contracts/supply_terminal_extension && sui move build -e testnet 2>&1 | head -20
```

Expected: succeeds (even with empty sources) or fails only on missing source modules, not on dependency resolution.

- [ ] **Step 3: Commit**

```bash
git add move-contracts/supply_terminal_extension/
git commit -m "feat: add supply_terminal_extension package skeleton"
```

---

### Task 2: Implement config.move

**Files:**
- Modify: `move-contracts/supply_terminal_extension/sources/config.move`

**Reference:** `move-contracts/smart_gate_extension/sources/config.move`

- [ ] **Step 1: Write config.move**

```move
/// Module: supply_terminal_extension::config
/// Extension witness, AdminCap, and dynamic-field configuration.
module supply_terminal_extension::config;

// ============================================================
// Witness & Capability
// ============================================================

/// Witness type for StorageUnit extension authorization.
/// Only code in this package can produce it.
public struct SupplyTerminalAuth has drop {}

/// Admin capability — holder can configure listing rules.
public struct AdminCap has key, store {
    id: UID,
}

/// Shared configuration object. Rules stored as dynamic fields.
public struct ExtensionConfig has key {
    id: UID,
}

// ============================================================
// Init — runs once on publish
// ============================================================

fun init(ctx: &mut TxContext) {
    transfer::transfer(
        AdminCap { id: object::new(ctx) },
        ctx.sender(),
    );
    transfer::share_object(ExtensionConfig {
        id: object::new(ctx),
    });
}

// ============================================================
// Witness accessor (package-level only)
// ============================================================

public(package) fun supply_terminal_auth(): SupplyTerminalAuth {
    SupplyTerminalAuth {}
}

// ============================================================
// Dynamic-field rule helpers
// ============================================================

public fun has_rule<K: copy + drop + store>(config: &ExtensionConfig, key: K): bool {
    dynamic_field::exists_(&config.id, key)
}

public fun borrow_rule<K: copy + drop + store, V: store>(
    config: &ExtensionConfig,
    key: K,
): &V {
    dynamic_field::borrow(&config.id, key)
}

public fun borrow_rule_mut<K: copy + drop + store, V: store>(
    config: &mut ExtensionConfig,
    _admin_cap: &AdminCap,
    key: K,
): &mut V {
    dynamic_field::borrow_mut(&mut config.id, key)
}

public fun add_rule<K: copy + drop + store, V: store>(
    config: &mut ExtensionConfig,
    _admin_cap: &AdminCap,
    key: K,
    value: V,
) {
    dynamic_field::add(&mut config.id, key, value);
}

public fun set_rule<K: copy + drop + store, V: store + drop>(
    config: &mut ExtensionConfig,
    admin_cap: &AdminCap,
    key: K,
    value: V,
) {
    if (has_rule(config, key)) {
        let old = remove_rule(config, admin_cap, key);
        drop(old);
    };
    add_rule(config, admin_cap, key, value);
}

public fun remove_rule<K: copy + drop + store, V: store>(
    config: &mut ExtensionConfig,
    _admin_cap: &AdminCap,
    key: K,
): V {
    dynamic_field::remove(&mut config.id, key)
}
```

- [ ] **Step 2: Build**

```bash
cd move-contracts/supply_terminal_extension && sui move build -e testnet 2>&1
```

Expected: success (compiles cleanly).

- [ ] **Step 3: Commit**

```bash
git add move-contracts/supply_terminal_extension/sources/config.move
git commit -m "feat: add config.move with SupplyTerminalAuth witness and ExtensionConfig"
```

---

### Task 3: Implement supply_terminal.move

**Files:**
- Modify: `move-contracts/supply_terminal_extension/sources/supply_terminal.move`

**Reference:** `smart_gate_extension::corpse_gate_bounty::collect_corpse_bounty` for inventory operation pattern.

- [ ] **Step 1: Write supply_terminal.move**

```move
/// Module: supply_terminal_extension::supply_terminal
/// Atomic item-for-item exchange between a buyer's owned inventory
/// and the machine StorageUnit's main inventory.
module supply_terminal_extension::supply_terminal;

use world::storage_unit::{Self, StorageUnit};
use world::character::{Self, Character};
use world::inventory::{Self, Item};
use world::access::{Self, OwnerCap};
use supply_terminal_extension::config::{Self, ExtensionConfig, SupplyTerminalAuth};

// ============================================================
// Listing Configuration
// ============================================================

/// Key for the listing config dynamic field.
public struct ListingConfigKey has copy, drop, store {}

/// Listing config stored on ExtensionConfig.
public struct ListingConfig has drop, store {
    enabled: bool,
    product_type_id: u64,
    product_quantity: u32,
    payment_type_id: u64,
    payment_quantity: u32,
}

// ============================================================
// Events
// ============================================================

/// Emitted on every successful exchange.
public struct SupplyTerminalExchangeEvent has copy, drop {
    storage_unit_id: ID,
    buyer_character_id: ID,
    payment_type_id: u64,
    payment_quantity: u32,
    product_type_id: u64,
    product_quantity: u32,
}

// ============================================================
// View functions
// ============================================================

public fun listing_enabled(config: &ExtensionConfig): bool {
    if (!config::has_rule(config, ListingConfigKey {})) {
        return false
    };
    let listing: &ListingConfig = config::borrow_rule(config, ListingConfigKey {});
    listing.enabled
}

public fun product_type_id(config: &ExtensionConfig): u64 {
    let listing: &ListingConfig = config::borrow_rule(config, ListingConfigKey {});
    listing.product_type_id
}

public fun product_quantity(config: &ExtensionConfig): u32 {
    let listing: &ListingConfig = config::borrow_rule(config, ListingConfigKey {});
    listing.product_quantity
}

public fun payment_type_id(config: &ExtensionConfig): u64 {
    let listing: &ListingConfig = config::borrow_rule(config, ListingConfigKey {});
    listing.payment_type_id
}

public fun payment_quantity(config: &ExtensionConfig): u32 {
    let listing: &ListingConfig = config::borrow_rule(config, ListingConfigKey {});
    listing.payment_quantity
}

// ============================================================
// Exchange entry point
// ============================================================

/// Execute an atomic exchange: buyer pays `payment_quantity` of
/// `payment_type_id` from their owned inventory, and receives
/// `product_quantity` of `product_type_id` from the machine inventory.
///
/// T: the buyer's Character type (for OwnerCap validation).
public fun exchange<T: key>(
    extension_config: &ExtensionConfig,
    storage_unit: &mut StorageUnit,
    buyer_character: &Character,
    buyer_owner_cap: &OwnerCap<T>,
    ctx: &mut TxContext,
) {
    // 1. Assert listing is enabled
    assert!(config::has_rule(extension_config, ListingConfigKey {}), 0);
    let listing: &ListingConfig = config::borrow_rule(extension_config, ListingConfigKey {});
    assert!(listing.enabled, 1);

    // 2. Copy values before mutable operations
    let payment_type = listing.payment_type_id;
    let payment_qty = listing.payment_quantity;
    let product_type = listing.product_type_id;
    let product_qty = listing.product_quantity;

    // 3. Withdraw payment from buyer's owned inventory
    let payment_item = storage_unit::withdraw_by_owner<T>(
        storage_unit,
        buyer_character,
        buyer_owner_cap,
        payment_type,
        payment_qty,
        ctx,
    );

    // 4. Deposit payment into machine's main inventory
    storage_unit::deposit_item<SupplyTerminalAuth>(
        storage_unit,
        buyer_character,
        payment_item,
        config::supply_terminal_auth(),
        ctx,
    );

    // 5. Withdraw product from machine's main inventory
    let product_item = storage_unit::withdraw_item<SupplyTerminalAuth>(
        storage_unit,
        buyer_character,
        config::supply_terminal_auth(),
        product_type,
        product_qty,
        ctx,
    );

    // 6. Deposit product into buyer's owned inventory
    storage_unit::deposit_to_owned<SupplyTerminalAuth>(
        storage_unit,
        buyer_character,
        product_item,
        config::supply_terminal_auth(),
        ctx,
    );

    // 7. Emit event
    event::emit(SupplyTerminalExchangeEvent {
        storage_unit_id: object::uid_to_inner(&storage_unit.id),
        buyer_character_id: character::id(buyer_character),
        payment_type_id: payment_type,
        payment_quantity: payment_qty,
        product_type_id: product_type,
        product_quantity: product_qty,
    });
}
```

- [ ] **Step 2: Build**

```bash
cd move-contracts/supply_terminal_extension && sui move build -e testnet 2>&1
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add move-contracts/supply_terminal_extension/sources/supply_terminal.move
git commit -m "feat: add supply_terminal.move with atomic exchange function"
```

---

## Phase 2: TS Scripts

### Task 4: Create modules.ts and extension-ids.ts

**Files:**
- Create: `ts-scripts/supply_terminal_extension/modules.ts`
- Create: `ts-scripts/supply_terminal_extension/extension-ids.ts`

- [ ] **Step 1: Write modules.ts**

```typescript
export const MODULE = {
    CONFIG: "config",
    SUPPLY_TERMINAL: "supply_terminal",
} as const;
```

- [ ] **Step 2: Write extension-ids.ts**

Following `ts-scripts/smart_gate_extension/extension-ids.ts` pattern:

```typescript
import { getEnvConfig, hydrateWorldConfig, initializeContext, requireEnv } from "../utils/helper";
import { getSingletonObjectByType } from "@evefrontier/dapp-kit/graphql";

let _builderPackageId: string | null = null;
let _extensionConfigId: string | null = null;

export function requireBuilderPackageId(): string {
    if (!_builderPackageId) {
        _builderPackageId = requireEnv("SUPPLY_TERMINAL_PACKAGE_ID");
    }
    return _builderPackageId;
}

export function setBuilderPackageId(id: string): void {
    _builderPackageId = id;
}

export async function resolveExtensionConfigId(
    client: ReturnType<typeof initializeContext>["client"],
    config: ReturnType<typeof initializeContext>["config"],
): Promise<string> {
    if (_extensionConfigId) return _extensionConfigId;
    const builderPackageId = requireBuilderPackageId();
    const result = await getSingletonObjectByType(
        `${builderPackageId}::config::ExtensionConfig`,
        client,
    );
    if (!result) throw new Error("ExtensionConfig not found");
    _extensionConfigId = result;
    return _extensionConfigId;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit ts-scripts/supply_terminal_extension/modules.ts ts-scripts/supply_terminal_extension/extension-ids.ts 2>&1
```

- [ ] **Step 4: Commit**

```bash
git add ts-scripts/supply_terminal_extension/modules.ts ts-scripts/supply_terminal_extension/extension-ids.ts
git commit -m "feat: add supply terminal modules.ts and extension-ids.ts"
```

---

### Task 5: Create configure-listing.ts

**Files:**
- Create: `ts-scripts/supply_terminal_extension/configure-listing.ts`

**Reference:** `ts-scripts/smart_gate_extension/configure-rules.ts`

- [ ] **Step 1: Write configure-listing.ts**

```typescript
import "dotenv/config";
import { Transaction } from "@mysten/sui/transactions";
import { MODULE } from "./modules";
import { requireBuilderPackageId, resolveExtensionConfigId } from "./extension-ids";
import {
    getEnvConfig,
    handleError,
    hydrateWorldConfig,
    initializeContext,
} from "../utils/helper";

// Hardcoded per spec: Carbon Weave x1 for Feldspar Crystals x10
const PRODUCT_TYPE_ID = 84210;
const PRODUCT_QUANTITY = 1;
const PAYMENT_TYPE_ID = 77800;
const PAYMENT_QUANTITY = 10;

async function configureListing(
    ctx: ReturnType<typeof initializeContext>,
) {
    const { client, keypair, config } = ctx;
    const builderPackageId = requireBuilderPackageId();
    const extensionConfigId = await resolveExtensionConfigId(client, config);

    const tx = new Transaction();

    tx.moveCall({
        target: `${builderPackageId}::${MODULE.CONFIG}::add_rule`,
        typeArguments: [
            `${builderPackageId}::${MODULE.SUPPLY_TERMINAL}::ListingConfigKey`,
            `${builderPackageId}::${MODULE.SUPPLY_TERMINAL}::ListingConfig`,
        ],
        arguments: [
            tx.object(extensionConfigId),
            tx.object(config.adminCapId), // AdminCap — admin must run this
            tx.pure.vector("u8", []),     // ListingConfigKey {}
            tx.pure("vector<u8>", [       // ListingConfig { ... } as BCS
                /* enabled */ 1,
                /* product_type_id */ ...encodeU64(PRODUCT_TYPE_ID),
                /* product_quantity */ ...encodeU32(PRODUCT_QUANTITY),
                /* payment_type_id */ ...encodeU64(PAYMENT_TYPE_ID),
                /* payment_quantity */ ...encodeU32(PAYMENT_QUANTITY),
            ]),
        ],
    });

    const result = await client.signAndExecuteTransaction({
        transaction: tx,
        signer: keypair,
        options: { showEffects: true },
    });

    console.log("Listing configured:", result.digest);
}

function encodeU64(n: number): number[] {
    const buf = new Uint8Array(8);
    const dv = new DataView(buf.buffer);
    dv.setBigUint64(0, BigInt(n), true);
    return Array.from(buf);
}

function encodeU32(n: number): number[] {
    const buf = new Uint8Array(4);
    const dv = new DataView(buf.buffer);
    dv.setUint32(0, n, true);
    return Array.from(buf);
}

async function main() {
    console.log("============= Configure Supply Terminal Listing ==============\n");
    try {
        const env = getEnvConfig();
        const adminKey = process.env.ADMIN_PRIVATE_KEY!;
        const ctx = initializeContext(env.network, adminKey);
        await hydrateWorldConfig(ctx);
        await configureListing(ctx);
    } catch (error) {
        handleError(error);
    }
}

main();
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit ts-scripts/supply_terminal_extension/configure-listing.ts 2>&1
```

- [ ] **Step 3: Commit**

```bash
git add ts-scripts/supply_terminal_extension/configure-listing.ts
git commit -m "feat: add configure-listing.ts for supply terminal"
```

---

### Task 6: Create authorise-extension.ts

**Files:**
- Create: `ts-scripts/supply_terminal_extension/authorise-extension.ts`

**Reference:** `ts-scripts/smart_gate_extension/authorise-storage-unit-extension.ts`

- [ ] **Step 1: Write authorise-extension.ts**

```typescript
import "dotenv/config";
import { Transaction } from "@mysten/sui/transactions";
import { MODULES } from "../utils/config";
import { MODULE } from "./modules";
import { requireBuilderPackageId } from "./extension-ids";
import { deriveObjectId } from "../utils/derive-object-id";
import { GAME_CHARACTER_ID } from "../utils/constants";
import {
    getEnvConfig,
    handleError,
    hydrateWorldConfig,
    initializeContext,
} from "../utils/helper";
import { getOwnerCap as getStorageUnitOwnerCap } from "../helpers/storage-unit-extension";

async function authoriseExtension(
    ctx: ReturnType<typeof initializeContext>,
    storageUnitItemId: bigint,
    characterItemId: bigint,
) {
    const { client, keypair, config, address } = ctx;
    const builderPackageId = requireBuilderPackageId();

    const characterId = deriveObjectId(config.objectRegistry, characterItemId, config.packageId);
    const storageUnitId = deriveObjectId(config.objectRegistry, storageUnitItemId, config.packageId);

    const storageUnitOwnerCapId = await getStorageUnitOwnerCap(storageUnitId, client, config, address);
    if (!storageUnitOwnerCapId) {
        throw new Error(`OwnerCap not found for storage unit ${storageUnitId}`);
    }

    const authType = `${builderPackageId}::${MODULE.CONFIG}::SupplyTerminalAuth`;

    const tx = new Transaction();

    const [storageUnitOwnerCap, returnReceipt] = tx.moveCall({
        target: `${config.packageId}::${MODULES.CHARACTER}::borrow_owner_cap`,
        typeArguments: [`${config.packageId}::${MODULES.STORAGE_UNIT}::StorageUnit`],
        arguments: [tx.object(characterId), tx.object(storageUnitOwnerCapId)],
    });

    tx.moveCall({
        target: `${config.packageId}::${MODULES.STORAGE_UNIT}::authorize_extension`,
        typeArguments: [authType],
        arguments: [tx.object(storageUnitId), storageUnitOwnerCap],
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

    console.log("Storage unit extension authorized!", storageUnitId);
    console.log("Auth type:", authType);
    console.log("Transaction digest:", result.digest);
}

async function main() {
    console.log("============= Authorise Supply Terminal Extension ==============\n");
    try {
        const env = getEnvConfig();
        const playerKey = process.env.PLAYER_A_PRIVATE_KEY!;
        const ctx = initializeContext(env.network, playerKey);
        await hydrateWorldConfig(ctx);
        await authoriseExtension(ctx, BigInt(process.env.STORAGE_UNIT_ITEM_ID || "0"), BigInt(GAME_CHARACTER_ID));
    } catch (error) {
        handleError(error);
    }
}

main();
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit ts-scripts/supply_terminal_extension/authorise-extension.ts 2>&1
```

- [ ] **Step 3: Commit**

```bash
git add ts-scripts/supply_terminal_extension/authorise-extension.ts
git commit -m "feat: add authorise-extension.ts for supply terminal"
```

---

### Task 7: Create exchange.ts (test script)

**Files:**
- Create: `ts-scripts/supply_terminal_extension/exchange.ts`

- [ ] **Step 1: Write exchange.ts**

```typescript
import "dotenv/config";
import { Transaction } from "@mysten/sui/transactions";
import { MODULES } from "../utils/config";
import { MODULE } from "./modules";
import { requireBuilderPackageId, resolveExtensionConfigId } from "./extension-ids";
import { deriveObjectId } from "../utils/derive-object-id";
import { GAME_CHARACTER_ID } from "../utils/constants";
import {
    getEnvConfig,
    handleError,
    hydrateWorldConfig,
    initializeContext,
} from "../utils/helper";
import { getCharacterOwnerCap } from "../helpers/character";

async function exchange(
    ctx: ReturnType<typeof initializeContext>,
    storageUnitItemId: bigint,
    characterItemId: bigint,
) {
    const { client, keypair, config } = ctx;
    const builderPackageId = requireBuilderPackageId();
    const extensionConfigId = await resolveExtensionConfigId(client, config);

    const characterId = deriveObjectId(config.objectRegistry, characterItemId, config.packageId);
    const storageUnitId = deriveObjectId(config.objectRegistry, storageUnitItemId, config.packageId);

    const playerOwnerCapId = await getCharacterOwnerCap(characterId, client, config);
    if (!playerOwnerCapId) {
        throw new Error(`Character OwnerCap not found for character ${characterId}`);
    }

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

    console.log("Exchange executed:", result.digest);
}

async function main() {
    console.log("============= Supply Terminal Exchange ==============\n");
    try {
        const env = getEnvConfig();
        const playerKey = process.env.PLAYER_A_PRIVATE_KEY!;
        const ctx = initializeContext(env.network, playerKey);
        await hydrateWorldConfig(ctx);
        await exchange(ctx, BigInt(process.env.STORAGE_UNIT_ITEM_ID || "0"), BigInt(GAME_CHARACTER_ID));
    } catch (error) {
        handleError(error);
    }
}

main();
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit ts-scripts/supply_terminal_extension/exchange.ts 2>&1
```

- [ ] **Step 3: Commit**

```bash
git add ts-scripts/supply_terminal_extension/exchange.ts
git commit -m "feat: add exchange.ts test script for supply terminal"
```

---

### Task 8: Wire package.json scripts and readme

**Files:**
- Modify: `package.json`
- Create: `ts-scripts/supply_terminal_extension/readme.md`

- [ ] **Step 1: Add scripts to package.json**

Add these under `"scripts"` in root `package.json`:

```json
"configure-supply-terminal": "tsx ts-scripts/supply_terminal_extension/configure-listing.ts",
"authorise-supply-terminal": "tsx ts-scripts/supply_terminal_extension/authorise-extension.ts",
"supply-terminal-exchange": "tsx ts-scripts/supply_terminal_extension/exchange.ts"
```

- [ ] **Step 2: Write readme.md**

```markdown
# Supply Terminal example

After publishing `move-contracts/supply_terminal_extension`, run these scripts from the repo root in order:

## Prerequisites

1. World contracts deployed and configured
2. `deployments/` and `test-resources.json` copied to repo root
3. Supply Terminal extension package published (`sui client publish`)
4. Set `SUPPLY_TERMINAL_PACKAGE_ID` and `STORAGE_UNIT_ITEM_ID` in `.env`

## Script order

```bash
# 1. Configure listing (admin)
pnpm configure-supply-terminal

# 2. Authorize extension on storage unit (owner)
pnpm authorise-supply-terminal

# 3. Execute test exchange (player)
pnpm supply-terminal-exchange
```
```

- [ ] **Step 3: Commit**

```bash
git add package.json ts-scripts/supply_terminal_extension/readme.md
git commit -m "feat: wire supply terminal scripts and add readme"
```

---

## Phase 3: dApp

### Task 9: Create config.ts and types.ts

**Files:**
- Create: `dapps/src/components/SupplyTerminal/config.ts`
- Create: `dapps/src/components/SupplyTerminal/types.ts`

- [ ] **Step 1: Write types.ts**

```typescript
export interface ListingConfig {
    enabled: boolean;
    productTypeId: number;
    productQuantity: number;
    paymentTypeId: number;
    paymentQuantity: number;
}

export type ExchangeState =
    | "idle"
    | "selected"
    | "payment_staged"
    | "submitting"
    | "completed"
    | "failed";

export interface ExchangeEvent {
    type: "local" | "chain";
    message: string;
    digest?: string;
    timestamp: number;
}
```

- [ ] **Step 2: Write config.ts**

```typescript
export const SUPPLY_TERMINAL_CONFIG = {
    product: {
        name: "Carbon Weave",
        sandboxItemId: 84210,
        quantity: 1,
    },
    payment: {
        name: "Feldspar Crystals",
        sandboxItemId: 77800,
        quantity: 10,
    },
} as const;
```

- [ ] **Step 3: Commit**

```bash
git add dapps/src/components/SupplyTerminal/config.ts dapps/src/components/SupplyTerminal/types.ts
git commit -m "feat: add supply terminal config and types"
```

---

### Task 10: Create panel components

**Files:**
- Create: `dapps/src/components/SupplyTerminal/ProductPanel.tsx`
- Create: `dapps/src/components/SupplyTerminal/MachinePanel.tsx`
- Create: `dapps/src/components/SupplyTerminal/InventoryPanel.tsx`

- [ ] **Step 1: Write ProductPanel.tsx**

Read-only display showing listing and stock. Uses props (no hooks).

```tsx
import { Card, Button, Text, Flex, Heading } from "@radix-ui/themes";
import { SUPPLY_TERMINAL_CONFIG } from "./config";

interface ProductPanelProps {
    stock: number;
    onSelect: () => void;
    selected: boolean;
    disabled: boolean;
}

export function ProductPanel({ stock, onSelect, selected, disabled }: ProductPanelProps) {
    const { product, payment } = SUPPLY_TERMINAL_CONFIG;
    return (
        <Card>
            <Heading size="3">{product.name}</Heading>
            <Flex direction="column" gap="1" mt="2">
                <Text size="2">Price: {payment.name} x{payment.quantity}</Text>
                <Text size="2">Stock: {stock}</Text>
            </Flex>
            <Button
                mt="3"
                onClick={onSelect}
                disabled={disabled || selected}
                variant={selected ? "outline" : "solid"}
            >
                {selected ? "Selected" : "Select"}
            </Button>
        </Card>
    );
}
```

- [ ] **Step 2: Write MachinePanel.tsx**

```tsx
import { Card, Text, Flex, Heading, Badge } from "@radix-ui/themes";

interface MachinePanelProps {
    carbonWeaveStock: number;
    feldsparCrystalsRevenue: number;
    online: boolean;
    extensionAuthorized: boolean;
}

export function MachinePanel({ carbonWeaveStock, feldsparCrystalsRevenue, online, extensionAuthorized }: MachinePanelProps) {
    return (
        <Card>
            <Heading size="3">Machine Storage</Heading>
            <Flex direction="column" gap="1" mt="2">
                <Text size="2">Carbon Weave Stock: {carbonWeaveStock}</Text>
                <Text size="2">Feldspar Crystals Revenue: {feldsparCrystalsRevenue}</Text>
                <Flex gap="2" mt="1">
                    <Badge color={online ? "green" : "red"}>
                        {online ? "Online" : "Offline"}
                    </Badge>
                    <Badge color={extensionAuthorized ? "green" : "orange"}>
                        {extensionAuthorized ? "Extension: Authorized" : "Extension: Not Authorized"}
                    </Badge>
                </Flex>
            </Flex>
        </Card>
    );
}
```

- [ ] **Step 3: Write InventoryPanel.tsx**

```tsx
import { Card, Text, Flex, Heading } from "@radix-ui/themes";
import { SUPPLY_TERMINAL_CONFIG } from "./config";

interface InventoryPanelProps {
    feldsparCrystals: number;
    carbonWeave: number;
}

export function InventoryPanel({ feldsparCrystals, carbonWeave }: InventoryPanelProps) {
    const { payment, product } = SUPPLY_TERMINAL_CONFIG;
    return (
        <Card>
            <Heading size="3">Your Inventory</Heading>
            <Flex direction="column" gap="1" mt="2">
                <Text size="2">{payment.name}: {feldsparCrystals}</Text>
                <Text size="2">{product.name}: {carbonWeave}</Text>
            </Flex>
        </Card>
    );
}
```

- [ ] **Step 4: Commit**

```bash
git add dapps/src/components/SupplyTerminal/ProductPanel.tsx dapps/src/components/SupplyTerminal/MachinePanel.tsx dapps/src/components/SupplyTerminal/InventoryPanel.tsx
git commit -m "feat: add supply terminal panel components"
```

---

### Task 11: Create PurchasePanel.tsx

**Files:**
- Create: `dapps/src/components/SupplyTerminal/PurchasePanel.tsx`

- [ ] **Step 1: Write PurchasePanel.tsx**

Local UI state machine per spec §7.7.

```tsx
import { useState } from "react";
import { Card, Button, Text, Flex, Heading, Badge } from "@radix-ui/themes";
import { ExchangeState } from "./types";
import { SUPPLY_TERMINAL_CONFIG } from "./config";

interface PurchasePanelProps {
    selected: boolean;
    playerFeldspar: number;
    machineStock: number;
    exchangeState: ExchangeState;
    onStagePayment: () => void;
    onConfirmExchange: () => void;
    onCancel: () => void;
}

export function PurchasePanel({
    selected,
    playerFeldspar,
    machineStock,
    exchangeState,
    onStagePayment,
    onConfirmExchange,
    onCancel,
}: PurchasePanelProps) {
    const { product, payment } = SUPPLY_TERMINAL_CONFIG;
    const canStage = selected && playerFeldspar >= payment.quantity;
    const canConfirm = exchangeState === "payment_staged" && machineStock > 0;
    const isSubmitting = exchangeState === "submitting";

    const stateBadge = () => {
        switch (exchangeState) {
            case "selected": return <Badge color="blue">Selected</Badge>;
            case "payment_staged": return <Badge color="green">Ready to confirm</Badge>;
            case "submitting": return <Badge color="orange">Submitting...</Badge>;
            case "completed": return <Badge color="green">Completed</Badge>;
            case "failed": return <Badge color="red">Failed</Badge>;
            default: return null;
        }
    };

    return (
        <Card>
            <Heading size="3">Purchase</Heading>
            <Flex direction="column" gap="2" mt="2">
                <Text size="2">Selected: {selected ? `${product.name} x${product.quantity}` : "None"}</Text>
                <Text size="2">Required: {payment.name} x{payment.quantity}</Text>
                <Flex gap="2" align="center">
                    <Text size="2">Status:</Text>
                    {stateBadge()}
                </Flex>
                <Flex gap="2" mt="2">
                    <Button
                        onClick={onStagePayment}
                        disabled={!canStage || exchangeState === "payment_staged" || isSubmitting}
                    >
                        Stage Payment
                    </Button>
                    <Button
                        onClick={onConfirmExchange}
                        disabled={!canConfirm || isSubmitting}
                        color="green"
                    >
                        Confirm Exchange
                    </Button>
                    <Button
                        onClick={onCancel}
                        disabled={exchangeState === "idle" || isSubmitting}
                        color="gray"
                    >
                        Cancel
                    </Button>
                </Flex>
            </Flex>
        </Card>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add dapps/src/components/SupplyTerminal/PurchasePanel.tsx
git commit -m "feat: add supply terminal PurchasePanel with state machine"
```

---

### Task 12: Create OwnerControls.tsx

**Files:**
- Create: `dapps/src/components/SupplyTerminal/OwnerControls.tsx`

- [ ] **Step 1: Write OwnerControls.tsx**

```tsx
import { Card, Button, Callout, Text, Flex } from "@radix-ui/themes";
import { InfoCircledIcon, GearIcon } from "@radix-ui/react-icons";

interface OwnerControlsProps {
    isOwner: boolean;
    extensionAuthorized: boolean;
    onAuthorize: () => void;
    isAuthorizing: boolean;
}

export function OwnerControls({ isOwner, extensionAuthorized, onAuthorize, isAuthorizing }: OwnerControlsProps) {
    if (!isOwner) return null;

    return (
        <>
            {!extensionAuthorized && (
                <Callout.Root color="orange" variant="surface">
                    <Callout.Icon><InfoCircledIcon /></Callout.Icon>
                    <Callout.Text>
                        Extension not authorized — items cannot be moved.
                    </Callout.Text>
                    <Button
                        ml="auto"
                        size="1"
                        onClick={onAuthorize}
                        disabled={isAuthorizing}
                    >
                        {isAuthorizing ? "Authorizing..." : "Authorize Extension"}
                    </Button>
                </Callout.Root>
            )}
            <div style={{ position: "fixed", bottom: 16, right: 16 }}>
                <Button
                    variant="soft"
                    size="2"
                    // onClick={onConfigure} — future: open configure dialog
                >
                    <GearIcon /> Configure
                </Button>
            </div>
        </>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add dapps/src/components/SupplyTerminal/OwnerControls.tsx
git commit -m "feat: add OwnerControls with authorize banner and configure button"
```

---

### Task 13: Create EventLog.tsx

**Files:**
- Create: `dapps/src/components/SupplyTerminal/EventLog.tsx`

- [ ] **Step 1: Write EventLog.tsx**

```tsx
import { Card, Text, Flex, Heading, ScrollArea } from "@radix-ui/themes";
import { ExchangeEvent } from "./types";

interface EventLogProps {
    events: ExchangeEvent[];
}

export function EventLog({ events }: EventLogProps) {
    return (
        <Card>
            <Heading size="3">Event Log</Heading>
            <ScrollArea style={{ maxHeight: 200 }} mt="2">
                <Flex direction="column" gap="1">
                    {events.map((event, i) => (
                        <Text key={i} size="1" color={event.type === "chain" ? "green" : "gray"}>
                            &gt; {event.message}
                            {event.digest && ` — ${event.digest.slice(0, 10)}...`}
                        </Text>
                    ))}
                </Flex>
            </ScrollArea>
        </Card>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add dapps/src/components/SupplyTerminal/EventLog.tsx
git commit -m "feat: add supply terminal EventLog component"
```

---

### Task 14: Create SupplyTerminal.tsx (main container)

**Files:**
- Create: `dapps/src/components/SupplyTerminal/SupplyTerminal.tsx`

Uses `isOwner`, `useSmartObject`, `useConnection`, `useDAppKit` for all logic.

- [ ] **Step 1: Implement SupplyTerminal.tsx logic**

Write the file and handle the TODO placeholders for data loading.

- [ ] **Step 2: Commit**

```bash
git add dapps/src/components/SupplyTerminal/SupplyTerminal.tsx
git commit -m "feat: add SupplyTerminal main container component"
```

---

### Task 15: Integrate into App.tsx

**Files:**
- Modify: `dapps/src/App.tsx`

- [ ] **Step 1: Add SupplyTerminal to App.tsx**

Replace `AssemblyInfo` with `SupplyTerminal` when the smart object is a StorageUnit.

- [ ] **Step 2: Commit**

```bash
git add dapps/src/App.tsx
git commit -m "feat: integrate SupplyTerminal into App"
```

---

## Phase 4: Deploy & Test on Localnet

### Task 16: Deploy and test end-to-end

- [ ] **Step 1: Start localnet**

```bash
cd docker && docker compose run --rm --service-ports sui-dev
```

- [ ] **Step 2: Publish supply_terminal_extension**

```bash
cd /workspace/builder-scaffold/move-contracts/supply_terminal_extension
sui client publish -e localnet
```

Note the package ID from output → set `SUPPLY_TERMINAL_PACKAGE_ID` in `.env`.

- [ ] **Step 3: Configure listing**

```bash
pnpm configure-supply-terminal
```

- [ ] **Step 4: Authorize extension**

```bash
pnpm authorise-supply-terminal
```

- [ ] **Step 5: Test exchange**

```bash
pnpm supply-terminal-exchange
```

Expected: transaction succeeds, events emitted. Verify balances changed.

- [ ] **Step 6: Run dApp dev server**

```bash
cd dapps && pnpm dev
```

Visit the dApp at the configured URL, verify both owner and buyer flows work.

