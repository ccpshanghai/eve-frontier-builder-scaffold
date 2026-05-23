# Supply Terminal Multi-Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support multiple Supply Terminal product listings keyed by `product_type_id`, while preserving the current `ListingConfig` fields including arbitrary `product_quantity`.

**Architecture:** Store one `ListingConfig` dynamic field per product, keyed by `ListingConfigKey { product_type_id }`. `exchange` receives the selected `product_type_id`, loads that product's listing, and uses the listing's configured product quantity, payment type, and payment quantity. TypeScript scripts share one listing parser so configure, seed, exchange, and preflight all agree on the same multi-listing configuration.

**Tech Stack:** Sui Move 2024, EVE Frontier world contracts, TypeScript ESM scripts via `tsx`, root `tsconfig.json`, existing `@mysten/sui` transaction helpers.

---

## File Structure

- Modify `move-contracts/supply_terminal_extension/sources/supply_terminal.move`
  - Change `ListingConfigKey` from a singleton key to `{ product_type_id: u64 }`.
  - Keep `ListingConfig { enabled, product_type_id, product_quantity, payment_type_id, payment_quantity }`.
  - Add `product_type_id` selection to view helpers and `exchange`.
- Modify `move-contracts/supply_terminal_extension/tests/supply_terminal_tests.move`
  - Add failing tests for multiple listings and selected-product exchange.
  - Update existing tests for keyed listing access.
- Create `ts-scripts/supply_terminal_extension/listing-config.ts`
  - Parse shared listing configuration from `SUPPLY_TERMINAL_LISTINGS`.
  - Provide the existing single listing as the default for backward compatibility.
  - Parse selected exchange product from `SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID`.
- Create `ts-scripts/supply_terminal_extension/listing-config.test.ts`
  - Pin parsing, defaults, duplicate product rejection, and selected-product validation.
- Modify `ts-scripts/supply_terminal_extension/configure-listing.ts`
  - Configure every parsed listing in one transaction.
- Modify `ts-scripts/supply_terminal_extension/seed-payment.ts`
  - Seed payment inventory for each configured listing, preserving one-command local setup.
- Modify `ts-scripts/supply_terminal_extension/seed-payment.test.ts`
  - Update tests for multi-listing payment seed config.
- Modify `ts-scripts/supply_terminal_extension/preflight.ts`
  - Load and validate the selected product listing.
- Modify `ts-scripts/supply_terminal_extension/preflight.test.ts`
  - Assert the selected listing is used for payment and machine-stock checks.
- Modify `ts-scripts/supply_terminal_extension/exchange.ts`
  - Pass the selected `product_type_id` into preflight and the Move call.
- Modify `ts-scripts/supply_terminal_extension/readme.md`
  - Document multi-listing env format and command flow.
- Modify `.env.example`
  - Add commented examples for `SUPPLY_TERMINAL_LISTINGS` and `SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID`.

---

### Task 1: Write Failing Move Tests for Keyed Listings

**Files:**
- Modify: `move-contracts/supply_terminal_extension/tests/supply_terminal_tests.move`
- Test: `move-contracts/supply_terminal_extension/tests/supply_terminal_tests.move`

- [ ] **Step 1: Add constants for a second product listing**

Add these constants near the existing `PRODUCT_*` and `PAYMENT_*` constants:

```move
const PRODUCT_B_TYPE_ID: u64 = 84211;
const PRODUCT_B_ITEM_ID: u64 = 84211;
const PRODUCT_B_VOLUME: u64 = 2;
const PRODUCT_B_QUANTITY: u32 = 3;
const PRODUCT_B_STOCK: u32 = 15;
const PAYMENT_B_TYPE_ID: u64 = 77801;
const PAYMENT_B_ITEM_ID: u64 = 77801;
const PAYMENT_B_VOLUME: u64 = 1;
const PAYMENT_B_QUANTITY: u32 = 25;
const BUYER_PAYMENT_B_STOCK: u32 = 100;
```

- [ ] **Step 2: Replace `setup_terminal_config` with keyed helper functions**

Replace the current `setup_terminal_config(ts, enabled)` helper with these two helpers:

```move
fun set_terminal_listing(
    ts: &mut test_scenario::Scenario,
    enabled: bool,
    product_type_id: u64,
    product_quantity: u32,
    payment_type_id: u64,
    payment_quantity: u32,
) {
    next_tx(ts, governor());
    let admin_cap: AdminCap = test_scenario::take_from_sender<AdminCap>(ts);
    let mut extension_config = test_scenario::take_shared<ExtensionConfig>(ts);
    supply_terminal::set_listing_config(
        &mut extension_config,
        &admin_cap,
        enabled,
        product_type_id,
        product_quantity,
        payment_type_id,
        payment_quantity,
    );
    test_scenario::return_to_sender(ts, admin_cap);
    test_scenario::return_shared(extension_config);
}

fun setup_terminal_config(ts: &mut test_scenario::Scenario, enabled: bool) {
    next_tx(ts, governor());
    config::init_for_testing(ctx(ts));
    set_terminal_listing(
        ts,
        enabled,
        PRODUCT_TYPE_ID,
        PRODUCT_QUANTITY,
        PAYMENT_TYPE_ID,
        PAYMENT_QUANTITY,
    );
}

fun setup_two_terminal_listings(ts: &mut test_scenario::Scenario) {
    next_tx(ts, governor());
    config::init_for_testing(ctx(ts));
    set_terminal_listing(
        ts,
        true,
        PRODUCT_TYPE_ID,
        PRODUCT_QUANTITY,
        PAYMENT_TYPE_ID,
        PAYMENT_QUANTITY,
    );
    set_terminal_listing(
        ts,
        true,
        PRODUCT_B_TYPE_ID,
        PRODUCT_B_QUANTITY,
        PAYMENT_B_TYPE_ID,
        PAYMENT_B_QUANTITY,
    );
}
```

- [ ] **Step 3: Update existing config tests to call keyed view helpers**

Where tests currently call:

