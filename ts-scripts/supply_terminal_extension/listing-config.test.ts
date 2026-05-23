import * as assert from "node:assert/strict";
import {
    buildSupplyTerminalListings,
    getSelectedExchangeProductTypeId,
} from "./listing-config";

const BASE_ENV = {
    STORAGE_UNIT_ITEM_ID: "888800006",
    CHARACTER_ITEM_ID: "811880",
};

{
    const listings = buildSupplyTerminalListings(BASE_ENV);

    assert.equal(listings.length, 1);
    assert.equal(listings[0].productTypeId, 84210n);
    assert.equal(listings[0].productQuantity, 1);
    assert.equal(listings[0].paymentTypeId, 77800n);
    assert.equal(listings[0].paymentQuantity, 10);
    assert.equal(listings[0].paymentVolume, 10n);
}

{
    const listings = buildSupplyTerminalListings({
        ...BASE_ENV,
        SUPPLY_TERMINAL_LISTINGS: JSON.stringify([
            {
                productTypeId: "84210",
                productQuantity: 2,
                paymentTypeId: "77800",
                paymentQuantity: 10,
                paymentVolume: "10",
            },
            {
                productTypeId: "84211",
                productQuantity: 3,
                paymentTypeId: "77801",
                paymentQuantity: 25,
            },
        ]),
    });

    assert.equal(listings.length, 2);
    assert.equal(listings[0].productTypeId, 84210n);
    assert.equal(listings[0].productQuantity, 2);
    assert.equal(listings[0].paymentTypeId, 77800n);
    assert.equal(listings[0].paymentQuantity, 10);
    assert.equal(listings[0].paymentVolume, 10n);
    assert.equal(listings[1].productTypeId, 84211n);
    assert.equal(listings[1].productQuantity, 3);
    assert.equal(listings[1].paymentTypeId, 77801n);
    assert.equal(listings[1].paymentQuantity, 25);
    assert.equal(listings[1].paymentVolume, 10n);
}

{
    const selected = getSelectedExchangeProductTypeId({
        ...BASE_ENV,
        SUPPLY_TERMINAL_LISTINGS: JSON.stringify([
            {
                productTypeId: "84210",
                productQuantity: 1,
                paymentTypeId: "77800",
                paymentQuantity: 10,
            },
            {
                productTypeId: "84211",
                productQuantity: 3,
                paymentTypeId: "77801",
                paymentQuantity: 25,
            },
        ]),
        SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID: "84211",
    });

    assert.equal(selected, 84211n);
}

assert.throws(
    () =>
        buildSupplyTerminalListings({
            ...BASE_ENV,
            SUPPLY_TERMINAL_LISTINGS: "[",
        }),
    /SUPPLY_TERMINAL_LISTINGS must be valid JSON/
);

assert.throws(
    () =>
        buildSupplyTerminalListings({
            ...BASE_ENV,
            SUPPLY_TERMINAL_LISTINGS: JSON.stringify([
                {
                    productTypeId: "84210",
                    productQuantity: 1,
                    paymentTypeId: "77800",
                    paymentQuantity: 10,
                },
                {
                    productTypeId: "84210",
                    productQuantity: 2,
                    paymentTypeId: "77801",
                    paymentQuantity: 25,
                },
            ]),
        }),
    /Duplicate SUPPLY_TERMINAL_LISTINGS productTypeId 84210/
);

assert.throws(
    () =>
        getSelectedExchangeProductTypeId({
            ...BASE_ENV,
            SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID: "99999",
        }),
    /SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID 99999 does not match a configured listing/
);
