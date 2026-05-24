# Supply Terminal example

After publishing `move-contracts/supply_terminal_extension`, run these scripts from the repo root in order:

## Prerequisites

1. World contracts deployed and configured
2. `deployments/` and `test-resources.json` copied to repo root
3. Supply Terminal extension package published (`sui client publish`)
4. Set env vars in `.env` (see below)

## Required env vars

```bash
SUPPLY_TERMINAL_PACKAGE_ID=<from sui client publish output>
SUPPLY_TERMINAL_CONFIG_ID=<ExtensionConfig object ID>
SUPPLY_TERMINAL_ADMIN_CAP_ID=<AdminCap object ID>
STORAGE_UNIT_ITEM_ID=<storage unit game item ID>
CHARACTER_ITEM_ID=<character game item ID>
```

## Optional multi-listing config

By default the scripts configure and seed the original single listing:

- product `84210` x1
- payment `77800` x10

Set `SUPPLY_TERMINAL_LISTINGS` to configure multiple products in one command:

```bash
SUPPLY_TERMINAL_LISTINGS='[
  {"productTypeId":"84210","productQuantity":1,"paymentTypeId":"77800","paymentQuantity":10,"paymentVolume":"10"},
  {"productTypeId":"84211","productQuantity":3,"paymentTypeId":"77801","paymentQuantity":25,"paymentVolume":"10"}
]'
```

Each `productTypeId` must be unique. `productQuantity` can be any positive integer. `paymentVolume` is only used by `pnpm seed-supply-terminal-payment`; it defaults to `10` when omitted.

`pnpm seed-supply-terminal-inventory` seeds local product stock into the StorageUnit machine inventory. By default it adds enough stock for 10 purchases of every configured listing:

```bash
SUPPLY_TERMINAL_STOCK_PURCHASE_COUNT=10 pnpm seed-supply-terminal-inventory
```

Optional inventory seed overrides:

```bash
SUPPLY_TERMINAL_PRODUCT_ITEM_ID=842100000000001
SUPPLY_TERMINAL_PRODUCT_VOLUME=10
SUPPLY_TERMINAL_STOCK_PURCHASE_COUNT=10
```

To run an exchange for a specific product:

```bash
SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID=84211 pnpm supply-terminal-exchange
```

## Script order

```bash
# 1. Configure listing (admin — sets product/payment rules)
pnpm configure-supply-terminal

# 2. Authorize extension on storage unit (owner)
pnpm authorise-supply-terminal

# 3. Seed machine product inventory for configured listings (localnet helper)
pnpm seed-supply-terminal-inventory

# 4. Seed player payment inventory for configured listings (localnet helper)
pnpm seed-supply-terminal-payment

# 5. Execute test exchange (player)
SUPPLY_TERMINAL_EXCHANGE_PRODUCT_TYPE_ID=84210 pnpm supply-terminal-exchange
```