```move
supply_terminal::listing_enabled(&config)
supply_terminal::product_type_id(&config)
supply_terminal::product_quantity(&config)
supply_terminal::payment_type_id(&config)
supply_terminal::payment_quantity(&config)
supply_terminal::new_listing_config_key()
```

change them to:

```move
supply_terminal::listing_enabled(&config, PRODUCT_TYPE_ID)
supply_terminal::product_type_id(&config, PRODUCT_TYPE_ID)
supply_terminal::product_quantity(&config, PRODUCT_TYPE_ID)
supply_terminal::payment_type_id(&config, PRODUCT_TYPE_ID)
supply_terminal::payment_quantity(&config, PRODUCT_TYPE_ID)
supply_terminal::new_listing_config_key(PRODUCT_TYPE_ID)
```

- [ ] **Step 4: Add a test that two product keys hold independent configs**

Add this test after `test_set_listing_config_updates_listing_values`:

```move
#[test]
fun test_set_listing_config_supports_multiple_product_keys() {
    let mut scenario = test_scenario::begin(governor());
    setup_two_terminal_listings(&mut scenario);

    next_tx(&mut scenario, governor());
    {
        let config: ExtensionConfig = test_scenario::take_shared<ExtensionConfig>(&scenario);

        assert!(supply_terminal::listing_enabled(&config, PRODUCT_TYPE_ID), 0);
        assert!(supply_terminal::listing_enabled(&config, PRODUCT_B_TYPE_ID), 1);

        assert_eq!(supply_terminal::product_type_id(&config, PRODUCT_TYPE_ID), PRODUCT_TYPE_ID);
        assert_eq!(supply_terminal::product_quantity(&config, PRODUCT_TYPE_ID), PRODUCT_QUANTITY);
        assert_eq!(supply_terminal::payment_type_id(&config, PRODUCT_TYPE_ID), PAYMENT_TYPE_ID);
        assert_eq!(supply_terminal::payment_quantity(&config, PRODUCT_TYPE_ID), PAYMENT_QUANTITY);

        assert_eq!(supply_terminal::product_type_id(&config, PRODUCT_B_TYPE_ID), PRODUCT_B_TYPE_ID);
        assert_eq!(supply_terminal::product_quantity(&config, PRODUCT_B_TYPE_ID), PRODUCT_B_QUANTITY);
        assert_eq!(supply_terminal::payment_type_id(&config, PRODUCT_B_TYPE_ID), PAYMENT_B_TYPE_ID);
        assert_eq!(supply_terminal::payment_quantity(&config, PRODUCT_B_TYPE_ID), PAYMENT_B_QUANTITY);

        test_scenario::return_shared(config);
    };

    test_scenario::end(scenario);
}
```

- [ ] **Step 5: Add a selected-product exchange test**

Add this test after `test_exchange_moves_payment_to_machine_and_product_to_buyer`:

```move
#[test]
fun test_exchange_uses_selected_product_listing() {
    let mut scenario = test_scenario::begin(governor());
    setup_network_node(&mut scenario);
    setup_two_terminal_listings(&mut scenario);

    let buyer_character_id = create_character(&mut scenario, user_a(), CHARACTER_A_ITEM_ID);
    let storage_owner_character_id = create_character(
        &mut scenario,
        user_b(),
        CHARACTER_B_ITEM_ID,
    );
    let (storage_id, node_id) = create_storage_unit(&mut scenario, storage_owner_character_id);
    online_storage_unit(
        &mut scenario,
        user_b(),
        storage_owner_character_id,
        storage_id,
        node_id,
    );

    let machine_owner_cap_id = storage_owner_cap_id(&mut scenario, storage_id);
    let buyer_owner_cap_id = character_owner_cap_id(&mut scenario, buyer_character_id);

    mint_item<StorageUnit>(
        &mut scenario,
        storage_id,
        storage_owner_character_id,
        user_b(),
        PRODUCT_ITEM_ID,
        PRODUCT_TYPE_ID,
        PRODUCT_VOLUME,
        PRODUCT_STOCK,
    );
    mint_item<StorageUnit>(
        &mut scenario,
        storage_id,
        storage_owner_character_id,
        user_b(),
        PRODUCT_B_ITEM_ID,
        PRODUCT_B_TYPE_ID,
        PRODUCT_B_VOLUME,
        PRODUCT_B_STOCK,
    );
    mint_item<Character>(
        &mut scenario,
        storage_id,
        buyer_character_id,
        user_a(),
        PAYMENT_ITEM_ID,
        PAYMENT_TYPE_ID,
        PAYMENT_VOLUME,
        BUYER_PAYMENT_STOCK,
    );
    mint_item<Character>(
        &mut scenario,
        storage_id,
        buyer_character_id,
        user_a(),
        PAYMENT_B_ITEM_ID,
        PAYMENT_B_TYPE_ID,
        PAYMENT_B_VOLUME,
        BUYER_PAYMENT_B_STOCK,
    );
    authorize_supply_terminal(&mut scenario, storage_id, storage_owner_character_id);

    next_tx(&mut scenario, user_a());
    {
        let extension_config = test_scenario::take_shared<ExtensionConfig>(&scenario);
        let mut storage_unit = test_scenario::take_shared_by_id<StorageUnit>(
            &scenario,
            storage_id,
        );
        let mut buyer_character = test_scenario::take_shared_by_id<Character>(
            &scenario,
            buyer_character_id,
        );
        let (buyer_owner_cap, receipt) = buyer_character.borrow_owner_cap<Character>(
            test_scenario::most_recent_receiving_ticket<OwnerCap<Character>>(
                &buyer_character_id,
            ),
            ctx(&mut scenario),
        );

        supply_terminal::exchange<Character>(
            &extension_config,
            &mut storage_unit,
            &buyer_character,
            &buyer_owner_cap,
            PRODUCT_B_TYPE_ID,
            ctx(&mut scenario),
        );

        buyer_character.return_owner_cap(buyer_owner_cap, receipt);
        test_scenario::return_shared(extension_config);
        test_scenario::return_shared(storage_unit);
        test_scenario::return_shared(buyer_character);
    };

    next_tx(&mut scenario, admin());
    {
        let storage_unit = test_scenario::take_shared_by_id<StorageUnit>(
            &scenario,
            storage_id,
        );
        assert_eq!(
            storage_unit.item_quantity(buyer_owner_cap_id, PAYMENT_TYPE_ID),
            BUYER_PAYMENT_STOCK,
        );
        assert_eq!(
            storage_unit.item_quantity(buyer_owner_cap_id, PAYMENT_B_TYPE_ID),
            BUYER_PAYMENT_B_STOCK - PAYMENT_B_QUANTITY,
        );
        assert_eq!(
            storage_unit.item_quantity(buyer_owner_cap_id, PRODUCT_TYPE_ID),
            0,
        );
        assert_eq!(
            storage_unit.item_quantity(buyer_owner_cap_id, PRODUCT_B_TYPE_ID),
            PRODUCT_B_QUANTITY,
        );
        assert_eq!(
            storage_unit.item_quantity(machine_owner_cap_id, PRODUCT_TYPE_ID),
            PRODUCT_STOCK,
        );
        assert_eq!(
            storage_unit.item_quantity(machine_owner_cap_id, PRODUCT_B_TYPE_ID),
            PRODUCT_B_STOCK - PRODUCT_B_QUANTITY,
        );
        assert_eq!(
            storage_unit.item_quantity(machine_owner_cap_id, PAYMENT_TYPE_ID),
            0,
        );
        assert_eq!(
            storage_unit.item_quantity(machine_owner_cap_id, PAYMENT_B_TYPE_ID),
            PAYMENT_B_QUANTITY,
        );
        test_scenario::return_shared(storage_unit);
    };

    test_scenario::end(scenario);
}
```

