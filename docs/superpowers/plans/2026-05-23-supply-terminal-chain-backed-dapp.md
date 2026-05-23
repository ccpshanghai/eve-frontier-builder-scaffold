# Supply Terminal Chain-Backed dApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Supply Terminal dapp derive Slot 01 from live Sui StorageUnit/listing/inventory state and submit the real `supply_terminal::exchange` Move call.

**Architecture:** Add a focused chain adapter under `dapps/src/components/SupplyTerminal/` that reads StorageUnit, listing config, wallet Character OwnerCap, and inventories through Sui JSON-RPC. `SupplyTerminal.tsx` becomes a state coordinator: it asks the adapter for a snapshot, builds slots from the snapshot, and builds the exchange transaction from the same ids. Existing presentation components remain mostly unchanged.

**Tech Stack:** React 19, Vite, Vitest, Testing Library, `@mysten/sui` `Transaction` and `SuiJsonRpcClient`, existing local dapp-kit wallet provider, `pnpx playwright` for browser verification.

---

## File Structure

- Create `dapps/src/components/SupplyTerminal/chain.ts`
  - Owns public env parsing, Sui RPC client creation, dynamic-field reads, listing parsing, inventory parsing, connected wallet Character OwnerCap discovery, preflight validation, and real exchange transaction construction.
- Modify `dapps/src/components/SupplyTerminal/storage.ts`
  - Replace GraphQL-only storage parsing with the chain adapter snapshot path, preserving `useSupplyTerminalStorage` as the hook consumed by `SupplyTerminal.tsx`.
- Modify `dapps/src/components/SupplyTerminal/SupplyTerminal.tsx`
  - Remove hard-coded `playerPaymentQuantity`, `machineStockQuantity`, `listingEnabled`, and local-only `slotSold` as the source of truth.
  - Build slots from the chain snapshot.
  - Submit `buildSupplyTerminalExchangeTransaction(...)` instead of an empty `Transaction`.
  - Refetch after success or failure.
- Modify `dapps/src/components/SupplyTerminal/types.ts`
  - Add snapshot/preflight types and optional `refreshing` state as needed.
- Modify `dapps/src/components/SupplyTerminal/slots.ts`
  - Accept chain-derived booleans and preserve disabled reasons.
- Modify `dapps/src/components/SupplyTerminal/__tests__/SupplyTerminal.test.tsx`
  - Assert disconnected storage-backed state comes from inventory snapshot.
  - Assert connected ready state sends real transaction builder path and refetches.
- Create `dapps/src/components/SupplyTerminal/__tests__/chain.test.ts`
  - Unit-test listing parsing, inventory parsing, wallet OwnerCap selection, preflight result, and exchange transaction construction calls.
- Modify `dapps/.envsample`
  - Add public placeholders for `VITE_SUPPLY_TERMINAL_PACKAGE_ID`, `VITE_SUPPLY_TERMINAL_CONFIG_ID`, and `VITE_WORLD_OBJECT_REGISTRY_ID`.
- Modify `dapps/src/vite-env.d.ts`
  - Type the new public Vite env vars.

## Task 1: Chain Adapter Parsing and Preflight

**Files:**
- Create: `dapps/src/components/SupplyTerminal/chain.ts`
- Create: `dapps/src/components/SupplyTerminal/__tests__/chain.test.ts`
- Modify: `dapps/src/components/SupplyTerminal/types.ts`

- [ ] **Step 1: Write failing tests for parsing and slot preflight**

Create `dapps/src/components/SupplyTerminal/__tests__/chain.test.ts` with tests equivalent to:

```ts
import { describe, expect, it } from "vitest";
import {
    parseInventoryItems,
    validateSupplyTerminalSnapshot,
} from "../chain";
import type { SupplyTerminalChainSnapshot } from "../types";

const baseSnapshot: SupplyTerminalChainSnapshot = {
    storage: {
        id: "0xstorage",
        ownerCapId: "0xmachinecap",
        status: "ONLINE",
        extension: "0xbuilder::config::SupplyTerminalAuth",
    },
    listing: {
        enabled: true,
        productTypeId: 84210,
        productQuantity: 1,
        paymentTypeId: 77800,
        paymentQuantity: 10,
    },
    machineInventory: [{ typeId: 84210, quantity: 1 }],
    buyerInventory: [{ typeId: 77800, quantity: 10 }],
    character: {
        id: "0xcharacter",
        ownerCapId: "0xcharactercap",
    },
};

describe("Supply Terminal chain adapter", () => {
    it("parses inventory dynamic field item contents", () => {
        expect(
            parseInventoryItems([
                {
                    fields: {
                        key: "84210",
                        value: {
                            fields: {
                                type_id: "84210",
                                quantity: "2",
                            },
                        },
                    },
                },
            ]),
        ).toEqual([{ typeId: 84210, quantity: 2 }]);
    });

    it("reports ready when listing, stock, payment, and wallet character are present", () => {
        expect(validateSupplyTerminalSnapshot(baseSnapshot)).toEqual({
            paymentAvailable: true,
            machineStockAvailable: true,
            listingEnabled: true,
            extensionAuthorized: true,
            disabledReason: undefined,
        });
    });

    it("reports out of stock when machine inventory is empty", () => {
        expect(
            validateSupplyTerminalSnapshot({
                ...baseSnapshot,
                machineInventory: [],
            }),
        ).toMatchObject({
            machineStockAvailable: false,
            disabledReason: "Carbon Weave unavailable",
        });
    });

    it("reports insufficient payment when buyer inventory lacks payment item", () => {
        expect(
            validateSupplyTerminalSnapshot({
                ...baseSnapshot,
                buyerInventory: [],
            }),
        ).toMatchObject({
            paymentAvailable: false,
            disabledReason: "Requires Feldspar Crystals x10",
        });
    });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
pnpm --dir dapps test -- src/components/SupplyTerminal/__tests__/chain.test.ts
```

Expected: fail because `../chain` and `SupplyTerminalChainSnapshot` are not defined.

- [ ] **Step 3: Implement minimal chain types and pure helpers**

Add these types to `dapps/src/components/SupplyTerminal/types.ts`:

```ts
export interface SupplyTerminalInventoryItem {
    typeId: number;
    quantity: number;
}

export interface SupplyTerminalStorageSnapshot {
    id: string;
    ownerCapId: string;
    status: string;
    extension: string;
}

export interface SupplyTerminalCharacterSnapshot {
    id: string;
    ownerCapId: string;
}

export interface SupplyTerminalChainSnapshot {
    storage: SupplyTerminalStorageSnapshot;
    listing: ListingConfig | null;
    machineInventory: SupplyTerminalInventoryItem[];
    buyerInventory: SupplyTerminalInventoryItem[];
    character: SupplyTerminalCharacterSnapshot | null;
}

export interface SupplyTerminalPreflightView {
    paymentAvailable: boolean;
    machineStockAvailable: boolean;
    listingEnabled: boolean;
    extensionAuthorized: boolean;
    disabledReason?: string;
}
```

Create `dapps/src/components/SupplyTerminal/chain.ts` with the pure helpers:

```ts
import { SUPPLY_TERMINAL_CONFIG } from "./config";
import type {
    SupplyTerminalChainSnapshot,
    SupplyTerminalInventoryItem,
    SupplyTerminalPreflightView,
} from "./types";

type MoveFields = Record<string, unknown>;

function getFields(value: unknown): MoveFields | null {
    if (!value || typeof value !== "object") return null;
    const fields = (value as { fields?: unknown }).fields;
    return fields && typeof fields === "object" ? (fields as MoveFields) : (value as MoveFields);
}

export function parseInventoryItems(contents: unknown[]): SupplyTerminalInventoryItem[] {
    return contents.map((entry) => {
        const fields = getFields(entry);
        const value = getFields(fields?.value);
        return {
            typeId: Number(value?.type_id ?? fields?.key ?? 0),
            quantity: Number(value?.quantity ?? 0),
        };
    });
}

function hasItem(
    inventory: SupplyTerminalInventoryItem[],
    typeId: number,
    quantity: number,
): boolean {
    return inventory.some((item) => item.typeId === typeId && item.quantity >= quantity);
}

export function validateSupplyTerminalSnapshot(
    snapshot: SupplyTerminalChainSnapshot,
): SupplyTerminalPreflightView {
    const listing = snapshot.listing;
    const product = SUPPLY_TERMINAL_CONFIG.product;
    const payment = SUPPLY_TERMINAL_CONFIG.payment;

    if (!listing?.enabled) {
        return {
            paymentAvailable: false,
            machineStockAvailable: false,
            listingEnabled: false,
            extensionAuthorized: snapshot.storage.extension.includes("::config::SupplyTerminalAuth"),
            disabledReason: "Listing disabled",
        };
    }

    const extensionAuthorized = snapshot.storage.extension.includes("::config::SupplyTerminalAuth");
    const machineStockAvailable = hasItem(
        snapshot.machineInventory,
        listing.productTypeId,
        listing.productQuantity,
    );
    const paymentAvailable = hasItem(
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
              ? `${product.name} unavailable`
              : !paymentAvailable
                ? `Requires ${payment.name} x${payment.quantity}`
                : undefined,
    };
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
pnpm --dir dapps test -- src/components/SupplyTerminal/__tests__/chain.test.ts
```

