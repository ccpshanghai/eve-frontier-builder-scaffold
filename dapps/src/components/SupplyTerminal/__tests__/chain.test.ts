import { describe, expect, it, vi } from "vitest";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import {
  buildStorageUnitOwnerCapProbeTransaction,
  buildSupplyTerminalAuthorizeExtensionTransaction,
  buildSupplyTerminalExchangeTransaction,
  loadSupplyTerminalSnapshot,
  parseInventoryItems,
  probeStorageUnitOwnerCapBorrow,
  readSupplyTerminalEnv,
  selectInventoryForKey,
  validateSupplyTerminalListings,
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
const storageOwnerCharacterId =
  "0x0000000000000000000000000000000000000000000000000000000000000009";
const worldPackageId =
  "0x0000000000000000000000000000000000000000000000000000000000000006";
const supplyTerminalPackageId =
  "0x0000000000000000000000000000000000000000000000000000000000000007";
const supplyTerminalConfigId =
  "0x0000000000000000000000000000000000000000000000000000000000000008";

const listingFieldName = { type: "u64", value: "84210" };
const secondListingFieldName = { type: "u64", value: "84211" };
const machineInventoryFieldName = { type: "address", value: machineOwnerCapId };
const characterInventoryFieldName = {
  type: "address",
  value: characterOwnerCapId,
};

const baseSnapshot: SupplyTerminalChainSnapshot = {
  storage: {
    id: storageId,
    ownerCapId: machineOwnerCapId,
    status: "ONLINE",
    extension: "0xbuilder::config::SupplyTerminalAuth",
  },
  listings: [
    {
      enabled: true,
      productTypeId: 84210,
      productQuantity: 1,
      paymentTypeId: 77800,
      paymentQuantity: 10,
    },
  ],
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

  it("uses a selected storage object id without requiring VITE_OBJECT_ID", () => {
    expect(
      readSupplyTerminalEnv(
        {
          VITE_EVE_WORLD_PACKAGE_ID: "0xworld",
          VITE_SUPPLY_TERMINAL_PACKAGE_ID: "0xbuilder",
          VITE_SUPPLY_TERMINAL_CONFIG_ID: "0xconfig",
        },
        { storageObjectId: " 0xselected " },
      ),
    ).toEqual({
      storageObjectId: "0xselected",
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

  it("reads nested StorageUnit status variants from Sui RPC content", async () => {
    const client = {
      getObject: async () => ({
        data: {
          content: {
            fields: {
              owner_cap_id: machineOwnerCapId,
              status: {
                type: `${worldPackageId}::status::AssemblyStatus`,
                fields: {
                  status: {
                    type: `${worldPackageId}::status::Status`,
                    variant: "ONLINE",
                    fields: {},
                  },
                },
              },
              extension: `${supplyTerminalPackageId}::config::SupplyTerminalAuth`,
            },
          },
        },
      }),
      getDynamicFields: async () => ({ data: [], hasNextPage: false }),
    };

    const snapshot = await loadSupplyTerminalSnapshot({
      env: baseEnv,
      client: client as unknown as SuiJsonRpcClient,
    });

    expect(snapshot.storage.status).toBe("ONLINE");
  });

  it("loads the storage owner character from the StorageUnit OwnerCap owner", async () => {
    const client = {
      getObject: async ({ id }: { id: string }) => {
        if (id === storageId) {
          return {
            data: {
              content: {
                fields: {
                  owner_cap_id: machineOwnerCapId,
                  status: "ONLINE",
                  extension: null,
                },
              },
            },
          };
        }

        if (id === machineOwnerCapId) {
          return {
            data: {
              owner: { AddressOwner: storageOwnerCharacterId },
            },
          };
        }

        if (id === storageOwnerCharacterId) {
          return {
            data: {
              type: `${worldPackageId}::character::Character`,
            },
          };
        }

        throw new Error(`Unexpected object lookup: ${id}`);
      },
      getDynamicFields: async () => ({ data: [], hasNextPage: false }),
      getOwnedObjects: async () => ({ data: [] }),
    };

    const snapshot = await loadSupplyTerminalSnapshot({
      env: baseEnv,
      client: client as unknown as SuiJsonRpcClient,
      accountAddress: sender,
    });

    expect(snapshot.storage.ownerCharacterId).toBe(storageOwnerCharacterId);
  });

  it("reports ready when listing, stock, payment, and wallet character are present", () => {
    expect(validateSupplyTerminalListings(baseSnapshot)).toEqual([
      {
        listing: baseSnapshot.listings[0],
        paymentAvailable: true,
        machineStockAvailable: true,
        listingEnabled: true,
        extensionAuthorized: true,
        buyerPaymentQuantity: 10,
        disabledReason: undefined,
      },
    ]);
  });

  it("reports per-listing stock and payment state", () => {
    expect(
      validateSupplyTerminalListings({
        ...baseSnapshot,
        listings: [
          ...baseSnapshot.listings,
          {
            enabled: true,
            productTypeId: 84211,
            productQuantity: 3,
            paymentTypeId: 77801,
            paymentQuantity: 25,
          },
        ],
        machineInventory: [{ typeId: 84210, quantity: 1 }],
        buyerInventory: [{ typeId: 77800, quantity: 10 }],
      }),
    ).toMatchObject([
      {
        listing: { productTypeId: 84210 },
        paymentAvailable: true,
        machineStockAvailable: true,
        disabledReason: undefined,
      },
      {
        listing: { productTypeId: 84211 },
        paymentAvailable: false,
        machineStockAvailable: false,
        disabledReason: "Item Type 84211 unavailable",
      },
    ]);
  });

  it("reports insufficient payment when buyer inventory lacks payment item", () => {
    expect(
      validateSupplyTerminalListings({
        ...baseSnapshot,
        buyerInventory: [],
      }),
    ).toMatchObject([
      {
        paymentAvailable: false,
        disabledReason: "Requires Feldspar Crystals x10",
      },
    ]);
  });

  it("discovers a wallet character from a StorageUnit inventory OwnerCap", async () => {
    const client = {
      getObject: async ({ id }: { id: string }) => {
        if (id === storageId) {
          return {
            data: {
              content: {
                fields: {
                  owner_cap_id: machineOwnerCapId,
                  status: "ONLINE",
                  extension: `${supplyTerminalPackageId}::config::SupplyTerminalAuth`,
                },
              },
            },
          };
        }

        if (id === characterOwnerCapId) {
          return {
            data: {
              objectId: characterOwnerCapId,
              type: `${worldPackageId}::access::OwnerCap<${worldPackageId}::character::Character>`,
              owner: { AddressOwner: characterId },
              content: {
                fields: {
                  authorized_object_id: characterId,
                },
              },
            },
          };
        }

        if (id === characterId) {
          return {
            data: {
              objectId: characterId,
              type: `${worldPackageId}::character::Character`,
              content: {
                fields: {
                  character_address: sender,
                  owner_cap_id: characterOwnerCapId,
                },
              },
            },
          };
        }

        throw new Error(`Unexpected object lookup: ${id}`);
      },
      getOwnedObjects: async () => ({ data: [] }),
      getDynamicFields: async ({ parentId }: { parentId: string }) => {
        if (parentId === supplyTerminalConfigId) {
          return {
            data: [
              {
                name: listingFieldName,
                objectType: `${supplyTerminalPackageId}::supply_terminal::ListingConfig`,
              },
              {
                name: secondListingFieldName,
                objectType: `${supplyTerminalPackageId}::supply_terminal::ListingConfig`,
              },
            ],
            hasNextPage: false,
          };
        }

        if (parentId === storageId) {
          return {
            data: [
              {
                name: machineInventoryFieldName,
                objectType: `${worldPackageId}::inventory::Inventory`,
              },
              {
                name: characterInventoryFieldName,
                objectType: `${worldPackageId}::inventory::Inventory`,
              },
            ],
            hasNextPage: false,
          };
        }

        return { data: [], hasNextPage: false };
      },
      getDynamicFieldObject: async ({
        name,
        parentId,
      }: {
        name: object;
        parentId: string;
      }) => {
        if (parentId === supplyTerminalConfigId && name === listingFieldName) {
          return {
            data: {
              content: {
                fields: {
                  value: {
                    fields: {
                      enabled: true,
                      product_type_id: "84210",
                      product_quantity: "1",
                      payment_type_id: "77800",
                      payment_quantity: "10",
                    },
                  },
                },
              },
            },
          };
        }

        if (
          parentId === supplyTerminalConfigId &&
          name === secondListingFieldName
        ) {
          return {
            data: {
              content: {
                fields: {
                  value: {
                    fields: {
                      enabled: true,
                      product_type_id: "84211",
                      product_quantity: "3",
                      payment_type_id: "77801",
                      payment_quantity: "25",
                    },
                  },
                },
              },
            },
          };
        }

        if (parentId === storageId && name === machineInventoryFieldName) {
          return {
            data: {
              content: {
                fields: {
                  name: machineInventoryFieldName,
                  value: {
                    fields: {
                      items: {
                        fields: {
                          contents: [
                            {
                              fields: {
                                key: "84210",
                                value: {
                                  fields: {
                                    type_id: "84210",
                                    quantity: "1",
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          };
        }

        if (parentId === storageId && name === characterInventoryFieldName) {
          return {
            data: {
              content: {
                fields: {
                  name: characterInventoryFieldName,
                  value: {
                    fields: {
                      items: {
                        fields: {
                          contents: [
                            {
                              fields: {
                                key: "77800",
                                value: {
                                  fields: {
                                    type_id: "77800",
                                    quantity: "10",
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          };
        }

        throw new Error(`Unexpected dynamic field lookup: ${parentId}`);
      },
    };

    const snapshot = await loadSupplyTerminalSnapshot({
      env: baseEnv,
      client: client as unknown as SuiJsonRpcClient,
      accountAddress: sender,
    });

    expect(snapshot.character).toEqual({
      id: characterId,
      ownerCapId: characterOwnerCapId,
    });
    expect(snapshot.listings.map((listing) => listing.productTypeId)).toEqual([
      84210, 84211,
    ]);
    expect(snapshot.buyerInventory).toEqual([{ typeId: 77800, quantity: 10 }]);
  });

  it("builds the borrow, exchange, and return Move call sequence", async () => {
    const transaction = buildSupplyTerminalExchangeTransaction({
      env: baseEnv,
      snapshot: baseSnapshot,
      sender,
      productTypeId: 84210,
    });

    const json = JSON.parse(await transaction.toJSON()) as {
      commands: Array<{
        MoveCall: {
          package: string;
          module: string;
          function: string;
          arguments: unknown[];
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
    expect(json.commands[1]?.MoveCall.arguments).toHaveLength(5);
  });

  it("builds the storage owner-cap probe Move call sequence", async () => {
    const transaction = buildStorageUnitOwnerCapProbeTransaction({
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
        package: worldPackageId,
        module: "character",
        function: "return_owner_cap",
      },
    ]);
  });

  it("uses the StorageUnit owner character when probing storage owner-cap access", async () => {
    const transaction = buildStorageUnitOwnerCapProbeTransaction({
      env: baseEnv,
      snapshot: {
        ...baseSnapshot,
        storage: {
          ...baseSnapshot.storage,
          ownerCharacterId: storageOwnerCharacterId,
        },
      },
      sender,
    });

    const json = JSON.parse(await transaction.toJSON()) as {
      inputs: Array<{
        UnresolvedObject?: {
          objectId: string;
        };
      }>;
    };

    expect(json.inputs[0]?.UnresolvedObject?.objectId).toBe(
      storageOwnerCharacterId,
    );
  });

  it("checks storage ownership through devInspect owner-cap borrow", async () => {
    const devInspectTransactionBlock = vi.fn().mockResolvedValue({
      effects: { status: { status: "success" } },
    });
    const client = {
      devInspectTransactionBlock,
    } as unknown as SuiJsonRpcClient;

    await expect(
      probeStorageUnitOwnerCapBorrow({
        env: baseEnv,
        snapshot: baseSnapshot,
        sender,
        client,
      }),
    ).resolves.toBe(true);

    expect(devInspectTransactionBlock).toHaveBeenCalledWith({
      sender,
      transactionBlock: expect.anything(),
    });
  });

  it("returns false when storage owner-cap borrow cannot be inspected", async () => {
    const client = {
      devInspectTransactionBlock: vi
        .fn()
        .mockRejectedValue(new Error("not owner")),
    } as unknown as SuiJsonRpcClient;

    await expect(
      probeStorageUnitOwnerCapBorrow({
        env: baseEnv,
        snapshot: baseSnapshot,
        sender,
        client,
      }),
    ).resolves.toBe(false);
  });

  it("builds the borrow, authorize extension, and return Move call sequence", async () => {
    const transaction = buildSupplyTerminalAuthorizeExtensionTransaction({
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
          typeArguments?: string[];
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
        package: worldPackageId,
        module: "storage_unit",
        function: "authorize_extension",
      },
      {
        package: worldPackageId,
        module: "character",
        function: "return_owner_cap",
      },
    ]);
    expect(json.commands[1]?.MoveCall.typeArguments).toEqual([
      `${supplyTerminalPackageId}::config::SupplyTerminalAuth`,
    ]);
  });
});