- [ ] **Step 6: Update existing exchange calls to include `PRODUCT_TYPE_ID`**

In existing tests that call `supply_terminal::exchange<Character>(...)`, add `PRODUCT_TYPE_ID` before `ctx(...)`:

```move
supply_terminal::exchange<Character>(
    &extension_config,
    &mut storage_unit,
    &buyer_character,
    &buyer_owner_cap,
    PRODUCT_TYPE_ID,
    ctx(&mut scenario),
);
```

- [ ] **Step 7: Run Move tests and verify RED**

Run:

```bash
cd move-contracts/supply_terminal_extension && sui move test -e testnet
```

Expected: FAIL because `ListingConfigKey` has no `product_type_id` field and `exchange` does not yet accept the selected product argument.

---

### Task 2: Implement Keyed Listing Config in Move

**Files:**
- Modify: `move-contracts/supply_terminal_extension/sources/supply_terminal.move`
- Test: `move-contracts/supply_terminal_extension/tests/supply_terminal_tests.move`

- [ ] **Step 1: Change the dynamic-field key shape**

Replace:

```move
public struct ListingConfigKey has copy, drop, store {}
```

with:

```move
public struct ListingConfigKey has copy, drop, store {
    product_type_id: u64,
}
```

- [ ] **Step 2: Update view functions to accept a product key**

Replace the current view functions with:

```move
public fun listing_enabled(config: &ExtensionConfig, product_type_id: u64): bool {
    let key = ListingConfigKey { product_type_id };
    if (!config::has_rule(config, key)) {
        return false
    };
    let listing: &ListingConfig = config::borrow_rule(config, key);
    listing.enabled
}

public fun product_type_id(config: &ExtensionConfig, product_type_id: u64): u64 {
    let listing: &ListingConfig = config::borrow_rule(
        config,
        ListingConfigKey { product_type_id },
    );
    listing.product_type_id
}

public fun product_quantity(config: &ExtensionConfig, product_type_id: u64): u32 {
    let listing: &ListingConfig = config::borrow_rule(
        config,
        ListingConfigKey { product_type_id },
    );
    listing.product_quantity
}

public fun payment_type_id(config: &ExtensionConfig, product_type_id: u64): u64 {
    let listing: &ListingConfig = config::borrow_rule(
        config,
        ListingConfigKey { product_type_id },
    );
    listing.payment_type_id
}

public fun payment_quantity(config: &ExtensionConfig, product_type_id: u64): u32 {
    let listing: &ListingConfig = config::borrow_rule(
        config,
        ListingConfigKey { product_type_id },
    );
    listing.payment_quantity
}
```

- [ ] **Step 3: Store listings under `product_type_id`**

In `set_listing_config`, replace `ListingConfigKey {}` with:

```move
ListingConfigKey { product_type_id }
```

The full `config::set_rule` call should become:

```move
config::set_rule<ListingConfigKey, ListingConfig>(
    extension_config,
    admin_cap,
    ListingConfigKey { product_type_id },
    ListingConfig {
        enabled,
        product_type_id,
        product_quantity,
        payment_type_id,
        payment_quantity,
    },
);
```

- [ ] **Step 4: Add product selection to `exchange`**

Change the signature to:

```move
public fun exchange<T: key>(
    extension_config: &ExtensionConfig,
    storage_unit: &mut StorageUnit,
    buyer_character: &Character,
    buyer_owner_cap: &OwnerCap<T>,
    product_type_id: u64,
    ctx: &mut TxContext,
)
```

Replace the listing lookup block with:

```move
let key = ListingConfigKey { product_type_id };
assert!(config::has_rule(extension_config, key), 0);
let listing: &ListingConfig = config::borrow_rule(extension_config, key);
assert!(listing.enabled, 1);
```

Keep the existing copied values:

```move
let payment_type = listing.payment_type_id;
let payment_qty = listing.payment_quantity;
let product_type = listing.product_type_id;
let product_qty = listing.product_quantity;
```

- [ ] **Step 5: Update the test-only key helper**

Replace:

```move
public fun new_listing_config_key(): ListingConfigKey { ListingConfigKey {} }
```

with:

