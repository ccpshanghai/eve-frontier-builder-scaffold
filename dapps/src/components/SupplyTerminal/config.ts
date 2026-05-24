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

export const SUPPLY_TERMINAL_ITEM_NAMES: Record<number, string> = {
  [SUPPLY_TERMINAL_CONFIG.product.sandboxItemId]:
    SUPPLY_TERMINAL_CONFIG.product.name,
  [SUPPLY_TERMINAL_CONFIG.payment.sandboxItemId]:
    SUPPLY_TERMINAL_CONFIG.payment.name,
  77811: "Hydrated Sulfide Matrix",
  84180: "Printed Circuits",
  84182: "Reinforced Alloys",
  88561: "Thermal Composites",
  89089: "Building Foam",
};

export function getSupplyTerminalItemName(typeId: number): string {
  return SUPPLY_TERMINAL_ITEM_NAMES[typeId] ?? `Item Type ${typeId}`;
}
