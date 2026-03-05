# Wooper

<p align="center">
  <img src="wooper.png" alt="Wooper mascot" width="200" />
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

| Object | ID |
|--------|-----|
| Package | `0x9beb306888905b115f532a92e2972c6262e6209b69c063891ebafdbabf332cec` |
| MarketplaceConfig | `0x794c46601b4ca1b26b90d665f35d6cf47efbeed5df548d1452bfc672cd621c2b` |
| PackageVersion | `0x534bf0d6d1341c1ff25e616d1523127337e2f3690690590cc0a8b2900dd8f1c1` |
| ListingsRegistry | `0x8fc2854e2d8218c2f7c780391f1c823e549a0723a43cdb95061f11b451b4fc62` |

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
