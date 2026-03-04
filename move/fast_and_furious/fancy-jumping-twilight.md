# Plan: Phase 3 — Frontend Core Pages

## Context

Phases 1-2 (Move contracts) are complete with 35 passing tests and clean code quality. Phase 3 builds the Next.js frontend with: project setup, wallet integration, on-chain listing discovery, browse/detail pages, and Walrus proxy routes. Contracts are **not deployed yet** — the frontend uses placeholder env vars and handles the "not deployed" state gracefully.

## Tech Stack

- Next.js 14+ (App Router) with `src/` directory
- Tailwind CSS + shadcn/ui (New York style, Slate base)
- `@mysten/dapp-kit-react` + `@mysten/sui` (gRPC only)
- TanStack Query for data caching
- TypeScript strict mode

## Step 1: Project Initialization

```bash
cd /Users/alilloig/workspace/fast-and-furious
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd frontend
npx shadcn@latest init    # New York style, Slate, CSS variables
npx shadcn@latest add button card input badge skeleton separator sheet select dropdown-menu scroll-area tooltip avatar
npm install @mysten/dapp-kit-react @mysten/dapp-kit-core @mysten/sui @nanostores/react @tanstack/react-query
```

Create `.env.local` and `.env.example` with placeholder object IDs:
```
NEXT_PUBLIC_MARKETPLACE_PACKAGE_ID=0x0
NEXT_PUBLIC_MARKETPLACE_CONFIG_ID=0x0
NEXT_PUBLIC_PACKAGE_VERSION_ID=0x0
NEXT_PUBLIC_LISTINGS_REGISTRY_ID=0x0
NEXT_PUBLIC_SUI_NETWORK=testnet
WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
```

## Step 2: Core Infrastructure (`src/lib/`)

**`constants.ts`** — Env var accessors, `IS_DEPLOYED` flag (`PACKAGE_ID !== '0x0'`), Seal server configs, `MIST_PER_SUI`.

**`dapp-kit.ts`** — `createDAppKit` instance with `SuiGrpcClient` for testnet/mainnet. Type registration via `declare module`.

**`types.ts`** — TypeScript interfaces mirroring Move structs: `SkillListing`, `PackageListing`, `MarketplaceConfig`, `RegistryEntry`.

**`parsers.ts`** — Parse gRPC JSON responses into typed objects. Handle Move field names (`walrus_blob_id` → `walrusBlobId`), `Option<String>` encoding, BCS decoding of `DynamicFieldEntry` names.

**`utils.ts`** — `cn()` (shadcn classnames), `formatSui()` (MIST→SUI), `truncateAddress()`.

**`mock-data.ts`** — 3-4 sample `SkillListing` + 1 `PackageListing` for UI development when `IS_DEPLOYED` is false.

## Step 3: Providers & Layout

**`src/app/providers.tsx`** — `"use client"` wrapper with `DAppKitProvider` + `QueryClientProvider`. Stale time 30s for queries.

**`src/app/layout.tsx`** — Server component shell: `<Providers>` + `<Header>` + `<main>` + `<Footer>`.

## Step 4: Data Hooks (`src/hooks/`)

All hooks use `enabled: IS_DEPLOYED` to avoid network calls when contracts aren't deployed. When not deployed, fall back to mock data.

| Hook | gRPC Call | Returns |
|------|----------|---------|
| `useListingsRegistry` | `listDynamicFields(REGISTRY_ID)` paginated | `RegistryEntry[]` |
| `useSkillListings` | `getObjects(ids, { json: true })` batched (50) | `SkillListing[]` (active only) |
| `usePackageListings` | Same batch fetch, filter by type | `PackageListing[]` |
| `useSkillDetail(id)` | `getObject(id, { json: true })` | `SkillListing \| null` |
| `usePackageDetail(id)` | `getObject(id, { json: true })` | `PackageListing \| null` |
| `useMarketplaceConfig` | `getObject(CONFIG_ID, { json: true })` | `MarketplaceConfig` |

**Key flow**: `useListingsRegistry` → collects all listing IDs → `useSkillListings`/`usePackageListings` batch-fetch the objects → distinguish by `obj.type` containing `::skill::SkillListing` vs `::package_listing::PackageListing`.

## Step 5: Layout Components

**`src/components/layout/header.tsx`** — Sticky nav bar with logo, nav links (Explore, My Purchases), `NotDeployedBanner`, and `ConnectButton` from `@mysten/dapp-kit-react/ui`.

**`src/components/layout/footer.tsx`** — Simple footer.

**`src/components/layout/mobile-nav.tsx`** — Responsive drawer using shadcn Sheet.

**`src/components/layout/not-deployed-banner.tsx`** — Yellow banner when `IS_DEPLOYED` is false: "Development Preview — contracts not deployed."

## Step 6: Shared Components (`src/components/`)

**`skills/skill-card.tsx`** — Card showing title, price (SUI), category badge, tags, seller address, epoch. Links to `/skill/[id]`.

**`skills/package-card.tsx`** — Card showing title, skill count, discount %, total price. Links to `/package/[id]`.

**`skills/skill-grid.tsx`** — Responsive CSS grid: 1→2→3→4 columns by breakpoint.

