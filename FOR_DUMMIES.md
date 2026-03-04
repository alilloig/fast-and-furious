# Fast & Furious — For Dummies

A plain-English guide to understanding, running, and contributing to Fast & Furious.
Start here if you are new to this repository.

---

## Table of Contents

- [What Is This?](#what-is-this)
- [Prerequisites](#prerequisites)
- [Project Status](#project-status)
- [System Architecture](#system-architecture)
- [How It Works (The Big Picture)](#how-it-works-the-big-picture)
- [Move Modules Explained](#move-modules-explained)
- [Key Data Flows](#key-data-flows)
- [Building & Testing](#building--testing)
- [Glossary](#glossary)
- [Important Files Reference](#important-files-reference)

---

## What Is This?

Fast & Furious is a decentralized marketplace for buying and selling AI skills (prompts, agents, tool configs) on the Sui blockchain. Sellers upload encrypted skill files to Walrus (decentralized storage), list them on-chain with metadata and pricing, and earn SUI from sales. Buyers discover skills, purchase them on-chain, and decrypt the content client-side using Seal encryption.

The platform takes a configurable fee (in basis points) on every sale, enforced entirely by Move smart contracts. There is no backend server — the frontend talks directly to the Sui blockchain via gRPC and proxies Walrus uploads/downloads through Next.js API routes.

The project is currently in **Phase 1** of a 5-phase implementation plan. The Move smart contract drafts exist, but function bodies are mostly stubs. No frontend code exists yet.

---

## Prerequisites

- **Sui CLI** — installed and on PATH (`sui` command available)
- **Sui Move Edition 2024** — the contracts use 2024 edition syntax
- **Node.js 18+** — for the frontend (Phase 3+)
- **pnpm** — package manager for the frontend (Phase 3+)
- **A Sui wallet** — for testnet deployment and testing

---

## Project Status

The repository contains **5 Move module drafts** in `move/`. These are design documents with struct definitions, function signatures, and partial implementations. Most function bodies are stubs (declared but empty) or contain only the access-control logic.

**What exists:**
- `marketplace.move` — struct definitions + working `register_listing` / `unregister_listing` functions
- `skill.move` — struct definitions + function signatures (stubs)
- `package_listing.move` — struct definitions + function signatures (stubs)
- `purchase.move` — struct definitions + function signatures (stubs)
- `seal_policy.move` — fully implemented `seal_approve` entry function

**What does not exist yet:**
- `Move.toml` — needed before `sui move build` will work
- Frontend (`frontend/` directory)
- Tests
- Deployment scripts
- `.env.example` or environment configuration

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 FRONTEND (not yet built)                 │
│  Next.js 14+ · Tailwind · @mysten/dapp-kit-react        │
│  @mysten/seal · SuiGrpcClient · TanStack Query          │
│  Next.js API Routes (Walrus upload/download proxy)       │
├─────────────────────────────────────────────────────────┤
│                 ON-CHAIN (Sui Move)                      │
│                                                         │
│  marketplace ─── MarketplaceConfig (shared)              │
│               ── ListingsRegistry (shared, dynamic flds) │
│               ── AdminCap (owned by deployer)            │
│               ── PackageVersion (shared)                 │
│                                                         │
│  skill ───────── SkillListing (shared, one per skill)    │
│               ── SellerCap (owned by seller)             │
│                                                         │
│  package_listing  PackageListing (shared, skill bundle)  │
│               ── PackageSellerCap (owned by seller)      │
│                                                         │
│  purchase ────── PurchaseReceipt (owned NFT, buyer)      │
│               ── SellerVault (shared, one per seller)    │
│                                                         │
│  seal_policy ─── seal_approve (entry fn for Seal keys)   │
├─────────────────────────────────────────────────────────┤
│  Walrus (encrypted blob storage)                        │
│  Seal Key Servers (testnet: 2 servers, threshold = 2)   │
└─────────────────────────────────────────────────────────┘
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
3. Payment is split: platform fee goes to `fee_recipient`, the rest goes to the seller's `SellerVault`
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
- **MarketplaceConfig** (shared) — holds `fee_bps` (platform fee in basis points) and `fee_recipient` address
- **AdminCap** (owned) — transferred to the deployer; required to update fees
- **PackageVersion** (shared) — version gating for Seal policy (prevents stale decryption after upgrades)
- **ListingsRegistry** (shared) — central index of all listings using dynamic fields (key = listing ID, value = tags)

The registry functions (`register_listing`, `unregister_listing`) are `public(package)` — only other modules in this package can call them.

### `skill.move` — Individual Skill Listings

Each skill becomes a shared `SkillListing` object. Listings are **immutable after creation** — there are no update functions. To change a listing, the seller delists it and creates a new one.

`SellerCap` is an owned object that proves the seller created a specific listing. It is required to delist.

### `package_listing.move` — Bundled Skills

A `PackageListing` groups multiple `SkillListing` IDs together with a discount (max 50%, stored as basis points). The price is computed from the sum of individual skill prices minus the discount.

### `purchase.move` — Purchases & Revenue

`PurchaseReceipt` is a `key`-only NFT (no `store` — cannot be placed in Kiosk). It records the buyer, seller, skills purchased, amount paid, and epoch.

`SellerVault` is a shared object that accumulates a seller's revenue. One vault per seller. The seller calls `withdraw` to extract SUI.

### `seal_policy.move` — Seal Access Control

The only fully implemented module. `seal_approve` is an `entry` function that Seal key servers call via `dry_run_transaction_block`. It:
1. Checks the package version matches
2. Extracts the first 32 bytes of the Seal key `id` as a skill listing ID
3. Verifies that the buyer's `PurchaseReceipt` contains that skill listing ID

If any check fails, the function aborts and Seal refuses to release decryption keys.

---

## Key Data Flows

### ListingsRegistry Discovery

The frontend discovers all listings by calling `ListDynamicFields` on the `ListingsRegistry` object via gRPC. Each dynamic field has:
- **Key**: the listing's object ID
- **Value**: `vector<String>` of tags

The frontend filters by tags client-side, then calls `multiGetObjects` to fetch full `SkillListing` details for display.

### Payment Splitting

When a buyer calls `purchase_skill`:
1. The function reads `fee_bps` from `MarketplaceConfig`
2. Computes `platform_fee = price * fee_bps / 10000`
3. Sends `platform_fee` to `fee_recipient`
4. Deposits the remainder into the seller's `SellerVault`
5. Mints a `PurchaseReceipt` and transfers it to the buyer

### Seal Key Identity Format

```
Full identity = [package_id (32 bytes)] ++ [id parameter]
id parameter   = [skill_listing_id (32 bytes)] ++ [random_nonce (5 bytes)]
```

Seal automatically prepends the `package_id`. The `seal_approve` function only receives the `id parameter` portion and extracts the first 32 bytes as the skill listing ID.

---

## Building & Testing

> **Note:** A `Move.toml` file does not exist yet. You must create one before building.

Create `move/Move.toml`:
```toml
[package]
name = "fast_and_furious"
edition = "2024"

[dependencies]

[addresses]
fast_and_furious = "0x0"
```

Then:

```bash
# Build the Move package
cd move && sui move build

# Run all tests
sui move test

# Run a specific test
sui move test --filter seal_approve

# Run with coverage
sui move test --coverage

# Publish to testnet (after implementation is complete)
sui client publish --gas-budget 100000000
```

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
- **gRPC** — The RPC protocol used to communicate with Sui full nodes. This project uses `SuiGrpcClient` exclusively (no JSON-RPC).

---

## Important Files Reference

| File | Description |
|---|---|
| `CLAUDE.md` | Full project spec: architecture, module designs, data flows, security model, implementation plan |
| `move/marketplace.move` | Platform config, admin cap, version gating, listings registry (dynamic fields) |
| `move/skill.move` | Individual skill listing struct, create/delist functions, seller cap |
| `move/package_listing.move` | Bundled skill packages with discount pricing |
| `move/purchase.move` | Purchase receipts (NFT), seller vaults, payment splitting |
| `move/seal_policy.move` | Seal access control — the only fully implemented module |