Expected: pass.

## Task 2: Live Snapshot Loading

**Files:**
- Modify: `dapps/src/components/SupplyTerminal/chain.ts`
- Modify: `dapps/src/components/SupplyTerminal/storage.ts`
- Modify: `dapps/src/vite-env.d.ts`
- Modify: `dapps/.envsample`
- Test: `dapps/src/components/SupplyTerminal/__tests__/chain.test.ts`

- [ ] **Step 1: Add failing tests for env parsing and snapshot composition**

Extend `chain.test.ts` with tests that call `readSupplyTerminalEnv(...)` and `selectInventoryForKey(...)`:

```ts
import {
    readSupplyTerminalEnv,
    selectInventoryForKey,
} from "../chain";

it("reads public Supply Terminal env values", () => {
    expect(
        readSupplyTerminalEnv({
            VITE_OBJECT_ID: " 0xstorage ",
            VITE_EVE_WORLD_PACKAGE_ID: "0xworld",
            VITE_SUPPLY_TERMINAL_PACKAGE_ID: "0xbuilder",
            VITE_SUPPLY_TERMINAL_CONFIG_ID: "0xconfig",
            VITE_SUI_RPC_URL: "http://127.0.0.1:9000",
        }),
    ).toEqual({
        storageObjectId: "0xstorage",
        worldPackageId: "0xworld",
        supplyTerminalPackageId: "0xbuilder",
        supplyTerminalConfigId: "0xconfig",
        rpcUrl: "http://127.0.0.1:9000",
    });
});

it("selects inventory by owner cap key case-insensitively", () => {
    expect(
        selectInventoryForKey(
            [
                { key: "0xABC", items: [{ typeId: 84210, quantity: 1 }] },
                { key: "0xDEF", items: [{ typeId: 77800, quantity: 10 }] },
            ],
            "0xdef",
        ),
    ).toEqual([{ typeId: 77800, quantity: 10 }]);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
pnpm --dir dapps test -- src/components/SupplyTerminal/__tests__/chain.test.ts
```

Expected: fail because `readSupplyTerminalEnv` and `selectInventoryForKey` are missing.

- [ ] **Step 3: Implement env parsing and live snapshot loader**

Add `readSupplyTerminalEnv`, `selectInventoryForKey`, `createSupplyTerminalRpcClient`, `loadSupplyTerminalSnapshot`, `loadListingConfig`, `loadInventories`, and `findWalletCharacter` to `chain.ts`. Use Sui JSON-RPC `getObject`, `getDynamicFields`, `getDynamicFieldObject`, and `getOwnedObjects`. Use the same type strings as `ts-scripts/supply_terminal_extension/exchange.ts`:

