# Architecture & Design

Detailed architecture, Seal integration, data flows, and security model for the Wooper marketplace.

---

## Seal Integration

### Encryption Flow (Seller Uploads)

The seller-side flow uses a **two-step listing creation** pattern to solve the chicken-and-egg problem: the Seal key identity requires the listing's object ID, which is only known after the `create()` transaction.

```
Seller (browser)                   Sui                    Walrus
      |                              |                       |
      |  1. skill::create(metadata)  |                       |
      |  ─────────────────────────►  |                       |
      |  ◄── listing_id (shared obj) |                       |
      |                              |                       |
      |  2. Compute Seal identity:   |                       |
      |     id = listing_id_bytes ++ |                       |
      |          random_nonce(5)     |                       |
      |                              |                       |
      |  3. sealClient.encrypt({     |                       |
      |       threshold: 2,          |                       |
      |       packageId, id,         |                       |
      |       data: plaintext })     |                       |
      |  → encryptedBytes            |                       |
      |                              |                       |
      |  4. POST /api/walrus/upload  |                       |
      |     (or upload-quilt for     |                       |
      |      multi-file)             |                       |
      |  ───────────────────────────────────────────────────► |
      |  ◄── blobId (or quiltId)     |                       |
      |                              |                       |
      |  5. skill::finalize(         |                       |
      |       walrus_blob_id,        |                       |
      |       seal_key_id, ...)      |                       |
      |  ─────────────────────────►  |                       |
      |  ◄── listing activated       |                       |
```

### Decryption Flow (Buyer Downloads)

```
Buyer (browser)                   Seal Key Servers        Sui Full Node
      |                              |                       |
      |  1. Fetch encrypted blob     |                       |
      |     from Walrus via          |                       |
      |     /api/walrus/download     |                       |
      |     (or download-quilt)      |                       |
      |                              |                       |
      |  2. Create/restore SessionKey|                       |
      |     (wallet popup once)      |                       |
      |                              |                       |
      |  3. Parse EncryptedObject    |                       |
      |     → extract id             |                       |
      |                              |                       |
      |  4. Build PTB:               |                       |
      |     seal_policy::seal_approve|                       |
      |     (id, pkg_version,        |                       |
      |      receipt)                |                       |
      |     build({ onlyTransaction- |                       |
      |       Kind: true })          |                       |
      |                              |                       |
      |  5. sealClient.decrypt()     |                       |
      |  ───────────────────────────►|                       |
      |                              |  6. dry_run           |
      |                              |     seal_approve      |
      |                              |  ────────────────────►|
      |                              |  ◄── success/abort    |
      |  ◄── decryption key shares   |                       |
      |                              |                       |
      |  7. Local decryption         |                       |
      |     → plaintext files        |                       |
```

### Key Identity Format

```
Full Seal key identity = [package_id (32 bytes)] ++ [id parameter]
id parameter            = [skill_listing_id (32 bytes)] ++ [random_nonce (5 bytes)]
```

- `package_id` is prepended automatically by Seal — NOT passed to `seal_approve`
- `seal_approve` receives only `[skill_listing_id ++ nonce]` and extracts the first 32 bytes as the skill listing ID
- Each skill gets a unique key identity; prefix check ensures receipts are skill-specific

### SessionKey Management

SessionKeys avoid repeated wallet popups during decryption. Implementation in `frontend/src/hooks/use-session-key.ts`. Key points:
- Created via `SessionKey.create()` with TTL (10 minutes)
- Requires one wallet signature (`signPersonalMessage`)
- Persisted to IndexedDB via `idb-keyval` (`set`/`get`)
- Restored via `SessionKey.import()`

---

## Data Lifecycle Flows

### Create Skill (Two-Step)

1. Seller connects wallet, fills listing form (title, description, price, category, tags, files)
2. Browser calls `skill::create()` on-chain → gets listing ID back
3. Browser computes Seal key identity from listing ID + random nonce
4. Browser encrypts files with Seal → uploads to Walrus (single file = blob, multi-file = quilt)
5. Browser calls `skill::finalize()` with Walrus blob/quilt ID and Seal key ID → listing activated and registered in ListingsRegistry

