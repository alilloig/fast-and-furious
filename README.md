# Wooper

<p align="center">
  <img src="wooper.png" alt="Wooper mascot" width="200" />
</p>

A decentralized marketplace for buying and selling AI skills and agents, built on the Sui blockchain. The platform enables creators to monetize their work by listing individual skills or curated packages, while buyers can discover, filter, and purchase capabilities to extend their own workflows.

Sellers encrypt skill files with Seal and store them on Walrus. Buyers purchase on-chain and decrypt client-side. The platform takes a configurable fee enforced entirely by Move smart contracts — no backend server.

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
