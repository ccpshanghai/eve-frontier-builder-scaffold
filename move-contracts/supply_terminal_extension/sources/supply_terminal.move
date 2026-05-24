/// Module: supply_terminal_extension::supply_terminal
/// Atomic item-for-item exchange between a buyer's owned inventory
/// and the machine StorageUnit's main inventory.
module supply_terminal_extension::supply_terminal;

use sui::event;
use supply_terminal_extension::config::{Self, AdminCap, ExtensionConfig, SupplyTerminalAuth};
use world::{access::OwnerCap, character::{Self, Character}, storage_unit::{Self, StorageUnit}};

// ============================================================
// Listing Configuration
// ============================================================

/// Key for the listing config dynamic field.
public struct ListingConfigKey has copy, drop, store {
    product_type_id: u64,
}

/// Listing config stored on ExtensionConfig.
public struct ListingConfig has drop, store {
    enabled: bool,
    product_type_id: u64,
    product_quantity: u32,
    payment_type_id: u64,
    payment_quantity: u32,
}

// ============================================================
// Events
// ============================================================

/// Emitted on every successful exchange.
public struct SupplyTerminalExchangeEvent has copy, drop {
    storage_unit_id: ID,
    buyer_character_id: ID,
    payment_type_id: u64,
    payment_quantity: u32,
    product_type_id: u64,
    product_quantity: u32,
}

// ============================================================
// View functions
// ============================================================

public fun listing_enabled(config: &ExtensionConfig, product_type_id: u64): bool {
    let key = ListingConfigKey { product_type_id };
    if (!config::has_rule(config, key)) {
        return false
    };
    let listing: &ListingConfig = config::borrow_rule(config, key);
    listing.enabled
}

public fun product_type_id(config: &ExtensionConfig, product_type_id: u64): u64 {
    let listing: &ListingConfig = config::borrow_rule(
        config,
        ListingConfigKey { product_type_id },
    );
    listing.product_type_id
}

public fun product_quantity(config: &ExtensionConfig, product_type_id: u64): u32 {
    let listing: &ListingConfig = config::borrow_rule(
        config,
        ListingConfigKey { product_type_id },
    );
    listing.product_quantity
}

public fun payment_type_id(config: &ExtensionConfig, product_type_id: u64): u64 {
    let listing: &ListingConfig = config::borrow_rule(
        config,
        ListingConfigKey { product_type_id },
    );
    listing.payment_type_id
}

public fun payment_quantity(config: &ExtensionConfig, product_type_id: u64): u32 {
    let listing: &ListingConfig = config::borrow_rule(
        config,
        ListingConfigKey { product_type_id },
    );
    listing.payment_quantity
}

// ============================================================
// Admin functions
// ============================================================

public fun set_listing_config(
    extension_config: &mut ExtensionConfig,
    admin_cap: &AdminCap,
    enabled: bool,
    product_type_id: u64,
    product_quantity: u32,
    payment_type_id: u64,
    payment_quantity: u32,
) {
    config::set_rule<ListingConfigKey, ListingConfig>(
        extension_config,
        admin_cap,
        ListingConfigKey { product_type_id },
        ListingConfig {
            enabled,
            product_type_id,
            product_quantity,
            payment_type_id,
            payment_quantity,
        },
    );
}

// ============================================================
// Exchange entry point
// ============================================================

/// Execute an atomic exchange: buyer pays `payment_quantity` of
/// `payment_type_id` from their owned inventory, and receives
/// `product_quantity` of `product_type_id` from the machine inventory.
///
/// T: the buyer's Character type (for OwnerCap validation).
public fun exchange<T: key>(
    extension_config: &ExtensionConfig,
    storage_unit: &mut StorageUnit,
    buyer_character: &Character,
    buyer_owner_cap: &OwnerCap<T>,
    product_type_id: u64,
    ctx: &mut TxContext,
) {
    // 1. Assert listing exists and is enabled
    let key = ListingConfigKey { product_type_id };
    assert!(config::has_rule(extension_config, key), 0);
    let listing: &ListingConfig = config::borrow_rule(extension_config, key);
    assert!(listing.enabled, 1);

    // 2. Copy values before mutable operations
    let payment_type = listing.payment_type_id;
    let payment_qty = listing.payment_quantity;
    let product_type = listing.product_type_id;
    let product_qty = listing.product_quantity;

    // 3. Withdraw payment from buyer's owned inventory
    let payment_item = storage_unit::withdraw_by_owner<T>(
        storage_unit,
        buyer_character,
        buyer_owner_cap,
        payment_type,
        payment_qty,
        ctx,
    );

    // 4. Deposit payment into machine's main inventory
    storage_unit::deposit_item<SupplyTerminalAuth>(
        storage_unit,
        buyer_character,
        payment_item,
        config::supply_terminal_auth(),
        ctx,
    );

    // 5. Withdraw product from machine's main inventory
    let product_item = storage_unit::withdraw_item<SupplyTerminalAuth>(
        storage_unit,
        buyer_character,
        config::supply_terminal_auth(),
        product_type,
        product_qty,
        ctx,
    );

    // 6. Deposit product into buyer's owned inventory
    storage_unit::deposit_to_owned<SupplyTerminalAuth>(
        storage_unit,
        buyer_character,
        product_item,
        config::supply_terminal_auth(),
        ctx,
    );

    // 7. Emit event
    event::emit(SupplyTerminalExchangeEvent {
        storage_unit_id: object::id(storage_unit),
        buyer_character_id: character::id(buyer_character),
        payment_type_id: payment_type,
        payment_quantity: payment_qty,
        product_type_id: product_type,
        product_quantity: product_qty,
    });
}

// ============================================================
// Test-only helpers
// ============================================================

#[test_only]
public fun new_listing_config(
    enabled: bool,
    product_type_id: u64,
    product_quantity: u32,
    payment_type_id: u64,
    payment_quantity: u32,
): ListingConfig {
    ListingConfig { enabled, product_type_id, product_quantity, payment_type_id, payment_quantity }
}

#[test_only]
public fun listing_config_enabled(config: &ListingConfig): bool { config.enabled }

#[test_only]
public fun listing_config_product_type_id(config: &ListingConfig): u64 { config.product_type_id }

#[test_only]
public fun listing_config_product_quantity(config: &ListingConfig): u32 { config.product_quantity }

#[test_only]
public fun listing_config_payment_type_id(config: &ListingConfig): u64 { config.payment_type_id }

#[test_only]
public fun listing_config_payment_quantity(config: &ListingConfig): u32 { config.payment_quantity }

#[test_only]
public fun new_listing_config_key(product_type_id: u64): ListingConfigKey {
    ListingConfigKey { product_type_id }
}
