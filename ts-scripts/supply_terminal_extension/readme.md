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

## Script order

```bash
# 1. Configure listing (admin — sets product/payment rules)
pnpm configure-supply-terminal

# 2. Authorize extension on storage unit (owner)
pnpm authorise-supply-terminal

# 3. Execute test exchange (player)
pnpm supply-terminal-exchange
```