```move
public fun new_listing_config_key(product_type_id: u64): ListingConfigKey {
    ListingConfigKey { product_type_id }
}
```

- [ ] **Step 6: Run Move tests and verify GREEN**

Run:

```bash
cd move-contracts/supply_terminal_extension && sui move test -e testnet
```

Expected: PASS for all `supply_terminal_extension` Move tests.

- [ ] **Step 7: Commit**

```bash
git add move-contracts/supply_terminal_extension/sources/supply_terminal.move move-contracts/supply_terminal_extension/tests/supply_terminal_tests.move
git commit -m "feat: key supply terminal listings by product type"
```

---

### Task 3: Add Shared TypeScript Listing Config Parser

**Files:**
- Create: `ts-scripts/supply_terminal_extension/listing-config.ts`
- Create: `ts-scripts/supply_terminal_extension/listing-config.test.ts`

- [ ] **Step 1: Write failing parser tests**

Create `ts-scripts/supply_terminal_extension/listing-config.test.ts`:

```ts
import * as assert from "node:assert/strict";
import {
    buildSupplyTerminalListings,
    getSelectedExchangeProductTypeId,
} from "./listing-config";

const BASE_ENV = {
    STORAGE_UNIT_ITEM_ID: "888800006",
    CHARACTER_ITEM_ID: "811880",
};

{
    const listings = buildSupplyTerminalListings(BASE_ENV);

    assert.equal(listings.length, 1);
    assert.equal(listings[0].productTypeId, 84210n);
    assert.equal(listings[0].productQuantity, 1);
    assert.equal(listings[0].paymentTypeId, 77800n);
    assert.equal(listings[0].paymentQuantity, 10);
    assert.equal(listings[0].paymentVolume, 10n);
}

{
    const listings = buildSupplyTerminalListings({
        ...BASE_ENV,
        SUPPLY_TERMINAL_LISTINGS: JSON.stringify([
            {
                productTypeId: "84210",
                productQuantity: 2,
                paymentTypeId: "77800",
                paymentQuantity: 10,
                paymentVolume: "10",
            },
            {
                productTypeId: "84211",
                productQuantity: 3,
                paymentTypeId: "77801",
                paymentQuantity: 25,
            },
        ]),
    });

    assert.equal(listings.length, 2);
    assert.equal(listings[0].productTypeId, 84210n);
    assert.equal(listings[0].productQuantity, 2);
    assert.equal(listings[0].paymentTypeId, 77800n);
    assert.equal(listings[0].paymentQuantity, 10);
    assert.equal(listings[0].paymentVolume, 10n);
    assert.equal(listings[1].productTypeId, 84211n);
    assert.equal(listings[1].productQuantity, 3);
    assert.equal(listings[1].paymentTypeId, 77801n);
    assert.equal(listings[1].paymentQuantity, 25);
    assert.equal(listings[1].paymentVolume, 10n);
}

{
    const selected = getSelectedExchangeProductTypeId({
        ...BASE_ENV,
        SUPPLY_TERMINAL_LISTINGS: JSON.stringify([
            {
                productTypeId: "84210",
                productQuantity: 1,
                paymentTypeId: "77800",
                paymentQuantity: 10,
            },
            {
                productTypeId: "84211",
                productQuantity: 3,
                paymentTypeId: "77801",
                paymentQuantity: 25,
            },
        ]),
        SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID: "84211",
    });

    assert.equal(selected, 84211n);
}

assert.throws(
    () =>
        buildSupplyTerminalListings({
            ...BASE_ENV,
            SUPPLY_TERMINAL_LISTINGS: "[",
        }),
    /SUPPLY_TERMINAL_LISTINGS must be valid JSON/
);

assert.throws(
    () =>
        buildSupplyTerminalListings({
            ...BASE_ENV,
            SUPPLY_TERMINAL_LISTINGS: JSON.stringify([
                {
                    productTypeId: "84210",
                    productQuantity: 1,
                    paymentTypeId: "77800",
                    paymentQuantity: 10,
                },
                {
                    productTypeId: "84210",
                    productQuantity: 2,
                    paymentTypeId: "77801",
                    paymentQuantity: 25,
                },
            ]),
        }),
    /Duplicate SUPPLY_TERMINAL_LISTINGS productTypeId 84210/
);

assert.throws(
    () =>
        getSelectedExchangeProductTypeId({
            ...BASE_ENV,
            SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID: "99999",
        }),
    /SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID 99999 does not match a configured listing/
);
```

- [ ] **Step 2: Run parser test and verify RED**

Run:

```bash
pnpm exec tsx ts-scripts/supply_terminal_extension/listing-config.test.ts
```

Expected: FAIL with module-not-found for `./listing-config`.

- [ ] **Step 3: Implement `listing-config.ts`**

Create `ts-scripts/supply_terminal_extension/listing-config.ts`:

