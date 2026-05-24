import {
  getSupplyTerminalItemName,
  SUPPLY_TERMINAL_SLOT_COUNT,
} from "./config";
import type {
  BuildSupplyTerminalSlotsInput,
  ListingConfig,
  SupplyTerminalPreflightView,
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

function createSlotItem(
  typeId: number,
  quantity: number,
): SupplyTerminalSlotItem {
  return {
    name: getSupplyTerminalItemName(typeId),
    sandboxItemId: typeId,
    quantity,
  };
}

function getBlockedSlotState(
  input: BuildSupplyTerminalSlotsInput,
  preflight: SupplyTerminalPreflightView,
): { status: SupplyTerminalSlotStatus; disabledReason?: string } | undefined {
  const { listing } = preflight;

  if (!preflight.listingEnabled) {
    return {
      status: "listing_disabled",
      disabledReason: "Listing disabled",
    };
  }

  if (!preflight.extensionAuthorized) {
    return {
      status: "extension_not_authorized",
      disabledReason: "Extension authorization required",
    };
  }

  if (!preflight.machineStockAvailable) {
    return {
      status: "out_of_stock",
      disabledReason:
        preflight.disabledReason ??
        `${getSupplyTerminalItemName(listing.productTypeId)} unavailable`,
    };
  }

  if (input.walletConnected === false) {
    return {
      status: "wallet_disconnected",
      disabledReason: "Connect wallet to trade",
    };
  }

  if (!preflight.paymentAvailable) {
    return {
      status: "insufficient_payment",
      disabledReason:
        preflight.disabledReason ??
        `Requires ${getSupplyTerminalItemName(listing.paymentTypeId)} x${listing.paymentQuantity}`,
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
  preflight: SupplyTerminalPreflightView,
  index: number,
): SupplyTerminalSlot {
  const { listing } = preflight;
  const baseSlot = createEmptySlot(index);

  if (input.soldProductTypeIds?.includes(listing.productTypeId)) {
    return {
      ...baseSlot,
      status: "sold",
    };
  }

  const blockedState = getBlockedSlotState(input, preflight);
  const status = blockedState?.status ?? "ready";
  const machineStockQuantity =
    input.machineInventory?.find(
      (item) => item.typeId === listing.productTypeId,
    )?.quantity;

  return {
    ...baseSlot,
    status,
    reward: createListingProductItem(listing),
    price: createListingPaymentItem(listing),
    productTypeId: listing.productTypeId,
    canTrade: status === "ready",
    disabledReason: blockedState?.disabledReason,
    machineStockQuantity,
    paymentOwnedQuantity: preflight.buyerPaymentQuantity,
  };
}

function createListingProductItem(
  listing: ListingConfig,
): SupplyTerminalSlotItem {
  return createSlotItem(listing.productTypeId, listing.productQuantity);
}

function createListingPaymentItem(
  listing: ListingConfig,
): SupplyTerminalSlotItem {
  return createSlotItem(listing.paymentTypeId, listing.paymentQuantity);
}

export function buildSupplyTerminalSlots(
  input: BuildSupplyTerminalSlotsInput,
): SupplyTerminalSlot[] {
  return Array.from({ length: SUPPLY_TERMINAL_SLOT_COUNT }, (_, slotIndex) => {
    const index = slotIndex + 1;
    const preflight = input.preflightViews[slotIndex];

    if (preflight && preflight.listingEnabled) {
      return createActiveSlot(input, preflight, index);
    }

    return createEmptySlot(index);
  });
}
