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
| Package | `0xc1486670f81da6f57615f136cc1834b6a834248489ffeda4471d9841f3b5dab2` |
| MarketplaceConfig | `0xac695c12a22ff47aee4ca805d24808c12ecae241791c714ae78718c9ab6dc7a0` |
| PackageVersion | `0x8054603214952289fd107aea1785c8989e7337cc1ea23dd41c49abbf620da23a` |
| ListingsRegistry | `0x1dcdf97a5542a2a4465e0bd1e019c7f132c9625ed433cd01dcede566819180bf` |

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
