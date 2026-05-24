# Supply Terminal UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current four-card Supply Terminal dApp prototype with the approved responsive Frontier-style vending terminal UI.

**Architecture:** Keep `SupplyTerminal.tsx` as the hook-aware container, but move most rendering into focused presentational components. Model the terminal as six slots where Slot 01 is the only real tradable slot, Slots 02-06 are inactive empty bays, each active slot owns its own `TRADE` button, trade confirmation happens in a modal, and the event log is a full-width bottom panel.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Radix Themes for existing provider compatibility, local component CSS in `dapps/src/components/SupplyTerminal/SupplyTerminal.css`.

---

## Context

Read these before starting:

- `docs/superpowers/specs/2026-05-23-supply-terminal-ui-design.md`
- `docs/superpowers/specs/2026-05-23-supply-terminal-ui-visual-reference.html`
- `dapps/src/components/SupplyTerminal/SupplyTerminal.tsx`
- `dapps/src/components/SupplyTerminal/config.ts`
- `dapps/src/components/SupplyTerminal/types.ts`

The dApp dependencies may not be installed in this workspace. If `dapps/node_modules` is missing, run:

```bash
cd dapps
pnpm install
```

Expected: `node_modules` is created and `pnpm test` can find `vitest`.

Do not include `.superpowers/brainstorm/` in commits. The user has an existing `.gitignore` edit for that directory; leave unrelated working tree changes alone.

## File Structure

Create or modify these files:

- Modify: `dapps/src/components/SupplyTerminal/types.ts`
  - Add slot, item, trade dialog, and slot status types.
- Modify: `dapps/src/components/SupplyTerminal/config.ts`
  - Add active slot configuration and empty slot count.
- Create: `dapps/src/components/SupplyTerminal/slots.ts`
  - Build the six-slot UI model from simple availability flags.
- Create: `dapps/src/components/SupplyTerminal/__tests__/slots.test.ts`
  - Pure tests for ready, disabled, sold, and empty slot models.
- Create: `dapps/src/components/SupplyTerminal/VendingSlot.tsx`
  - Render one ready/disabled/empty/sold slot and its button.
- Create: `dapps/src/components/SupplyTerminal/__tests__/VendingSlot.test.tsx`
  - Component tests for slot text, buttons, disabled behavior, and callback invocation.
- Create: `dapps/src/components/SupplyTerminal/VendingGrid.tsx`
  - Render the responsive set of six slots.
- Create: `dapps/src/components/SupplyTerminal/__tests__/VendingGrid.test.tsx`
  - Tests for six slots and trade callback routing.
- Create: `dapps/src/components/SupplyTerminal/TradeConfirmDialog.tsx`
  - Render the modal confirmation flow.
- Create: `dapps/src/components/SupplyTerminal/__tests__/TradeConfirmDialog.test.tsx`
  - Tests for modal visibility, content, cancel, confirm, submitting, and error state.
- Modify: `dapps/src/components/SupplyTerminal/EventLog.tsx`
  - Keep existing event shape but render as bottom terminal panel.
- Modify: `dapps/src/components/SupplyTerminal/__tests__/EventLog.test.tsx`
  - Update tests for bottom panel heading while keeping empty-log behavior.
- Create: `dapps/src/components/SupplyTerminal/SupplyTerminalView.tsx`
  - Compose owner controls, slot grid, modal, and event log without wallet hooks.
- Create: `dapps/src/components/SupplyTerminal/__tests__/SupplyTerminalView.test.tsx`
  - Tests for modal opening, success state callback routing, owner banner, and event log placement.
- Modify: `dapps/src/components/SupplyTerminal/OwnerControls.tsx`
  - Remove fixed bottom-right configure layout; render compact owner banner/actions.
- Modify: `dapps/src/components/SupplyTerminal/__tests__/OwnerControls.test.tsx`
  - Preserve owner visibility tests and update compact action expectations.
- Modify: `dapps/src/components/SupplyTerminal/SupplyTerminal.tsx`
  - Replace four-card prototype wiring with vending state, modal state, and `SupplyTerminalView`.
- Create: `dapps/src/components/SupplyTerminal/SupplyTerminal.css`
  - Implement responsive vending terminal visuals from the approved reference.

Keep old `ProductPanel`, `PurchasePanel`, `InventoryPanel`, and `MachinePanel` files until the new UI is integrated. Delete them only if no imports or tests reference them at the end.

---

### Task 1: Slot Domain Model

**Files:**
- Modify: `dapps/src/components/SupplyTerminal/types.ts`
- Modify: `dapps/src/components/SupplyTerminal/config.ts`
- Create: `dapps/src/components/SupplyTerminal/slots.ts`
- Create: `dapps/src/components/SupplyTerminal/__tests__/slots.test.ts`

- [ ] **Step 1: Write failing slot model tests**

Create `dapps/src/components/SupplyTerminal/__tests__/slots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildSupplyTerminalSlots } from "../slots";

describe("buildSupplyTerminalSlots", () => {
    it("creates one ready slot and five empty slots when all preconditions pass", () => {
        const slots = buildSupplyTerminalSlots({
            paymentAvailable: true,
            machineStockAvailable: true,
            listingEnabled: true,
            extensionAuthorized: true,
            submitting: false,
            sold: false,
        });

        expect(slots).toHaveLength(6);
        expect(slots[0]).toMatchObject({
            id: "slot-01",
            label: "SLOT 01",
            status: "ready",
            canTrade: true,
        });
        expect(slots[0].reward?.name).toBe("Carbon Weave");
        expect(slots[0].price?.name).toBe("Feldspar Crystals");
        expect(slots.slice(1).every((slot) => slot.status === "empty")).toBe(true);
        expect(slots.slice(1).every((slot) => slot.canTrade === false)).toBe(true);
    });

    it("disables Slot 01 when payment is unavailable", () => {
        const slots = buildSupplyTerminalSlots({
            paymentAvailable: false,
            machineStockAvailable: true,
            listingEnabled: true,
            extensionAuthorized: true,
            submitting: false,
            sold: false,
        });

        expect(slots[0]).toMatchObject({
            status: "insufficient_payment",
            canTrade: false,
            disabledReason: "Requires Feldspar Crystals x10",
        });
    });

    it("disables Slot 01 when the extension is not authorized", () => {
        const slots = buildSupplyTerminalSlots({
            paymentAvailable: true,
            machineStockAvailable: true,
            listingEnabled: true,
            extensionAuthorized: false,
            submitting: false,
            sold: false,
        });

        expect(slots[0]).toMatchObject({
            status: "extension_not_authorized",
            canTrade: false,
            disabledReason: "Extension authorization required",
        });
    });

    it("renders Slot 01 as empty after it has been sold in the current session", () => {
        const slots = buildSupplyTerminalSlots({
            paymentAvailable: true,
            machineStockAvailable: true,
            listingEnabled: true,
            extensionAuthorized: true,
            submitting: false,
            sold: true,
        });

        expect(slots[0]).toMatchObject({
            id: "slot-01",
            label: "SLOT 01",
            status: "sold",
            canTrade: false,
        });
        expect(slots[0].reward).toBeUndefined();
        expect(slots[0].price).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run the slot model tests to verify they fail**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal/__tests__/slots.test.ts
```

Expected: FAIL because `../slots` does not exist yet.

- [ ] **Step 3: Add slot types**

Replace `dapps/src/components/SupplyTerminal/types.ts` with:

```ts
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
    | "submitting"
    | "completed"
    | "failed";

export interface ExchangeEvent {
    type: "local" | "chain";
    message: string;
    digest?: string;
    timestamp: number;
}

export type SupplyTerminalSlotStatus =
    | "ready"
    | "insufficient_payment"
    | "extension_not_authorized"
    | "out_of_stock"
    | "listing_disabled"
    | "submitting"
    | "empty"
    | "sold";

export interface SupplyTerminalSlotItem {
    name: string;
    sandboxItemId: number;
    quantity: number;
}

export interface SupplyTerminalSlot {
    id: string;
    index: number;
    label: string;
    status: SupplyTerminalSlotStatus;
    reward?: SupplyTerminalSlotItem;
    price?: SupplyTerminalSlotItem;
    canTrade: boolean;
    disabledReason?: string;
}

export interface BuildSupplyTerminalSlotsInput {
    paymentAvailable: boolean;
    machineStockAvailable: boolean;
    listingEnabled: boolean;
    extensionAuthorized: boolean;
    submitting: boolean;
    sold: boolean;
}
```

- [ ] **Step 4: Add slot config constants**

Replace `dapps/src/components/SupplyTerminal/config.ts` with:

```ts
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

export const SUPPLY_TERMINAL_SLOT_COUNT = 6;
export const ACTIVE_SUPPLY_TERMINAL_SLOT_INDEX = 1;
```

- [ ] **Step 5: Implement slot builder**

Create `dapps/src/components/SupplyTerminal/slots.ts`:

```ts
import {
    ACTIVE_SUPPLY_TERMINAL_SLOT_INDEX,
    SUPPLY_TERMINAL_CONFIG,
    SUPPLY_TERMINAL_SLOT_COUNT,
} from "./config";
import {
    BuildSupplyTerminalSlotsInput,
    SupplyTerminalSlot,
    SupplyTerminalSlotStatus,
} from "./types";

export function buildSupplyTerminalSlots(
    input: BuildSupplyTerminalSlotsInput
): SupplyTerminalSlot[] {
    return Array.from({ length: SUPPLY_TERMINAL_SLOT_COUNT }, (_, offset) => {
        const index = offset + 1;
        if (index !== ACTIVE_SUPPLY_TERMINAL_SLOT_INDEX) {
            return buildEmptySlot(index, "empty");
        }

        if (input.sold) {
            return buildEmptySlot(index, "sold");
        }

        const blocked = getBlockedStatus(input);
        const canTrade = blocked === null;

        return {
            id: slotId(index),
            index,
            label: slotLabel(index),
            status: blocked?.status ?? "ready",
            reward: SUPPLY_TERMINAL_CONFIG.product,
            price: SUPPLY_TERMINAL_CONFIG.payment,
            canTrade,
            disabledReason: blocked?.reason,
        };
    });
}

function getBlockedStatus(
    input: BuildSupplyTerminalSlotsInput
): { status: SupplyTerminalSlotStatus; reason: string } | null {
    if (!input.listingEnabled) {
        return { status: "listing_disabled", reason: "Listing disabled" };
    }
    if (!input.extensionAuthorized) {
        return { status: "extension_not_authorized", reason: "Extension authorization required" };
    }
    if (!input.machineStockAvailable) {
        return { status: "out_of_stock", reason: "Machine stock unavailable" };
    }
    if (!input.paymentAvailable) {
        return {
            status: "insufficient_payment",
            reason: `Requires ${SUPPLY_TERMINAL_CONFIG.payment.name} x${SUPPLY_TERMINAL_CONFIG.payment.quantity}`,
        };
    }
    if (input.submitting) {
        return { status: "submitting", reason: "Transaction submitting" };
    }
    return null;
}

function buildEmptySlot(
    index: number,
    status: Extract<SupplyTerminalSlotStatus, "empty" | "sold">
): SupplyTerminalSlot {
    return {
        id: slotId(index),
        index,
        label: slotLabel(index),
        status,
        canTrade: false,
    };
}

function slotId(index: number): string {
    return `slot-${String(index).padStart(2, "0")}`;
}

function slotLabel(index: number): string {
    return `SLOT ${String(index).padStart(2, "0")}`;
}
```

- [ ] **Step 6: Run the slot model tests to verify they pass**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal/__tests__/slots.test.ts
```

Expected: PASS for all `buildSupplyTerminalSlots` tests.

- [ ] **Step 7: Commit the slot domain model**

Run:

```bash
git add dapps/src/components/SupplyTerminal/types.ts \
  dapps/src/components/SupplyTerminal/config.ts \
  dapps/src/components/SupplyTerminal/slots.ts \
  dapps/src/components/SupplyTerminal/__tests__/slots.test.ts
git commit -m "feat: add supply terminal slot model"
```

---

### Task 2: Vending Slot Component

**Files:**
- Create: `dapps/src/components/SupplyTerminal/VendingSlot.tsx`
- Create: `dapps/src/components/SupplyTerminal/__tests__/VendingSlot.test.tsx`

- [ ] **Step 1: Write failing VendingSlot tests**

Create `dapps/src/components/SupplyTerminal/__tests__/VendingSlot.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VendingSlot } from "../VendingSlot";
import { SupplyTerminalSlot } from "../types";

const readySlot: SupplyTerminalSlot = {
    id: "slot-01",
    index: 1,
    label: "SLOT 01",
    status: "ready",
    reward: { name: "Carbon Weave", sandboxItemId: 84210, quantity: 1 },
    price: { name: "Feldspar Crystals", sandboxItemId: 77800, quantity: 10 },
    canTrade: true,
};

describe("VendingSlot", () => {
    it("renders a ready slot with reward, price, and trade action", () => {
        render(<VendingSlot slot={readySlot} onTrade={() => {}} />);

        expect(screen.getByText("SLOT 01")).toBeDefined();
        expect(screen.getByText("READY")).toBeDefined();
        expect(screen.getByText("Carbon Weave")).toBeDefined();
        expect(screen.getByText(/REWARD x1/)).toBeDefined();
        expect(screen.getByText("Feldspar Crystals x10")).toBeDefined();
        expect(screen.getByRole("button", { name: "TRADE" }).hasAttribute("disabled")).toBe(false);
    });

    it("calls onTrade with the slot when the trade button is clicked", () => {
        const onTrade = vi.fn();
        render(<VendingSlot slot={readySlot} onTrade={onTrade} />);

        fireEvent.click(screen.getByRole("button", { name: "TRADE" }));

        expect(onTrade).toHaveBeenCalledWith(readySlot);
    });

    it("renders an empty slot with a disabled empty action", () => {
        render(
            <VendingSlot
                slot={{
                    id: "slot-02",
                    index: 2,
                    label: "SLOT 02",
                    status: "empty",
                    canTrade: false,
                }}
                onTrade={() => {}}
            />
        );

        expect(screen.getByText("SLOT 02")).toBeDefined();
        expect(screen.getAllByText("EMPTY").length).toBeGreaterThan(0);
        expect(screen.getByRole("button", { name: "EMPTY" }).hasAttribute("disabled")).toBe(true);
    });

    it("renders disabled reason for blocked active slots", () => {
        render(
            <VendingSlot
                slot={{
                    ...readySlot,
                    status: "insufficient_payment",
                    canTrade: false,
                    disabledReason: "Requires Feldspar Crystals x10",
                }}
                onTrade={() => {}}
            />
        );

        expect(screen.getByText("Requires Feldspar Crystals x10")).toBeDefined();
        expect(screen.getByRole("button", { name: "TRADE" }).hasAttribute("disabled")).toBe(true);
    });
});
```

- [ ] **Step 2: Run the VendingSlot tests to verify they fail**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal/__tests__/VendingSlot.test.tsx
```

Expected: FAIL because `../VendingSlot` does not exist yet.