```ts
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

export interface SupplyTerminalEnv {
    storageObjectId: string;
    worldPackageId: string;
    supplyTerminalPackageId: string;
    supplyTerminalConfigId: string;
    rpcUrl: string;
}

export function readSupplyTerminalEnv(env: ImportMetaEnv | Record<string, string | undefined>): SupplyTerminalEnv {
    return {
        storageObjectId: env.VITE_OBJECT_ID?.trim() ?? "",
        worldPackageId: env.VITE_EVE_WORLD_PACKAGE_ID?.trim() ?? "",
        supplyTerminalPackageId: env.VITE_SUPPLY_TERMINAL_PACKAGE_ID?.trim() ?? "",
        supplyTerminalConfigId: env.VITE_SUPPLY_TERMINAL_CONFIG_ID?.trim() ?? "",
        rpcUrl: env.VITE_SUI_RPC_URL?.trim() || "http://127.0.0.1:9000",
    };
}

export function createSupplyTerminalRpcClient(env = readSupplyTerminalEnv(import.meta.env)) {
    return new SuiJsonRpcClient({ url: env.rpcUrl, network: "localnet" });
}

export function selectInventoryForKey(
    inventories: { key: string; items: SupplyTerminalInventoryItem[] }[],
    key: string | null | undefined,
): SupplyTerminalInventoryItem[] {
    if (!key) return [];
    return inventories.find((inventory) => inventory.key.toLowerCase() === key.toLowerCase())?.items ?? [];
}
```

The live loader should return a `SupplyTerminalChainSnapshot` and should not throw for a missing connected account; it should return `character: null` and `buyerInventory: []`.

- [ ] **Step 4: Wire `storage.ts` hook to the live loader**

Change `useSupplyTerminalStorage` to return:

```ts
interface SupplyTerminalStorageState {
    snapshot: SupplyTerminalChainSnapshot | null;
    storage: SupplyTerminalStorageSnapshot | null;
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}
```

The hook should call `loadSupplyTerminalSnapshot({ accountAddress })` and expose `refetch`.

- [ ] **Step 5: Add public env placeholders**

Update `dapps/.envsample`:

```env
VITE_SUPPLY_TERMINAL_PACKAGE_ID=
VITE_SUPPLY_TERMINAL_CONFIG_ID=
VITE_WORLD_OBJECT_REGISTRY_ID=
```

`VITE_WORLD_OBJECT_REGISTRY_ID` is reserved for future direct derivation and should remain public.

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm --dir dapps test -- src/components/SupplyTerminal/__tests__/chain.test.ts
```

Expected: pass.

## Task 3: Chain-Derived Slots in UI

**Files:**
- Modify: `dapps/src/components/SupplyTerminal/SupplyTerminal.tsx`
- Modify: `dapps/src/components/SupplyTerminal/slots.ts`
- Modify: `dapps/src/components/SupplyTerminal/__tests__/SupplyTerminal.test.tsx`

- [ ] **Step 1: Write failing UI tests for chain-derived slots**

Update `SupplyTerminal.test.tsx` so the hook mock returns a snapshot with machine stock and no connected wallet. Assert Slot 01 is `NO WALLET`. Add a connected snapshot with no machine stock and assert Slot 01 is `NO STOCK`.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
pnpm --dir dapps test -- src/components/SupplyTerminal/__tests__/SupplyTerminal.test.tsx
```

Expected: fail because `SupplyTerminal.tsx` still uses hard-coded stock/payment values.

- [ ] **Step 3: Replace hard-coded slot inputs with snapshot validation**

In `SupplyTerminal.tsx`, compute:

```ts
const preflight = snapshot
    ? validateSupplyTerminalSnapshot(snapshot)
    : {
          paymentAvailable: false,
          machineStockAvailable: false,
          listingEnabled: false,
          extensionAuthorized: false,
          disabledReason: "Storage unavailable",
      };
```

Pass `preflight.paymentAvailable`, `preflight.machineStockAvailable`, `preflight.listingEnabled`, `preflight.extensionAuthorized`, and `preflight.disabledReason` into `buildSupplyTerminalSlots`.

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
pnpm --dir dapps test -- src/components/SupplyTerminal/__tests__/SupplyTerminal.test.tsx
```

Expected: pass.

## Task 4: Real Exchange Transaction Builder

**Files:**
- Modify: `dapps/src/components/SupplyTerminal/chain.ts`
- Modify: `dapps/src/components/SupplyTerminal/SupplyTerminal.tsx`
- Test: `dapps/src/components/SupplyTerminal/__tests__/chain.test.ts`
- Test: `dapps/src/components/SupplyTerminal/__tests__/SupplyTerminal.test.tsx`

- [ ] **Step 1: Write failing transaction builder test**

In `chain.test.ts`, mock a transaction-like object or inspect `Transaction.toJSON()` to verify the transaction includes these three move calls:

```ts
`${worldPackageId}::character::borrow_owner_cap`
`${supplyTerminalPackageId}::supply_terminal::exchange`
`${worldPackageId}::character::return_owner_cap`
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
pnpm --dir dapps test -- src/components/SupplyTerminal/__tests__/chain.test.ts
```

Expected: fail because `buildSupplyTerminalExchangeTransaction` is missing.

- [ ] **Step 3: Implement `buildSupplyTerminalExchangeTransaction`**

Add to `chain.ts`:

```ts
import { Transaction } from "@mysten/sui/transactions";

