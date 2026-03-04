module fast_and_furious::purchase;

// === Errors ===
const EListingNotActive: u64 = 400;
const EInsufficientPayment: u64 = 401;
const ENotVaultOwner: u64 = 402;
const EInsufficientVaultBalance: u64 = 403;
const EWrongVersion: u64 = 404;

// === Structs ===

/// Owned NFT — proof of purchase. Holder can decrypt the skill content via Seal.
/// Has `key` only (no `store`) — cannot be placed in Kiosk or other objects.
/// Can be transferred via `transfer::transfer`.
public struct PurchaseReceipt has key {
    id: UID,
    buyer: address,
    skill_ids: vector<ID>,      // which skills this receipt grants access to
    seller: address,
    amount_paid: u64,
    purchased_at_epoch: u64,
}

/// Shared object — accumulates seller revenue from sales.
/// One per seller, created on first sale.
public struct SellerVault has key {
    id: UID,
    seller: address,
    balance: Balance<SUI>,
}

// === Events ===

public struct SkillPurchased has copy, drop {
    receipt_id: ID,
    buyer: address,
    skill_ids: vector<ID>,
    seller: address,
    total_paid: u64,
    platform_fee: u64,
    seller_revenue: u64,
}

public struct VaultWithdrawal has copy, drop {
    vault_id: ID,
    seller: address,
    amount: u64,
}

// === Public Functions ===

/// Purchase a single skill. Splits payment: platform fee → fee_recipient, rest → SellerVault.
/// Mints a PurchaseReceipt NFT and transfers to buyer.
public fun purchase_skill(
    config: &MarketplaceConfig,
    listing: &SkillListing,
    vault: &mut SellerVault,
    payment: Coin<SUI>,
    ctx: &mut TxContext,
);

/// Purchase a package (bundle). Computes discounted price, splits payment.
/// Mints a PurchaseReceipt with all skill_ids from the package.
public fun purchase_package(
    config: &MarketplaceConfig,
    package: &PackageListing,
    skills: &vector<SkillListing>,  // to compute total price for discount
    vault: &mut SellerVault,
    payment: Coin<SUI>,
    ctx: &mut TxContext,
);

/// Seller withdraws from their vault.
public fun withdraw(
    vault: &mut SellerVault,
    amount: u64,
    ctx: &mut TxContext,
): Coin<SUI>;

/// Create a SellerVault (called once per seller, on first listing creation).
public fun create_vault(ctx: &mut TxContext);

// === View Functions ===
public fun receipt_skill_ids(receipt: &PurchaseReceipt): vector<ID>;
public fun vault_balance(vault: &SellerVault): u64;