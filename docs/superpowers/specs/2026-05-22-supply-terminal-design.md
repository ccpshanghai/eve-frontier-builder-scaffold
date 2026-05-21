# Supply Terminal Implementation Design

Date: 2026-05-22
Spec: [docs/supply-terminal-spec.md](../../supply-terminal-spec.md)

## Architecture Overview

Three independent units deployed incrementally: Move contract → TS scripts → dApp.

```
move-contracts/supply_terminal_extension/   # Smart contract (Move)
  sources/config.move                       # Witness, AdminCap, listing config
  sources/supply_terminal.move              # exchange() entry point
ts-scripts/supply_terminal_extension/       # Configure listing + test exchange
dapps/src/                                  # Frontend (extend existing)
  components/SupplyTerminal/                # Owner setup + buyer exchange UI
```

## 1. Move Contract

**Package**: `move-contracts/supply_terminal_extension/`

Dependency: `world = { local = "../../../world-contracts/contracts/world" }`

### Module: `supply_terminal_extension::config`

Follows `smart_gate_extension::config` pattern:

| Type | Purpose |
|------|---------|
| `SupplyTerminalAuth has drop` | Witness for `authorize_extension<Auth>` |
| `AdminCap has key, store` | Controls listing configuration |
| `ExtensionConfig has key` | Shared object holding dynamic-field rules |

Functions: `init()`, `x_auth()` (package-level), `has_rule/borrow_rule/add_rule/set_rule/remove_rule` on ExtensionConfig via AdminCap.

### Module: `supply_terminal_extension::supply_terminal`

Listing constants stored as dynamic fields on ExtensionConfig:
- `ListingConfigKey {}` → `ListingConfig { enabled: bool, product_type_id: u64, product_quantity: u32, payment_type_id: u64, payment_quantity: u32 }`

Entry point:
```move
public fun exchange<T: key>(
    extension_config: &ExtensionConfig,
    storage_unit: &mut StorageUnit,
    buyer_character: &Character,
    buyer_owner_cap: &OwnerCap<T>,  // Character OwnerCap
    ctx: &mut TxContext,
)
```

Flow: check enabled → `withdraw_by_owner` (payment, Character OwnerCap) → `deposit_item<SupplyTerminalAuth>` (payment, Auth witness) → `withdraw_item<SupplyTerminalAuth>` (product, Auth witness) → `deposit_to_owned<SupplyTerminalAuth>` (product, Auth witness) → emit event.

Event: `SupplyTerminalExchangeEvent { storage_unit_id, buyer_character_id, payment_type_id, payment_quantity, product_type_id, product_quantity }`

All operations atomic — failure aborts entire transaction.

## 2. TS Scripts

Follows [ts-scripts/readme.md](../../ts-scripts/readme.md) conventions — subdirectory per extension, `modules.ts` + `extension-ids.ts` + operation scripts + `readme.md`.

Directory: `ts-scripts/supply_terminal_extension/`

| File | Purpose |
|------|---------|
| `modules.ts` | Module name constants (`CONFIG`, `SUPPLY_TERMINAL`) |
| `extension-ids.ts` | Resolve package ID and `ExtensionConfig` ID from deployment |
| `configure-listing.ts` | Admin sets product/payment/quantity rules on ExtensionConfig |
| `authorise-extension.ts` | StorageUnit owner authorizes `SupplyTerminalAuth` (localnet test / deployment) |
| `exchange.ts` | Execute exchange (for testing, mirrors dApp transaction) |
| `readme.md` | Script order, prerequisites, env vars |

Package publish is done via `sui client publish` (CLI, not a TS script). Authorization can be done via dApp UI (recommended) or `authorise-extension.ts` (localnet). Seeding inventory is handled through world-contracts or in-game operations.

Reuses existing helpers from `ts-scripts/helpers/` and `ts-scripts/utils/`.

## 3. dApp

Extends existing `dapps/` project. **Not two separate views — owner sees exchange too.** The owner-only controls are additions to the shared exchange UI.

| Role | Exchange UI | Extra controls |
|------|-------------|----------------|
| Owner | Full exchange flow (can buy same as anyone) | [Authorize Extension] (if needed), configure listing (bottom-right corner) |
| Buyer | Full exchange flow | None |

### Visibility Control (dapp-kit APIs)

```text
useSmartObject() → assembly (type SmartAssemblyResponse) + character
useConnection()  → currentAccount (has .address)
isOwner(assembly, currentAccount?.address) → boolean
```

- `isOwner()` (from `@evefrontier/dapp-kit`) drives visibility of owner-only UI elements
- dApp reads `StorageUnit.extension` via `getObjectWithJson()` to check if `SupplyTerminalAuth` is already authorized

### UI Layout

```text
┌──────────────────────────────────────┐
│  [Product Panel]   [Inventory Panel] │
│  [Purchase Panel]  [Machine Panel]   │
│                                      │
│  [Event Log]                         │
│                                      │
│                [⚙ Configure]  ← owner only, bottom-right corner
└──────────────────────────────────────┘
```

If owner enters and extension is NOT authorized: show a banner/prompt at top — "Extension not authorized. [Authorize Now]" — but exchange UI remains visible below. Once authorized, the banner disappears. Configure button stays in bottom-right corner.

### Owner-Only Actions

**Authorize** (one-time, shown when `isOwner && !authorized`):
```text
Prompt: "Extension not authorized — items cannot be moved."
[Authorize Extension] → dAppKit.signAndExecuteTransaction(
    borrow StorageUnit OwnerCap → storage_unit::authorize_extension<SupplyTerminalAuth> → return OwnerCap
)
```

**Configure listing** (corner button, owner only):
Opens a small panel/dialog to set product/payment rules via ExtensionConfig.

### Buyer Exchange Flow (all users)

Exchange flow as specified in [§7-8 of the spec](../../supply-terminal-spec.md). Local UI state machine only — no on-chain staging.

### Files

```
dapps/src/
  components/
    SupplyTerminal/
      SupplyTerminal.tsx     # Main container: isOwner() → show/hide owner controls
      ProductPanel.tsx        # Listing + stock display
      PurchasePanel.tsx       # Local UI state machine
      InventoryPanel.tsx      # Player balances
      MachinePanel.tsx        # Machine stock + revenue
      EventLog.tsx            # Transaction event log
      OwnerControls.tsx       # Authorize banner + configure button (owner only)
      config.ts               # Product/payment type IDs, quantities
      types.ts                # UI state types
```

## 4. Deployment Order

1. **Localnet running** (via `docker compose run sui-dev`)
2. **Deploy world-contracts** (already done)
3. **Publish** `supply_terminal_extension` package (`sui client publish`)
4. **Configure listing** — `pnpm configure-listing` (set product/payment rules)
5. **Seed stock** — deposit Carbon Weave into machine StorageUnit (in-game)
6. **Seed payment** — deposit Feldspar Crystals into player's Character-owned inventory (in-game)
7. **Open dApp** →
   - Owner arrives → sees [Authorize Extension] → clicks → ✅ installed
   - Buyer arrives → sees exchange UI → selects, stages, confirms → ✅ exchange done

## 5. Files Not Touched

| Skip | Reason |
|------|--------|
| `storage_unit_extension/` | Supply Terminal is a new independent package |
| `smart_gate_extension/` | Reference only, no changes |
| `docker/`, `world-contracts/` | Already deployed |
| `move-contracts/storage_unit_extension/` | Template left as-is |
