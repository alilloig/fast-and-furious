# Plan: Phase 4 — Purchase & Decrypt

## Context

Contracts are deployed on testnet (IDs in `.env.local`). Phase 3 built the frontend shell with browsing, detail pages, and mock data. Phase 4 adds the core marketplace functionality: buying skills/packages and decrypting purchased content via Seal. The `IS_DEPLOYED` flag is now `true` — real gRPC queries run against testnet.

---

## 1. Install Dependencies

```bash
cd frontend && npm install @mysten/seal idb-keyval
```

- `@mysten/seal` — Seal encryption/decryption SDK (SealClient, SessionKey, EncryptedObject)
- `idb-keyval` — IndexedDB key-value store for SessionKey persistence

---

## 2. Types & Constants

### `src/lib/types.ts` — add PurchaseReceipt

```typescript
export interface PurchaseReceipt {
  id: string;
  buyer: string;
  skillIds: string[];
  seller: string;
  amountPaid: bigint;
  purchasedAtEpoch: number;
}
```

### `src/lib/constants.ts` — add type strings

```typescript
export const PURCHASE_RECEIPT_TYPE = `${MARKETPLACE_PACKAGE_ID}::purchase::PurchaseReceipt`;
export const SELLER_VAULT_TYPE = `${MARKETPLACE_PACKAGE_ID}::purchase::SellerVault`;
```

### `src/lib/parsers.ts` — add parsePurchaseReceipt

Same pattern as existing `parseSkillListing`:
```typescript
export function parsePurchaseReceipt(objectId: string, json: Record<string, unknown>): PurchaseReceipt
```

### `src/lib/mock-data.ts` — add MOCK_RECEIPTS

Two mock receipts referencing existing mock skills, for placeholderData when `!IS_DEPLOYED`.

---

## 3. SellerVault Discovery

**Problem:** `SellerVault` is a shared object. gRPC has no `queryEvents`/`queryTransactionBlocks`. We need the vault ID to call `purchase_skill`.

**Solution:** JSON-RPC fallback — only place in the app that uses JSON-RPC.

### `src/lib/json-rpc-client.ts` — NEW

Singleton `SuiJsonRpcClient` from `@mysten/sui/jsonRpc`. Used exclusively for vault lookup.

### `src/hooks/use-seller-vault.ts` — NEW

```typescript
export function useSellerVault(sellerAddress: string | undefined)
```

- Uses `queryTransactionBlocks` with filter `{ MoveFunction: { package, module: "purchase", function: "create_vault" } }` + input sender filter
- Parses created objects from tx effects to find `SellerVault` type
- Extracts the vault object ID
- Cached with `staleTime: Infinity` (vault IDs never change)
- Returns `{ data: string | null, isLoading, error }` (vault object ID or null if not found)

---

## 4. Seal Client Setup

### `src/lib/seal.ts` — NEW

```typescript
export function getSealClient(suiClient: SuiGrpcClient): SealClient
```

Lazy singleton that creates `SealClient` with the configured `SEAL_SERVER_CONFIGS`. Uses the gRPC client for Seal operations. If `SealClient` doesn't accept gRPC directly, fall back to creating a separate JSON-RPC client for Seal only.

---

## 5. New Hooks

### `src/hooks/use-purchase-receipts.ts` — NEW

```typescript
export function usePurchaseReceipts()
```

- Requires connected wallet (`useCurrentAccount`)
- Uses gRPC `listOwnedObjects({ owner, type: PURCHASE_RECEIPT_TYPE, include: { json: true } })` with pagination
- Parses results with `parsePurchaseReceipt`
- Returns `{ data: PurchaseReceipt[], isLoading }`
- placeholderData: `MOCK_RECEIPTS` when `!IS_DEPLOYED`

### `src/hooks/use-purchase-skill.ts` — NEW

```typescript
export function usePurchaseSkill()
```

