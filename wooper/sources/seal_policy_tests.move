#[test_only]
module wooper::seal_policy_tests;

use std::unit_test::destroy;
use wooper::marketplace;
use wooper::purchase;
use wooper::seal_policy;
use wooper::test_utils;

/// Build a 37-byte Seal key id: [skill_listing_id (32 bytes)] ++ [nonce (5 bytes)]
fun build_seal_id(skill_listing_id: ID): vector<u8> {
    let mut id_bytes = object::id_to_bytes(&skill_listing_id);
    // Append 5-byte nonce
    id_bytes.push_back(0xAA);
    id_bytes.push_back(0xBB);
    id_bytes.push_back(0xCC);
    id_bytes.push_back(0xDD);
    id_bytes.push_back(0xEE);
    id_bytes
}

#[test]
fun seal_approve_valid_receipt() {
    let mut scenario = test_utils::begin();

    let pkg_version = marketplace::create_package_version_for_testing(scenario.ctx());
    let skill_id = object::id_from_address(@0x5A);
    let receipt = purchase::create_receipt_for_testing(
        test_utils::user1(),
        vector[skill_id],
        test_utils::user2(),
        1_000_000_000,
        scenario.ctx(),
    );

    let seal_id = build_seal_id(skill_id);
    seal_policy::seal_approve(seal_id, &pkg_version, &receipt);

    destroy(receipt);
    destroy(pkg_version);
    scenario.end();
}

#[test]
fun seal_approve_multiple_skills_in_receipt() {
    let mut scenario = test_utils::begin();

    let pkg_version = marketplace::create_package_version_for_testing(scenario.ctx());
    let skill_a = object::id_from_address(@0x0A);
    let skill_b = object::id_from_address(@0x0B);
    let skill_c = object::id_from_address(@0x0C);

    // Receipt covers three skills
    let receipt = purchase::create_receipt_for_testing(
        test_utils::user1(),
        vector[skill_a, skill_b, skill_c],
        test_utils::user2(),
        3_000_000_000,
        scenario.ctx(),
    );

    // Approve for skill_b (middle of the list)
    let seal_id = build_seal_id(skill_b);
    seal_policy::seal_approve(seal_id, &pkg_version, &receipt);

    destroy(receipt);
    destroy(pkg_version);
    scenario.end();
}

#[test, expected_failure(abort_code = 500, location = wooper::seal_policy)]
fun seal_approve_no_matching_skill_fails() {
    let mut scenario = test_utils::begin();

    let pkg_version = marketplace::create_package_version_for_testing(scenario.ctx());
    let owned_skill = object::id_from_address(@0x0A);
    let requested_skill = object::id_from_address(@0x0B);

    let receipt = purchase::create_receipt_for_testing(
        test_utils::user1(),
        vector[owned_skill], // only has skill 0x0A
        test_utils::user2(),
        1_000_000_000,
        scenario.ctx(),
    );

    // Try to approve for skill 0x0B — not in receipt
    let seal_id = build_seal_id(requested_skill);
    seal_policy::seal_approve(seal_id, &pkg_version, &receipt);
    abort 0
}

#[test, expected_failure(abort_code = 502, location = wooper::seal_policy)]
fun seal_approve_invalid_key_id_fails() {
    let mut scenario = test_utils::begin();

    let pkg_version = marketplace::create_package_version_for_testing(scenario.ctx());
    let skill_id = object::id_from_address(@0x0A);
    let receipt = purchase::create_receipt_for_testing(
        test_utils::user1(),
        vector[skill_id],
        test_utils::user2(),
        1_000_000_000,
        scenario.ctx(),
    );

    // Too-short key id (only 10 bytes, need >= 32)
    let short_id = vector[0u8, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    seal_policy::seal_approve(short_id, &pkg_version, &receipt);
    abort 0
}

#[test, expected_failure(abort_code = 501, location = wooper::seal_policy)]
fun seal_approve_version_mismatch_fails() {
    let mut scenario = test_utils::begin();

    // Create a PackageVersion with wrong version (0 instead of 1)
    let pkg_version = marketplace::create_package_version_with_version_for_testing(
        0, scenario.ctx(),
    );
    let skill_id = object::id_from_address(@0x0A);
    let receipt = purchase::create_receipt_for_testing(
        test_utils::user1(),
        vector[skill_id],
        test_utils::user2(),
        1_000_000_000,
        scenario.ctx(),
    );

    let seal_id = build_seal_id(skill_id);
    seal_policy::seal_approve(seal_id, &pkg_version, &receipt);
    abort 0
}
