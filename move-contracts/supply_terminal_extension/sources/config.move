/// Module: supply_terminal_extension::config
/// Extension witness, AdminCap, and dynamic-field configuration.
module supply_terminal_extension::config;

use sui::dynamic_field;

// ============================================================
// Witness & Capability
// ============================================================

/// Witness type for StorageUnit extension authorization.
/// Only code in this package can produce it.
public struct SupplyTerminalAuth has drop {}

/// Admin capability — holder can configure listing rules.
public struct AdminCap has key, store {
    id: UID,
}

/// Shared configuration object. Rules stored as dynamic fields.
public struct ExtensionConfig has key {
    id: UID,
}

// ============================================================
// Init — runs once on publish
// ============================================================

fun init(ctx: &mut TxContext) {
    transfer::transfer(
        AdminCap { id: object::new(ctx) },
        ctx.sender(),
    );
    transfer::share_object(ExtensionConfig {
        id: object::new(ctx),
    });
}

// ============================================================
// Witness accessor (package-level only)
// ============================================================

public(package) fun supply_terminal_auth(): SupplyTerminalAuth {
    SupplyTerminalAuth {}
}

// ============================================================
// Dynamic-field rule helpers
// ============================================================

public fun has_rule<K: copy + drop + store>(config: &ExtensionConfig, key: K): bool {
    dynamic_field::exists_<K>(&config.id, key)
}

public fun borrow_rule<K: copy + drop + store, V: store>(
    config: &ExtensionConfig,
    key: K,
): &V {
    dynamic_field::borrow<K, V>(&config.id, key)
}

public fun borrow_rule_mut<K: copy + drop + store, V: store>(
    config: &mut ExtensionConfig,
    _admin_cap: &AdminCap,
    key: K,
): &mut V {
    dynamic_field::borrow_mut<K, V>(&mut config.id, key)
}

public fun add_rule<K: copy + drop + store, V: store>(
    config: &mut ExtensionConfig,
    _admin_cap: &AdminCap,
    key: K,
    value: V,
) {
    dynamic_field::add<K, V>(&mut config.id, key, value);
}

public fun set_rule<K: copy + drop + store, V: store + drop>(
    config: &mut ExtensionConfig,
    admin_cap: &AdminCap,
    key: K,
    value: V,
) {
    if (has_rule(config, key)) {
        let _old: V = remove_rule(config, admin_cap, key);
    };
    add_rule(config, admin_cap, key, value);
}

public fun remove_rule<K: copy + drop + store, V: store>(
    config: &mut ExtensionConfig,
    _admin_cap: &AdminCap,
    key: K,
): V {
    dynamic_field::remove<K, V>(&mut config.id, key)
}

// ============================================================
// Test-only helpers
// ============================================================

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx)
}
