#[test_only]
module supply_terminal_extension::supply_terminal_tests;

use std::{string::utf8, unit_test::assert_eq};
use sui::{clock, test_scenario::{Self, next_tx, ctx}};
use supply_terminal_extension::{
    config::{Self, AdminCap, ExtensionConfig, SupplyTerminalAuth},
    supply_terminal::{Self, ListingConfigKey, ListingConfig}
};
use world::{
    access::{AdminACL, OwnerCap},
    character::{Self, Character},
    energy::EnergyConfig,
    network_node::{Self, NetworkNode},
    object_registry::ObjectRegistry,
    storage_unit::{Self, StorageUnit},
    test_helpers::{Self, admin, governor, tenant, user_a, user_b}
};

const CHARACTER_A_ITEM_ID: u32 = 1234u32;
const CHARACTER_B_ITEM_ID: u32 = 5678u32;
const LOCATION_HASH: vector<u8> =
    x"7a8f3b2e9c4d1a6f5e8b2d9c3f7a1e5b7a8f3b2e9c4d1a6f5e8b2d9c3f7a1e5b";
const MAX_CAPACITY: u64 = 100000;
const STORAGE_TYPE_ID: u64 = 5555;
const STORAGE_ITEM_ID: u64 = 90002;
const NETWORK_NODE_TYPE_ID: u64 = 111000;
const NETWORK_NODE_ITEM_ID: u64 = 5000;
const FUEL_MAX_CAPACITY: u64 = 1000;
const FUEL_BURN_RATE_IN_MS: u64 = 3600 * 1000;
const MAX_PRODUCTION: u64 = 100;
const FUEL_TYPE_ID: u64 = 1;
const FUEL_VOLUME: u64 = 10;

const PRODUCT_TYPE_ID: u64 = 84210;
const PRODUCT_ITEM_ID: u64 = 84210;
const PRODUCT_VOLUME: u64 = 1;
const PRODUCT_QUANTITY: u32 = 1;
const PRODUCT_STOCK: u32 = 20;
const PAYMENT_TYPE_ID: u64 = 77800;
const PAYMENT_ITEM_ID: u64 = 77800;
const PAYMENT_VOLUME: u64 = 1;
const PAYMENT_QUANTITY: u32 = 10;
const BUYER_PAYMENT_STOCK: u32 = 100;
const PRODUCT_B_TYPE_ID: u64 = 84211;
const PRODUCT_B_ITEM_ID: u64 = 84211;
const PRODUCT_B_VOLUME: u64 = 2;
const PRODUCT_B_QUANTITY: u32 = 3;
const PRODUCT_B_STOCK: u32 = 15;
const PAYMENT_B_TYPE_ID: u64 = 77801;
const PAYMENT_B_ITEM_ID: u64 = 77801;
const PAYMENT_B_VOLUME: u64 = 1;
const PAYMENT_B_QUANTITY: u32 = 25;
const BUYER_PAYMENT_B_STOCK: u32 = 100;

fun setup_network_node(ts: &mut test_scenario::Scenario) {
    test_helpers::setup_world(ts);
    test_helpers::configure_assembly_energy(ts);
}

fun create_character(ts: &mut test_scenario::Scenario, user: address, item_id: u32): ID {
    next_tx(ts, admin());
    let character_id = {
        let admin_acl = test_scenario::take_shared<AdminACL>(ts);
        let mut registry = test_scenario::take_shared<ObjectRegistry>(ts);
        let character = character::create_character(
            &mut registry,
            &admin_acl,
            item_id,
            tenant(),
            100,
            user,
            utf8(b"name"),
            ctx(ts),
        );
        let character_id = object::id(&character);
        character.share_character(&admin_acl, ctx(ts));
        test_scenario::return_shared(registry);
        test_scenario::return_shared(admin_acl);
        character_id
    };
    character_id
}

