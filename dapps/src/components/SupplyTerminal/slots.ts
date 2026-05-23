import {
  ACTIVE_SUPPLY_TERMINAL_SLOT_INDEX,
  SUPPLY_TERMINAL_CONFIG,
  SUPPLY_TERMINAL_SLOT_COUNT,
} from "./config";
import type {
  BuildSupplyTerminalSlotsInput,
  SupplyTerminalSlot,
  SupplyTerminalSlotItem,
  SupplyTerminalSlotStatus,
} from "./types";

function formatSlotNumber(index: number): string {
  return index.toString().padStart(2, "0");
}

function createEmptySlot(index: number): SupplyTerminalSlot {
  const slotNumber = formatSlotNumber(index);

  return {
    id: `slot-${slotNumber}`,
    index,
    label: `SLOT ${slotNumber}`,
    status: "empty",
    canTrade: false,
  };
}

function createSlotItem(item: SupplyTerminalSlotItem): SupplyTerminalSlotItem {
  return {
    name: item.name,
    sandboxItemId: item.sandboxItemId,
    quantity: item.quantity,
  };
}

function getBlockedSlotState(
  input: BuildSupplyTerminalSlotsInput,
): { status: SupplyTerminalSlotStatus; disabledReason?: string } | undefined {
  if (!input.listingEnabled) {
    return {
      status: "listing_disabled",
      disabledReason: "Listing disabled",
    };
  }

  if (!input.extensionAuthorized) {
    return {
      status: "extension_not_authorized",
      disabledReason: "Extension authorization required",
    };
  }

  if (!input.machineStockAvailable) {
    return {
      status: "out_of_stock",
      disabledReason: `${SUPPLY_TERMINAL_CONFIG.product.name} unavailable`,
    };
  }

  if (input.walletConnected === false) {
    return {
      status: "wallet_disconnected",
      disabledReason: "Connect wallet to trade",
    };
  }

  if (!input.paymentAvailable) {
    return {
      status: "insufficient_payment",
      disabledReason:
        input.disabledReason ??
        `Requires ${SUPPLY_TERMINAL_CONFIG.payment.name} x${SUPPLY_TERMINAL_CONFIG.payment.quantity}`,
    };
  }

  if (input.submitting) {
    return {
      status: "submitting",
      disabledReason: "Exchange in progress",
    };
  }

  return undefined;
}

function createActiveSlot(
  input: BuildSupplyTerminalSlotsInput,
): SupplyTerminalSlot {
  const baseSlot = createEmptySlot(ACTIVE_SUPPLY_TERMINAL_SLOT_INDEX);

  if (input.sold) {
    return {
      ...baseSlot,
      status: "sold",
    };
  }

  const blockedState = getBlockedSlotState(input);
  const status = blockedState?.status ?? "ready";

  return {
    ...baseSlot,
    status,
    reward: createSlotItem(SUPPLY_TERMINAL_CONFIG.product),
    price: createSlotItem(SUPPLY_TERMINAL_CONFIG.payment),
    canTrade: status === "ready",
    disabledReason: blockedState?.disabledReason,
  };
}

export function buildSupplyTerminalSlots(
  input: BuildSupplyTerminalSlotsInput,
): SupplyTerminalSlot[] {
  return Array.from({ length: SUPPLY_TERMINAL_SLOT_COUNT }, (_, slotIndex) => {
    const index = slotIndex + 1;

    if (index === ACTIVE_SUPPLY_TERMINAL_SLOT_INDEX) {
      return createActiveSlot(input);
    }

    return createEmptySlot(index);
  });
}
