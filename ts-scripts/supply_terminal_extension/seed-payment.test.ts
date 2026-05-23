import * as assert from "node:assert/strict";
import { buildPaymentSeedConfig } from "./seed-payment";

const BASE_ENV = {
    STORAGE_UNIT_ITEM_ID: "888800006",
    CHARACTER_ITEM_ID: "811880",
};

{
    const config = buildPaymentSeedConfig(BASE_ENV, 1779436000000);

    assert.equal(config.storageUnitItemId, 888800006n);
    assert.equal(config.characterItemId, 811880n);
    assert.equal(config.payments.length, 1);
    assert.equal(config.payments[0].paymentTypeId, 77800n);
    assert.equal(config.payments[0].paymentItemId, 7781779436000000n);
    assert.equal(config.payments[0].volume, 10n);
    assert.equal(config.payments[0].quantity, 10);
}

{
    const config = buildPaymentSeedConfig(
        {
            ...BASE_ENV,
            SUPPLY_TERMINAL_LISTINGS: JSON.stringify([
                {
                    productTypeId: "84210",
                    productQuantity: 1,
                    paymentTypeId: "77800",
                    paymentQuantity: 10,
                    paymentVolume: "10",
                },
                {
                    productTypeId: "84211",
                    productQuantity: 3,
                    paymentTypeId: "77801",
                    paymentQuantity: 25,
                    paymentVolume: "7",
                },
            ]),
        },
        1779436000000
    );

    assert.equal(config.payments.length, 2);
    assert.equal(config.payments[0].paymentTypeId, 77800n);
    assert.equal(config.payments[0].paymentItemId, 7781779436000000n);
    assert.equal(config.payments[0].volume, 10n);
    assert.equal(config.payments[0].quantity, 10);
    assert.equal(config.payments[1].paymentTypeId, 77801n);
    assert.equal(config.payments[1].paymentItemId, 7781779436000001n);
    assert.equal(config.payments[1].volume, 7n);
    assert.equal(config.payments[1].quantity, 25);
}

{
    const config = buildPaymentSeedConfig(
        {
            ...BASE_ENV,
            SUPPLY_TERMINAL_PAYMENT_ITEM_ID: "99999",
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
        },
        1779436000000
    );

    assert.equal(config.payments[0].paymentItemId, 99999n);
    assert.equal(config.payments[1].paymentItemId, 100000n);
}

assert.throws(
    () => buildPaymentSeedConfig({ STORAGE_UNIT_ITEM_ID: "888800006" }, 1779436000000),
    /CHARACTER_ITEM_ID is required/
);

assert.throws(
    () =>
        buildPaymentSeedConfig(
            {
                ...BASE_ENV,
                SUPPLY_TERMINAL_LISTINGS: JSON.stringify([
                    {
                        productTypeId: "84210",
                        productQuantity: 0,
                        paymentTypeId: "77800",
                        paymentQuantity: 10,
                    },
                ]),
            },
            1779436000000
        ),
    /SUPPLY_TERMINAL_LISTINGS\[0\].productQuantity must be a positive integer/
);