### Browse & Search

1. Buyer visits `/explore`
2. Frontend calls `ListDynamicFields` on ListingsRegistry via gRPC (paginated)
3. Client-side filtering by tags/category
4. `multiGetObjects` fetches full SkillListing objects for filtered results
5. Results rendered in filterable grid

### Purchase

1. Buyer views `/skill/[id]` → fetches SkillListing via gRPC
2. Clicks "Purchase" → browser builds PTB with `purchase::purchase_skill()`
3. Payment split on-chain: platform fee → fee_recipient, rest → SellerVault
4. PurchaseReceipt NFT transferred to buyer
5. Redirect to `/purchases`

### Decrypt

1. Buyer visits `/purchases` → fetches owned PurchaseReceipts via gRPC
2. Clicks "Download" on a skill
3. Fetches encrypted blob from Walrus via API route
4. Creates/restores SessionKey (wallet popup if new session)
5. Builds PTB with `seal_approve` → `sealClient.decrypt()`
6. Seal key servers dry-run PTB, verify receipt ownership
7. Decrypted plaintext delivered to browser → file download

### Delist

1. Seller visits dashboard → clicks "Delist"
2. Browser builds PTB: `skill::delist(listing, seller_cap, registry)`
3. `is_active` set to false, listing removed from ListingsRegistry
4. **Existing PurchaseReceipts remain valid** — buyers can still decrypt

---

## Security Model

### Attack Vectors & Mitigations

| Attack | Mitigation |
|--------|-----------|
| Fake PurchaseReceipt | MoveVM owned-object enforcement: only the actual owner can include it in a PTB |
| Key reuse across skills | Each skill gets unique Seal key identity (listing ID + nonce); prefix check in `seal_approve` |
| Package upgrade changes policy | PackageVersion singleton with version check in `seal_approve` |
| Price manipulation | Price read from shared SkillListing on-chain; Move verifies `coin.value() >= listing.price` |
| Platform fee bypass | Fee split computed in Move from `MarketplaceConfig.fee_bps`; cannot be bypassed |
| Seller impersonation on delist | `delist` requires SellerCap (owned object) |
| Cross-seller vault deposit | `EVaultSellerMismatch` (405) asserts vault.seller == listing.seller |
| Replay attacks on Seal | SessionKey has TTL; key servers validate session timestamp |
| Content redistribution | Out of scope for v1 (fundamental DRM limitation) |
| ListingsRegistry contention | Shared object hotspot; acceptable for v1, can shard later |

### Edge Cases

| Scenario | Handling |
|----------|---------|
| Walrus blob expires before renewal | Listing inaccessible; PurchaseReceipts valid but decryption fails (no blob). Seller re-uploads + new listing |
| Buyer purchases delisted skill | `purchase_skill` checks `is_active == true`; aborts if inactive |
| Package with delisted skill | Package purchase uses package's own `is_active` check; individual skill decrypt still works for existing receipts |
| Multiple purchases of same skill | Each creates a new PurchaseReceipt; no deduplication needed |
| Skill not yet finalized | Cannot purchase — `is_active` is false until `finalize()` is called |

---

## Open Questions & Dependencies

| # | Question | Status |
|---|----------|--------|
| 1 | Walrus quilt API — JS SDK for quilts? | Implemented via Next.js API routes (upload-quilt/download-quilt) |
| 2 | Walrus storage pricing on mainnet | TBD at mainnet launch |
| 3 | Seal key server object IDs for mainnet | Obtain from Mysten |
| 4 | Should PurchaseReceipt have `store`? | Decided: `key` only for v1 |
| 5 | ListingsRegistry gas costs at scale | Monitor during testnet |
| 6 | ListDynamicFields pagination limits | Test with realistic data volumes |
| 7 | Package purchase — verify all skills active? | Decided: package has own `is_active`; uses explicit price |
| 8 | SellerVault — one per seller or per listing? | Decided: one per seller |
