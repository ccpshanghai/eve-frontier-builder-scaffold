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

## Localnet Storage Units

| 用途 | Item ID | Object ID | OwnerCap ID | 状态 |
|------|---------|-----------|-------------|------|
| Supply Terminal (已配置) | `888800006` | `0x371f219e428fbf1bb8d8f921a1643c8eeb347c4739113b8e27828d2b86020024` | `0xc34611257c564c3547e601fc5286170bca15eed8f25dcef9cc7f14c046d3bbc5` | online, extension 已授权, inventory 已填充 |
| 干净测试 (无 extension) | `888800007` | `0x97035c98f9a3debc5de4a0e3c50748f2718f7a7ebdfa91f33337e9f684de00d7` | `0x3b865911860c4150f3ad492ccbe6bc1e963b15d2ebb78baf26790eaecdcbaf44` | online, 无 extension, 无 inventory |

两个 StorageUnit 的 OwnerCap 均归 Character（item ID `811880`，`0x87bc...5583`）持有。链上操作使用 `PLAYER_A_PRIVATE_KEY`。

切换到不同 StorageUnit：
```bash
# 已配置的 Supply Terminal
STORAGE_UNIT_ITEM_ID=888800006 pnpm <script>
# 干净的测试 StorageUnit
STORAGE_UNIT_ITEM_ID=888800007 pnpm <script>
```
