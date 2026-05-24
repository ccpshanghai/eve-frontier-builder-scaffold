import { describe, expect, it } from "vitest";
import { buildSupplyTerminalSlots } from "../slots";
import type { ListingConfig, SupplyTerminalPreflightView } from "../types";

const carbonListing: ListingConfig = {
  enabled: true,
  productTypeId: 84210,
  productQuantity: 1,
  paymentTypeId: 77800,
  paymentQuantity: 10,
};

const alloyListing: ListingConfig = {
  enabled: true,
  productTypeId: 84211,
  productQuantity: 3,
  paymentTypeId: 77801,
  paymentQuantity: 25,
};

function createPreflight(
  listing: ListingConfig = carbonListing,
  overrides: Partial<SupplyTerminalPreflightView> = {},
): SupplyTerminalPreflightView {
  return {
    listing,
    paymentAvailable: true,
    machineStockAvailable: true,
    listingEnabled: true,
    extensionAuthorized: true,
    disabledReason: undefined,
    ...overrides,
  };
}

describe("buildSupplyTerminalSlots", () => {
  it("creates ready slots for every configured listing and fills the rest with empty slots", () => {
    const slots = buildSupplyTerminalSlots({
      preflightViews: [createPreflight(), createPreflight(alloyListing)],
      submitting: false,
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
    expect(slots[0].productTypeId).toBe(84210);
    expect(slots[1]).toMatchObject({
      id: "slot-02",
      label: "SLOT 02",
      status: "ready",
      canTrade: true,
      productTypeId: 84211,
      reward: {
        name: "Item Type 84211",
        quantity: 3,
        sandboxItemId: 84211,
      },
      price: {
        name: "Item Type 77801",
        quantity: 25,
        sandboxItemId: 77801,
      },
    });
    expect(slots.slice(2).every((slot) => slot.status === "empty")).toBe(true);
    expect(slots.slice(2).every((slot) => slot.canTrade === false)).toBe(true);
  });

  it("returns copies of configured reward and price items", () => {
    const slots = buildSupplyTerminalSlots({
      preflightViews: [createPreflight()],
      submitting: false,
    });
    const rebuiltSlots = buildSupplyTerminalSlots({
      preflightViews: [createPreflight()],
      submitting: false,
    });

    expect(slots[0].reward).toEqual(rebuiltSlots[0].reward);
    expect(slots[0].price).toEqual(rebuiltSlots[0].price);
    expect(slots[0].reward).not.toBe(rebuiltSlots[0].reward);
    expect(slots[0].price).not.toBe(rebuiltSlots[0].price);
  });

  it("disables Slot 01 when payment is unavailable", () => {
    const slots = buildSupplyTerminalSlots({
      preflightViews: [
        createPreflight(carbonListing, {
          paymentAvailable: false,
          disabledReason: "Requires Feldspar Crystals x10",
        }),
      ],
      submitting: false,
    });

    expect(slots[0]).toMatchObject({
      status: "insufficient_payment",
      canTrade: false,
      disabledReason: "Requires Feldspar Crystals x10",
    });
  });

  it("treats disabled listing as empty slot", () => {
    const slots = buildSupplyTerminalSlots({
      preflightViews: [
        createPreflight(carbonListing, {
          listingEnabled: false,
          disabledReason: "Listing disabled",
        }),
      ],
      submitting: false,
    });

    expect(slots[0]).toMatchObject({
      status: "empty",
      canTrade: false,
    });
  });

  it("disables Slot 01 when machine stock is unavailable", () => {
    const slots = buildSupplyTerminalSlots({
      preflightViews: [
        createPreflight(carbonListing, {
          machineStockAvailable: false,
          disabledReason: "Carbon Weave unavailable",
        }),
      ],
      submitting: false,
    });

    expect(slots[0]).toMatchObject({
      status: "out_of_stock",
      canTrade: false,
      disabledReason: "Carbon Weave unavailable",
    });
  });

  it("disables Slot 01 when the extension is not authorized", () => {
    const slots = buildSupplyTerminalSlots({
      preflightViews: [
        createPreflight(carbonListing, {
          extensionAuthorized: false,
          disabledReason: "Extension authorization required",
        }),
      ],
      submitting: false,
    });

    expect(slots[0]).toMatchObject({
      status: "extension_not_authorized",
      canTrade: false,
      disabledReason: "Extension authorization required",
    });
  });

  it("disables Slot 01 while an exchange is submitting", () => {
    const slots = buildSupplyTerminalSlots({
      preflightViews: [createPreflight()],
      submitting: true,
    });

    expect(slots[0]).toMatchObject({
      status: "submitting",
      canTrade: false,
      disabledReason: "Exchange in progress",
    });
  });

  it("renders Slot 01 as sold after it has been purchased in the current session", () => {
    const slots = buildSupplyTerminalSlots({
      preflightViews: [createPreflight()],
      submitting: false,
      soldProductTypeIds: [84210],
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
