# Supply Terminal: Item-for-Item Vending Machine

This document describes a single-player reference flow for a world-contract
powered vending machine. The flow focuses on one visible chain of custody:

```text
Player owned inventory pays Feldspar Crystals
-> the machine StorageUnit receives Feldspar Crystals revenue
-> the contract checks the listing and machine stock
-> the machine StorageUnit dispenses Carbon Weave
-> the player's owned inventory receives Carbon Weave
```

The approved implementation model is an **atomic exchange**. The UI may show
Select, Place Payment, and Confirm steps, but only Confirm submits an on-chain
transaction. If the transaction fails, all inventory changes roll back.

---

## 1. Goal

The player selects a product, stages the required payment in the UI, and confirms
the exchange.

One-sentence experience:

```text
The player selects Carbon Weave, stages Feldspar Crystals x10, confirms, and receives Carbon Weave x1.
```

The flow verifies three things:

1. A player's owned inventory can pay an item into a contract-controlled
   StorageUnit.
2. The contract can validate the listing and required payment.
3. The contract can dispense an item from the machine StorageUnit into the
   player's owned inventory.

---

## 2. Scope

Included:

```text
One Supply Terminal
One product
One purchase quantity
One atomic exchange transaction
```

Listing:

```text
Product: Carbon Weave x1
Price: Feldspar Crystals x10
Status: Enabled
```

Supported actions:

```text
Select product
Stage payment in the UI
Confirm exchange on-chain
Cancel before confirmation in the UI
View inventory and storage changes
View event log
```

Not included:

```text
Multi-product catalog
Dynamic pricing
Random rewards
Mini-games
Leaderboards
Multiple terminals
Complex owner permissions
Bulk purchase
Per-player purchase limits
Discounts
Two-phase on-chain escrow
Partial on-chain deposits
On-chain refund sessions
```

---

## 3. Participants

### Player Owned Inventory

The player's inventory is represented by the player's Character-owned inventory
inside the target StorageUnit. This is the inventory keyed by the player's
`OwnerCap<Character>` on the machine StorageUnit.

For this flow, the inventory must already contain Feldspar Crystals. In a full flow, the
player would first bridge or deposit game items into this Character-owned
inventory before buying from the terminal.

Initial state:

```text
Feldspar Crystals: 100
Carbon Weave: 0
```

### Supply Terminal StorageUnit

The Supply Terminal is backed by one StorageUnit.

Initial state:

```text
Carbon Weave: 20
Feldspar Crystals: 0
```

The machine StorageUnit has two roles:

```text
Product stock: Carbon Weave
Revenue inventory: Feldspar Crystals
```

### Supply Terminal Contract

The custom storage-unit extension owns the vending behavior. It needs to handle:

```text
Listing constants
Listing enabled check
Payment item and amount check
Machine stock check
Atomic item transfer
Exchange event emission
```

It does not need to store a persistent purchase session for the atomic exchange.

### Resource IDs

Use concrete resource items from the EVE Frontier Sandbox Access reference:

```text
https://docs.evefrontier.com/troubleshooting/sandbox-access
```

Chosen exchange resources:

```text
Product: Carbon Weave
Sandbox ItemID: 84210
Quantity: 1

Payment: Feldspar Crystals
Sandbox ItemID: 77800
Quantity: 10
```

The Sandbox Access page lists these as common item IDs and links to WorldAPI for
additional item data. If the deployed world distinguishes game `ItemID` from
inventory `type_id`, resolve the exact on-chain `type_id` from WorldAPI or the
deployed world data before hardcoding contract constants.

### Resource Preparation

Players obtain items through normal gameplay. The terminal flow only assumes
that:

```text
The machine StorageUnit already has Carbon Weave stock available on-chain.
The buyer's Character-owned inventory already has Feldspar Crystals available
on-chain in the target StorageUnit context.
```

---

## 4. Feasibility Assessment

The design is feasible against the current world-contract model.

The StorageUnit module already exposes the required inventory primitives:

```text
withdraw_by_owner<T>
  Withdraws an item from a player's owned inventory after the player borrows
  the relevant owner cap.

deposit_item<Auth>
  Lets an authorized extension deposit an item into the machine's main
  inventory.

withdraw_item<Auth>
  Lets an authorized extension withdraw product stock from the machine's main
  inventory.

deposit_to_owned<Auth>
  Lets an authorized extension deposit the product into a target player's owned
  inventory.
```

