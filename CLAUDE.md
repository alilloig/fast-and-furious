# Wooper — AI Skills Marketplace on Sui

A decentralized marketplace for buying and selling AI skills/agents on Sui, with Seal-encrypted content stored on Walrus.

## Project Overview

**Sellers** upload encrypted AI skill files to Walrus, list on-chain with metadata and pricing, earn SUI.
**Buyers** discover skills via on-chain ListingsRegistry, purchase on-chain, decrypt client-side with Seal.
**Platform** takes a configurable fee (basis points) on each sale, enforced by Move contracts.

**Core principles:** Immutable listings (create + delete only, no edits) · Client-side decryption (no server sees plaintext) · On-chain discovery (ListingsRegistry + gRPC) · SUI-only payments · No backend (Next.js API routes proxy Walrus only)

**Non-goals:** Custom tokens · On-chain reviews · IPFS/Arweave · Mobile-native apps

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js 16)                     │
│  Tailwind CSS 4 · @mysten/dapp-kit-react v2 · shadcn/ui      │
│  @mysten/sui v2 (SuiGrpcClient) · TanStack Query v5          │
│  @mysten/seal · Next.js API Routes (Walrus proxy)             │
├──────────────────────────────────────────────────────────────┤
│                     ON-CHAIN (Sui Move)                       │
│  marketplace · skill · package_listing · purchase · seal_policy│
│  ListingsRegistry (shared, dynamic fields)                    │
│  Seal Key Servers (testnet) · Walrus Blob/Quilt Storage       │
└──────────────────────────────────────────────────────────────┘
```

Seller encrypts → uploads to Walrus → creates listing on-chain (two-step: create then finalize). Buyer discovers via ListingsRegistry → purchases → receives PurchaseReceipt NFT → decrypts locally via Seal.

---

## Project Structure

```
wooper/                          # Sui Move package
  sources/
    marketplace.move             # Platform config, admin, ListingsRegistry
    skill.move                   # Individual skill listings (create/finalize/delist)
    package_listing.move         # Bundled skill packages with discounts
    purchase.move                # PurchaseReceipt NFT, SellerVault, payment splitting
    seal_policy.move             # Seal access control (seal_approve entry fn)
    test_utils.move              # Shared test addresses and helpers
    *_tests.move                 # Test suites for each module

frontend/                        # Next.js 16 (App Router)
  src/app/                       # Pages: explore, skill/[id], package/[id], seller/*, purchases
  src/app/api/walrus/            # 4 Walrus proxy routes (upload, download, upload-quilt, download-quilt)
  src/hooks/                     # 24 hooks (data fetching + transaction building)
  src/lib/                       # Constants, types, parsers, mock data, dapp-kit setup
  src/components/                # UI components (shadcn/ui + custom)
```

---

## Technology Stack

- **Smart contracts:** Sui Move (Edition 2024), package `wooper`
- **Encryption:** Seal (`@mysten/seal`) with testnet key servers (threshold 2)
- **Storage:** Walrus (single file → blob, multi-file → quilt)
- **Frontend:** Next.js 16 (App Router), Tailwind CSS 4, shadcn/ui (Slate theme)
- **Wallet:** `@mysten/dapp-kit-react` v2
- **Sui client:** `SuiGrpcClient` from `@mysten/sui/grpc` (primary), JSON-RPC fallback for vault lookup
- **State:** TanStack Query v5, BCS parsing via `@mysten/sui/bcs`

---

## Key Architectural Decisions

1. **Two-step create/finalize** — `skill::create()` produces listing ID (needed for Seal key identity) → seller encrypts/uploads → `skill::finalize()` sets Walrus/Seal data and activates. Solves chicken-and-egg problem.
2. **Explicit package price** — `PackageListing` stores `price: u64` directly (pre-computed by frontend) instead of referencing individual skill prices at purchase time.
3. **One vault per seller** — `SellerVault` is shared, one per seller address. `EVaultSellerMismatch` (405) prevents cross-seller deposits.
4. **Seal key identity** — `[skill_listing_id (32 bytes)] ++ [random_nonce (5 bytes)]`. Package ID prepended automatically by Seal.
5. **Blob vs quilt** — Single file → Walrus blob (`walrus_blob_id`). Multi-file → Walrus quilt (`walrus_quilt_id`). SkillListing stores both fields.
6. **SSR workaround** — `@mysten/sui/grpc` accesses `window` at import. Solution: `client-layout.tsx` uses `next/dynamic` with `ssr: false` to import `ClientShell`.

---

## Coding Conventions

### Move (2024 Edition)

- Module syntax: `module wooper::name;` (no curly braces)
- Method syntax: `id.delete()`, `ctx.sender()`, `listing.price()`
- String literals: `b"text".to_string()`
- Errors: `EPascalCase` (e.g., `ENotSeller`), constants: `ALL_CAPS` (e.g., `MAX_FEE_BPS`)
- Capabilities: `*Cap` suffix. Events: past tense (`SkillListed`, `VaultWithdrawn`)
- Getters: named after field, no `get_` prefix
- Test functions: no `test_` prefix (redundant with `#[test]`)
- Test attributes: `#[test, expected_failure(abort_code = N, location = package::module)]` — `location` is required
- Assertions: `assert_eq!(a, b)` — must import `use std::unit_test::assert_eq;`
- Test cleanup: `use std::unit_test::destroy;` (NOT `sui::test_utils::destroy`, which is deprecated)
- Test addresses: valid hex only (A-F, not arbitrary letters)

### TypeScript (Frontend)

- Strict mode, no `any` types
- gRPC primary: `SuiGrpcClient` from `@mysten/sui/grpc`
- `@mysten/dapp-kit-react` (not `@mysten/dapp-kit`)
- BCS parsing for gRPC content via `@mysten/sui/bcs`
- Never import from `@mysten/sui.js` (deprecated)

### Git & Testing

- Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`
- Move: `cd wooper && sui move build && sui move test`
- Frontend: `cd frontend && npm run build`

---

## Deployed Object IDs (Testnet)

Source of truth: `frontend/.env` and `wooper/Published.toml`

```
Package:           0xc1486670f81da6f57615f136cc1834b6a834248489ffeda4471d9841f3b5dab2
MarketplaceConfig: 0xac695c12a22ff47aee4ca805d24808c12ecae241791c714ae78718c9ab6dc7a0
PackageVersion:    0x8054603214952289fd107aea1785c8989e7337cc1ea23dd41c49abbf620da23a
ListingsRegistry:  0x1dcdf97a5542a2a4465e0bd1e019c7f132c9625ed433cd01dcede566819180bf
```

Seal key servers: see `frontend/src/lib/constants.ts` (2 servers, threshold 2).

---

## Detailed Documentation

- **[docs/architecture.md](docs/architecture.md)** — Seal flows, security model, data lifecycles, edge cases
- **[docs/move-api-reference.md](docs/move-api-reference.md)** — Module summaries, structs, error codes, events
- **[docs/frontend-guide.md](docs/frontend-guide.md)** — Hooks inventory, SSR patterns, Walrus routes, mock data
- **[FOR_DUMMIES.md](FOR_DUMMIES.md)** — Plain-English onboarding guide