TanStack `useMutation` that:
1. Takes `{ listingId: string, vaultId: string, price: bigint }`
2. Builds PTB:
   ```typescript
   const tx = new Transaction();
   const payment = coinWithBalance({ balance: price });
   tx.moveCall({
     target: `${PACKAGE_ID}::purchase::purchase_skill`,
     arguments: [
       tx.object(MARKETPLACE_CONFIG_ID),
       tx.object(listingId),
       tx.object(vaultId),
       payment,
     ],
   });
   ```
3. Signs and executes via `useDAppKit().signAndExecuteTransaction`
4. On success: invalidates `["purchase-receipts"]` query

### `src/hooks/use-purchase-package.ts` — NEW

Same pattern as `usePurchaseSkill` but calls `purchase::purchase_package(config, package, vault, payment)`.

### `src/hooks/use-session-key.ts` — NEW

```typescript
export function useSessionKey(): { getOrCreateSessionKey: () => Promise<SessionKey> }
```

1. Tries to restore from IndexedDB (`idb-keyval`)
2. If expired/missing, creates new via `SessionKey.create()`, prompts wallet for personal message signature via `useDAppKit().signPersonalMessage`
3. Persists exported key to IndexedDB
4. Returns a stable callback via `useCallback`

### `src/hooks/use-decrypt-skill.ts` — NEW (optional, may inline in DecryptButton)

Encapsulates: fetch blob from Walrus → parse `EncryptedObject` → build `seal_approve` PTB → `sealClient.decrypt()` → return plaintext bytes.

---

## 6. UI Changes

### `src/app/skill/[id]/page.tsx` — MODIFY

Replace the disabled purchase Tooltip/Button block (lines 94–103) with:

- Import `useCurrentAccount`, `useSellerVault`, `usePurchaseSkill`
- Purchase button states:
  - No wallet: show ConnectButton
  - Wallet connected, vault loading: disabled "Loading..."
  - Vault not found: disabled "Seller vault not set up"
  - Ready: "Purchase for X SUI" (enabled)
  - Purchasing (mutation pending): "Purchasing..." with spinner
  - Success: show success message, link to `/purchases`
  - Error: show error inline

### `src/app/package/[id]/page.tsx` — MODIFY

Same pattern as skill page, using `usePurchasePackage` instead. Replace disabled button block (lines 118–127).

### `src/app/purchases/page.tsx` — REWRITE

Replace skeleton "Coming in Phase 4" with:

1. Wallet not connected → show ConnectButton (already exists)
2. Connected, loading → skeleton cards
3. No receipts → EmptyState "No purchases yet"
4. Has receipts → list of `ReceiptCard` components

For each receipt:
- Resolve skill titles by fetching `SkillListing` objects using existing `useSkillListings`
- Show: skill name(s), amount paid, purchase epoch, seller address
- "Decrypt & Download" button per skill in the receipt

### `src/components/purchases/receipt-card.tsx` — NEW

Displays a single PurchaseReceipt with skill details and decrypt buttons.

### `src/components/purchases/decrypt-button.tsx` — NEW

Self-contained component that handles the full decrypt flow:
1. `getOrCreateSessionKey()` — may trigger wallet popup
2. Fetch encrypted blob via `/api/walrus/download/${walrusBlobId}`
3. `EncryptedObject.parse(encryptedBytes)` → extract `id`
4. Build `seal_approve` PTB with `tx.pure.vector('u8', fromHex(parsed.id))`, `tx.object(PACKAGE_VERSION_ID)`, `tx.object(receiptId)`
5. `tx.build({ client, onlyTransactionKind: true })` → txBytes
6. `sealClient.decrypt({ data: encryptedBytes, sessionKey, txBytes })` → plaintext
7. Trigger browser file download via Blob URL

Button states: idle → "Decrypt & Download", loading → "Decrypting...", error → show error text, retry.

---

## 7. File Summary