export function buildSupplyTerminalExchangeTransaction(input: {
    env: SupplyTerminalEnv;
    snapshot: SupplyTerminalChainSnapshot;
    sender: string;
}): Transaction {
    const character = input.snapshot.character;
    if (!character) {
        throw new Error("Connected wallet does not own a Character OwnerCap");
    }

    const tx = new Transaction();
    tx.setSender(input.sender);

    const [ownerCap, returnReceipt] = tx.moveCall({
        target: `${input.env.worldPackageId}::character::borrow_owner_cap`,
        typeArguments: [`${input.env.worldPackageId}::character::Character`],
        arguments: [tx.object(character.id), tx.object(character.ownerCapId)],
    });

    tx.moveCall({
        target: `${input.env.supplyTerminalPackageId}::supply_terminal::exchange`,
        typeArguments: [`${input.env.worldPackageId}::character::Character`],
        arguments: [
            tx.object(input.env.supplyTerminalConfigId),
            tx.object(input.snapshot.storage.id),
            tx.object(character.id),
            ownerCap,
        ],
    });

    tx.moveCall({
        target: `${input.env.worldPackageId}::character::return_owner_cap`,
        typeArguments: [`${input.env.worldPackageId}::character::Character`],
        arguments: [tx.object(character.id), ownerCap, returnReceipt],
    });

    return tx;
}
```

- [ ] **Step 4: Wire `handleConfirmTrade` to the builder**

In `SupplyTerminal.tsx`, replace `new Transaction()` with `buildSupplyTerminalExchangeTransaction({ env, snapshot, sender: account.address })`. On success, call `await refetch()` instead of `setSlotSold(true)`.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --dir dapps test -- src/components/SupplyTerminal/__tests__/chain.test.ts src/components/SupplyTerminal/__tests__/SupplyTerminal.test.tsx
```

Expected: pass.

## Task 5: Browser Verification

**Files:**
- No committed files.

- [ ] **Step 1: Ensure local services respond**

Run:

```bash
curl -sS -X POST -H 'content-type: application/json' --data '{"query":"query { chainIdentifier }"}' http://127.0.0.1:9125/graphql
curl -sS -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"sui_getChainIdentifier","params":[]}' http://127.0.0.1:9000
```

Expected: both return identifiers.

- [ ] **Step 2: Verify unit and build**

Run:

```bash
pnpm --dir dapps test
pnpm --dir dapps build
git diff --check
```

Expected: tests pass, build exits 0, diff check exits 0.

- [ ] **Step 3: Verify in browser with `pnpx playwright`**

Create a temporary Playwright spec under `/private/tmp` that connects the local dev wallet, waits for `TRADE`, clicks it, confirms, and expects either:

- Slot 01 becomes empty because stock was consumed, or
- Slot 01 becomes `NO STOCK` after refresh.

Run:

```bash
pnpx playwright test --config /private/tmp/supply-terminal-chain-backed.config.cjs
```

Expected: the page no longer records an empty transaction as success; state after confirmation comes from refreshed StorageUnit inventory.

## Self-Review

- Spec coverage: live StorageUnit slot derivation is covered by Tasks 1-3; real Move transaction is covered by Task 4; `pnpx playwright` verification is covered by Task 5.
- Placeholder scan: no TODO/TBD steps remain. Future direct object derivation env is explicit and non-blocking.
- Type consistency: `SupplyTerminalChainSnapshot`, `SupplyTerminalPreflightView`, and transaction builder inputs are defined before use.
