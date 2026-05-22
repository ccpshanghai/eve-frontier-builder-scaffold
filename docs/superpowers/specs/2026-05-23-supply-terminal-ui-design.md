# Supply Terminal dApp UI Design

Date: 2026-05-23
Base implementation spec: [2026-05-22-supply-terminal-design.md](./2026-05-22-supply-terminal-design.md)
Visual direction approved from the brainstorming companion: responsive Frontier-style vending terminal with per-slot trade confirmation.

## Goal

Redesign the Supply Terminal dApp from a generic four-card dashboard into a Frontier-style vending terminal.

The UI should feel like an in-world industrial vending panel:

- Multiple vending slots are visible.
- Only Slot 01 is backed by the current real listing and exchange transaction.
- Empty slots are visible as future vending bays, not active products.
- Each active slot owns its own `TRADE` action.
- Clicking `TRADE` opens a confirmation modal.
- Confirming the modal submits the exchange transaction.
- On successful exchange, the purchased slot becomes `EMPTY`.
- The event log is always a full-width bottom terminal panel.

This design intentionally does not expand the contract into true multi-slot vending yet.

## Scope

Included:

- Responsive slot grid with 1 to 3 columns depending on available container width.
- One real tradable slot for the existing `Carbon Weave x1` for `Feldspar Crystals x10` listing.
- Empty visual slots for future products.
- Per-slot trade button.
- Confirmation modal for the selected slot.
- Bottom full-width event log.
- Owner authorization prompt that does not dominate the sale slots.
- Frontier-inspired visual treatment: hard borders, dark industrial background, orange active state language.

Excluded:

- True multi-slot contract/listing support.
- In-dApp full player inventory display.
- Persistent right-side trade rail.
- Persistent right-side event log.
- Multi-product configuration UI beyond a future owner entry point.
- Two-step on-chain staging or escrow.

## Visual System

Use a dark industrial terminal palette:

- Background: black/brown-black terminal surface.
- Panel fill: slightly lifted dark brown-black.
- Borders: muted beige/gray-brown thin strokes.
- Active/confirm/warning: orange.
- Available/success checks: muted green.
- Empty states: low-contrast gray-brown with dashed borders.
- Text: off-white/cream, with muted beige secondary labels.

Use hard-edged UI:

- Square or near-square panels.
- Thin borders.
- Minimal border radius.
- Compact, terminal-like typography.
- No SaaS card polish, gradients-as-decoration, or large marketing-style sections.

The page should feel like a machine interface, but still behave like a clear dApp.

## Responsive Layout

The terminal shell is container-based, not fixed-width.

Desktop/wide container:

- Header at top with app title, storage status, and wallet/address chip.
- Optional owner authorization banner below the header.
- Sale slot grid below the banner.
- Event log below the grid, full width.

Slot grid:

- Uses responsive auto-fit behavior.
- Minimum practical slot width: about 300-340px.
- 1 column on narrow/mobile containers.
- 2 columns on medium containers.
- Maximum 3 columns on wide containers.
- It must not force horizontal scrolling at normal browser widths.

Small containers:

- Header status chips wrap below title if needed.
- Owner banner stacks action button below text if needed.
- Slots become single-column.
- Modal remains centered and constrained to the viewport.

## Slot Model

Represent each vending bay as a slot.

### Ready Slot

Slot 01 is the only real slot for the current scope.

Content:

- Slot label: `SLOT 01`
- Status: `READY` when inventory/payment conditions allow purchase.
- Reward: `Carbon Weave`
- Reward quantity: `x1`
- Reward item ID: `84210`
- Price: `Feldspar x10`
- Price check: `AVAILABLE` when the player can pay.
- Primary button: `TRADE`

Interaction:

- Clicking `TRADE` opens the confirmation modal.
- The button is disabled if payment is insufficient, machine stock is unavailable, listing is disabled, extension is not authorized, or a transaction is currently submitting.

### Empty Slot

Slots 02-06 are empty visual bays for now.

Content:

- Slot label: `SLOT 02`, `SLOT 03`, etc.
- Status: `EMPTY`
- Body: `No Item`
- Price: `--`
- Disabled button labeled `EMPTY`

Interaction:

- Empty slots are not selectable.
- Empty slots never open the modal.

### Sold/Consumed Slot

After a successful exchange, Slot 01 should render like an empty slot for the local session.

Content:

- Slot label remains `SLOT 01`.
- Status becomes `EMPTY`.
- Reward and price are no longer shown as tradable.
- Event log records the completed exchange.

This local sold state can later be replaced by live machine stock/listing data once the dApp reads current inventory from chain/indexer data.

## Trade Confirmation Modal

The confirmation modal appears only after a user clicks `TRADE` on a ready slot.

Modal content:

- Title: `CONFIRM TRADE`
- Slot label: `Slot 01`
- Status chip: `READY`
- Receive row: `Carbon Weave x1`
- Pay row: `Feldspar Crystals x10`
- Price check row: `AVAILABLE`
- Success row: `Slot 01 becomes EMPTY`
- Actions: `CANCEL`, `CONFIRM TRADE`

