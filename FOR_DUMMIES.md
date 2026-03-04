# Wooper — For Dummies

A plain-English guide to understanding, running, and contributing to Wooper.
Start here if you are new to this repository.

---

## Table of Contents

- [What Is This?](#what-is-this)
- [Prerequisites](#prerequisites)
- [Project Status](#project-status)
- [Quick Start](#quick-start)
- [System Architecture](#system-architecture)
- [How It Works (The Big Picture)](#how-it-works-the-big-picture)
- [Move Modules Explained](#move-modules-explained)
- [Key Data Flows](#key-data-flows)
- [Building & Testing](#building--testing)
- [Frontend](#frontend)
- [Configuration Reference](#configuration-reference)
- [Key Commands](#key-commands)
- [Glossary](#glossary)
- [Important Files Reference](#important-files-reference)

---

## What Is This?

Wooper is a decentralized marketplace for buying and selling AI skills (prompts, agents, tool configs) on the Sui blockchain. Sellers upload encrypted skill files to Walrus (decentralized storage), list them on-chain with metadata and pricing, and earn SUI from sales. Buyers discover skills, purchase them on-chain, and decrypt the content client-side using Seal encryption.

The platform takes a configurable fee (in basis points) on every sale, enforced entirely by Move smart contracts. There is no backend server — the frontend talks directly to the Sui blockchain via gRPC and proxies Walrus uploads/downloads through Next.js API routes.

After following this guide you will be able to build and test the Move contracts, run the frontend dev server, and understand the end-to-end data flow from listing creation to purchase and decryption.

---

## Prerequisites

- **Sui CLI** — installed and on PATH (`sui` command available)
- **Node.js 20+** — for the frontend
- **npm** — ships with Node.js; used as the frontend package manager
- **A Sui wallet** — for testnet deployment and testing (e.g., Sui Wallet browser extension)

---

## Project Status

All 5 phases of the implementation plan are complete. Move contracts and frontend are fully implemented and deployed to testnet.

**What is complete:**
- All 5 Move modules fully implemented and deployed to testnet
- Comprehensive test suites for all modules (35+ tests)
- Full frontend: explore page, skill/package detail, purchase flow, seller dashboard, decrypt/download
- Walrus proxy API routes (upload, download, upload-quilt, download-quilt)
- Seal encryption/decryption integration
- DAppKit + SuiGrpcClient wallet integration
- Testnet deployment with live object IDs in `frontend/.env`

---

## Quick Start

```bash
# 1. Build the Move contracts
cd wooper && sui move build

# 2. Run all Move tests
sui move test

# 3. Start the frontend dev server
cd ../frontend && npm install && npm run dev
```

After step 2, all tests should pass. After step 3, the frontend is available at `http://localhost:3000`.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  FRONTEND (Next.js 16)                   │
│  Tailwind CSS 4 · @mysten/dapp-kit-react ^2.0           │
│  @mysten/sui ^2.5 · TanStack Query ^5                   │
│  shadcn/ui (Radix + lucide-react)                        │
│  Next.js API Routes (Walrus proxy)                        │
├─────────────────────────────────────────────────────────┤
│                  ON-CHAIN (Sui Move)                      │
│                                                          │
│  marketplace ─── MarketplaceConfig (shared, fee: 250bps) │
│               ── ListingsRegistry (shared, dynamic flds)  │
│               ── AdminCap (owned by deployer)             │
│               ── PackageVersion (shared, v1)              │
│                                                          │
│  skill ───────── SkillListing (shared, one per skill)     │
│               ── SellerCap (owned by seller)              │
│                                                          │
│  package_listing  PackageListing (shared, skill bundle)   │
│               ── PackageSellerCap (owned by seller)       │
│                                                          │
│  purchase ────── PurchaseReceipt (owned NFT, buyer)       │
│               ── SellerVault (shared, one per seller)     │
│                                                          │
│  seal_policy ─── seal_approve (entry fn for Seal keys)    │
├──────────────────────────────────────────────────────────┤
│  Walrus (encrypted blob storage)                         │
│  Seal Key Servers (testnet: 2 servers, threshold = 2)    │
└──────────────────────────────────────────────────────────┘
```

The system has no backend. The frontend reads the blockchain directly via gRPC and proxies Walrus through thin Next.js API routes. Encryption and decryption happen entirely in the buyer's browser using Seal.

---

## How It Works (The Big Picture)

### Selling a skill

1. Seller encrypts skill files in the browser using Seal
2. Encrypted bytes are uploaded to Walrus via a Next.js API route
3. Seller creates a `SkillListing` on-chain (includes Walrus blob ID and Seal key ID)
4. The listing is registered in the shared `ListingsRegistry` with its tags

### Buying a skill

1. Buyer browses the `ListingsRegistry` via gRPC (paginated dynamic field enumeration)
2. Buyer picks a skill and calls `purchase::purchase_skill` on-chain with SUI payment
3. Payment is split: platform fee (default 2.5%) goes to `fee_recipient`, the rest goes to the seller's `SellerVault`
4. Buyer receives a `PurchaseReceipt` NFT (proof of purchase)

### Decrypting a skill

1. Buyer fetches the encrypted blob from Walrus
2. Buyer creates a Seal `SessionKey` (one wallet signature popup)
3. Buyer builds a PTB calling `seal_approve` with their `PurchaseReceipt`
4. Seal key servers dry-run the PTB to verify the buyer owns a valid receipt
5. If valid, Seal returns decryption key shares; the buyer decrypts locally

---

## Move Modules Explained

### `marketplace.move` — The Platform Core

Creates four shared/owned objects at deploy time (`init`):
- **MarketplaceConfig** (shared) — holds `fee_bps` (default 250 = 2.5%) and `fee_recipient` (deployer address)
- **AdminCap** (owned) — transferred to the deployer; required to call `update_fee` and `update_fee_recipient`
- **PackageVersion** (shared) — version gating for Seal policy (prevents stale decryption after upgrades)
- **ListingsRegistry** (shared) — central index of all listings using dynamic fields (key = listing ID, value = tags)

The registry functions (`register_listing`, `unregister_listing`) are `public(package)` — only other modules in this package can call them.

### `skill.move` — Individual Skill Listings

Each skill becomes a shared `SkillListing` object. Listings are **immutable after creation** — there are no update functions. To change a listing, the seller delists it and creates a new one. Price must be greater than zero (in MIST).

`SellerCap` is an owned object that proves the seller created a specific listing. It is required to delist. The cap's `skill_listing_id` is checked against the listing's object ID.

### `package_listing.move` — Bundled Skills

A `PackageListing` groups multiple `SkillListing` IDs together with a discount (max 50% = 5000 bps). The price is pre-computed by the frontend at creation time. The package also stores its own `tags` vector for registry indexing.

### `purchase.move` — Purchases & Revenue

`PurchaseReceipt` is a `key`-only NFT (no `store` — cannot be placed in Kiosk). It records the buyer, seller, skills purchased, amount paid, and epoch.

`SellerVault` is a shared object that accumulates a seller's revenue. One vault per seller, created via `create_vault`. The purchase functions verify that the vault's seller matches the listing's seller (`EVaultSellerMismatch`). The seller calls `withdraw` to extract SUI. Any overpayment is returned to the buyer as change.

### `seal_policy.move` — Seal Access Control

`seal_approve` is an `entry` function that Seal key servers call via `dry_run_transaction_block`. It uses `vector::tabulate!` to extract the first 32 bytes of the Seal key ID as a skill listing ID, then checks the buyer's `PurchaseReceipt` covers that skill using `do_ref!`. If any check fails, the function aborts and Seal refuses to release decryption keys.

---

## Key Data Flows

### ListingsRegistry Discovery

The frontend discovers all listings by calling `ListDynamicFields` on the `ListingsRegistry` object via gRPC. Each dynamic field has:
- **Key**: the listing's object ID
- **Value**: `vector<String>` of tags

The frontend filters by tags client-side, then calls `multiGetObjects` to fetch full `SkillListing` details for display.

### Payment Splitting

When a buyer calls `purchase_skill`:
1. Asserts the listing is active and the vault belongs to the correct seller
2. Reads `fee_bps` from `MarketplaceConfig` and computes `platform_fee = price * fee_bps / 10000`
3. Splits the payment coin: sends `platform_fee` to `fee_recipient` via `transfer::public_transfer`
4. Deposits `seller_revenue` into the seller's `SellerVault` balance
5. Returns any change to the buyer (or destroys the zero coin)
6. Mints a `PurchaseReceipt` and transfers it to the buyer

### Seal Key Identity Format

```
Full identity = [package_id (32 bytes)] ++ [id parameter]
id parameter   = [skill_listing_id (32 bytes)] ++ [random_nonce (5 bytes)]
```

Seal automatically prepends the `package_id`. The `seal_approve` function only receives the `id parameter` portion and extracts the first 32 bytes as the skill listing ID.

---

## Building & Testing

### Move Contracts

```bash
cd wooper

# Build
sui move build

# Run all tests
sui move test

# Run a specific test by name
sui move test --filter creates_all_objects_on_init

# Run with coverage
sui move test --coverage

# Publish to testnet (after all object IDs are updated in .env)
sui client publish --gas-budget 100000000
```

The test suite covers:
- **marketplace_tests** — init creates all 4 objects, admin fee updates, fee cap at 10000, registry register/unregister, duplicate and nonexistent listing errors
- **skill_tests** — create produces listing + seller cap, zero price rejected, delist deactivates + unregisters, wrong seller cap rejected, double-delist rejected
- **purchase_tests** — purchase flow with payment splitting, vault creation, package purchases
- **seal_policy_tests** — seal_approve access control validation
- **package_listing_tests** — bundle creation, discount limits, delist flow

Test addresses used across all test modules (defined in `test_utils.move`):
- `ADMIN` = `@0xAD`
- `USER1` = `@0x01`
- `USER2` = `@0x02`

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Lint
npm run lint
```

---

## Frontend

The frontend is a Next.js 16 project (App Router) with Tailwind CSS 4 and shadcn/ui components. It uses `@mysten/dapp-kit-react` for wallet integration and `@mysten/sui` for blockchain communication.

### Installed Dependencies

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.1.6 | React framework (App Router) |
| `react` / `react-dom` | 19.2.3 | UI library |
| `@mysten/dapp-kit-react` | ^2.0.0 | Sui wallet integration |
| `@mysten/dapp-kit-core` | ^1.1.3 | Core wallet primitives |
| `@mysten/sui` | ^2.5.1 | Sui SDK (gRPC client, transactions, BCS) |
| `@tanstack/react-query` | ^5.90.21 | Async state management |
| `radix-ui` | ^1.4.3 | Headless UI primitives |
| `lucide-react` | ^0.577.0 | Icon library |
| `tailwindcss` | ^4 | Utility-first CSS |
| `shadcn` | ^3.8.5 (dev) | Component generator |

### UI Components (shadcn/ui)

Pre-installed in `src/components/ui/`: `button`, `card`, `input`, `badge`, `skeleton`, `separator`, `sheet`, `select`, `dropdown-menu`, `scroll-area`, `tooltip`, `avatar`.

### Current State

The layout uses `ClientLayout` → `ClientShell` (dynamic import with `ssr: false`) wrapping `DAppKitProvider` + `QueryClientProvider`. Path alias `@/*` maps to `./src/*`.

---

## Configuration Reference

### Environment Variables (`frontend/.env.example`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_MARKETPLACE_PACKAGE_ID` | Yes | `0x0` | Published Move package ID (set after deployment) |
| `NEXT_PUBLIC_MARKETPLACE_CONFIG_ID` | Yes | `0x0` | MarketplaceConfig shared object ID |
| `NEXT_PUBLIC_PACKAGE_VERSION_ID` | Yes | `0x0` | PackageVersion shared object ID |
| `NEXT_PUBLIC_LISTINGS_REGISTRY_ID` | Yes | `0x0` | ListingsRegistry shared object ID |
| `NEXT_PUBLIC_SUI_NETWORK` | Yes | `testnet` | Sui network (`testnet` or `mainnet`) |
| `WALRUS_PUBLISHER_URL` | Yes | `https://publisher.walrus-testnet.walrus.space` | Walrus publisher endpoint (server-side only) |
| `WALRUS_AGGREGATOR_URL` | Yes | `https://aggregator.walrus-testnet.walrus.space` | Walrus aggregator endpoint (server-side only) |

The four `NEXT_PUBLIC_*_ID` variables are placeholders (`0x0`) until the Move package is published to testnet. After publishing, update them with the actual object IDs from the publish transaction output.

---

## Key Commands

**`cd wooper && sui move build`** — Compile the Move package. Run this after any contract changes to verify they compile.

**`cd wooper && sui move test`** — Run all Move unit tests. The test suite has tests across 5 test modules covering happy paths and error cases.

**`cd frontend && npm run dev`** — Start the Next.js development server at `http://localhost:3000`.

**`cd frontend && npm run build`** — Production build. Run this to verify the frontend compiles without errors.

---

## Glossary

- **Basis points (bps)** — One hundredth of a percent. 250 bps = 2.5%. Used for platform fees and package discounts.
- **MIST** — The smallest unit of SUI. 1 SUI = 1,000,000,000 MIST. All prices are stored in MIST.
- **Seal** — Mysten Labs' threshold encryption protocol for Sui. Content is encrypted client-side; key servers release decryption shares only if an on-chain policy function (`seal_approve`) succeeds.
- **Walrus** — Mysten Labs' decentralized blob storage. Stores encrypted skill file content off-chain. Blobs expire and must be renewed.
- **Quilt** — A Walrus construct for bundling multiple files into a single addressable unit.
- **PTB (Programmable Transaction Block)** — A Sui transaction that can compose multiple Move calls in a single atomic execution.
- **Dynamic fields** — Sui's key-value storage attached to an object's UID. The `ListingsRegistry` uses dynamic fields to index all listings.
- **Shared object** — A Sui object accessible by any transaction (not owned by a single address). Used for marketplace config, registry, listings, and vaults.
- **Owned object** — A Sui object owned by a specific address. Only the owner can use it in transactions. Used for capabilities and purchase receipts.
- **Hot potato** — A Move pattern where a struct without `drop` ability must be explicitly consumed, enforcing function call sequences.
- **SessionKey** — A Seal concept: a temporary key signed by the wallet that avoids repeated wallet popups during a decryption session.
- **gRPC** — The RPC protocol used to communicate with Sui full nodes. This project primarily uses `SuiGrpcClient`, with JSON-RPC fallback for vault lookup.
- **shadcn/ui** — A component library that generates source code into your project (not an npm dependency at runtime). Components live in `src/components/ui/`.

---

## Important Files Reference

| File | Description |
|---|---|
| `CLAUDE.md` | Project conventions, architecture summary, key decisions, pointers to detailed docs |
| `docs/architecture.md` | Seal flows, security model, data lifecycles, edge cases |
| `docs/move-api-reference.md` | Module summaries, structs, error codes, events |
| `docs/frontend-guide.md` | Hooks inventory, SSR patterns, Walrus routes, mock data |
| `wooper/Move.toml` | Move package manifest (edition 2024) |
| `wooper/sources/marketplace.move` | Platform config, admin cap, version gating, listings registry (dynamic fields) |
| `wooper/sources/skill.move` | Individual skill listing struct, two-step create/finalize, delist, seller cap |
| `wooper/sources/package_listing.move` | Bundled skill packages with discount pricing |
| `wooper/sources/purchase.move` | Purchase receipts (NFT), seller vaults, payment splitting, vault withdrawals |
| `wooper/sources/seal_policy.move` | Seal access control entry function for decryption gating |
| `wooper/sources/test_utils.move` | Shared test addresses (ADMIN, USER1, USER2) and scenario helpers |
| `wooper/sources/*_tests.move` | Test suites for each module (5 files) |
| `frontend/package.json` | Frontend dependencies and scripts |
| `frontend/.env` | Environment variables with deployed Sui object IDs and Walrus endpoints |
| `frontend/src/app/layout.tsx` | Root layout (Geist fonts, imports ClientLayout) |
| `frontend/src/app/client-layout.tsx` | Dynamic import of ClientShell with ssr: false |
| `frontend/src/hooks/` | 24 hooks for data fetching and transaction building |
| `frontend/src/lib/constants.ts` | Package IDs, object IDs, Seal config, type strings |
| `frontend/src/components/ui/` | shadcn/ui components (button, card, input, badge, etc.) |
| `.gitignore` | Ignores `wooper/build` |