```ts
export type SupplyTerminalListingConfig = {
    productTypeId: bigint;
    productQuantity: number;
    paymentTypeId: bigint;
    paymentQuantity: number;
    paymentVolume: bigint;
};

type EnvLike = Record<string, string | undefined>;
type RawListing = Record<string, unknown>;

const DEFAULT_PAYMENT_VOLUME = 10n;

const DEFAULT_LISTINGS: SupplyTerminalListingConfig[] = [
    {
        productTypeId: 84210n,
        productQuantity: 1,
        paymentTypeId: 77800n,
        paymentQuantity: 10,
        paymentVolume: DEFAULT_PAYMENT_VOLUME,
    },
];

export function buildSupplyTerminalListings(
    env: EnvLike = process.env
): SupplyTerminalListingConfig[] {
    const value = env.SUPPLY_TERMINAL_LISTINGS;
    const listings = value ? parseListingsJson(value) : DEFAULT_LISTINGS;
    assertUniqueProductTypeIds(listings);
    return listings;
}

export function getSelectedExchangeProductTypeId(env: EnvLike = process.env): bigint {
    const listings = buildSupplyTerminalListings(env);
    const value = env.SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID;
    const selected = value ? parsePositiveBigInt(value, "SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID") : listings[0].productTypeId;

    if (!listings.some((listing) => listing.productTypeId === selected)) {
        throw new Error(
            `SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID ${selected.toString()} does not match a configured listing`
        );
    }

    return selected;
}

function parseListingsJson(value: string): SupplyTerminalListingConfig[] {
    let raw: unknown;
    try {
        raw = JSON.parse(value);
    } catch {
        throw new Error("SUPPLY_TERMINAL_LISTINGS must be valid JSON");
    }

    if (!Array.isArray(raw) || raw.length === 0) {
        throw new Error("SUPPLY_TERMINAL_LISTINGS must be a non-empty JSON array");
    }

    return raw.map((entry, index) => parseListing(entry, index));
}

function parseListing(entry: unknown, index: number): SupplyTerminalListingConfig {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(`SUPPLY_TERMINAL_LISTINGS[${index}] must be an object`);
    }

    const raw = entry as RawListing;

    return {
        productTypeId: readRequiredBigInt(raw, "productTypeId", index),
        productQuantity: readRequiredPositiveInteger(raw, "productQuantity", index),
        paymentTypeId: readRequiredBigInt(raw, "paymentTypeId", index),
        paymentQuantity: readRequiredPositiveInteger(raw, "paymentQuantity", index),
        paymentVolume: readOptionalBigInt(raw, "paymentVolume", DEFAULT_PAYMENT_VOLUME, index),
    };
}

function assertUniqueProductTypeIds(listings: SupplyTerminalListingConfig[]): void {
    const seen = new Set<string>();
    for (const listing of listings) {
        const key = listing.productTypeId.toString();
        if (seen.has(key)) {
            throw new Error(`Duplicate SUPPLY_TERMINAL_LISTINGS productTypeId ${key}`);
        }
        seen.add(key);
    }
}

function readRequiredBigInt(raw: RawListing, field: string, index: number): bigint {
    return parsePositiveBigInt(readRequiredValue(raw, field, index), `SUPPLY_TERMINAL_LISTINGS[${index}].${field}`);
}

function readOptionalBigInt(raw: RawListing, field: string, defaultValue: bigint, index: number): bigint {
    const value = raw[field];
    return value === undefined
        ? defaultValue
        : parsePositiveBigInt(value, `SUPPLY_TERMINAL_LISTINGS[${index}].${field}`);
}

function readRequiredPositiveInteger(raw: RawListing, field: string, index: number): number {
    const parsed = Number(readRequiredValue(raw, field, index));
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new Error(`SUPPLY_TERMINAL_LISTINGS[${index}].${field} must be a positive integer`);
    }
    return parsed;
}

function readRequiredValue(raw: RawListing, field: string, index: number): unknown {
    const value = raw[field];
    if (value === undefined || value === null || value === "") {
        throw new Error(`SUPPLY_TERMINAL_LISTINGS[${index}].${field} is required`);
    }
    return value;
}

function parsePositiveBigInt(value: unknown, name: string): bigint {
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
        throw new Error(`${name} must be a positive integer`);
    }

    const text = String(value);
    if (!/^[0-9]+$/.test(text)) {
        throw new Error(`${name} must be a positive integer`);
    }

    const parsed = BigInt(text);
    if (parsed <= 0n) {
        throw new Error(`${name} must be a positive integer`);
    }
    return parsed;
}
```

- [ ] **Step 4: Run parser test and verify GREEN**

Run:

```bash
pnpm exec tsx ts-scripts/supply_terminal_extension/listing-config.test.ts
```

Expected: PASS with no output.

- [ ] **Step 5: Commit**

```bash
git add ts-scripts/supply_terminal_extension/listing-config.ts ts-scripts/supply_terminal_extension/listing-config.test.ts
git commit -m "feat: parse supply terminal listing config"
```

---

### Task 4: Configure Multiple Listings from TypeScript

**Files:**
- Modify: `ts-scripts/supply_terminal_extension/configure-listing.ts`
- Test: `ts-scripts/supply_terminal_extension/listing-config.test.ts`

- [ ] **Step 1: Update configure script to use parsed listings**

In `configure-listing.ts`, import:

```ts
import { buildSupplyTerminalListings } from "./listing-config";
```

Inside `configureListing`, replace the hardcoded single `tx.moveCall` with:

```ts
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
```

Replace the success log with:

```ts
console.log(`Configured ${listings.length} Supply Terminal listing(s) successfully!`);
for (const listing of listings) {
    console.log(
        `Product ${listing.productTypeId.toString()} x${listing.productQuantity} for payment ` +
            `${listing.paymentTypeId.toString()} x${listing.paymentQuantity}`
    );
}
console.log("Transaction digest:", result.digest);
```

- [ ] **Step 2: Run TypeScript parser test**

Run:

```bash
pnpm exec tsx ts-scripts/supply_terminal_extension/listing-config.test.ts
```

Expected: PASS with no output.

- [ ] **Step 3: Run TypeScript typecheck**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add ts-scripts/supply_terminal_extension/configure-listing.ts
git commit -m "feat: configure multiple supply terminal listings"
```

---

### Task 5: Seed Payments for All Configured Listings

**Files:**
- Modify: `ts-scripts/supply_terminal_extension/seed-payment.ts`
- Modify: `ts-scripts/supply_terminal_extension/seed-payment.test.ts`

- [ ] **Step 1: Replace seed config tests with multi-listing expectations**

Replace `ts-scripts/supply_terminal_extension/seed-payment.test.ts` with:

```ts
import * as assert from "node:assert/strict";
import { buildPaymentSeedConfig } from "./seed-payment";

const BASE_ENV = {
    STORAGE_UNIT_ITEM_ID: "888800006",
    CHARACTER_ITEM_ID: "811880",
};