fun create_network_node(ts: &mut test_scenario::Scenario, character_id: ID): ID {
    next_tx(ts, admin());
    let mut registry = test_scenario::take_shared<ObjectRegistry>(ts);
    let character = test_scenario::take_shared_by_id<Character>(ts, character_id);
    let admin_acl = test_scenario::take_shared<AdminACL>(ts);
    let node = network_node::anchor(
        &mut registry,
        &character,
        &admin_acl,
        NETWORK_NODE_ITEM_ID,
        NETWORK_NODE_TYPE_ID,
        LOCATION_HASH,
        FUEL_MAX_CAPACITY,
        FUEL_BURN_RATE_IN_MS,
        MAX_PRODUCTION,
        ctx(ts),
    );
    let id = object::id(&node);
    node.share_network_node(&admin_acl, ctx(ts));

    test_scenario::return_shared(character);
    test_scenario::return_shared(admin_acl);
    test_scenario::return_shared(registry);
    id
}

fun create_storage_unit(ts: &mut test_scenario::Scenario, character_id: ID): (ID, ID) {
    let node_id = create_network_node(ts, character_id);
    next_tx(ts, admin());
    let mut registry = test_scenario::take_shared<ObjectRegistry>(ts);
    let mut node = test_scenario::take_shared_by_id<NetworkNode>(ts, node_id);
    let character = test_scenario::take_shared_by_id<Character>(ts, character_id);
    let storage_id = {
        let admin_acl = test_scenario::take_shared<AdminACL>(ts);
        let storage_unit = storage_unit::anchor(
            &mut registry,
            &mut node,
            &character,
            &admin_acl,
            STORAGE_ITEM_ID,
            STORAGE_TYPE_ID,
            MAX_CAPACITY,
            LOCATION_HASH,
            ctx(ts),
        );
        let storage_id = object::id(&storage_unit);
        storage_unit.share_storage_unit(&admin_acl, ctx(ts));
        test_scenario::return_shared(admin_acl);
        storage_id
    };
    test_scenario::return_shared(character);
    test_scenario::return_shared(registry);
    test_scenario::return_shared(node);
    (storage_id, node_id)
}

fun online_storage_unit(
    ts: &mut test_scenario::Scenario,
    user: address,
    character_id: ID,
    storage_id: ID,
    node_id: ID,
) {
    let clock = clock::create_for_testing(ctx(ts));
    next_tx(ts, user);
    let mut character = test_scenario::take_shared_by_id<Character>(ts, character_id);
    let (node_owner_cap, node_receipt) = character.borrow_owner_cap<NetworkNode>(
        test_scenario::most_recent_receiving_ticket<OwnerCap<NetworkNode>>(&character_id),
        ctx(ts),
    );

    next_tx(ts, user);
    {
        let mut node = test_scenario::take_shared_by_id<NetworkNode>(ts, node_id);
        node.deposit_fuel_test(&node_owner_cap, FUEL_TYPE_ID, FUEL_VOLUME, 10, &clock);
        test_scenario::return_shared(node);
    };

    next_tx(ts, user);
    {
        let mut node = test_scenario::take_shared_by_id<NetworkNode>(ts, node_id);
        node.online(&node_owner_cap, &clock);
        test_scenario::return_shared(node);
    };
    character.return_owner_cap(node_owner_cap, node_receipt);

    next_tx(ts, user);
    {
        let mut storage_unit = test_scenario::take_shared_by_id<StorageUnit>(ts, storage_id);
        let mut node = test_scenario::take_shared_by_id<NetworkNode>(ts, node_id);
        let energy_config = test_scenario::take_shared<EnergyConfig>(ts);
        let (storage_owner_cap, storage_receipt) = character.borrow_owner_cap<StorageUnit>(
            test_scenario::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(&character_id),
            ctx(ts),
        );
        storage_unit.online(&mut node, &energy_config, &storage_owner_cap);
        character.return_owner_cap(storage_owner_cap, storage_receipt);
        test_scenario::return_shared(storage_unit);
        test_scenario::return_shared(node);
        test_scenario::return_shared(energy_config);
    };

    test_scenario::return_shared(character);
    clock.destroy_for_testing();
}

