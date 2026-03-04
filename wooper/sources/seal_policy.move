/// Module: seal_policy
/// Seal access control — key servers call `seal_approve` via dry_run to verify decryption access.
module wooper::seal_policy;

// === Imports ===
use wooper::marketplace::PackageVersion;
use wooper::purchase::PurchaseReceipt;

// === Errors ===
const ENoAccess: u64 = 500;
const EWrongVersion: u64 = 501;
const EInvalidKeyId: u64 = 502;

// === Constants ===
const VERSION: u64 = 1;

// === Functions ===

/// Seal key servers call this via dry_run_transaction_block.
///
/// Access control logic:
/// 1. MoveVM enforces PurchaseReceipt ownership (owned object in PTB).
/// 2. Verify `id` prefix matches a SkillListing ID in the receipt.
/// 3. Verify PackageVersion matches (upgrade protection).
///
/// `id` format: [skill_listing_id_bytes (32)] ++ [random_nonce (5)]
entry fun seal_approve(
    id: vector<u8>,
    pkg_version: &PackageVersion,
    receipt: &PurchaseReceipt,
) {
    // 1. Version check
    assert!(pkg_version.pkg_version() == VERSION, EWrongVersion);

    // 2. Extract the skill listing ID prefix from `id` (first 32 bytes)
    assert!(id.length() >= 32, EInvalidKeyId);
    let prefix = vector::tabulate!(32, |i| id[i]);
    let requested_skill_id = object::id_from_bytes(prefix);

    // 3. Check that the receipt covers this skill
    let skill_ids = receipt.skill_ids();
    let mut found = false;
    skill_ids.do_ref!(|sid| if (*sid == requested_skill_id) { found = true });
    assert!(found, ENoAccess);
}