- [ ] **Step 3: Implement VendingSlot**

Create `dapps/src/components/SupplyTerminal/VendingSlot.tsx`:

```tsx
import { SupplyTerminalSlot } from "./types";

interface VendingSlotProps {
    slot: SupplyTerminalSlot;
    onTrade: (slot: SupplyTerminalSlot) => void;
}

export function VendingSlot({ slot, onTrade }: VendingSlotProps) {
    const isEmpty = slot.status === "empty" || slot.status === "sold";
    const statusLabel = getStatusLabel(slot);

    return (
        <article className={`st-slot st-slot--${slot.status}`}>
            <div className="st-slot__meta">
                <span>{slot.label}</span>
                <span className="st-slot__status">{statusLabel}</span>
            </div>

            <div className="st-slot__body">
                <div className={isEmpty ? "st-slot__empty-icon" : "st-slot__item-icon"}>
                    {isEmpty ? "EMPTY" : null}
                </div>
                <div className="st-slot__content">
                    <div className="st-slot__name">{slot.reward?.name ?? "No Item"}</div>
                    <div className="st-slot__detail">
                        {slot.reward
                            ? `REWARD x${slot.reward.quantity} · ITEMID ${slot.reward.sandboxItemId}`
                            : "No reward configured"}
                    </div>
                    <div className="st-slot__separator" />
                    <div className="st-slot__kv">
                        <span>PRICE</span>
                        <span>
                            {slot.price ? `${slot.price.name} x${slot.price.quantity}` : "--"}
                        </span>
                    </div>
                    <div className="st-slot__kv st-slot__kv--small">
                        <span>CHECK</span>
                        <span>{slot.canTrade ? "AVAILABLE" : slot.disabledReason ?? "--"}</span>
                    </div>
                </div>
            </div>

            <div className="st-slot__action">
                <button
                    type="button"
                    className="st-button"
                    disabled={!slot.canTrade}
                    onClick={() => onTrade(slot)}
                >
                    {isEmpty ? "EMPTY" : "TRADE"}
                </button>
            </div>
        </article>
    );
}

function getStatusLabel(slot: SupplyTerminalSlot): string {
    if (slot.status === "sold") return "EMPTY";
    if (slot.status === "insufficient_payment") return "NO PAYMENT";
    if (slot.status === "extension_not_authorized") return "NO AUTH";
    if (slot.status === "out_of_stock") return "NO STOCK";
    if (slot.status === "listing_disabled") return "DISABLED";
    if (slot.status === "submitting") return "SUBMITTING";
    return slot.status.toUpperCase();
}
```

- [ ] **Step 4: Run the VendingSlot tests to verify they pass**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal/__tests__/VendingSlot.test.tsx
```

Expected: PASS for all `VendingSlot` tests.

- [ ] **Step 5: Commit VendingSlot**

Run:

```bash
git add dapps/src/components/SupplyTerminal/VendingSlot.tsx \
  dapps/src/components/SupplyTerminal/__tests__/VendingSlot.test.tsx
git commit -m "feat: add vending slot component"
```

---

### Task 3: Vending Grid Component

**Files:**
- Create: `dapps/src/components/SupplyTerminal/VendingGrid.tsx`
- Create: `dapps/src/components/SupplyTerminal/__tests__/VendingGrid.test.tsx`

- [ ] **Step 1: Write failing VendingGrid tests**

Create `dapps/src/components/SupplyTerminal/__tests__/VendingGrid.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VendingGrid } from "../VendingGrid";
import { buildSupplyTerminalSlots } from "../slots";

describe("VendingGrid", () => {
    it("renders one active slot and five empty slots", () => {
        const slots = buildSupplyTerminalSlots({
            paymentAvailable: true,
            machineStockAvailable: true,
            listingEnabled: true,
            extensionAuthorized: true,
            submitting: false,
            sold: false,
        });

        render(<VendingGrid slots={slots} onTrade={() => {}} />);

        expect(screen.getByText("SALE SLOTS")).toBeDefined();
        expect(screen.getByText("SLOT 01")).toBeDefined();
        expect(screen.getByText("SLOT 06")).toBeDefined();
        expect(screen.getByText("1 READY")).toBeDefined();
        expect(screen.getByText("5 EMPTY")).toBeDefined();
    });

    it("routes trade clicks to the selected slot", () => {
        const slots = buildSupplyTerminalSlots({
            paymentAvailable: true,
            machineStockAvailable: true,
            listingEnabled: true,
            extensionAuthorized: true,
            submitting: false,
            sold: false,
        });
        const onTrade = vi.fn();

        render(<VendingGrid slots={slots} onTrade={onTrade} />);

        fireEvent.click(screen.getByRole("button", { name: "TRADE" }));

        expect(onTrade).toHaveBeenCalledWith(slots[0]);
    });
});
```

- [ ] **Step 2: Run the VendingGrid tests to verify they fail**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal/__tests__/VendingGrid.test.tsx
```

Expected: FAIL because `../VendingGrid` does not exist yet.

- [ ] **Step 3: Implement VendingGrid**

Create `dapps/src/components/SupplyTerminal/VendingGrid.tsx`:

```tsx
import { SupplyTerminalSlot } from "./types";
import { VendingSlot } from "./VendingSlot";

interface VendingGridProps {
    slots: SupplyTerminalSlot[];
    onTrade: (slot: SupplyTerminalSlot) => void;
}

export function VendingGrid({ slots, onTrade }: VendingGridProps) {
    const readyCount = slots.filter((slot) => slot.status === "ready").length;
    const emptyCount = slots.filter((slot) => slot.status === "empty" || slot.status === "sold").length;

    return (
        <section className="st-panel">
            <div className="st-panel__head">
                <div>
                    <div className="st-eyebrow">SALE SLOTS</div>
                    <div className="st-panel__note">
                        Payment check uses player StorageUnit-owned inventory. Empty slots are future vending bays.
                    </div>
                </div>
                <div className="st-counter">
                    <span className="st-counter__ready">{readyCount} READY</span>
                    <span>{emptyCount} EMPTY</span>
                </div>
            </div>
            <div className="st-slot-grid">
                {slots.map((slot) => (
                    <VendingSlot key={slot.id} slot={slot} onTrade={onTrade} />
                ))}
            </div>
        </section>
    );
}
```

- [ ] **Step 4: Run the VendingGrid tests to verify they pass**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal/__tests__/VendingGrid.test.tsx
```

Expected: PASS for all `VendingGrid` tests.

- [ ] **Step 5: Commit VendingGrid**

Run:

```bash
git add dapps/src/components/SupplyTerminal/VendingGrid.tsx \
  dapps/src/components/SupplyTerminal/__tests__/VendingGrid.test.tsx
git commit -m "feat: add vending slot grid"
```

---

### Task 4: Trade Confirmation Dialog

**Files:**
- Create: `dapps/src/components/SupplyTerminal/TradeConfirmDialog.tsx`
- Create: `dapps/src/components/SupplyTerminal/__tests__/TradeConfirmDialog.test.tsx`

- [ ] **Step 1: Write failing TradeConfirmDialog tests**

Create `dapps/src/components/SupplyTerminal/__tests__/TradeConfirmDialog.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TradeConfirmDialog } from "../TradeConfirmDialog";
import { SupplyTerminalSlot } from "../types";

const slot: SupplyTerminalSlot = {
    id: "slot-01",
    index: 1,
    label: "SLOT 01",
    status: "ready",
    reward: { name: "Carbon Weave", sandboxItemId: 84210, quantity: 1 },
    price: { name: "Feldspar Crystals", sandboxItemId: 77800, quantity: 10 },
    canTrade: true,
};