fun character_owner_cap_id(ts: &mut test_scenario::Scenario, character_id: ID): ID {
    next_tx(ts, admin());
    let character = test_scenario::take_shared_by_id<Character>(ts, character_id);
    let owner_cap_id = character.owner_cap_id();
    test_scenario::return_shared(character);
    owner_cap_id
}

fun storage_owner_cap_id(ts: &mut test_scenario::Scenario, storage_id: ID): ID {
    next_tx(ts, admin());
    let storage_unit = test_scenario::take_shared_by_id<StorageUnit>(ts, storage_id);
    let owner_cap_id = storage_unit.owner_cap_id();
    test_scenario::return_shared(storage_unit);
    owner_cap_id
}

fun mint_item<T: key>(
    ts: &mut test_scenario::Scenario,
    storage_id: ID,
    character_id: ID,
    user: address,
    item_id: u64,
    type_id: u64,
    volume: u64,
    quantity: u32,
) {
    next_tx(ts, user);
    let mut character = test_scenario::take_shared_by_id<Character>(ts, character_id);
    let (owner_cap, receipt) = character.borrow_owner_cap<T>(
        test_scenario::most_recent_receiving_ticket<OwnerCap<T>>(&character_id),
        ctx(ts),
    );
    let mut storage_unit = test_scenario::take_shared_by_id<StorageUnit>(ts, storage_id);
    storage_unit.game_item_to_chain_inventory_test<T>(
        &character,
        &owner_cap,
        item_id,
        type_id,
        volume,
        quantity,
        ctx(ts),
    );
    character.return_owner_cap(owner_cap, receipt);
    test_scenario::return_shared(character);
    test_scenario::return_shared(storage_unit);
}

fun set_terminal_listing(
    ts: &mut test_scenario::Scenario,
    enabled: bool,
    product_type_id: u64,
    product_quantity: u32,
    payment_type_id: u64,
    payment_quantity: u32,
) {
    next_tx(ts, governor());
    let admin_cap: AdminCap = test_scenario::take_from_sender<AdminCap>(ts);
    let mut extension_config = test_scenario::take_shared<ExtensionConfig>(ts);
    supply_terminal::set_listing_config(
        &mut extension_config,
        &admin_cap,
        enabled,
        product_type_id,
        product_quantity,
        payment_type_id,
        payment_quantity,
    );
    test_scenario::return_to_sender(ts, admin_cap);
    test_scenario::return_shared(extension_config);
}

fun setup_terminal_config(ts: &mut test_scenario::Scenario, enabled: bool) {
    next_tx(ts, governor());
    config::init_for_testing(ctx(ts));
    set_terminal_listing(
        ts,
        enabled,
        PRODUCT_TYPE_ID,
        PRODUCT_QUANTITY,
        PAYMENT_TYPE_ID,
        PAYMENT_QUANTITY,
    );
}

fun setup_two_terminal_listings(ts: &mut test_scenario::Scenario) {
    next_tx(ts, governor());
    config::init_for_testing(ctx(ts));
    set_terminal_listing(
        ts,
        true,
        PRODUCT_TYPE_ID,
        PRODUCT_QUANTITY,
        PAYMENT_TYPE_ID,
        PAYMENT_QUANTITY,
    );
    set_terminal_listing(
        ts,
        true,
        PRODUCT_B_TYPE_ID,
        PRODUCT_B_QUANTITY,
        PAYMENT_B_TYPE_ID,
        PAYMENT_B_QUANTITY,
    );
}

fun authorize_supply_terminal(
    ts: &mut test_scenario::Scenario,
    storage_id: ID,
    storage_owner_character_id: ID,
) {
    next_tx(ts, user_b());
    let mut storage_unit = test_scenario::take_shared_by_id<StorageUnit>(ts, storage_id);
    let mut character = test_scenario::take_shared_by_id<Character>(
        ts,
        storage_owner_character_id,
    );
    let (owner_cap, receipt) = character.borrow_owner_cap<StorageUnit>(
        test_scenario::most_recent_receiving_ticket<OwnerCap<StorageUnit>>(
            &storage_owner_character_id,
        ),
        ctx(ts),
    );
    storage_unit.authorize_extension<SupplyTerminalAuth>(&owner_cap);
    character.return_owner_cap(owner_cap, receipt);
    test_scenario::return_shared(storage_unit);
    test_scenario::return_shared(character);
}