Therefore the exchange can happen in one Programmable Transaction Block:

```text
borrow player Character OwnerCap
withdraw Feldspar Crystals x10 from player owned inventory
deposit Feldspar Crystals x10 into machine StorageUnit
withdraw Carbon Weave x1 from machine StorageUnit
deposit Carbon Weave x1 into player owned inventory
return player Character OwnerCap
```

The main gap is that `move-contracts/storage_unit_extension` is currently only a
template. The implementation needs a real Supply Terminal extension module.

---

## 5. Authorization Model

The purchase operation should be callable by **any player who owns a valid
Character inventory and has enough Feldspar Crystals**, not only the owner of
the machine StorageUnit.

Roles:

```text
Storage owner
  Owns or controls the machine StorageUnit.
  Funds the machine with Carbon Weave stock.
  Authorizes the SupplyTerminalAuth extension on the StorageUnit.
  Optionally freezes the extension configuration for trust.

Buyer
  Owns a Character.
  Borrows their Character OwnerCap inside the transaction.
  Pays Feldspar Crystals from their own Character-owned inventory on the machine
  StorageUnit.
  Receives Carbon Weave into their own Character-owned inventory.
```

Why any player can buy:

```text
The StorageUnit owner cap is only needed to authorize the extension.
After authorization, the extension witness lets the contract mutate the machine
inventory.
The buyer only needs their own Character OwnerCap to withdraw payment from their
own inventory.
```

The dApp must not require the connected wallet to be the StorageUnit owner for a
purchase. It should only require:

```text
Wallet connected
Character resolved for that wallet
Character OwnerCap available to borrow
Character-owned inventory exists on the machine StorageUnit
Machine StorageUnit online
SupplyTerminalAuth authorized on the machine StorageUnit
Player has Feldspar Crystals x10
Machine has Carbon Weave x1
```

### StorageUnit Permission Model

The StorageUnit's base permission model is separate from the Supply Terminal
purchase rule.

```text
OwnerCap<StorageUnit>
  Controls StorageUnit-level operations.
  Required for authorizing extensions, freezing extension configuration,
  online/offline operations, and storage-owner inventory access.

OwnerCap<Character>
  Controls one Character's inventory inside the StorageUnit.
  Required for a buyer to withdraw their own Feldspar Crystals payment.
  Does not grant access to the StorageUnit owner's main inventory or another
  player's Character-owned inventory.

Authorized extension witness
  Lets a registered extension mutate the StorageUnit inventory only through the
  rules encoded by that extension.
  Regular players cannot directly create this witness.
```

Direct access rule:

```text
A regular player cannot directly operate the StorageUnit owner's main inventory
or another player's Character-owned inventory.

They can only affect the machine inventory through an authorized extension flow,
such as the Supply Terminal exchange.
```

---

## 6. Smart Contract Design

### Package and Module

Use the existing storage extension package:

```text
move-contracts/storage_unit_extension
```

Add a Supply Terminal module:

```text
storage_unit_extension::supply_terminal
```

### Witness Type

The extension defines a witness type:

```text
SupplyTerminalAuth
```

The StorageUnit owner authorizes this type on the machine StorageUnit:

```text
storage_unit::authorize_extension<SupplyTerminalAuth>
```

After redeploying the extension package, the TypeName changes because it includes
the package ID. The machine StorageUnit must be re-authorized after each
redeploy.

### Listing Configuration

For the first implementation, the listing can be hardcoded in the contract:

```text
Product type: Carbon Weave
Product sandbox ItemID: 84210
Product quantity: 1
Payment type: Feldspar Crystals
Payment sandbox ItemID: 77800
Payment quantity: 10
Status: Enabled
```

If a later version needs owner-managed listings, add a shared config object or
dynamic-field config. Do not add that complexity unless runtime configuration is
required.

### Exchange Entry Point

The contract should expose one main purchase function:

```text
exchange(
  storage_unit,
  buyer_character,
  buyer_character_owner_cap,
  ctx
)
```

Expected behavior:

```text
1. Assert listing is enabled.
2. Withdraw Feldspar Crystals x10 from the buyer's owned inventory.
3. Deposit Feldspar Crystals x10 into the machine StorageUnit inventory.
4. Withdraw Carbon Weave x1 from the machine StorageUnit inventory.
5. Deposit Carbon Weave x1 into the buyer's owned inventory.
6. Emit SupplyTerminalExchangeEvent.
```

The function should use the buyer's Character OwnerCap for the payment withdrawal
and the SupplyTerminalAuth witness for machine inventory operations.

### Events

Emit one high-level event for the dApp event log:

```text
SupplyTerminalExchangeEvent
  storage_unit_id
  buyer_character_id
  payment_type_id
  payment_quantity
  product_type_id
  product_quantity
```

The world inventory module will also emit lower-level deposit and withdrawal
events.

### Failure Behavior

Because the exchange is atomic, failure does not require a refund flow. Any
failure aborts the transaction and all inventory changes roll back.

Required failure cases:

```text
Insufficient Feldspar Crystals
  Payment withdrawal aborts. Player inventory is unchanged.

Insufficient Carbon Weave stock
  Product withdrawal aborts. Feldspar Crystals deposit rolls back.

Listing disabled
  Contract aborts before moving items.

StorageUnit offline
  StorageUnit inventory operation aborts. State is unchanged.

Extension not authorized
  Machine inventory operation aborts. State is unchanged.

Wrong buyer owner cap
  Buyer inventory withdrawal aborts. State is unchanged.
```

---

## 7. dApp Logic Design

The dApp is built on the existing React/Vite/Radix/EVE Frontier starter.

### In-Game Connection Model

The Supply Terminal dApp connects to an existing in-game StorageUnit. Creating,
anchoring, powering, and bringing the StorageUnit online are game-side assembly
operations and are not responsibilities of this dApp.

The in-game connection flow follows the EVE Frontier dApp model:

```text
1. A player navigates to a built Assembly in the EVE Frontier client.
2. The player interacts with the Assembly.
3. The in-game browser opens the Assembly's dApp page.
4. The dApp reads the selected Smart Assembly context and wallet state.
5. The dApp submits only the Supply Terminal exchange transaction.
```

The StorageUnit owner may use the base Smart Assembly dApp to set the unit name,
description, and dApp URL. External custom dApps can be viewed in-game, but
custom builder function calls are normal gas-consuming transactions unless a
sponsored transaction path is explicitly provided.

Inventory preparation is also part of the in-game StorageUnit flow. Items must be
deposited into the on-chain inventory holding area before they are usable by
contract transactions.

### Configuration

The dApp should read these IDs from environment variables or a small config
module:

```text
World package ID
Supply Terminal extension package ID
Machine StorageUnit ID
Carbon Weave sandbox ItemID
Carbon Weave on-chain type_id
Feldspar Crystals sandbox ItemID
Feldspar Crystals on-chain type_id
Listing quantity constants
```

### Data Loading

The dApp needs to load:

```text
Wallet connection state
Current account address
Player Character for the connected wallet
Machine StorageUnit object
Machine Carbon Weave stock
Machine Feldspar Crystals revenue
Player Feldspar Crystals balance
Player Carbon Weave balance
Whether the machine StorageUnit is online
Whether the player's Character-owned inventory exists on the machine StorageUnit
```

Use the starter's existing EVE Frontier and GraphQL helpers where possible:

```text
useConnection
useCurrentAccount
useSmartObject
getAssemblyWithOwner
getObjectWithJson
getObjectWithDynamicFields
```

If the dapp-kit helpers do not expose inventory quantities directly, add a small
query helper for StorageUnit dynamic fields.

### Transaction Construction

On Confirm Exchange, the dApp builds one Programmable Transaction Block:

```text
1. Set sender to connected wallet.
2. Borrow buyer Character OwnerCap from the Character object.
3. Call storage_unit_extension::supply_terminal::exchange.
4. Return buyer Character OwnerCap to the Character object.
5. Sign and execute with the connected wallet.
6. Refetch inventory and StorageUnit data.
```

Sponsored transactions are optional. If enabled, use EVE Vault supported
sponsored transaction APIs and show a clear unsupported-wallet message when the
wallet cannot sponsor.

### Local UI State

The UI state machine is local only:

```text
Idle
  -> Select Product
Selected
  -> Stage Payment
Payment Staged
  -> Confirm Exchange
Submitting
  -> Completed

Selected / Payment Staged
  -> Cancel
Idle
```

