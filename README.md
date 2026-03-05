# Wooper

<p align="center">
  <img src="wooper.png" alt="Wooper logo" width="320" />
</p>


A decentralized marketplace for buying and selling AI skills and agents, built on the Sui blockchain. The platform enables creators to monetize their work by listing individual skills or curated packages, while buyers can discover, filter, and purchase capabilities to extend their own workflows.

Sellers encrypt skill files with Seal and store them on Walrus. Buyers purchase on-chain and decrypt client-side. The platform takes a configurable fee enforced entirely by Move smart contracts — no backend server.

## Walrus Blob Deletion on Delist

When a seller delists a skill, they can optionally delete the encrypted content from Walrus in the same transaction. The delist dialog shows a checkbox (checked by default) to "Also delete encrypted content from Walrus."

**How it works:**

- The Walrus blob delete and the on-chain `skill::delist` Move call are composed into a **single Programmable Transaction Block** — the user signs once, and both operations succeed or fail atomically.
- Deletion destroys the Sui Blob object and reclaims the WAL storage resource back to the seller.
- **Blob data is not purged instantly.** Walrus storage nodes continue serving the data until the storage end epoch. After that, it is garbage-collected and becomes inaccessible. This is expected Walrus behavior — deletion prevents renewal and reclaims the storage deposit, but does not immediately erase data from the network.

If the seller unchecks the option, only the delist executes and the blob persists until its storage period expires naturally.

## Deployed Object IDs (Testnet)

Source of truth: `frontend/.env` and `wooper/Published.toml`


| Object            | ID                                                                   |
| ----------------- | -------------------------------------------------------------------- |
| Package           | `0xc5e76bfe120371c0312fc2bbd3550eb1b7509ae18ae26df903b85a7cae23f1df` |
| MarketplaceConfig | `0x591a5427fe755707f7a89909ab8803cebd6260af6974a996d075dab92d00f5cd` |
| PackageVersion    | `0x7c633a4304583576e0b15a78a85a4919518566b881fd5ca9664ff621d9f9f932` |
| ListingsRegistry  | `0x4217adb0d77b95928b221192830f8e6624d12bbb11dcac9885854cf3dc9c37a4` |


## Quick Start

```bash
# Build and test Move contracts
cd wooper && sui move build && sui move test

# Run frontend
cd frontend && npm install && npm run dev
```

## Documentation

- **[CLAUDE.md](CLAUDE.md)** — Project conventions, architecture summary, key decisions
- **[docs/architecture.md](docs/architecture.md)** — Seal flows, security model, data lifecycles
- **[docs/move-api-reference.md](docs/move-api-reference.md)** — Move module API reference
- **[docs/frontend-guide.md](docs/frontend-guide.md)** — Frontend hooks, SSR patterns, Walrus routes
- **[FOR_DUMMIES.md](FOR_DUMMIES.md)** — Plain-English onboarding guide

