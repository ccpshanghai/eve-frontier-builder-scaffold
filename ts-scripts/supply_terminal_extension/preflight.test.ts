import * as assert from "node:assert/strict";
import { validateSupplyTerminalPreflight } from "./preflight";

const LISTINGS = [
    {
        enabled: true,
        productTypeId: "84210",
        productQuantity: 1,
        paymentTypeId: "77800",
        paymentQuantity: 10,
    },
    {
        enabled: true,
        productTypeId: "84211",
        productQuantity: 3,
        paymentTypeId: "77801",
        paymentQuantity: 25,
    },
];

const BASE_STATE = {
    characterItemId: "811880",
    storageUnitItemId: "888800006",
    characterId: "0xcharacter",
    storageUnitId: "0xstorage",
    characterOwnerCapId: "0xbuyer-cap",
    storageUnitOwnerCapId: "0xmachine-cap",
    storageUnitStatus: "ONLINE",
    storageUnitExtension: "0xpackage::config::SupplyTerminalAuth",
    expectedAuthType: "0xpackage::config::SupplyTerminalAuth",
    selectedProductTypeId: "84211",
    listings: LISTINGS,
    inventories: [
        {
            key: "0xmachine-cap",
            items: [
                { typeId: "84210", quantity: 1 },
                { typeId: "84211", quantity: 3 },
            ],
        },
        {
            key: "0xbuyer-cap",
            items: [
                { typeId: "77800", quantity: 10 },
                { typeId: "77801", quantity: 25 },
            ],
        },
    ],
};

function cloneState(): typeof BASE_STATE {
    return structuredClone(BASE_STATE);
}

function assertValidationError(state: typeof BASE_STATE, expected: RegExp) {
    assert.throws(() => validateSupplyTerminalPreflight(state), expected);
}

assert.doesNotThrow(() => validateSupplyTerminalPreflight(cloneState()));

{
    const state = cloneState();
    state.storageUnitExtension = "package::config::SupplyTerminalAuth";

    assert.doesNotThrow(() => validateSupplyTerminalPreflight(state));
}

{
    const state = cloneState();
    state.selectedProductTypeId = "99999";

    assertValidationError(
        state,
        /Supply Terminal listing config is missing for product type 99999/
    );
}

{
    const state = cloneState();
    state.inventories = state.inventories.filter((inventory) => inventory.key !== "0xbuyer-cap");

    assertValidationError(
        state,
        /Buyer owned inventory is not initialized for Character 811880 .* StorageUnit 888800006/
    );
}

{
    const state = cloneState();
    state.inventories[1].items = state.inventories[1].items.filter(
        (item) => item.typeId !== "77801"
    );

    assertValidationError(state, /Buyer inventory does not contain payment type 77801 x25/);
}

{
    const state = cloneState();
    state.inventories[0].items.find((item) => item.typeId === "84211")!.quantity = 2;

    assertValidationError(state, /Machine inventory does not contain product type 84211 x3/);
}

{
    const state = cloneState();
    state.listings[1].enabled = false;

    assertValidationError(state, /Supply Terminal listing is disabled/);
}