describe("TradeConfirmDialog", () => {
    it("renders nothing when closed", () => {
        const { container } = render(
            <TradeConfirmDialog
                slot={null}
                submitting={false}
                error={null}
                onCancel={() => {}}
                onConfirm={() => {}}
            />
        );

        expect(container.innerHTML).toBe("");
    });

    it("renders selected trade details", () => {
        render(
            <TradeConfirmDialog
                slot={slot}
                submitting={false}
                error={null}
                onCancel={() => {}}
                onConfirm={() => {}}
            />
        );

        expect(screen.getByRole("dialog")).toBeDefined();
        expect(screen.getByText("CONFIRM TRADE")).toBeDefined();
        expect(screen.getByText("Slot 01")).toBeDefined();
        expect(screen.getByText("Carbon Weave x1")).toBeDefined();
        expect(screen.getByText("Feldspar Crystals x10")).toBeDefined();
        expect(screen.getByText("Slot 01 becomes EMPTY")).toBeDefined();
    });

    it("calls cancel and confirm handlers", () => {
        const onCancel = vi.fn();
        const onConfirm = vi.fn();

        render(
            <TradeConfirmDialog
                slot={slot}
                submitting={false}
                error={null}
                onCancel={onCancel}
                onConfirm={onConfirm}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "CANCEL" }));
        fireEvent.click(screen.getByRole("button", { name: "CONFIRM TRADE" }));

        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith(slot);
    });

    it("disables actions while submitting and renders errors", () => {
        render(
            <TradeConfirmDialog
                slot={slot}
                submitting={true}
                error="Wallet rejected transaction"
                onCancel={() => {}}
                onConfirm={() => {}}
            />
        );

        expect(screen.getByText("Wallet rejected transaction")).toBeDefined();
        expect(screen.getByRole("button", { name: "CANCEL" }).hasAttribute("disabled")).toBe(true);
        expect(screen.getByRole("button", { name: "SUBMITTING" }).hasAttribute("disabled")).toBe(true);
    });
});
```

- [ ] **Step 2: Run the TradeConfirmDialog tests to verify they fail**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal/__tests__/TradeConfirmDialog.test.tsx
```

Expected: FAIL because `../TradeConfirmDialog` does not exist yet.

- [ ] **Step 3: Implement TradeConfirmDialog**

Create `dapps/src/components/SupplyTerminal/TradeConfirmDialog.tsx`:

```tsx
import { SupplyTerminalSlot } from "./types";

interface TradeConfirmDialogProps {
    slot: SupplyTerminalSlot | null;
    submitting: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: (slot: SupplyTerminalSlot) => void;
}

export function TradeConfirmDialog({
    slot,
    submitting,
    error,
    onCancel,
    onConfirm,
}: TradeConfirmDialogProps) {
    if (!slot || !slot.reward || !slot.price) return null;

    return (
        <div className="st-modal-backdrop">
            <section className="st-modal" role="dialog" aria-modal="true" aria-label="Confirm trade">
                <div className="st-modal__head">
                    <div>
                        <div className="st-eyebrow">CONFIRM TRADE</div>
                        <div className="st-modal__title">Slot {String(slot.index).padStart(2, "0")}</div>
                    </div>
                    <div className="st-chip st-chip--hot">READY</div>
                </div>
                <div className="st-modal__body">
                    <div className="st-modal__row">
                        <span>RECEIVE</span>
                        <span>{slot.reward.name} x{slot.reward.quantity}</span>
                    </div>
                    <div className="st-modal__row">
                        <span>PAY</span>
                        <span>{slot.price.name} x{slot.price.quantity}</span>
                    </div>
                    <div className="st-modal__row">
                        <span>PRICE CHECK</span>
                        <span className="st-ok">AVAILABLE</span>
                    </div>
                    <div className="st-modal__row">
                        <span>ON SUCCESS</span>
                        <span>Slot {String(slot.index).padStart(2, "0")} becomes EMPTY</span>
                    </div>
                    {error && <div className="st-modal__error">{error}</div>}
                    <div className="st-modal__actions">
                        <button
                            type="button"
                            className="st-button st-button--secondary"
                            disabled={submitting}
                            onClick={onCancel}
                        >
                            CANCEL
                        </button>
                        <button
                            type="button"
                            className="st-button"
                            disabled={submitting}
                            onClick={() => onConfirm(slot)}
                        >
                            {submitting ? "SUBMITTING" : "CONFIRM TRADE"}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}
```

- [ ] **Step 4: Run the TradeConfirmDialog tests to verify they pass**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal/__tests__/TradeConfirmDialog.test.tsx
```

Expected: PASS for all `TradeConfirmDialog` tests.

- [ ] **Step 5: Commit TradeConfirmDialog**

Run:

```bash
git add dapps/src/components/SupplyTerminal/TradeConfirmDialog.tsx \
  dapps/src/components/SupplyTerminal/__tests__/TradeConfirmDialog.test.tsx
git commit -m "feat: add trade confirmation dialog"
```

---

### Task 5: Bottom Event Log

**Files:**
- Modify: `dapps/src/components/SupplyTerminal/EventLog.tsx`
- Modify: `dapps/src/components/SupplyTerminal/__tests__/EventLog.test.tsx`

- [ ] **Step 1: Update EventLog tests first**

Replace `dapps/src/components/SupplyTerminal/__tests__/EventLog.test.tsx` with:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventLog } from "../EventLog";
import { ExchangeEvent } from "../types";

describe("EventLog", () => {
    it("renders nothing when no events", () => {
        const { container } = render(<EventLog events={[]} />);
        expect(container.innerHTML).toBe("");
    });

    it("renders as a bottom terminal event log", () => {
        const events: ExchangeEvent[] = [
            { type: "local", message: "Trade confirmation opened", timestamp: 1000 },
            { type: "chain", message: "Exchange complete", digest: "0xabcdef1234567890", timestamp: 2000 },
        ];

        render(<EventLog events={events} />);

        expect(screen.getByText("EVENT LOG")).toBeDefined();
        expect(screen.getByText("LOCAL")).toBeDefined();
        expect(screen.getByText("CHAIN")).toBeDefined();
        expect(screen.getByText(/Trade confirmation opened/)).toBeDefined();
        expect(screen.getByText(/Exchange complete/)).toBeDefined();
        expect(screen.getByText(/0xabcdef12/)).toBeDefined();
    });
});
```

- [ ] **Step 2: Run the EventLog tests to verify they fail**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal/__tests__/EventLog.test.tsx
```

Expected: FAIL because the current component does not render the `EVENT LOG` heading and bottom panel structure.

- [ ] **Step 3: Implement bottom EventLog**

Replace `dapps/src/components/SupplyTerminal/EventLog.tsx` with:

```tsx
import { ExchangeEvent } from "./types";

interface EventLogProps {
    events: ExchangeEvent[];
}

export function EventLog({ events }: EventLogProps) {
    if (events.length === 0) return null;

    return (
        <section className="st-panel st-event-log">
            <div className="st-panel__head">
                <div>
                    <div className="st-eyebrow">EVENT LOG</div>
                    <div className="st-panel__note">Full-width bottom terminal panel.</div>
                </div>
                <div className="st-counter">
                    <span>LOCAL</span>
                    <span className="st-counter__ready">CHAIN</span>
                </div>
            </div>
            <div className="st-event-log__body">
                {events.map((event, index) => (
                    <div key={`${event.timestamp}-${index}`} className={`st-event-log__line st-event-log__line--${event.type}`}>
                        &gt; {event.message}
                        {event.digest && ` — ${event.digest.slice(0, 10)}...`}
                    </div>
                ))}
            </div>
        </section>
    );
}
```

- [ ] **Step 4: Run the EventLog tests to verify they pass**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal/__tests__/EventLog.test.tsx
```