// ============================================================
// Config Module Tests
// ============================================================

#[test]
fun test_init_creates_admin_cap_and_extension_config() {
    let admin = @0xA;
    let mut scenario = test_scenario::begin(admin);

    {
        config::init_for_testing(ctx(&mut scenario));
    };

    next_tx(&mut scenario, admin);
    {
        let _admin_cap: AdminCap = test_scenario::take_from_sender<AdminCap>(&scenario);
        test_scenario::return_to_sender(&scenario, _admin_cap);
    };

    next_tx(&mut scenario, @0xB);
    {
        let _config: ExtensionConfig = test_scenario::take_shared<ExtensionConfig>(&scenario);
        test_scenario::return_shared(_config);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_add_and_read_rule() {
    let admin = @0xA;
    let mut scenario = test_scenario::begin(admin);

    {
        config::init_for_testing(ctx(&mut scenario));
    };

    next_tx(&mut scenario, admin);
    {
        let admin_cap: AdminCap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config: ExtensionConfig = test_scenario::take_shared<ExtensionConfig>(&scenario);

        let listing = supply_terminal::new_listing_config(
            true,
            84210,
            1,
            77800,
            10,
        );
        let key = supply_terminal::new_listing_config_key(PRODUCT_TYPE_ID);
        config::add_rule(&mut config, &admin_cap, key, listing);

        assert!(config::has_rule(&config, key), 0);

        let read_listing: &ListingConfig = config::borrow_rule(&config, key);
        assert!(supply_terminal::listing_config_enabled(read_listing), 1);
        assert!(supply_terminal::listing_config_product_type_id(read_listing) == 84210, 2);
        assert!(supply_terminal::listing_config_product_quantity(read_listing) == 1, 3);
        assert!(supply_terminal::listing_config_payment_type_id(read_listing) == 77800, 4);
        assert!(supply_terminal::listing_config_payment_quantity(read_listing) == 10, 5);

        config::remove_rule<ListingConfigKey, ListingConfig>(&mut config, &admin_cap, key);

        test_scenario::return_to_sender(&scenario, admin_cap);
        test_scenario::return_shared(config);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_set_rule_replaces_existing() {
    let admin = @0xA;
    let mut scenario = test_scenario::begin(admin);

    {
        config::init_for_testing(ctx(&mut scenario));
    };

    next_tx(&mut scenario, admin);
    {
        let admin_cap: AdminCap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config: ExtensionConfig = test_scenario::take_shared<ExtensionConfig>(&scenario);

        let key = supply_terminal::new_listing_config_key(PRODUCT_TYPE_ID);
        let listing = supply_terminal::new_listing_config(
            true,
            84210,
            1,
            77800,
            10,
        );
        config::add_rule(&mut config, &admin_cap, key, listing);

        let new_listing = supply_terminal::new_listing_config(
            false,
            99999,
            5,
            11111,
            20,
        );
        config::set_rule(&mut config, &admin_cap, key, new_listing);

        let read_listing: &ListingConfig = config::borrow_rule(&config, key);
        assert!(!supply_terminal::listing_config_enabled(read_listing), 0);
        assert!(supply_terminal::listing_config_product_type_id(read_listing) == 99999, 1);
        assert!(supply_terminal::listing_config_payment_quantity(read_listing) == 20, 2);

        config::remove_rule<ListingConfigKey, ListingConfig>(&mut config, &admin_cap, key);

        test_scenario::return_to_sender(&scenario, admin_cap);
        test_scenario::return_shared(config);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_has_rule_returns_false_for_missing_key() {
    let admin = @0xA;
    let mut scenario = test_scenario::begin(admin);

    {
        config::init_for_testing(ctx(&mut scenario));
    };

    next_tx(&mut scenario, admin);
    {
        let config: ExtensionConfig = test_scenario::take_shared<ExtensionConfig>(&scenario);

        let key = supply_terminal::new_listing_config_key(PRODUCT_TYPE_ID);
        assert!(!config::has_rule(&config, key), 0);

        test_scenario::return_shared(config);
    };

    test_scenario::end(scenario);
}

// ============================================================
// Supply Terminal View Function Tests
// ============================================================

#[test]
fun test_listing_enabled_returns_false_when_not_configured() {
    let admin = @0xA;
    let mut scenario = test_scenario::begin(admin);

    {
        config::init_for_testing(ctx(&mut scenario));
    };

    next_tx(&mut scenario, admin);
    {
        let config: ExtensionConfig = test_scenario::take_shared<ExtensionConfig>(&scenario);

        assert!(!supply_terminal::listing_enabled(&config, PRODUCT_TYPE_ID), 0);

        test_scenario::return_shared(config);
    };

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = 1)]
fun test_view_functions_abort_when_not_configured() {
    let admin = @0xA;
    let mut scenario = test_scenario::begin(admin);

    {
        config::init_for_testing(ctx(&mut scenario));
    };

    next_tx(&mut scenario, admin);
    {
        let config: ExtensionConfig = test_scenario::take_shared<ExtensionConfig>(&scenario);

        // Should abort because listing not configured
        supply_terminal::product_type_id(&config, PRODUCT_TYPE_ID);

        // unreachable
        test_scenario::return_shared(config);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_view_functions_return_configured_values() {
    let admin = @0xA;
    let mut scenario = test_scenario::begin(admin);

    {
        config::init_for_testing(ctx(&mut scenario));
    };

    next_tx(&mut scenario, admin);
    {
        let admin_cap: AdminCap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config: ExtensionConfig = test_scenario::take_shared<ExtensionConfig>(&scenario);

        let listing = supply_terminal::new_listing_config(
            true,
            84210,
            1,
            77800,
            10,
        );
        let key = supply_terminal::new_listing_config_key(PRODUCT_TYPE_ID);
        config::add_rule(&mut config, &admin_cap, key, listing);

        assert!(supply_terminal::listing_enabled(&config, PRODUCT_TYPE_ID), 0);
        assert!(supply_terminal::product_type_id(&config, PRODUCT_TYPE_ID) == 84210, 1);
        assert!(supply_terminal::product_quantity(&config, PRODUCT_TYPE_ID) == 1, 2);
        assert!(supply_terminal::payment_type_id(&config, PRODUCT_TYPE_ID) == 77800, 3);
        assert!(supply_terminal::payment_quantity(&config, PRODUCT_TYPE_ID) == 10, 4);

        test_scenario::return_to_sender(&scenario, admin_cap);
        test_scenario::return_shared(config);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_set_listing_config_updates_listing_values() {
    let mut scenario = test_scenario::begin(governor());
    setup_terminal_config(&mut scenario, true);

    next_tx(&mut scenario, governor());
    {
        let config: ExtensionConfig = test_scenario::take_shared<ExtensionConfig>(&scenario);

        assert!(supply_terminal::listing_enabled(&config, PRODUCT_TYPE_ID), 0);
        assert_eq!(supply_terminal::product_type_id(&config, PRODUCT_TYPE_ID), PRODUCT_TYPE_ID);
        assert_eq!(supply_terminal::product_quantity(&config, PRODUCT_TYPE_ID), PRODUCT_QUANTITY);
        assert_eq!(supply_terminal::payment_type_id(&config, PRODUCT_TYPE_ID), PAYMENT_TYPE_ID);
        assert_eq!(supply_terminal::payment_quantity(&config, PRODUCT_TYPE_ID), PAYMENT_QUANTITY);

        test_scenario::return_shared(config);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_set_listing_config_supports_multiple_product_keys() {
    let mut scenario = test_scenario::begin(governor());
    setup_two_terminal_listings(&mut scenario);

    next_tx(&mut scenario, governor());
    {
        let config: ExtensionConfig = test_scenario::take_shared<ExtensionConfig>(&scenario);

        assert!(supply_terminal::listing_enabled(&config, PRODUCT_TYPE_ID), 0);
        assert!(supply_terminal::listing_enabled(&config, PRODUCT_B_TYPE_ID), 1);

        assert_eq!(supply_terminal::product_type_id(&config, PRODUCT_TYPE_ID), PRODUCT_TYPE_ID);
        assert_eq!(supply_terminal::product_quantity(&config, PRODUCT_TYPE_ID), PRODUCT_QUANTITY);
        assert_eq!(supply_terminal::payment_type_id(&config, PRODUCT_TYPE_ID), PAYMENT_TYPE_ID);
        assert_eq!(supply_terminal::payment_quantity(&config, PRODUCT_TYPE_ID), PAYMENT_QUANTITY);

        assert_eq!(supply_terminal::product_type_id(&config, PRODUCT_B_TYPE_ID), PRODUCT_B_TYPE_ID);
        assert_eq!(
            supply_terminal::product_quantity(&config, PRODUCT_B_TYPE_ID),
            PRODUCT_B_QUANTITY,
        );
        assert_eq!(supply_terminal::payment_type_id(&config, PRODUCT_B_TYPE_ID), PAYMENT_B_TYPE_ID);
        assert_eq!(
            supply_terminal::payment_quantity(&config, PRODUCT_B_TYPE_ID),
            PAYMENT_B_QUANTITY,
        );

        test_scenario::return_shared(config);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_exchange_moves_payment_to_machine_and_product_to_buyer() {
    let mut scenario = test_scenario::begin(governor());
    setup_network_node(&mut scenario);
    setup_terminal_config(&mut scenario, true);

    let buyer_character_id = create_character(&mut scenario, user_a(), CHARACTER_A_ITEM_ID);
    let storage_owner_character_id = create_character(
        &mut scenario,
        user_b(),
        CHARACTER_B_ITEM_ID,
    );
    let (storage_id, node_id) = create_storage_unit(&mut scenario, storage_owner_character_id);
    online_storage_unit(
        &mut scenario,
        user_b(),
        storage_owner_character_id,
        storage_id,
        node_id,
    );

    let machine_owner_cap_id = storage_owner_cap_id(&mut scenario, storage_id);
    let buyer_owner_cap_id = character_owner_cap_id(&mut scenario, buyer_character_id);

    mint_item<StorageUnit>(
        &mut scenario,
        storage_id,
        storage_owner_character_id,
        user_b(),
        PRODUCT_ITEM_ID,
        PRODUCT_TYPE_ID,
        PRODUCT_VOLUME,
        PRODUCT_STOCK,
    );
    mint_item<Character>(
        &mut scenario,
        storage_id,
        buyer_character_id,
        user_a(),
        PAYMENT_ITEM_ID,
        PAYMENT_TYPE_ID,
        PAYMENT_VOLUME,
        BUYER_PAYMENT_STOCK,
    );
    authorize_supply_terminal(&mut scenario, storage_id, storage_owner_character_id);

    next_tx(&mut scenario, user_a());
    {
        let extension_config = test_scenario::take_shared<ExtensionConfig>(&scenario);
        let mut storage_unit = test_scenario::take_shared_by_id<StorageUnit>(
            &scenario,
            storage_id,
        );
        let mut buyer_character = test_scenario::take_shared_by_id<Character>(
            &scenario,
            buyer_character_id,
        );
        let (buyer_owner_cap, receipt) = buyer_character.borrow_owner_cap<Character>(
            test_scenario::most_recent_receiving_ticket<OwnerCap<Character>>(
                &buyer_character_id,
            ),
            ctx(&mut scenario),
        );

        supply_terminal::exchange<Character>(
            &extension_config,
            &mut storage_unit,
            &buyer_character,
            &buyer_owner_cap,
            PRODUCT_TYPE_ID,
            ctx(&mut scenario),
        );

        buyer_character.return_owner_cap(buyer_owner_cap, receipt);
        test_scenario::return_shared(extension_config);
        test_scenario::return_shared(storage_unit);
        test_scenario::return_shared(buyer_character);
    };

    next_tx(&mut scenario, admin());
    {
        let storage_unit = test_scenario::take_shared_by_id<StorageUnit>(
            &scenario,
            storage_id,
        );
        assert_eq!(
            storage_unit.item_quantity(buyer_owner_cap_id, PAYMENT_TYPE_ID),
            BUYER_PAYMENT_STOCK - PAYMENT_QUANTITY,
        );
        assert_eq!(
            storage_unit.item_quantity(buyer_owner_cap_id, PRODUCT_TYPE_ID),
            PRODUCT_QUANTITY,
        );
        assert_eq!(
            storage_unit.item_quantity(machine_owner_cap_id, PRODUCT_TYPE_ID),
            PRODUCT_STOCK - PRODUCT_QUANTITY,
        );
        assert_eq!(
            storage_unit.item_quantity(machine_owner_cap_id, PAYMENT_TYPE_ID),
            PAYMENT_QUANTITY,
        );
        test_scenario::return_shared(storage_unit);
    };

    test_scenario::end(scenario);
}

#[test]
fun test_exchange_uses_selected_product_listing() {
    let mut scenario = test_scenario::begin(governor());
    setup_network_node(&mut scenario);
    setup_two_terminal_listings(&mut scenario);

    let buyer_character_id = create_character(&mut scenario, user_a(), CHARACTER_A_ITEM_ID);
    let storage_owner_character_id = create_character(
        &mut scenario,
        user_b(),
        CHARACTER_B_ITEM_ID,
    );
    let (storage_id, node_id) = create_storage_unit(&mut scenario, storage_owner_character_id);
    online_storage_unit(
        &mut scenario,
        user_b(),
        storage_owner_character_id,
        storage_id,
        node_id,
    );

    let machine_owner_cap_id = storage_owner_cap_id(&mut scenario, storage_id);
    let buyer_owner_cap_id = character_owner_cap_id(&mut scenario, buyer_character_id);

    mint_item<StorageUnit>(
        &mut scenario,
        storage_id,
        storage_owner_character_id,
        user_b(),
        PRODUCT_ITEM_ID,
        PRODUCT_TYPE_ID,
        PRODUCT_VOLUME,
        PRODUCT_STOCK,
    );
    mint_item<StorageUnit>(
        &mut scenario,
        storage_id,
        storage_owner_character_id,
        user_b(),
        PRODUCT_B_ITEM_ID,
        PRODUCT_B_TYPE_ID,
        PRODUCT_B_VOLUME,
        PRODUCT_B_STOCK,
    );
    mint_item<Character>(
        &mut scenario,
        storage_id,
        buyer_character_id,
        user_a(),
        PAYMENT_ITEM_ID,
        PAYMENT_TYPE_ID,
        PAYMENT_VOLUME,
        BUYER_PAYMENT_STOCK,
    );
    mint_item<Character>(
        &mut scenario,
        storage_id,
        buyer_character_id,
        user_a(),
        PAYMENT_B_ITEM_ID,
        PAYMENT_B_TYPE_ID,
        PAYMENT_B_VOLUME,
        BUYER_PAYMENT_B_STOCK,
    );
    authorize_supply_terminal(&mut scenario, storage_id, storage_owner_character_id);

    next_tx(&mut scenario, user_a());
    {
        let extension_config = test_scenario::take_shared<ExtensionConfig>(&scenario);
        let mut storage_unit = test_scenario::take_shared_by_id<StorageUnit>(
            &scenario,
            storage_id,
        );
        let mut buyer_character = test_scenario::take_shared_by_id<Character>(
            &scenario,
            buyer_character_id,
        );
        let (buyer_owner_cap, receipt) = buyer_character.borrow_owner_cap<Character>(
            test_scenario::most_recent_receiving_ticket<OwnerCap<Character>>(
                &buyer_character_id,
            ),
            ctx(&mut scenario),
        );

        supply_terminal::exchange<Character>(
            &extension_config,
            &mut storage_unit,
            &buyer_character,
            &buyer_owner_cap,
            PRODUCT_B_TYPE_ID,
            ctx(&mut scenario),
        );

        buyer_character.return_owner_cap(buyer_owner_cap, receipt);
        test_scenario::return_shared(extension_config);
        test_scenario::return_shared(storage_unit);
        test_scenario::return_shared(buyer_character);
    };

    next_tx(&mut scenario, admin());
    {
        let storage_unit = test_scenario::take_shared_by_id<StorageUnit>(
            &scenario,
            storage_id,
        );
        assert_eq!(
            storage_unit.item_quantity(buyer_owner_cap_id, PAYMENT_TYPE_ID),
            BUYER_PAYMENT_STOCK,
        );
        assert_eq!(
            storage_unit.item_quantity(buyer_owner_cap_id, PAYMENT_B_TYPE_ID),
            BUYER_PAYMENT_B_STOCK - PAYMENT_B_QUANTITY,
        );
        assert_eq!(
            storage_unit.item_quantity(buyer_owner_cap_id, PRODUCT_B_TYPE_ID),
            PRODUCT_B_QUANTITY,
        );
        assert_eq!(
            storage_unit.item_quantity(machine_owner_cap_id, PRODUCT_TYPE_ID),
            PRODUCT_STOCK,
        );
        assert_eq!(
            storage_unit.item_quantity(machine_owner_cap_id, PRODUCT_B_TYPE_ID),
            PRODUCT_B_STOCK - PRODUCT_B_QUANTITY,
        );
        assert_eq!(
            storage_unit.item_quantity(machine_owner_cap_id, PAYMENT_B_TYPE_ID),
            PAYMENT_B_QUANTITY,
        );
        test_scenario::return_shared(storage_unit);
    };

    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = 1)]
fun test_exchange_aborts_when_listing_disabled() {
    let mut scenario = test_scenario::begin(governor());
    setup_network_node(&mut scenario);
    setup_terminal_config(&mut scenario, false);

    let buyer_character_id = create_character(&mut scenario, user_a(), CHARACTER_A_ITEM_ID);
    let storage_owner_character_id = create_character(
        &mut scenario,
        user_b(),
        CHARACTER_B_ITEM_ID,
    );
    let (storage_id, node_id) = create_storage_unit(&mut scenario, storage_owner_character_id);
    online_storage_unit(
        &mut scenario,
        user_b(),
        storage_owner_character_id,
        storage_id,
        node_id,
    );
    mint_item<StorageUnit>(
        &mut scenario,
        storage_id,
        storage_owner_character_id,
        user_b(),
        PRODUCT_ITEM_ID,
        PRODUCT_TYPE_ID,
        PRODUCT_VOLUME,
        PRODUCT_STOCK,
    );
    mint_item<Character>(
        &mut scenario,
        storage_id,
        buyer_character_id,
        user_a(),
        PAYMENT_ITEM_ID,
        PAYMENT_TYPE_ID,
        PAYMENT_VOLUME,
        BUYER_PAYMENT_STOCK,
    );
    authorize_supply_terminal(&mut scenario, storage_id, storage_owner_character_id);

    next_tx(&mut scenario, user_a());
    {
        let extension_config = test_scenario::take_shared<ExtensionConfig>(&scenario);
        let mut storage_unit = test_scenario::take_shared_by_id<StorageUnit>(
            &scenario,
            storage_id,
        );
        let mut buyer_character = test_scenario::take_shared_by_id<Character>(
            &scenario,
            buyer_character_id,
        );
        let (buyer_owner_cap, receipt) = buyer_character.borrow_owner_cap<Character>(
            test_scenario::most_recent_receiving_ticket<OwnerCap<Character>>(
                &buyer_character_id,
            ),
            ctx(&mut scenario),
        );

        supply_terminal::exchange<Character>(
            &extension_config,
            &mut storage_unit,
            &buyer_character,
            &buyer_owner_cap,
            PRODUCT_TYPE_ID,
            ctx(&mut scenario),
        );

        buyer_character.return_owner_cap(buyer_owner_cap, receipt);
        test_scenario::return_shared(extension_config);
        test_scenario::return_shared(storage_unit);
        test_scenario::return_shared(buyer_character);
    };

    test_scenario::end(scenario);
}
