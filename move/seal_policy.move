module fast_and_furious::seal_policy;

// === Errors ===
const ENoAccess: u64 = 500;
const EWrongVersion: u64 = 501;
const EInvalidKeyId: u64 = 502;

// === Functions ===

/// Seal key servers call this via dry_run_transaction_block.
///
/// Access control logic:
/// 1. MoveVM enforces that only the PurchaseReceipt owner can include it in the PTB
///    (owned object enforcement — no explicit sender check needed).
/// 2. Verify that `id` starts with a SkillListing ID that appears in
///    `receipt.skill_ids` (namespace prefix check).
/// 3. Verify PackageVersion matches (upgrade protection).
///
/// Parameters:
/// - id: The Seal key identity (without package ID prefix).
///        Format: [skill_listing_id_bytes (32)] ++ [random_nonce (5)]
/// - pkg_version: Shared PackageVersion object for version gating.
/// - receipt: The buyer's PurchaseReceipt (owned object — MoveVM enforces ownership).
///
/// Aborts if access is denied.
entry fun seal_approve(
    id: vector<u8>,
    pkg_version: &PackageVersion,
    receipt: &PurchaseReceipt,
) {
    // 1. Version check
    assert!(pkg_version.version == VERSION, EWrongVersion);

    // 2. Extract the skill listing ID prefix from `id` (first 32 bytes)
    assert!(id.length() >= 32, EInvalidKeyId);
    let mut prefix = vector::empty<u8>();
    let mut i = 0;
    while (i < 32) {
        prefix.push_back(id[i]);
        i = i + 1;
    };
    let requested_skill_id = object::id_from_bytes(prefix);

    // 3. Check that the receipt covers this skill
    let skill_ids = receipt.skill_ids;
    let mut found = false;
    let mut j = 0;
    while (j < skill_ids.length()) {
        if (skill_ids[j] == requested_skill_id) {
            found = true;
            break
        };
        j = j + 1;
    };
    assert!(found, ENoAccess);
}