{
    const config = buildPaymentSeedConfig(BASE_ENV, 1779436000000);

    assert.equal(config.storageUnitItemId, 888800006n);
    assert.equal(config.characterItemId, 811880n);
    assert.equal(config.payments.length, 1);
    assert.equal(config.payments[0].paymentTypeId, 77800n);
    assert.equal(config.payments[0].paymentItemId, 7781779436000000n);
    assert.equal(config.payments[0].volume, 10n);
    assert.equal(config.payments[0].quantity, 10);
}

{
    const config = buildPaymentSeedConfig(
        {
            ...BASE_ENV,
            SUPPLY_TERMINAL_LISTINGS: JSON.stringify([
                {
                    productTypeId: "84210",
                    productQuantity: 1,
                    paymentTypeId: "77800",
                    paymentQuantity: 10,
                    paymentVolume: "10",
                },
                {
                    productTypeId: "84211",
                    productQuantity: 3,
                    paymentTypeId: "77801",
                    paymentQuantity: 25,
                    paymentVolume: "7",
                },
            ]),
        },
        1779436000000
    );

    assert.equal(config.payments.length, 2);
    assert.equal(config.payments[0].paymentTypeId, 77800n);
    assert.equal(config.payments[0].paymentItemId, 7781779436000000n);
    assert.equal(config.payments[0].volume, 10n);
    assert.equal(config.payments[0].quantity, 10);
    assert.equal(config.payments[1].paymentTypeId, 77801n);
    assert.equal(config.payments[1].paymentItemId, 7781779436000001n);
    assert.equal(config.payments[1].volume, 7n);
    assert.equal(config.payments[1].quantity, 25);
}

{
    const config = buildPaymentSeedConfig(
        {
            ...BASE_ENV,
            SUPPLY_TERMINAL_PAYMENT_ITEM_ID: "99999",
            SUPPLY_TERMINAL_LISTINGS: JSON.stringify([
                {
                    productTypeId: "84210",
                    productQuantity: 1,
                    paymentTypeId: "77800",
                    paymentQuantity: 10,
                },
                {
                    productTypeId: "84211",
                    productQuantity: 3,
                    paymentTypeId: "77801",
                    paymentQuantity: 25,
                },
            ]),
        },
        1779436000000
    );

    assert.equal(config.payments[0].paymentItemId, 99999n);
    assert.equal(config.payments[1].paymentItemId, 100000n);
}

assert.throws(
    () => buildPaymentSeedConfig({ STORAGE_UNIT_ITEM_ID: "888800006" }, 1779436000000),
    /CHARACTER_ITEM_ID is required/
);

assert.throws(
    () =>
        buildPaymentSeedConfig(
            {
                ...BASE_ENV,
                SUPPLY_TERMINAL_LISTINGS: JSON.stringify([
                    {
                        productTypeId: "84210",
                        productQuantity: 0,
                        paymentTypeId: "77800",
                        paymentQuantity: 10,
                    },
                ]),
            },
            1779436000000
        ),
    /SUPPLY_TERMINAL_LISTINGS\[0\].productQuantity must be a positive integer/
);
```

- [ ] **Step 2: Run seed test and verify RED**

Run:

```bash
pnpm exec tsx ts-scripts/supply_terminal_extension/seed-payment.test.ts
```

Expected: FAIL because `buildPaymentSeedConfig` still returns a single payment shape.

- [ ] **Step 3: Update seed config types**

In `seed-payment.ts`, import:

```ts
import { buildSupplyTerminalListings } from "./listing-config";
```

Replace `PaymentSeedConfig` with:

```ts
export type PaymentSeed = {
    paymentTypeId: bigint;
    paymentItemId: bigint;
    volume: bigint;
    quantity: number;
};

export type PaymentSeedConfig = {
    storageUnitItemId: bigint;
    characterItemId: bigint;
    payments: PaymentSeed[];
};
```

- [ ] **Step 4: Update `buildPaymentSeedConfig`**

Replace the current implementation with:

```ts
export function buildPaymentSeedConfig(
    env: EnvLike = process.env,
    nowMs: number = Date.now()
): PaymentSeedConfig {
    const basePaymentItemId = readOptionalBigInt(
        env,
        "SUPPLY_TERMINAL_PAYMENT_ITEM_ID",
        DEFAULT_PAYMENT_ITEM_ID_BASE + BigInt(nowMs)
    );

    return {
        storageUnitItemId: readRequiredBigInt(env, "STORAGE_UNIT_ITEM_ID"),
        characterItemId: readRequiredBigInt(env, "CHARACTER_ITEM_ID"),
        payments: buildSupplyTerminalListings(env).map((listing, index) => ({
            paymentTypeId: listing.paymentTypeId,
            paymentItemId: basePaymentItemId + BigInt(index),
            volume: listing.paymentVolume,
            quantity: listing.paymentQuantity,
        })),
    };
}
```

Remove the old `DEFAULT_PAYMENT_TYPE_ID`, `DEFAULT_PAYMENT_QUANTITY`, and `DEFAULT_PAYMENT_VOLUME` constants after this replacement.

- [ ] **Step 5: Seed all payments while borrowing owner cap once**

In `seedPayment`, replace the single `game_item_to_chain_inventory` call with:

```ts
for (const payment of seedConfig.payments) {
    tx.moveCall({
        target: `${worldConfig.packageId}::${MODULES.STORAGE_UNIT}::game_item_to_chain_inventory`,
        typeArguments: [`${worldConfig.packageId}::${MODULES.CHARACTER}::Character`],
        arguments: [
            tx.object(storageUnitId),
            tx.object(worldConfig.adminAcl),
            tx.object(characterId),
            ownerCap,
            tx.pure.u64(payment.paymentItemId),
            tx.pure.u64(payment.paymentTypeId),
            tx.pure.u64(payment.volume),
            tx.pure.u32(payment.quantity),
        ],
    });
}
```

Replace the success logs with:

```ts
console.log("Payment item(s) seeded successfully!");
console.log("StorageUnit:", storageUnitId);
console.log("Character:", characterId);
for (const payment of seedConfig.payments) {
    console.log(
        `Payment type ${payment.paymentTypeId.toString()} x${payment.quantity}, ` +
            `item id ${payment.paymentItemId.toString()}`
    );
}
console.log("Transaction digest:", result.digest);
```

- [ ] **Step 6: Run seed test and verify GREEN**

Run:

```bash
pnpm exec tsx ts-scripts/supply_terminal_extension/seed-payment.test.ts
```

Expected: PASS with no output.

- [ ] **Step 7: Run TypeScript typecheck**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add ts-scripts/supply_terminal_extension/seed-payment.ts ts-scripts/supply_terminal_extension/seed-payment.test.ts
git commit -m "feat: seed payments for supply terminal listings"
```

