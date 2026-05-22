import assert from "node:assert/strict";
import { buildPaymentSeedConfig } from "./seed-payment";

const BASE_ENV = {
    STORAGE_UNIT_ITEM_ID: "888800006",
    CHARACTER_ITEM_ID: "811880",
};

{
    const config = buildPaymentSeedConfig(BASE_ENV, 1779436000000);

    assert.equal(config.storageUnitItemId, 888800006n);
    assert.equal(config.characterItemId, 811880n);
    assert.equal(config.paymentTypeId, 77800n);
    assert.equal(config.paymentItemId, 7781779436000000n);
    assert.equal(config.volume, 10n);
    assert.equal(config.quantity, 10);
}

{
    const config = buildPaymentSeedConfig(
        {
            ...BASE_ENV,
            SUPPLY_TERMINAL_PAYMENT_TYPE_ID: "12345",
            SUPPLY_TERMINAL_PAYMENT_ITEM_ID: "99999",
            SUPPLY_TERMINAL_PAYMENT_VOLUME: "7",
            SUPPLY_TERMINAL_PAYMENT_QUANTITY: "42",
        },
        1779436000000
    );

    assert.equal(config.paymentTypeId, 12345n);
    assert.equal(config.paymentItemId, 99999n);
    assert.equal(config.volume, 7n);
    assert.equal(config.quantity, 42);
}

assert.throws(
    () => buildPaymentSeedConfig({ STORAGE_UNIT_ITEM_ID: "888800006" }, 1779436000000),
    /CHARACTER_ITEM_ID is required/
);

assert.throws(
    () =>
        buildPaymentSeedConfig(
            { ...BASE_ENV, SUPPLY_TERMINAL_PAYMENT_QUANTITY: "0" },
            1779436000000
        ),
    /SUPPLY_TERMINAL_PAYMENT_QUANTITY must be a positive integer/
);
