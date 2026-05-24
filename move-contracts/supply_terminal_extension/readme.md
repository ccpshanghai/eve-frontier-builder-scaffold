# Supply Terminal Extension

Supply Terminal is a `StorageUnit`-backed vending extension. An admin configures
product listings, the StorageUnit owner authorizes the extension, and a player
exchanges payment items from their Character-owned inventory for products stored
in the machine inventory.

`exchange` is atomic: payment moves into the machine inventory, product moves
into the buyer inventory, and `SupplyTerminalExchangeEvent` is emitted. If any
step fails, the whole transaction aborts.

## Architecture

| Component                | Source                                 | Role                                                                               |
| ------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------- |
| Package                  | `Move.toml`                            | Defines the Supply Terminal extension package and depends on `world`.              |
| `config` module          | `sources/config.move`                  | Creates `AdminCap`, shared `ExtensionConfig`, and `SupplyTerminalAuth`.            |
| `ExtensionConfig`        | `sources/config.move`                  | Stores listing rules as dynamic fields keyed by `product_type_id`.                 |
| `AdminCap`               | `sources/config.move`                  | Required to add or replace listings.                                               |
| `SupplyTerminalAuth`     | `sources/config.move`                  | Witness used to authorize StorageUnit inventory access.                            |
| `supply_terminal` module | `sources/supply_terminal.move`         | Exposes listing views, admin config, and the `exchange` entry point.               |
| `StorageUnit`            | `world::storage_unit`                  | Holds machine inventory and Character-owned inventories.                           |
| `Character` + `OwnerCap` | `world::character` / `world::access`   | Proves the buyer controls the inventory used for payment.                          |
| TypeScript scripts       | `ts-scripts/supply_terminal_extension` | Configure listings, authorize the extension, seed local payment, and run exchange. |

## Local Flow

```bash
pnpm configure-supply-terminal
ADMIN_PRIVATE_KEY="$PLAYER_A_PRIVATE_KEY" pnpm authorise-supply-terminal
pnpm seed-supply-terminal-payment
pnpm supply-terminal-exchange
```

`seed-supply-terminal-payment` is a localnet helper. In a real environment, the
buyer must already have enough payment items in the target StorageUnit, and the
machine inventory must already hold enough product stock.

## Listing Example

The table below can be used as `SUPPLY_TERMINAL_LISTINGS` data. Without that env
var, scripts use the local test default: product `84210 x1` for payment
`77800 x10`.

| Product                 | `product_type_id` | `product_quantity` | `payment_type_id` | `payment_quantity` |
| ----------------------- | ----------------: | -----------------: | ----------------: | -----------------: |
| Carbon Weave            |             84210 |                 25 |             77800 |                180 |
| Printed Circuits        |             84180 |                 18 |             77800 |                520 |
| Reinforced Alloys       |             84182 |                 14 |             77800 |                940 |
| Thermal Composites      |             88561 |                 10 |             77800 |               1680 |
| Hydrated Sulfide Matrix |             77811 |                  8 |             77800 |               3200 |
| Building Foam           |             89089 |                  1 |             77800 |              10000 |
