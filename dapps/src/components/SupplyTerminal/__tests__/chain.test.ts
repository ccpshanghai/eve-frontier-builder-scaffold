import { describe, expect, it } from "vitest";
import {
  buildSupplyTerminalExchangeTransaction,
  parseInventoryItems,
  readSupplyTerminalEnv,
  selectInventoryForKey,
  validateSupplyTerminalSnapshot,
} from "../chain";
import type { SupplyTerminalChainSnapshot } from "../types";

const storageId =
  "0x0000000000000000000000000000000000000000000000000000000000000001";
const machineOwnerCapId =
  "0x0000000000000000000000000000000000000000000000000000000000000002";
const characterId =
  "0x0000000000000000000000000000000000000000000000000000000000000003";
const characterOwnerCapId =
  "0x0000000000000000000000000000000000000000000000000000000000000004";
const sender =
  "0x0000000000000000000000000000000000000000000000000000000000000005";
const worldPackageId =
  "0x0000000000000000000000000000000000000000000000000000000000000006";
const supplyTerminalPackageId =
  "0x0000000000000000000000000000000000000000000000000000000000000007";
const supplyTerminalConfigId =
  "0x0000000000000000000000000000000000000000000000000000000000000008";

const baseSnapshot: SupplyTerminalChainSnapshot = {
  storage: {
    id: storageId,
    ownerCapId: machineOwnerCapId,
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
    id: characterId,
    ownerCapId: characterOwnerCapId,
  },
};

const baseEnv = {
  storageObjectId: storageId,
  worldPackageId,
  supplyTerminalPackageId,
  supplyTerminalConfigId,
  rpcUrl: "http://127.0.0.1:9000",
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

  it("builds the borrow, exchange, and return Move call sequence", async () => {
    const transaction = buildSupplyTerminalExchangeTransaction({
      env: baseEnv,
      snapshot: baseSnapshot,
      sender,
    });

    const json = JSON.parse(await transaction.toJSON()) as {
      commands: Array<{
        MoveCall: {
          package: string;
          module: string;
          function: string;
        };
      }>;
    };

    expect(json.commands.map((command) => command.MoveCall)).toMatchObject([
      {
        package: worldPackageId,
        module: "character",
        function: "borrow_owner_cap",
      },
      {
        package: supplyTerminalPackageId,
        module: "supply_terminal",
        function: "exchange",
      },
      {
        package: worldPackageId,
        module: "character",
        function: "return_owner_cap",
      },
    ]);
  });
});