| # | File | Action |
|---|------|--------|
| 1 | `package.json` | Modify — add `@mysten/seal`, `idb-keyval` |
| 2 | `src/lib/types.ts` | Modify — add `PurchaseReceipt` |
| 3 | `src/lib/constants.ts` | Modify — add `PURCHASE_RECEIPT_TYPE`, `SELLER_VAULT_TYPE` |
| 4 | `src/lib/parsers.ts` | Modify — add `parsePurchaseReceipt` |
| 5 | `src/lib/mock-data.ts` | Modify — add `MOCK_RECEIPTS` |
| 6 | `src/lib/json-rpc-client.ts` | **Create** — singleton JSON-RPC client for vault lookup |
| 7 | `src/lib/seal.ts` | **Create** — SealClient factory |
| 8 | `src/hooks/use-seller-vault.ts` | **Create** — vault discovery via JSON-RPC |
| 9 | `src/hooks/use-purchase-receipts.ts` | **Create** — fetch buyer's receipts via gRPC |
| 10 | `src/hooks/use-purchase-skill.ts` | **Create** — purchase mutation |
| 11 | `src/hooks/use-purchase-package.ts` | **Create** — package purchase mutation |
| 12 | `src/hooks/use-session-key.ts` | **Create** — SessionKey lifecycle |
| 13 | `src/components/purchases/decrypt-button.tsx` | **Create** — decrypt & download button |
| 14 | `src/components/purchases/receipt-card.tsx` | **Create** — receipt display card |
| 15 | `src/app/skill/[id]/page.tsx` | Modify — wire purchase button |
| 16 | `src/app/package/[id]/page.tsx` | Modify — wire purchase button |
| 17 | `src/app/purchases/page.tsx` | Modify — full rewrite with receipt list |

---

## 8. Implementation Order

1. Install deps (`npm install`)
2. Foundation: types, constants, parsers, mock data (files 2–5)
3. Infrastructure: json-rpc-client, seal client (files 6–7)
4. Vault hook (file 8) — needed before purchase works
5. Purchase hooks (files 10–11)
6. Update detail pages (files 15–16) — wire purchase buttons
7. Receipt hook (file 9)
8. Session key hook (file 12)
9. Decrypt components (files 13–14)
10. Purchases page rewrite (file 17)

---

## 9. Key Patterns to Follow

- **Existing hook pattern**: `useQuery` with `queryKey`, `enabled: IS_DEPLOYED && condition`, `placeholderData` for mocks (see `use-skill-detail.ts`)
- **Client access**: `useSuiClient()` from `src/hooks/use-sui-client.ts` (casts to `SuiGrpcClient`)
- **Parser pattern**: snake_case JSON fields → camelCase TS (see `src/lib/parsers.ts`)
- **Transaction signing**: `useDAppKit().signAndExecuteTransaction({ transaction: tx })` from `@mysten/dapp-kit-react`
- **`coinWithBalance`**: from `@mysten/sui/transactions` — creates a coin argument for PTBs

---

## 10. Verification

```bash
# Build succeeds
cd frontend && npm run build

# Dev server runs
npm run dev
```

Manual testnet testing:
1. Connect wallet → navigate to a skill → verify purchase button is active (if seller has vault)
2. Purchase a skill → verify receipt appears in "My Purchases"
3. Click "Decrypt" → verify SessionKey creation (wallet popup), blob fetch, decryption, file download
4. Refresh page → verify SessionKey restored from IndexedDB (no re-sign)

---

## 11. Risks

| Risk | Mitigation |
|------|-----------|
| `SealClient` may not accept `SuiGrpcClient` | Fall back to creating a separate JSON-RPC client for Seal |
| No seller vault exists | UI shows "Seller vault not set up" — purchase disabled. Phase 5 adds vault creation. |
| `EncryptedObject.parse(id)` format mismatch | Verify `fromHex(parsed.id)` produces correct bytes for `seal_approve`'s `vector<u8>` |
| `coinWithBalance` API shape | Verify if it returns `(tx) => TransactionResult` or `TransactionResult` directly |