Expected: PASS for all `EventLog` tests.

- [ ] **Step 5: Commit EventLog update**

Run:

```bash
git add dapps/src/components/SupplyTerminal/EventLog.tsx \
  dapps/src/components/SupplyTerminal/__tests__/EventLog.test.tsx
git commit -m "feat: restyle supply terminal event log"
```

---

### Task 6: Compact Owner Controls

**Files:**
- Modify: `dapps/src/components/SupplyTerminal/OwnerControls.tsx`
- Modify: `dapps/src/components/SupplyTerminal/__tests__/OwnerControls.test.tsx`

- [ ] **Step 1: Update OwnerControls tests first**

Replace `dapps/src/components/SupplyTerminal/__tests__/OwnerControls.test.tsx` with:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OwnerControls } from "../OwnerControls";

describe("OwnerControls", () => {
    it("renders nothing when isOwner is false", () => {
        const { container } = render(
            <OwnerControls
                isOwner={false}
                extensionAuthorized={false}
                onAuthorize={() => {}}
                isAuthorizing={false}
                onConfigure={() => {}}
            />
        );

        expect(container.innerHTML).toBe("");
    });

    it("shows compact authorization banner when owner and extension is not authorized", () => {
        render(
            <OwnerControls
                isOwner={true}
                extensionAuthorized={false}
                onAuthorize={() => {}}
                isAuthorizing={false}
                onConfigure={() => {}}
            />
        );

        expect(screen.getByText("EXTENSION NOT AUTHORIZED")).toBeDefined();
        expect(screen.getByRole("button", { name: "AUTHORIZE" })).toBeDefined();
    });

    it("disables authorization button while authorizing", () => {
        render(
            <OwnerControls
                isOwner={true}
                extensionAuthorized={false}
                onAuthorize={() => {}}
                isAuthorizing={true}
                onConfigure={() => {}}
            />
        );

        expect(screen.getByRole("button", { name: "AUTHORIZING" }).hasAttribute("disabled")).toBe(true);
    });

    it("shows compact configure entry when owner and extension is authorized", () => {
        render(
            <OwnerControls
                isOwner={true}
                extensionAuthorized={true}
                onAuthorize={() => {}}
                isAuthorizing={false}
                onConfigure={() => {}}
            />
        );

        expect(screen.getByText("EXTENSION AUTHORIZED")).toBeDefined();
        expect(screen.getByRole("button", { name: "CONFIGURE" })).toBeDefined();
    });
});
```

- [ ] **Step 2: Run OwnerControls tests to verify they fail**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal/__tests__/OwnerControls.test.tsx
```

Expected: FAIL because the current component uses Radix Callout text and a fixed bottom-right configure button.

- [ ] **Step 3: Implement compact OwnerControls**

Replace `dapps/src/components/SupplyTerminal/OwnerControls.tsx` with:

```tsx
interface OwnerControlsProps {
    isOwner: boolean;
    extensionAuthorized: boolean;
    onAuthorize: () => void;
    isAuthorizing: boolean;
    onConfigure: () => void;
}

export function OwnerControls({
    isOwner,
    extensionAuthorized,
    onAuthorize,
    isAuthorizing,
    onConfigure,
}: OwnerControlsProps) {
    if (!isOwner) return null;

    if (extensionAuthorized) {
        return (
            <div className="st-auth-banner st-auth-banner--ok">
                <div className="st-auth-banner__copy">
                    <div className="st-pulse st-pulse--ok" />
                    <div>
                        <div className="st-auth-banner__title">EXTENSION AUTHORIZED</div>
                        <div className="st-auth-banner__detail">Terminal item movement is enabled.</div>
                    </div>
                </div>
                <button type="button" className="st-button st-button--secondary" onClick={onConfigure}>
                    CONFIGURE
                </button>
            </div>
        );
    }

    return (
        <div className="st-auth-banner">
            <div className="st-auth-banner__copy">
                <div className="st-pulse" />
                <div>
                    <div className="st-auth-banner__title">EXTENSION NOT AUTHORIZED</div>
                    <div className="st-auth-banner__detail">
                        Owner action required before terminal item movement.
                    </div>
                </div>
            </div>
            <button
                type="button"
                className="st-button"
                onClick={onAuthorize}
                disabled={isAuthorizing}
            >
                {isAuthorizing ? "AUTHORIZING" : "AUTHORIZE"}
            </button>
        </div>
    );
}
```

- [ ] **Step 4: Run OwnerControls tests to verify they pass**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal/__tests__/OwnerControls.test.tsx
```

Expected: PASS for all `OwnerControls` tests.

- [ ] **Step 5: Commit OwnerControls update**

Run:

```bash
git add dapps/src/components/SupplyTerminal/OwnerControls.tsx \
  dapps/src/components/SupplyTerminal/__tests__/OwnerControls.test.tsx
git commit -m "feat: compact supply terminal owner controls"
```

---

### Task 7: SupplyTerminalView Composition

**Files:**
- Create: `dapps/src/components/SupplyTerminal/SupplyTerminalView.tsx`
- Create: `dapps/src/components/SupplyTerminal/__tests__/SupplyTerminalView.test.tsx`

- [ ] **Step 1: Write failing SupplyTerminalView tests**

Create `dapps/src/components/SupplyTerminal/__tests__/SupplyTerminalView.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SupplyTerminalView } from "../SupplyTerminalView";
import { buildSupplyTerminalSlots } from "../slots";
import { ExchangeEvent } from "../types";

const readySlots = buildSupplyTerminalSlots({
    paymentAvailable: true,
    machineStockAvailable: true,
    listingEnabled: true,
    extensionAuthorized: true,
    submitting: false,
    sold: false,
});

const events: ExchangeEvent[] = [
    { type: "local", message: "Terminal inventory synchronized", timestamp: 1000 },
];

describe("SupplyTerminalView", () => {
    it("renders vending grid and bottom event log", () => {
        render(
            <SupplyTerminalView
                isOwner={false}
                extensionAuthorized={true}
                isAuthorizing={false}
                slots={readySlots}
                events={events}
                selectedTradeSlot={null}
                tradeSubmitting={false}
                tradeError={null}
                onAuthorize={() => {}}
                onConfigure={() => {}}
                onOpenTrade={() => {}}
                onCancelTrade={() => {}}
                onConfirmTrade={() => {}}
            />
        );

        expect(screen.getByText("SALE SLOTS")).toBeDefined();
        expect(screen.getByText("EVENT LOG")).toBeDefined();
        expect(screen.getByText("SLOT 01")).toBeDefined();
        expect(screen.getByText("SLOT 06")).toBeDefined();
    });

    it("opens trade modal through slot trade action", () => {
        const onOpenTrade = vi.fn();
        render(
            <SupplyTerminalView
                isOwner={false}
                extensionAuthorized={true}
                isAuthorizing={false}
                slots={readySlots}
                events={events}
                selectedTradeSlot={null}
                tradeSubmitting={false}
                tradeError={null}
                onAuthorize={() => {}}
                onConfigure={() => {}}
                onOpenTrade={onOpenTrade}
                onCancelTrade={() => {}}
                onConfirmTrade={() => {}}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "TRADE" }));

        expect(onOpenTrade).toHaveBeenCalledWith(readySlots[0]);
    });

    it("renders owner authorization banner when supplied owner state requires it", () => {
        render(
            <SupplyTerminalView
                isOwner={true}
                extensionAuthorized={false}
                isAuthorizing={false}
                slots={readySlots}
                events={events}
                selectedTradeSlot={readySlots[0]}
                tradeSubmitting={false}
                tradeError={null}
                onAuthorize={() => {}}
                onConfigure={() => {}}
                onOpenTrade={() => {}}
                onCancelTrade={() => {}}
                onConfirmTrade={() => {}}
            />
        );

        expect(screen.getByText("EXTENSION NOT AUTHORIZED")).toBeDefined();
        expect(screen.getByRole("dialog")).toBeDefined();
    });
});
```

- [ ] **Step 2: Run SupplyTerminalView tests to verify they fail**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal/__tests__/SupplyTerminalView.test.tsx
```