---

### Task 6: Select Product Listing in Preflight and Exchange

**Files:**
- Modify: `ts-scripts/supply_terminal_extension/preflight.ts`
- Modify: `ts-scripts/supply_terminal_extension/preflight.test.ts`
- Modify: `ts-scripts/supply_terminal_extension/exchange.ts`

- [ ] **Step 1: Update preflight tests for selected listing**

In `preflight.test.ts`, change `BASE_STATE` to use `listings` and `selectedProductTypeId`:

```ts
const LISTINGS = [
    {
        enabled: true,
        productTypeId: "84210",
        productQuantity: 1,
        paymentTypeId: "77800",
        paymentQuantity: 10,
    },
    {
        enabled: true,
        productTypeId: "84211",
        productQuantity: 3,
        paymentTypeId: "77801",
        paymentQuantity: 25,
    },
];

const BASE_STATE = {
    characterItemId: "811880",
    storageUnitItemId: "888800006",
    characterId: "0xcharacter",
    storageUnitId: "0xstorage",
    characterOwnerCapId: "0xbuyer-cap",
    storageUnitOwnerCapId: "0xmachine-cap",
    storageUnitStatus: "ONLINE",
    storageUnitExtension: "0xpackage::config::SupplyTerminalAuth",
    expectedAuthType: "0xpackage::config::SupplyTerminalAuth",
    selectedProductTypeId: "84211",
    listings: LISTINGS,
    inventories: [
        {
            key: "0xmachine-cap",
            items: [
                { typeId: "84210", quantity: 1 },
                { typeId: "84211", quantity: 3 },
            ],
        },
        {
            key: "0xbuyer-cap",
            items: [
                { typeId: "77800", quantity: 10 },
                { typeId: "77801", quantity: 25 },
            ],
        },
    ],
};
```

Update the missing payment assertion to:

```ts
state.inventories[1].items = state.inventories[1].items.filter((item) => item.typeId !== "77801");
assertValidationError(state, /Buyer inventory does not contain payment type 77801 x25/);
```

Update the missing stock assertion to:

```ts
state.inventories[0].items.find((item) => item.typeId === "84211")!.quantity = 2;
assertValidationError(state, /Machine inventory does not contain product type 84211 x3/);
```

Add this selected-listing failure case:

```ts
{
    const state = cloneState();
    state.selectedProductTypeId = "99999";

    assertValidationError(state, /Supply Terminal listing config is missing for product type 99999/);
}
```

- [ ] **Step 2: Run preflight test and verify RED**

Run:

```bash
pnpm exec tsx ts-scripts/supply_terminal_extension/preflight.test.ts
```

Expected: FAIL because `SupplyTerminalPreflightState` still has `listing`, not `listings` plus `selectedProductTypeId`.

- [ ] **Step 3: Update preflight types**

In `preflight.ts`, replace:

```ts
listing: ListingConfigSnapshot | null;
```

with:

```ts
selectedProductTypeId: string;
listings: ListingConfigSnapshot[];
```

Add to `SupplyTerminalPreflightParams`:

```ts
productTypeId: bigint;
```

- [ ] **Step 4: Validate only the selected listing**

At the start of `validateSupplyTerminalPreflight`, replace:

```ts
const listing = state.listing;
if (!listing) {
    throw new Error(`Supply Terminal listing config is missing on ${state.storageUnitId}`);
}
```

with:

```ts
const listing =
    state.listings.find((candidate) => candidate.productTypeId === state.selectedProductTypeId) ??
    null;
if (!listing) {
    throw new Error(
        `Supply Terminal listing config is missing for product type ${state.selectedProductTypeId} on ${state.storageUnitId}`
    );
}
```

Keep the rest of the validation against this `listing` variable.

- [ ] **Step 5: Load all listing dynamic fields**

Rename `loadListingConfig` to `loadListingConfigs` and return `ListingConfigSnapshot[]`:

```ts
async function loadListingConfigs(
    client: SuiJsonRpcClient,
    extensionConfigId: string,
    builderPackageId: string
): Promise<ListingConfigSnapshot[]> {
    const fields = await getAllDynamicFields(client, extensionConfigId);
    const listingFields = fields.filter((field) =>
        String(field.objectType).endsWith(
            `${builderPackageId}::${MODULE.SUPPLY_TERMINAL}::ListingConfig`
        )
    );

    const listings = await Promise.all(
        listingFields.map(async (field) => {
            const fieldObject = await client.getDynamicFieldObject({
                parentId: extensionConfigId,
                name: field.name,
            });
            const value = getMoveObjectFields(fieldObject)?.value;
            const listing = getTypedFields(value);

            if (!listing) return null;

            return {
                enabled: Boolean(listing.enabled),
                productTypeId: String(listing.product_type_id),
                productQuantity: Number(listing.product_quantity),
                paymentTypeId: String(listing.payment_type_id),
                paymentQuantity: Number(listing.payment_quantity),
            };
        })
    );

    return listings.filter((listing): listing is ListingConfigSnapshot => listing !== null);
}
```

In `loadSupplyTerminalPreflightState`, change the Promise tuple to:

```ts
const [listings, storageUnit, inventories] = await Promise.all([
    loadListingConfigs(client, params.extensionConfigId, params.builderPackageId),
    loadStorageUnit(client, params.storageUnitId),
    loadInventories(client, params.storageUnitId),
]);
```