Important distinction:

```text
Stage Payment does not move items on-chain.
Confirm Exchange moves payment and product atomically on-chain.
Cancel before Confirm only clears local UI state.
```

---

## 8. UI Design

The UI should be dense and transaction-focused. Four panels are enough.

### Product Panel

Shows the listing and current stock:

```text
Carbon Weave
Price: Feldspar Crystals x10
Stock: 20
[Select]
```

### Purchase Panel

Shows the local purchase state:

```text
Selected: Carbon Weave x1
Required: Feldspar Crystals x10
Payment: Staged / Not staged
Status: Ready to confirm

[Stage Payment]
[Confirm Exchange]
[Cancel]
```

Button rules:

```text
Select
  Enabled when wallet, character, and machine data are loaded.

Stage Payment
  Enabled after selection and when player Feldspar Crystals >= 10.

Confirm Exchange
  Enabled only after payment is staged, machine stock > 0, and no transaction is pending.

Cancel
  Clears local selection and staged payment before confirmation.
```

### Player Inventory Panel

Shows the buyer's relevant balances:

```text
Feldspar Crystals: 100
Carbon Weave: 0
```

### Machine Storage Panel

Shows stock and revenue:

```text
Carbon Weave Stock: 20
Feldspar Crystals Revenue: 0
Status: Online
Extension: Authorized
```

---

## 9. Event Log

The event log is required for a clear transaction walkthrough.

Local UI events:

```text
> Product selected: Carbon Weave
> Payment staged: Feldspar Crystals x10
> Exchange submitted
```

Successful chain events:

```text
> Payment accepted: Feldspar Crystals x10
> Dispensed: Carbon Weave x1
> Exchange completed
> Transaction digest: <digest>
```

Failure examples:

```text
> Confirm failed: insufficient Feldspar Crystals
> Confirm failed: out of stock
> Confirm failed: listing disabled
> Confirm failed: extension not authorized
> Purchase cancelled before confirmation
```

---

## 10. Usage Scripts

### Happy Path

```text
Initial:
Player has Feldspar Crystals x100
Player has Carbon Weave x0
Machine has Carbon Weave x20
Machine has Feldspar Crystals x0

1. Player selects Carbon Weave.
2. Player stages Feldspar Crystals x10 in the UI.
3. Player confirms exchange.
4. One atomic transaction executes.
5. Machine receives Feldspar Crystals x10.
6. Machine dispenses Carbon Weave x1.

Final:
Player has Feldspar Crystals x90, Carbon Weave x1
Machine has Feldspar Crystals x10, Carbon Weave x19
```

### Cancel Before Confirmation

```text
1. Player selects Carbon Weave.
2. Player stages Feldspar Crystals x10 in the UI.
3. Player cancels before confirmation.

Final:
No on-chain transaction is submitted.
Player has Feldspar Crystals x100, Carbon Weave x0
Machine has Feldspar Crystals x0, Carbon Weave x20
```

### Out-of-Stock Path

```text
1. Machine Carbon Weave stock is 0.
2. Player selects Carbon Weave.
3. Player stages Feldspar Crystals x10 in the UI.
4. Player confirms exchange.
5. Transaction aborts with out of stock.

Final:
State is unchanged because the exchange is atomic.
Player keeps Feldspar Crystals x100, Carbon Weave x0
Machine keeps Feldspar Crystals x0, Carbon Weave x0
```

---

## 11. Success Criteria

The flow succeeds when the following are clearly visible:

```text
Player starts with Feldspar Crystals and no Carbon Weave.
Machine starts with Carbon Weave stock and no Feldspar Crystals revenue.
Player confirms one exchange transaction.
Feldspar Crystals leaves the player's owned inventory.
Feldspar Crystals enters the machine StorageUnit.
Carbon Weave leaves the machine StorageUnit.
Carbon Weave enters the player's owned inventory.
Failures do not produce partial inventory changes.
```

Atomic exchange means there is no on-chain refund path in this design. Failed
transactions roll back automatically, and pre-confirmation cancel is a local UI
operation.

---

## 12. Recommended Name

Use:

```text
Supply Terminal
```

This name fits the EVE Frontier setting better than a generic vending machine
and communicates that the object is a world facility, not a regular shop.