Behavior:

- `CANCEL` closes the modal without changing state.
- `CONFIRM TRADE` submits the exchange transaction.
- While submitting, disable modal actions and show a submitting state.
- On success, close the modal, mark Slot 01 empty, and append event log entries.
- On failure, keep the modal open with a compact error message, re-enable actions, append a failure event, and keep Slot 01 tradable if no exchange completed.

## Event Log

The event log is a bottom full-width panel and should visually match the terminal surface.

It is the persistent feedback area for the machine.

Typical events:

- `Terminal inventory synchronized`
- `Slot 01 price available`
- `Trade confirmation opened`
- `Awaiting wallet confirmation`
- `Exchange submitted`
- `Exchange complete`
- `Slot 01 empty`
- `Exchange failed: <reason>`
- `Extension authorized`
- `Authorization failed: <reason>`

The event log should not occupy a right rail. It should stay below the slot grid so the sale slots remain the main visual focus.

## Owner Controls

Owner controls remain secondary.

When the connected account is the owner and the Supply Terminal extension is not authorized:

- Show an authorization banner below the header.
- Use orange active/warning styling.
- Include a compact `AUTHORIZE` or `AUTHORIZE EXTENSION` action.
- Do not hide the sale slots.

Future configure controls may appear as an owner entry point, but they should not become the primary UI in this one-slot vending version.

## State Rules

The UI state machine should track:

- `ready`: Slot 01 is tradable.
- `insufficient_payment`: Slot 01 exists but player cannot pay.
- `submitting`: Wallet/transaction confirmation is in progress.
- `sold`: Slot 01 has been purchased in the current session and renders empty.
- `failed`: Last transaction failed; slot remains available if conditions still allow.

The modal is transient UI state and should not imply an on-chain staging step.

There is no persistent on-chain staging phase. The exchange remains atomic and only happens when the user confirms the modal.

## Component Structure

Recommended component shape:

```text
dapps/src/components/SupplyTerminal/
  SupplyTerminal.tsx        # container state, wallet/assembly hooks, transaction handlers
  VendingGrid.tsx           # responsive slot grid
  VendingSlot.tsx           # ready/disabled/empty/sold slot presentation
  TradeConfirmDialog.tsx    # modal confirmation and submitting state
  OwnerControls.tsx         # owner authorization banner/action
  EventLog.tsx              # bottom terminal log
  config.ts                 # current one-slot product/payment config
  types.ts                  # slot and exchange UI state types
```

Existing `ProductPanel`, `PurchasePanel`, `InventoryPanel`, and `MachinePanel` can either be replaced by the vending components or kept temporarily only if doing so reduces migration risk. The final UI should not present them as four dashboard cards.

## Data Flow

Current one-slot scope:

1. Load wallet, assembly, ownership, and connection state.
2. Resolve current product/payment listing from local config and existing environment assumptions.
3. Determine whether Slot 01 is ready based on available payment, machine stock, listing enabled, and authorization state.
4. Render empty Slots 02-06 as non-interactive placeholders.
5. User clicks `TRADE` on Slot 01.
6. Modal opens with reward, price, and success result.
7. User clicks `CONFIRM TRADE`.
8. dApp submits the existing atomic exchange transaction.
9. On success, Slot 01 renders empty and event log updates.
10. On failure, Slot 01 stays available if preconditions remain true and event log shows failure.

The dApp should not show full player inventory in the main UI. Inventory is only reflected through slot availability and event log feedback.

## Testing

Add or update component tests around behavior rather than only static text.

Required coverage:

- Slot 01 renders as `READY` with reward, price, and `TRADE` button when preconditions are met.
- Empty slots render as `EMPTY` and do not expose a usable trade action.
- Clicking Slot 01 `TRADE` opens the confirmation modal.
- Modal displays receive/pay/price-check/success rows.
- `CANCEL` closes the modal.
- `CONFIRM TRADE` calls the supplied transaction handler.
- Successful trade changes Slot 01 to empty/sold state.
- Failed trade leaves Slot 01 tradable and logs failure.
- Owner authorization banner appears only for owner + unauthorized state.
- Event log renders as a bottom full-width panel.

Responsive behavior should be verified manually or with browser-based checks:

- At narrow widths, slots collapse to one column.
- At medium widths, slots use two columns where space allows.
- At wide widths, slots cap at three columns.
- The UI does not require horizontal scrolling at normal browser widths.

## Acceptance Criteria

The implementation is acceptable when:

- The dApp first screen reads as a Frontier-style vending terminal, not a generic dashboard.
- Slot 01 is the only real tradable slot.
- Slots 02-06 render as empty and inactive.
- Trade confirmation is modal-based.
- Event log is bottom full-width.
- Layout is responsive and supports 1, 2, or 3 slot columns.
- The current atomic exchange model is preserved.
- Tests cover the slot/modal/log behavior listed above.