**`skills/listing-filters.tsx`** — Search input, category Select, tag Badges, sort dropdown, type toggle (Skills/Packages/All). Filters applied client-side via `useMemo`.

**`skills/price-display.tsx`** — MIST→SUI formatter with SUI icon.

**`empty-state.tsx`** — "No results" / "Not deployed yet" placeholder.

**`loading-skeleton.tsx`** — Skeleton card grid during loading.

## Step 7: Pages

### Landing (`src/app/page.tsx`)
- Hero section with tagline + CTA buttons
- Featured skills grid (first 6 active listings)
- "How it works" section (Browse → Purchase → Decrypt)
- Stats section (total listing count from registry)

### Explore (`src/app/explore/page.tsx`)
- `ListingFilters` + `SkillGrid` with `SkillCard`/`PackageCard`
- Client-side filtering via `useMemo` on the full listings array
- Loading skeletons + empty state

### Skill Detail (`src/app/skill/[id]/page.tsx`)
- Full details: title, description, price, seller, category, tags, epoch
- Walrus blob ID (display only)
- Purchase button (disabled with tooltip: "Coming in Phase 4")

### Package Detail (`src/app/package/[id]/page.tsx`)
- Package details + list of included skills (fetches each)
- Discount display + total price
- Purchase button (disabled)

### Purchases Placeholder (`src/app/purchases/page.tsx`)
- "Connect wallet" prompt if disconnected
- "Coming in Phase 4" message if connected

## Step 8: Walrus Proxy API Routes

**`src/app/api/walrus/upload/route.ts`** — `POST`: proxy body bytes to `WALRUS_PUBLISHER_URL/v1/blobs` (PUT), return JSON result.

**`src/app/api/walrus/download/[blobId]/route.ts`** — `GET`: proxy fetch from `WALRUS_AGGREGATOR_URL/v1/blobs/{blobId}`, return blob with `application/octet-stream` content type.

Both routes return 503 if env vars are not configured.

## Step 9: "Not Deployed" Handling

1. `IS_DEPLOYED = PACKAGE_ID !== '0x0'` in constants
2. All hooks have `enabled: IS_DEPLOYED` — when false, return mock data instead
3. `NotDeployedBanner` renders a yellow bar at top
4. Pages show meaningful empty states, not error screens
5. All interactive features (connect wallet, browse explore) still work with mock data

## File Tree

```
frontend/src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── providers.tsx
│   ├── page.tsx                    # Landing
│   ├── explore/page.tsx            # Browse/search
│   ├── skill/[id]/page.tsx         # Skill detail
│   ├── package/[id]/page.tsx       # Package detail
│   ├── purchases/page.tsx          # Placeholder
│   └── api/walrus/
│       ├── upload/route.ts
│       └── download/[blobId]/route.ts
├── lib/
│   ├── constants.ts
│   ├── dapp-kit.ts
│   ├── types.ts
│   ├── parsers.ts
│   ├── utils.ts
│   └── mock-data.ts
├── hooks/
│   ├── use-listings-registry.ts
│   ├── use-skill-listings.ts
│   ├── use-package-listings.ts
│   ├── use-skill-detail.ts
│   ├── use-package-detail.ts
│   └── use-marketplace-config.ts
└── components/
    ├── ui/                         # shadcn (auto-generated)
    ├── layout/
    │   ├── header.tsx
    │   ├── footer.tsx
    │   ├── mobile-nav.tsx
    │   └── not-deployed-banner.tsx
    ├── skills/
    │   ├── skill-card.tsx
    │   ├── package-card.tsx
    │   ├── skill-grid.tsx
    │   ├── listing-filters.tsx
    │   └── price-display.tsx
    ├── empty-state.tsx
    └── loading-skeleton.tsx
```

## Implementation Order

1. **Step 1**: Project init + dependencies + shadcn
2. **Step 2**: `lib/` infrastructure files (constants, dapp-kit, types, parsers, utils, mock-data)
3. **Step 3**: providers.tsx + layout.tsx
4. **Step 4**: All data hooks
5. **Step 5-6**: Layout + shared components
6. **Step 7**: All pages
7. **Step 8**: Walrus API routes
8. **Step 9**: Not-deployed polish

## Verification

```bash
cd frontend
npm run build        # must succeed with no errors
npm run dev          # dev server starts, pages render
```

Manual checks:
- Landing page renders with hero + mock featured skills
- Explore page shows mock listings with working filters
- Skill detail page renders mock data
- ConnectButton appears in header
- NotDeployedBanner visible when using 0x0 IDs
- Walrus routes return 503 gracefully (no publisher configured locally)
- Responsive layout works on mobile viewport

## Key Risks

1. **`@mysten/dapp-kit-react` availability** — If not yet on npm, fall back to legacy `@mysten/dapp-kit` with `SuiClientProvider` + `WalletProvider` pattern
2. **gRPC JSON field format** — Move Option/vector encoding in gRPC JSON may differ; parsers need testing against real data after deployment
3. **BCS decoding of DynamicFieldEntry names** — Registry field names are BCS-encoded IDs; need `bcs.Address.parse()` from `@mysten/sui/bcs`
