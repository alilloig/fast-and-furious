# Frontend Guide

Reference for the Next.js 16 frontend. Source: `frontend/`.

---

## SSR Pattern

`@mysten/sui/grpc` accesses `window` at import time, which breaks SSR. The solution:

1. **`app/layout.tsx`** — Server component, imports `ClientLayout`
2. **`app/client-layout.tsx`** — `"use client"`, uses `next/dynamic` with `ssr: false` to import `ClientShell`
3. **`components/layout/client-shell.tsx`** — `"use client"`, wraps children in `QueryClientProvider` → `DAppKitProvider` → `TooltipProvider` → `Header` + `main` + `Footer`

This ensures all Sui SDK code only runs in the browser.

---

## App Directory Structure

```
app/
├── layout.tsx                     # Root layout (Geist fonts, imports ClientLayout)
├── client-layout.tsx              # "use client" dynamic import of ClientShell (ssr: false)
├── page.tsx                       # Landing page
├── explore/
│   └── page.tsx                   # Browse & search skills (filterable grid)
├── skill/
│   └── [id]/
│       └── page.tsx               # Skill detail + purchase button
├── package/
│   └── [id]/
│       └── page.tsx               # Package detail + purchase button
├── seller/
│   ├── create/
│   │   └── page.tsx               # Create skill listing form
│   ├── create-package/
│   │   └── page.tsx               # Create package listing form
│   └── dashboard/
│       └── page.tsx               # Seller dashboard (listings, revenue)
├── purchases/
│   └── page.tsx                   # My purchases + decrypt/download
└── api/
    └── walrus/
        ├── upload/
        │   └── route.ts           # Single-file blob upload proxy
        ├── upload-quilt/
        │   └── route.ts           # Multi-file quilt upload proxy
        ├── download/
        │   └── [blobId]/
        │       └── route.ts       # Single-file blob download proxy
        └── download-quilt/
            └── [quiltId]/
                └── [identifier]/
                    └── route.ts   # Quilt file download proxy
```

---

## Walrus API Routes

All routes proxy to Walrus publisher/aggregator. No database, no indexing.

| Method | Path | Proxies To | Purpose |
|--------|------|-----------|---------|
| `PUT` | `/api/walrus/upload` | `WALRUS_PUBLISHER_URL/v1/blobs` | Upload single encrypted blob |
| `POST` | `/api/walrus/upload-quilt` | Walrus publisher | Upload multi-file quilt |
| `GET` | `/api/walrus/download/[blobId]` | `WALRUS_AGGREGATOR_URL/v1/blobs/:blobId` | Download single encrypted blob |
| `GET` | `/api/walrus/download-quilt/[quiltId]/[identifier]` | Walrus aggregator | Download file from quilt |

Source files: `frontend/src/app/api/walrus/*/route.ts`

---

## Hooks Inventory

### Data Fetching (Read)

| Hook | Source | Purpose |
|------|--------|---------|
| `useListingsRegistry` | `hooks/use-listings-registry.ts` | Enumerate ListingsRegistry dynamic fields via gRPC |
| `useSkillListings` | `hooks/use-skill-listings.ts` | Fetch multiple SkillListing objects |
| `useSkillDetail` | `hooks/use-skill-detail.ts` | Fetch single SkillListing by ID |
| `usePackageListings` | `hooks/use-package-listings.ts` | Fetch multiple PackageListing objects |
| `usePackageDetail` | `hooks/use-package-detail.ts` | Fetch single PackageListing by ID |
| `useMarketplaceConfig` | `hooks/use-marketplace-config.ts` | Fetch MarketplaceConfig (fee_bps, etc.) |
| `usePurchaseReceipts` | `hooks/use-purchase-receipts.ts` | Fetch buyer's owned PurchaseReceipts |
| `useSellerCaps` | `hooks/use-seller-caps.ts` | Fetch seller's owned SellerCaps |
| `usePackageSellerCaps` | `hooks/use-package-seller-caps.ts` | Fetch seller's owned PackageSellerCaps |
| `useMyListings` | `hooks/use-my-listings.ts` | Fetch seller's own skill listings |
| `useMyPackages` | `hooks/use-my-packages.ts` | Fetch seller's own package listings |
| `useSellerVault` | `hooks/use-seller-vault.ts` | Find seller's vault object |
| `useSellerVaultDetail` | `hooks/use-seller-vault-detail.ts` | Fetch vault balance details |

### Transactions (Write)

| Hook | Source | Purpose |
|------|--------|---------|
| `useCreateSkill` | `hooks/use-create-skill.ts` | Build + sign `skill::create` PTB |
| `useFinalizeSkill` | `hooks/use-finalize-skill.ts` | Build + sign `skill::finalize` PTB |
| `useDelistSkill` | `hooks/use-delist-skill.ts` | Build + sign `skill::delist` PTB |
| `useCreatePackage` | `hooks/use-create-package.ts` | Build + sign `package_listing::create` PTB |
| `useDelistPackage` | `hooks/use-delist-package.ts` | Build + sign `package_listing::delist` PTB |
| `usePurchaseSkill` | `hooks/use-purchase-skill.ts` | Build + sign `purchase::purchase_skill` PTB |
| `usePurchasePackage` | `hooks/use-purchase-package.ts` | Build + sign `purchase::purchase_package` PTB |
| `useCreateVault` | `hooks/use-create-vault.ts` | Build + sign `purchase::create_vault` PTB |
| `useWithdraw` | `hooks/use-withdraw.ts` | Build + sign `purchase::withdraw` PTB |

### Utilities

| Hook | Source | Purpose |
|------|--------|---------|
| `useSuiClient` | `hooks/use-sui-client.ts` | Casts `useCurrentClient()` result to `SuiGrpcClient` |
| `useSessionKey` | `hooks/use-session-key.ts` | Seal SessionKey create/restore/persist |

---

## Mock Data System

When contracts are not deployed (all IDs are `0x0`), the app uses mock data instead of live chain queries.

- **Flag**: `IS_DEPLOYED` in `lib/constants.ts` — `true` when `MARKETPLACE_PACKAGE_ID !== "0x0"`
- **Behavior**: All query hooks set `enabled: IS_DEPLOYED` on their `useQuery` calls
- **Fallback**: When disabled, hooks return `placeholderData` from `lib/mock-data.ts`
- This allows the frontend to be developed and tested without a testnet deployment

---

## Key Patterns

### SuiGrpcClient Access

`useCurrentClient()` from `@mysten/dapp-kit-react` returns `ClientWithCoreApi`, which lacks some transport methods. The `useSuiClient()` hook casts it to `SuiGrpcClient` for full access.

Source: `frontend/src/hooks/use-sui-client.ts`

### BCS Parsing

gRPC object content is BCS-encoded. Parsing logic lives in `frontend/src/lib/parsers.ts`. TypeScript interfaces matching the Move structs are in `frontend/src/lib/types.ts`.

### DAppKit Setup

The `getDAppKit()` factory is in `frontend/src/lib/dapp-kit.ts`. It configures `SuiGrpcClient` for the selected network.

### Type Constants

All Move type strings (`SkillListing`, `PurchaseReceipt`, etc.) are defined in `frontend/src/lib/constants.ts` with the package ID prefix.