Return:

```ts
selectedProductTypeId: params.productTypeId.toString(),
listings,
```

- [ ] **Step 6: Pass selected product from `exchange.ts`**

In `exchange.ts`, import:

```ts
import { getSelectedExchangeProductTypeId } from "./listing-config";
```

Change the `exchange` function signature to:

```ts
async function exchange(
    ctx: ReturnType<typeof initializeContext>,
    storageUnitItemId: bigint,
    characterItemId: bigint,
    productTypeId: bigint
)
```

Add `productTypeId` to the preflight params:

```ts
productTypeId,
```

Add the Move call argument before `ownerCap` is returned:

```ts
tx.pure.u64(productTypeId),
```

The exchange move call arguments should be:

```ts
arguments: [
    tx.object(extensionConfigId),
    tx.object(storageUnitId),
    tx.object(characterId),
    ownerCap,
    tx.pure.u64(productTypeId),
],
```

In `main`, derive and pass the selected product:

```ts
const productTypeId = getSelectedExchangeProductTypeId();
await exchange(ctx, storageUnitItemId, characterItemId, productTypeId);
```

- [ ] **Step 7: Run preflight test and verify GREEN**

Run:

```bash
pnpm exec tsx ts-scripts/supply_terminal_extension/preflight.test.ts
```

Expected: PASS with no output.

- [ ] **Step 8: Run TypeScript typecheck**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add ts-scripts/supply_terminal_extension/preflight.ts ts-scripts/supply_terminal_extension/preflight.test.ts ts-scripts/supply_terminal_extension/exchange.ts
git commit -m "feat: select supply terminal product for exchange"
```

---

### Task 7: Document Env and Usage

**Files:**
- Modify: `.env.example`
- Modify: `ts-scripts/supply_terminal_extension/readme.md`

- [ ] **Step 1: Update `.env.example`**

Replace the old optional payment overrides:

```dotenv
# Optional overrides for pnpm seed-supply-terminal-payment
# SUPPLY_TERMINAL_PAYMENT_TYPE_ID=77800
# SUPPLY_TERMINAL_PAYMENT_QUANTITY=10
# SUPPLY_TERMINAL_PAYMENT_VOLUME=10
# SUPPLY_TERMINAL_PAYMENT_ITEM_ID=
```

with:

```dotenv
# Optional multi-listing config used by configure, seed, and exchange scripts.
# If omitted, scripts use the original single listing:
# Carbon Weave 84210 x1 for Feldspar Crystals 77800 x10.
# SUPPLY_TERMINAL_LISTINGS=[{"productTypeId":"84210","productQuantity":1,"paymentTypeId":"77800","paymentQuantity":10,"paymentVolume":"10"},{"productTypeId":"84211","productQuantity":3,"paymentTypeId":"77801","paymentQuantity":25,"paymentVolume":"10"}]
# SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID=84210
# SUPPLY_TERMINAL_PAYMENT_ITEM_ID=
```

- [ ] **Step 2: Update script README**

In `ts-scripts/supply_terminal_extension/readme.md`, add this section after required env vars:

````markdown
## Optional multi-listing config

By default the scripts configure and seed the original single listing:

- product `84210` x1
- payment `77800` x10

Set `SUPPLY_TERMINAL_LISTINGS` to configure multiple products in one command:

```bash
SUPPLY_TERMINAL_LISTINGS='[
  {"productTypeId":"84210","productQuantity":1,"paymentTypeId":"77800","paymentQuantity":10,"paymentVolume":"10"},
  {"productTypeId":"84211","productQuantity":3,"paymentTypeId":"77801","paymentQuantity":25,"paymentVolume":"10"}
]'
```

Each `productTypeId` must be unique. `productQuantity` can be any positive integer. `paymentVolume` is only used by `pnpm seed-supply-terminal-payment`; it defaults to `10` when omitted.

To run an exchange for a specific product:

```bash
SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID=84211 pnpm supply-terminal-exchange
```
````

Update script order to include payment seeding:

```markdown
# 3. Seed player payment inventory for configured listings (localnet helper)
pnpm seed-supply-terminal-payment

# 4. Execute test exchange (player)
SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID=84210 pnpm supply-terminal-exchange
```

- [ ] **Step 3: Commit**

```bash
git add .env.example ts-scripts/supply_terminal_extension/readme.md
git commit -m "docs: document supply terminal multi-listing config"
```

---

### Task 8: Final Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run Move tests**

Run:

```bash
cd move-contracts/supply_terminal_extension && sui move test -e testnet
```

Expected: PASS for all tests.

- [ ] **Step 2: Run targeted TypeScript tests**

Run:

```bash
pnpm exec tsx ts-scripts/supply_terminal_extension/listing-config.test.ts
pnpm exec tsx ts-scripts/supply_terminal_extension/seed-payment.test.ts
pnpm exec tsx ts-scripts/supply_terminal_extension/preflight.test.ts
```

Expected: each command exits 0 with no assertion failures.

- [ ] **Step 3: Run TypeScript typecheck**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Run formatting check**

Run:

```bash
pnpm fmt:check
```

Expected: PASS for Move and TypeScript formatting.

- [ ] **Step 5: Inspect git diff**

Run:

```bash
git diff --stat
git diff -- move-contracts/supply_terminal_extension ts-scripts/supply_terminal_extension .env.example
```

Expected: diff is limited to the Move contract/tests, Supply Terminal TS scripts/tests/docs, and `.env.example`. No dapp files are changed.

---

## Self-Review

- Spec coverage: The plan preserves `ListingConfig` fields, supports arbitrary `product_quantity`, uses `product_type_id` as the unique dynamic-field key, updates configure/seed scripts, and avoids dapp changes.
- Placeholder scan: No planned step relies on unspecified implementation details or future fill-ins.
- Type consistency: Move uses `product_type_id`/`product_quantity`; TypeScript uses `productTypeId`/`productQuantity`; exchange and preflight both pass `productTypeId` as a `bigint`.