Expected: FAIL because `../SupplyTerminalView` does not exist yet.

- [ ] **Step 3: Implement SupplyTerminalView**

Create `dapps/src/components/SupplyTerminal/SupplyTerminalView.tsx`:

```tsx
import { EventLog } from "./EventLog";
import { OwnerControls } from "./OwnerControls";
import { TradeConfirmDialog } from "./TradeConfirmDialog";
import { VendingGrid } from "./VendingGrid";
import { ExchangeEvent, SupplyTerminalSlot } from "./types";

interface SupplyTerminalViewProps {
    isOwner: boolean;
    extensionAuthorized: boolean;
    isAuthorizing: boolean;
    slots: SupplyTerminalSlot[];
    events: ExchangeEvent[];
    selectedTradeSlot: SupplyTerminalSlot | null;
    tradeSubmitting: boolean;
    tradeError: string | null;
    onAuthorize: () => void;
    onConfigure: () => void;
    onOpenTrade: (slot: SupplyTerminalSlot) => void;
    onCancelTrade: () => void;
    onConfirmTrade: (slot: SupplyTerminalSlot) => void;
}

export function SupplyTerminalView({
    isOwner,
    extensionAuthorized,
    isAuthorizing,
    slots,
    events,
    selectedTradeSlot,
    tradeSubmitting,
    tradeError,
    onAuthorize,
    onConfigure,
    onOpenTrade,
    onCancelTrade,
    onConfirmTrade,
}: SupplyTerminalViewProps) {
    return (
        <section className="st-terminal-shell">
            <div className="st-terminal__topbar">
                <div className="st-terminal__brand">
                    <div className="st-terminal__mark">ST</div>
                    <div>
                        <div className="st-eyebrow">EVE FRONTIER DAPP</div>
                        <div className="st-terminal__title">SUPPLY TERMINAL</div>
                    </div>
                </div>
                <div className="st-terminal__status">
                    <div className="st-chip">STORAGE <span className="st-ok">ONLINE</span></div>
                    <div className="st-chip st-chip--hot">ONE ACTIVE SLOT</div>
                </div>
            </div>

            <OwnerControls
                isOwner={isOwner}
                extensionAuthorized={extensionAuthorized}
                isAuthorizing={isAuthorizing}
                onAuthorize={onAuthorize}
                onConfigure={onConfigure}
            />

            <div className="st-terminal__content">
                <VendingGrid slots={slots} onTrade={onOpenTrade} />
                <EventLog events={events} />
            </div>

            <TradeConfirmDialog
                slot={selectedTradeSlot}
                submitting={tradeSubmitting}
                error={tradeError}
                onCancel={onCancelTrade}
                onConfirm={onConfirmTrade}
            />
        </section>
    );
}
```

- [ ] **Step 4: Run SupplyTerminalView tests to verify they pass**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal/__tests__/SupplyTerminalView.test.tsx
```

Expected: PASS for all `SupplyTerminalView` tests.

- [ ] **Step 5: Commit SupplyTerminalView**

Run:

```bash
git add dapps/src/components/SupplyTerminal/SupplyTerminalView.tsx \
  dapps/src/components/SupplyTerminal/__tests__/SupplyTerminalView.test.tsx
git commit -m "feat: compose supply terminal vending view"
```

---

### Task 8: Container State Integration

**Files:**
- Modify: `dapps/src/components/SupplyTerminal/SupplyTerminal.tsx`

- [ ] **Step 1: Replace the container with vending state wiring**

Replace `dapps/src/components/SupplyTerminal/SupplyTerminal.tsx` with:

```tsx
import { useCallback, useMemo, useState } from "react";
import { useSmartObject, useConnection, isOwner } from "@evefrontier/dapp-kit";
import { useCurrentAccount, useDAppKit } from "@mysten/dapp-kit-react";
import { Transaction } from "@mysten/sui/transactions";
import { buildSupplyTerminalSlots } from "./slots";
import { SupplyTerminalView } from "./SupplyTerminalView";
import { ExchangeEvent, SupplyTerminalSlot } from "./types";
import { SUPPLY_TERMINAL_CONFIG } from "./config";
import "./SupplyTerminal.css";

export function SupplyTerminal() {
    const { assembly, loading, error: smartObjectError } = useSmartObject();
    const { isConnected } = useConnection();
    const account = useCurrentAccount();
    const dAppKit = useDAppKit();

    const [events, setEvents] = useState<ExchangeEvent[]>([
        {
            type: "local",
            message: "Terminal inventory synchronized",
            timestamp: Date.now(),
        },
    ]);
    const [selectedTradeSlot, setSelectedTradeSlot] = useState<SupplyTerminalSlot | null>(null);
    const [tradeSubmitting, setTradeSubmitting] = useState(false);
    const [tradeError, setTradeError] = useState<string | null>(null);
    const [slotSold, setSlotSold] = useState(false);
    const [isAuthorizing, setIsAuthorizing] = useState(false);
    const [extensionAuthorized, setExtensionAuthorized] = useState(false);

    const playerPaymentQuantity = 100;
    const machineStockQuantity = slotSold ? 0 : 1;
    const listingEnabled = true;
    const owner = isOwner(assembly, account?.address);

    const addEvent = useCallback((event: Omit<ExchangeEvent, "timestamp">) => {
        setEvents((prev) => [...prev, { ...event, timestamp: Date.now() }]);
    }, []);

    const slots = useMemo(
        () =>
            buildSupplyTerminalSlots({
                paymentAvailable: playerPaymentQuantity >= SUPPLY_TERMINAL_CONFIG.payment.quantity,
                machineStockAvailable: machineStockQuantity > 0,
                listingEnabled,
                extensionAuthorized,
                submitting: tradeSubmitting,
                sold: slotSold,
            }),
        [extensionAuthorized, listingEnabled, machineStockQuantity, playerPaymentQuantity, slotSold, tradeSubmitting]
    );

    const handleOpenTrade = useCallback(
        (slot: SupplyTerminalSlot) => {
            setSelectedTradeSlot(slot);
            setTradeError(null);
            addEvent({ type: "local", message: `${slot.label} trade confirmation opened` });
        },
        [addEvent]
    );

    const handleCancelTrade = useCallback(() => {
        setSelectedTradeSlot(null);
        setTradeError(null);
        addEvent({ type: "local", message: "Trade confirmation cancelled" });
    }, [addEvent]);

    const handleConfirmTrade = useCallback(
        async (slot: SupplyTerminalSlot) => {
            if (!assembly || !account) return;

            setTradeSubmitting(true);
            setTradeError(null);
            addEvent({ type: "local", message: "Awaiting wallet confirmation" });

            try {
                const tx = new Transaction();
                tx.setSender(account.address);

                const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
                const digest = (result as Record<string, unknown>).digest;

                setSlotSold(true);
                setSelectedTradeSlot(null);
                addEvent({ type: "chain", message: "Exchange complete", digest: typeof digest === "string" ? digest : undefined });
                addEvent({ type: "local", message: `${slot.label} empty` });
            } catch (err) {
                const message = (err as Error).message || String(err);
                setTradeError(message);
                addEvent({ type: "local", message: `Exchange failed: ${message}` });
            } finally {
                setTradeSubmitting(false);
            }
        },
        [account, addEvent, assembly, dAppKit]
    );

    const handleAuthorize = useCallback(async () => {
        if (!assembly || !account) return;

        setIsAuthorizing(true);
        try {
            const tx = new Transaction();
            tx.setSender(account.address);

            const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });
            const digest = (result as Record<string, unknown>).digest;

            setExtensionAuthorized(true);
            addEvent({
                type: "chain",
                message: "Extension authorized",
                digest: typeof digest === "string" ? digest : undefined,
            });
        } catch (err) {
            addEvent({ type: "local", message: `Authorization failed: ${(err as Error).message}` });
        } finally {
            setIsAuthorizing(false);
        }
    }, [account, addEvent, assembly, dAppKit]);

    const handleConfigure = useCallback(() => {
        addEvent({ type: "local", message: "Configure entry selected" });
    }, [addEvent]);

    if (loading) return <div className="st-screen-message">Loading assembly...</div>;
    if (smartObjectError) return <div className="st-screen-message">Error: {smartObjectError}</div>;
    if (!assembly) return <div className="st-screen-message">No assembly found</div>;
    if (!isConnected) return <div className="st-screen-message">Connect your wallet to use the Supply Terminal</div>;

    return (
        <SupplyTerminalView
            isOwner={owner}
            extensionAuthorized={extensionAuthorized}
            isAuthorizing={isAuthorizing}
            slots={slots}
            events={events}
            selectedTradeSlot={selectedTradeSlot}
            tradeSubmitting={tradeSubmitting}
            tradeError={tradeError}
            onAuthorize={handleAuthorize}
            onConfigure={handleConfigure}
            onOpenTrade={handleOpenTrade}
            onCancelTrade={handleCancelTrade}
            onConfirmTrade={handleConfirmTrade}
        />
    );
}
```

- [ ] **Step 2: Run component test suite**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal
```

