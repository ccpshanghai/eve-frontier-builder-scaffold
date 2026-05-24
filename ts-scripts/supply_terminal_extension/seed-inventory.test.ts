import * as assert from "node:assert/strict";
import { buildInventorySeedConfig } from "./seed-inventory";

const BASE_ENV = {
    STORAGE_UNIT_ITEM_ID: "888800006",
    CHARACTER_ITEM_ID: "811880",
};

{
    const config = buildInventorySeedConfig(BASE_ENV, 1779436000000);

    assert.equal(config.storageUnitItemId, 888800006n);
    assert.equal(config.characterItemId, 811880n);
    assert.equal(config.products.length, 1);
    assert.equal(config.products[0].productTypeId, 84210n);
    assert.equal(config.products[0].productItemId, 8421779436000000n);
    assert.equal(config.products[0].volume, 10n);
    assert.equal(config.products[0].quantity, 10);
}

{
    const config = buildInventorySeedConfig(
        {
            ...BASE_ENV,
            SUPPLY_TERMINAL_LISTINGS: JSON.stringify([
                {
                    productTypeId: "84210",
                    productQuantity: 25,
                    paymentTypeId: "77800",
                    paymentQuantity: 180,
                },
                {
                    productTypeId: "89089",
                    productQuantity: 1,
                    paymentTypeId: "77800",
                    paymentQuantity: 10000,
                },
            ]),
        },
        1779436000000
    );

    assert.equal(config.products.length, 2);
    assert.equal(config.products[0].productTypeId, 84210n);
    assert.equal(config.products[0].productItemId, 8421779436000000n);
    assert.equal(config.products[0].volume, 10n);
    assert.equal(config.products[0].quantity, 250);
    assert.equal(config.products[1].productTypeId, 89089n);
    assert.equal(config.products[1].productItemId, 8421779436000001n);
    assert.equal(config.products[1].volume, 10n);
    assert.equal(config.products[1].quantity, 10);
}

{
    const config = buildInventorySeedConfig(
        {
            ...BASE_ENV,
            SUPPLY_TERMINAL_PRODUCT_ITEM_ID: "99000",
            SUPPLY_TERMINAL_PRODUCT_VOLUME: "7",
            SUPPLY_TERMINAL_STOCK_PURCHASE_COUNT: "12",
            SUPPLY_TERMINAL_LISTINGS: JSON.stringify([
                {
                    productTypeId: "84210",
                    productQuantity: 25,
                    paymentTypeId: "77800",
                    paymentQuantity: 180,
                },
                {
                    productTypeId: "89089",
                    productQuantity: 1,
                    paymentTypeId: "77800",
                    paymentQuantity: 10000,
                },
            ]),
        },
        1779436000000
    );

    assert.equal(config.products[0].productItemId, 99000n);
    assert.equal(config.products[0].volume, 7n);
    assert.equal(config.products[0].quantity, 300);
    assert.equal(config.products[1].productItemId, 99001n);
    assert.equal(config.products[1].volume, 7n);
    assert.equal(config.products[1].quantity, 12);
}

assert.throws(
    () => buildInventorySeedConfig({ STORAGE_UNIT_ITEM_ID: "888800006" }, 1779436000000),
    /CHARACTER_ITEM_ID is required/
);

assert.throws(
    () =>
        buildInventorySeedConfig(
            {
                ...BASE_ENV,
                SUPPLY_TERMINAL_STOCK_PURCHASE_COUNT: "0",
            },
            1779436000000
        ),
    /SUPPLY_TERMINAL_STOCK_PURCHASE_COUNT must be a positive integer/
);
