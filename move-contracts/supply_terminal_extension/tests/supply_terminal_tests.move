#[test_only]
module supply_terminal_extension::supply_terminal_tests;

use sui::test_scenario::{Self, next_tx, ctx};

use supply_terminal_extension::config::{
    Self,
    AdminCap,
    ExtensionConfig,
};

use supply_terminal_extension::supply_terminal;

use supply_terminal_extension::supply_terminal::{
    ListingConfigKey,
    ListingConfig,
};

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
            true, 84210, 1, 77800, 10,
        );
        let key = supply_terminal::new_listing_config_key();
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

        let key = supply_terminal::new_listing_config_key();
        let listing = supply_terminal::new_listing_config(
            true, 84210, 1, 77800, 10,
        );
        config::add_rule(&mut config, &admin_cap, key, listing);

        let new_listing = supply_terminal::new_listing_config(
            false, 99999, 5, 11111, 20,
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

        let key = supply_terminal::new_listing_config_key();
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

        assert!(!supply_terminal::listing_enabled(&config), 0);

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
        supply_terminal::product_type_id(&config);

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
            true, 84210, 1, 77800, 10,
        );
        let key = supply_terminal::new_listing_config_key();
        config::add_rule(&mut config, &admin_cap, key, listing);

        assert!(supply_terminal::listing_enabled(&config), 0);
        assert!(supply_terminal::product_type_id(&config) == 84210, 1);
        assert!(supply_terminal::product_quantity(&config) == 1, 2);
        assert!(supply_terminal::payment_type_id(&config) == 77800, 3);
        assert!(supply_terminal::payment_quantity(&config) == 10, 4);

        test_scenario::return_to_sender(&scenario, admin_cap);
        test_scenario::return_shared(config);
    };

    test_scenario::end(scenario);
}