Expected: Existing tests for removed dashboard components may fail if they still run. If old `ProductPanel`, `PurchasePanel`, `InventoryPanel`, and `MachinePanel` tests remain and are no longer relevant, delete those obsolete component test files in the next step.

- [ ] **Step 3: Remove obsolete dashboard component tests**

If Task 8 Step 2 fails only because obsolete dashboard component tests assert the old four-card UI, delete:

```bash
rm dapps/src/components/SupplyTerminal/__tests__/ProductPanel.test.tsx \
  dapps/src/components/SupplyTerminal/__tests__/PurchasePanel.test.tsx \
  dapps/src/components/SupplyTerminal/__tests__/InventoryPanel.test.tsx \
  dapps/src/components/SupplyTerminal/__tests__/MachinePanel.test.tsx
```

Expected: The removed tests only covered UI components no longer rendered by the final vending terminal.

- [ ] **Step 4: Run component test suite again**

Run:

```bash
cd dapps
pnpm test -- src/components/SupplyTerminal
```

Expected: PASS for the active SupplyTerminal component tests.

- [ ] **Step 5: Commit container integration**

Run:

```bash
git add dapps/src/components/SupplyTerminal/SupplyTerminal.tsx \
  dapps/src/components/SupplyTerminal/__tests__
git commit -m "feat: wire supply terminal vending state"
```

---

### Task 9: Visual CSS

**Files:**
- Create: `dapps/src/components/SupplyTerminal/SupplyTerminal.css`

- [ ] **Step 1: Add final CSS**

Create `dapps/src/components/SupplyTerminal/SupplyTerminal.css`:

```css
.st-terminal-shell {
    position: relative;
    width: min(100%, 1240px);
    margin: 0 auto;
    border: 1px solid #4f4438;
    background:
        linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px),
        radial-gradient(circle at 16% 10%, rgba(232, 121, 42, 0.12), transparent 23%),
        #060504;
    background-size: 24px 24px, 24px 24px, 100% 100%, 100% 100%;
    box-shadow: 0 0 0 1px rgba(232, 121, 42, 0.16), 0 18px 50px rgba(0, 0, 0, 0.45);
    overflow: hidden;
}

.st-terminal__topbar,
.st-auth-banner,
.st-panel__head {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: center;
}

.st-terminal__topbar {
    padding: 14px 18px;
    border-bottom: 1px solid #4f4438;
    background: rgba(11, 9, 7, 0.94);
}

.st-terminal__brand,
.st-auth-banner__copy {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
}

.st-terminal__mark {
    width: 32px;
    height: 32px;
    border: 1px solid #e8792a;
    display: grid;
    place-items: center;
    color: #e8792a;
    font-size: 12px;
    flex: 0 0 auto;
}

.st-eyebrow {
    color: #e8792a;
    font-size: 10px;
    letter-spacing: 0.16em;
}

.st-terminal__title {
    font-size: clamp(18px, 2.1vw, 24px);
    line-height: 1.08;
    margin-top: 2px;
    white-space: nowrap;
}

.st-terminal__status,
.st-counter {
    display: flex;
    gap: 8px;
    font-size: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
}

.st-chip,
.st-counter span {
    border: 1px solid #4f4438;
    padding: 7px 9px;
    color: #bdb29a;
    white-space: nowrap;
}

.st-chip--hot,
.st-counter__ready {
    border-color: #e8792a !important;
    color: #e8792a !important;
    background: rgba(232, 121, 42, 0.08);
}

.st-ok {
    color: #8fe0aa;
}

.st-auth-banner {
    margin: 14px 18px 0;
    border: 1px solid #7d5935;
    background: rgba(232, 121, 42, 0.09);
    padding: 10px 12px;
}

.st-auth-banner--ok {
    border-color: rgba(143, 224, 170, 0.45);
    background: rgba(143, 224, 170, 0.06);
}

.st-pulse {
    width: 9px;
    height: 9px;
    background: #e8792a;
    box-shadow: 0 0 12px rgba(232, 121, 42, 0.85);
    flex: 0 0 auto;
}

.st-pulse--ok {
    background: #8fe0aa;
    box-shadow: 0 0 12px rgba(143, 224, 170, 0.55);
}

.st-auth-banner__title {
    font-size: 11px;
}

.st-auth-banner__detail,
.st-panel__note {
    font-size: 10px;
    color: #948875;
    margin-top: 2px;
    line-height: 1.35;
}

.st-button {
    border: 1px solid #e8792a;
    border-radius: 0;
    background: #e8792a;
    color: #140b04;
    font: inherit;
    font-size: 10px;
    padding: 8px 10px;
    white-space: nowrap;
    cursor: pointer;
}

.st-button--secondary {
    border-color: #4f4438;
    background: transparent;
    color: #bdb29a;
}

.st-button:disabled {
    border-color: #4f4438;
    background: transparent;
    color: #665d50;
    cursor: default;
}

.st-terminal__content {
    padding: 14px 18px 18px;
    display: grid;
    gap: 14px;
}

.st-panel {
    border: 1px solid #4f4438;
    background: rgba(14, 11, 8, 0.94);
    min-width: 0;
}

.st-panel__head {
    align-items: flex-start;
    padding: 10px 12px;
    border-bottom: 1px solid #4f4438;
}

.st-slot-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr));
    gap: 10px;
    padding: 12px;
}

@media (min-width: 1120px) {
    .st-slot-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

.st-slot {
    min-height: 196px;
    padding: 11px;
    position: relative;
    display: flex;
    flex-direction: column;
}

.st-slot--ready {
    border: 1px solid #e8792a;
    background: linear-gradient(180deg, rgba(232, 121, 42, 0.16), rgba(232, 121, 42, 0.04));
    box-shadow: inset 0 0 0 1px rgba(255, 197, 120, 0.08);
}

.st-slot--empty,
.st-slot--sold {
    border: 1px dashed #4f4438;
    background: rgba(8, 7, 6, 0.78);
    color: #665d50;
}

.st-slot--insufficient_payment,
.st-slot--extension_not_authorized,
.st-slot--out_of_stock,
.st-slot--listing_disabled,
.st-slot--submitting {
    border: 1px solid #4f4438;
    background: rgba(12, 9, 7, 0.9);
    color: #8b7c69;
}

.st-slot__meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 10px;
}

.st-slot--ready .st-slot__meta {
    color: #e8792a;
}

.st-slot__status {
    border: 1px solid currentColor;
    padding: 2px 6px;
    background: rgba(232, 121, 42, 0.1);
}

.st-slot__body {
    display: grid;
    grid-template-columns: 80px minmax(0, 1fr);
    gap: 12px;
    margin-top: 12px;
    flex: 1;
}

.st-slot__item-icon {
    height: 80px;
    border: 1px solid #f3ecd2;
    background:
        radial-gradient(circle at 50% 42%, rgba(232, 121, 42, 0.25), transparent 38%),
        repeating-linear-gradient(45deg, #2a1e14 0, #2a1e14 5px, #17110c 5px, #17110c 10px);
    display: grid;
    place-items: center;
}

.st-slot__item-icon::after {
    content: "";
    width: 38px;
    height: 38px;
    border: 1px solid #f3ecd2;
    background: rgba(243, 236, 210, 0.08);
}

.st-slot__empty-icon {
    height: 80px;
    border: 1px dashed #4f4438;
    display: grid;
    place-items: center;
    font-size: 11px;
}

.st-slot__name {
    font-size: 20px;
    line-height: 1.05;
    overflow-wrap: anywhere;
}

.st-slot__detail {
    font-size: 10px;
    color: #bdb29a;
    margin-top: 7px;
}

.st-slot__separator {
    height: 1px;
    background: #4f4438;
    margin: 10px 0 8px;
}

.st-slot__kv {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
}

.st-slot__kv--small {
    margin-top: 6px;
    font-size: 10px;
}

.st-slot__action {
    margin-top: 12px;
    display: flex;
}

.st-slot__action .st-button {
    width: 100%;
}

.st-slot--ready::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: #e8792a;
}

.st-event-log__body {
    padding: 12px;
    font-size: 11px;
    color: #bdb29a;
    line-height: 1.7;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
    gap: 4px 18px;
}

.st-event-log__line--chain {
    color: #8fe0aa;
}

.st-modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.58);
    display: grid;
    place-items: center;
    padding: 20px;
}

.st-modal {
    width: min(100%, 430px);
    border: 1px solid #e8792a;
    background:
        linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px),
        #100c08;
    background-size: 20px 20px;
    box-shadow: 0 0 0 1px rgba(255, 174, 99, 0.14), 0 24px 70px rgba(0, 0, 0, 0.6);
}

.st-modal__head {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 14px;
    border-bottom: 1px solid #7d5935;
}

.st-modal__title {
    font-size: 22px;
    margin-top: 4px;
}

.st-modal__body {
    padding: 14px;
    display: grid;
    gap: 12px;
}

.st-modal__row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 9px;
    border-bottom: 1px solid #4f4438;
    font-size: 12px;
}

.st-modal__error {
    border: 1px solid rgba(196, 106, 66, 0.65);
    color: #f0a079;
    padding: 8px;
    font-size: 11px;
}

.st-modal__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

.st-screen-message {
    border: 1px solid #4f4438;
    background: rgba(14, 11, 8, 0.94);
    padding: 18px;
    color: #f3ecd2;
}

@media (max-width: 720px) {
    .st-terminal__topbar,
    .st-auth-banner,
    .st-panel__head {
        align-items: stretch;
        flex-direction: column;
    }

    .st-terminal__status,
    .st-counter {
        justify-content: flex-start;
    }

    .st-terminal__content {
        padding: 12px;
    }

    .st-slot__body {
        grid-template-columns: 1fr;
    }

    .st-slot__item-icon,
    .st-slot__empty-icon {
        height: 96px;
    }

    .st-modal__actions {
        grid-template-columns: 1fr;
    }
}
```

- [ ] **Step 2: Run full dApp test suite**

Run:

```bash
cd dapps
pnpm test
```

Expected: PASS for all active tests.

- [ ] **Step 3: Run build**

Run:

```bash
cd dapps
pnpm build
```

Expected: PASS with TypeScript compilation and Vite production build completing successfully.

- [ ] **Step 4: Commit visual CSS**

Run:

```bash
git add dapps/src/components/SupplyTerminal/SupplyTerminal.css
git commit -m "style: add supply terminal vending visuals"
```

---

### Task 10: Browser Verification

**Files:**
- No source files required unless browser verification exposes layout defects.

- [ ] **Step 1: Start the dApp dev server**

Run:

```bash
cd dapps
pnpm dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 2: Verify at desktop-ish width**

Open the local URL in a browser tool at `1200x900`.

Expected:

- Slot grid shows up to three columns when the container has enough width.
- There is no persistent right-side trade rail.
- Event log is below the slot grid and spans the terminal width.
- Each slot has its own action button.
- Trade modal appears centered when `TRADE` is clicked.
- No horizontal page overflow is visible.

- [ ] **Step 3: Verify at medium width**

Resize to `900x900`.

Expected:

- Slot grid uses two columns where width allows.
- Header chips wrap cleanly if needed.
- Bottom event log remains below the grid.
- No text overlaps button content or adjacent panels.

- [ ] **Step 4: Verify at mobile-ish width**

Resize to `390x844`.

Expected:

- Slot grid collapses to one column.
- Modal fits within viewport width.
- Header, owner banner, slot action, and event log text do not overlap.
- No horizontal page overflow is visible.

- [ ] **Step 5: Fix any visual defects found during browser verification**

If verification finds overflow or overlap, adjust only `dapps/src/components/SupplyTerminal/SupplyTerminal.css`, then rerun:

```bash
cd dapps
pnpm test
pnpm build
```

Expected: both commands pass after the CSS adjustment.

- [ ] **Step 6: Commit browser verification fixes if any**

If Step 5 changed CSS, run:

```bash
git add dapps/src/components/SupplyTerminal/SupplyTerminal.css
git commit -m "fix: polish supply terminal responsive layout"
```

If Step 5 changed nothing, do not create an empty commit.

---

## Final Verification

Run these commands from the repository root or the indicated subdirectory:

```bash
git status --short
cd dapps
pnpm test
pnpm build
```

Expected:

- `pnpm test` passes.
- `pnpm build` passes.
- `git status --short` shows only intentional implementation changes or a clean tree.
- Existing user-owned `.gitignore` edits remain untouched unless the user explicitly asks to include them.

## Implementation Notes

- Prefer the presentational `SupplyTerminalView` tests over hook-heavy `SupplyTerminal.tsx` tests. This keeps wallet/dapp-kit mocking small.
- Keep transaction construction as the existing minimal `Transaction` object until the real exchange transaction wiring is separately implemented.
- Do not add a full inventory panel. Availability is represented by slot state.
- Do not add true multi-slot contract data. Slots 02-06 are inactive bays in this iteration.
- Do not create a persistent right rail.
- Keep event log below the slot grid.
