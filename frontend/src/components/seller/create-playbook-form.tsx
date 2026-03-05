"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toHex, fromHex } from "@mysten/sui/utils";
import { useCurrentClient } from "@mysten/dapp-kit-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorAlert } from "@/components/error-alert";
import { StorageCostEstimate } from "@/components/seller/storage-cost-estimate";
import { FileDropZone } from "@/components/seller/file-drop-zone";
import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { useCreatePlaybook } from "@/hooks/use-create-playbook";
import { useFinalizePlaybook } from "@/hooks/use-finalize-playbook";
import { getSealClient } from "@/lib/seal";
import { MOCK_CATEGORIES } from "@/lib/mock-data";
import {
  MIST_PER_SUI,
  MARKETPLACE_PACKAGE_ID,
  SEAL_THRESHOLD,
  MAX_FILES_PER_LISTING,
  MAX_TOTAL_FILE_SIZE_BYTES,
  ALLOWED_FILE_EXTENSIONS,
  WALRUS_DEFAULT_EPOCHS,
} from "@/lib/constants";
import { estimateWalrusCost } from "@/lib/walrus-cost";

type Step =
  | "form"
  | "creating"
  | "encrypting"
  | "uploading"
  | "finalizing"
  | "done";

/**
 * Build a Seal key identity from a listing ID.
 * Format: [listing_id_bytes (32)] ++ [random_nonce (5)]
 * Returns the hex string (for Seal encrypt) and raw bytes (for on-chain storage).
 */
function buildSealIdentity(listingId: string): {
  id: string;
  sealKeyId: number[];
} {
  const listingIdBytes = fromHex(listingId);
  const nonce = crypto.getRandomValues(new Uint8Array(5));
  const combined = new Uint8Array(listingIdBytes.length + nonce.length);
  combined.set(listingIdBytes, 0);
  combined.set(nonce, listingIdBytes.length);
  return {
    id: toHex(combined),
    sealKeyId: Array.from(combined),
  };
}

/**
 * Extract the shared object ID (SkillListing) and owned object ID (SellerCap)
 * from transaction effects after a skill::create call.
 */
function extractCreatedObjectIds(effects: {
  changedObjects: Array<{
    objectId: string;
    idOperation: string;
    outputOwner: { $kind: string } | null;
  }>;
}): { listingId: string; sellerCapId: string } {
  let listingId: string | null = null;
  let sellerCapId: string | null = null;

  for (const obj of effects.changedObjects) {
    if (obj.idOperation !== "Created") continue;
    const kind = obj.outputOwner?.$kind;
    if (kind === "Shared" && !listingId) {
      listingId = obj.objectId;
    } else if (kind === "AddressOwner" && !sellerCapId) {
      sellerCapId = obj.objectId;
    }
  }

  if (!listingId || !sellerCapId) {
    throw new Error(
      "Failed to extract created object IDs from transaction effects",
    );
  }
  return { listingId, sellerCapId };
}

function validateFiles(files: File[]): string | null {
  if (files.length === 0) return "Please select at least one file.";
  if (files.length > MAX_FILES_PER_LISTING)
    return `Maximum ${MAX_FILES_PER_LISTING} files allowed.`;
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_TOTAL_FILE_SIZE_BYTES)
    return "Total file size exceeds 50MB.";
  for (const f of files) {
    const ext = f.name.includes(".")
      ? `.${f.name.split(".").pop()!.toLowerCase()}`
      : "";
    if (!ALLOWED_FILE_EXTENSIONS.includes(ext))
      return `File type "${ext || "(no extension)"}" is not allowed. Only ${ALLOWED_FILE_EXTENSIONS.join(", ")} files are accepted.`;
  }
  return null;
}

export function CreatePlaybookForm() {
  const router = useRouter();
  const createPlaybookMutation = useCreatePlaybook();
  const finalizeMutation = useFinalizePlaybook();
  const suiClient = useCurrentClient();
  const currentAccount = useCurrentAccount();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [category, setCategory] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [epochs, setEpochs] = useState(WALRUS_DEFAULT_EPOCHS);

  const storageEstimate = useMemo(
    () => estimateWalrusCost(files, epochs),
    [files, epochs],
  );

  const [step, setStep] = useState<Step>("form");
  const [stepDetail, setStepDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const priceSui = parseFloat(priceStr);
    if (isNaN(priceSui) || priceSui <= 0) return;

    const validationError = validateFiles(files);
    if (validationError) {
      setError(validationError);
      return;
    }

    const price = BigInt(Math.floor(priceSui * Number(MIST_PER_SUI)));
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      // Step 1: Create listing on-chain (metadata only — gets us the listing ID)
      setStep("creating");
      setStepDetail("Creating listing on-chain...");
      const createResult = await createPlaybookMutation.mutateAsync({
        title,
        description,
        price,
        category,
        tags,
      });

      if (createResult.$kind === "FailedTransaction") {
        throw new Error("Transaction failed on-chain");
      }

      const effects = createResult.Transaction.effects;
      if (!effects) {
        throw new Error("Transaction effects not available");
      }

      const { listingId, sellerCapId } = extractCreatedObjectIds(effects);

      // Step 2: Encrypt each file with Seal using the same identity
      setStep("encrypting");
      const { id: sealId, sealKeyId } = buildSealIdentity(listingId);
      const sealClient = getSealClient(suiClient);

      const encryptedFiles: Array<{ name: string; data: Uint8Array }> = [];
      for (let i = 0; i < files.length; i++) {
        setStepDetail(`Encrypting file ${i + 1} of ${files.length}...`);
        const fileBytes = new Uint8Array(await files[i].arrayBuffer());
        const { encryptedObject } = await sealClient.encrypt({
          threshold: SEAL_THRESHOLD,
          packageId: MARKETPLACE_PACKAGE_ID,
          id: sealId,
          data: fileBytes,
        });
        encryptedFiles.push({ name: files[i].name, data: encryptedObject });
      }

      // Step 3: Assemble upload payload and compute integrity metadata
      setStep("uploading");
      let walrusBlobId: string;
      let walrusQuiltId: string | null = null;
      let walrusBlobObjectId = "";
      let storageEndEpoch = 0;
      let rootHash: number[] = [];
      let encodingNonce = 0;

      const { WalrusClient } = await import("@mysten/walrus");
      const walrusClient = new WalrusClient({ network: "testnet", suiClient });

      let uploadBytes: Uint8Array;

      if (encryptedFiles.length === 1) {
        uploadBytes = encryptedFiles[0].data;
      } else {
        // Assemble quilt client-side so we can compute integrity metadata
        setStepDetail("Assembling quilt...");
        const { encodeQuilt } = await import("@mysten/walrus");
        const systemState = await walrusClient.systemState();
        const numShards = systemState.committee.n_shards;
        const quiltBlobs = encryptedFiles.map((ef) => ({
          contents: ef.data,
          identifier: ef.name,
        }));
        const { quilt } = encodeQuilt({ blobs: quiltBlobs, numShards });
        uploadBytes = quilt;
      }

      // Compute Walrus blob metadata for integrity verification (works for both blob and quilt)
      try {
        const metadata = await walrusClient.computeBlobMetadata({ bytes: uploadBytes });
        rootHash = Array.from(new Uint8Array(metadata.rootHash));
        const nonceBytes = metadata.nonce;
        const nonceDv = new DataView(new ArrayBuffer(8));
        for (let i = 0; i < Math.min(nonceBytes.length, 8); i++) {
          nonceDv.setUint8(i, nonceBytes[i]);
        }
        encodingNonce = Number(nonceDv.getBigUint64(0, true));
      } catch {
        console.warn("Could not compute blob metadata for integrity verification");
      }

      // Upload assembled bytes to Walrus via existing blob route
      const sellerAddress = currentAccount?.address ?? "";
      const sendToParam = sellerAddress ? `&send_object_to=${sellerAddress}` : "";
      setStepDetail(
        encryptedFiles.length === 1
          ? "Uploading file to Walrus..."
          : `Uploading ${encryptedFiles.length} files to Walrus...`,
      );
      const uploadResponse = await fetch(`/api/walrus/upload?epochs=${epochs}${sendToParam}`, {
        method: "POST",
        body: uploadBytes as BodyInit,
        headers: { "Content-Type": "application/octet-stream" },
      });
      if (!uploadResponse.ok) {
        throw new Error(`Walrus upload failed: ${uploadResponse.statusText}`);
      }
      const uploadResult = await uploadResponse.json();
      const blobObject = uploadResult.newlyCreated?.blobObject;
      walrusBlobId =
        blobObject?.blobId ??
        uploadResult.alreadyCertified?.blobId;
      walrusBlobObjectId = blobObject?.id ?? "";
      storageEndEpoch = blobObject?.storage?.endEpoch ?? 0;
      if (!walrusBlobId) {
        throw new Error("No blob ID returned from Walrus");
      }

      // For multi-file listings, the quilt ID is the blob ID
      if (encryptedFiles.length > 1) {
        walrusQuiltId = walrusBlobId;
      }

      // Step 4: Finalize listing on-chain (store walrus/seal data, activate, register)
      setStep("finalizing");
      setStepDetail("Finalizing listing...");
      await finalizeMutation.mutateAsync({
        sellerCapId,
        listingId,
        walrusBlobId,
        walrusQuiltId,
        fileNames: files.map((f) => f.name),
        sealKeyId,
        walrusBlobObjectId,
        storageEndEpoch,
        rootHash,
        encodingNonce,
      });

      setStep("done");
      router.push("/seller/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      if (step !== "form") setStep("form");
    }
  };

  const isPending = step !== "form" && step !== "done";

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Playbook Listing</CardTitle>
      </CardHeader>
      <CardContent>
        {isPending && (
          <div className="mb-4 rounded-md bg-muted p-3 text-sm">
            {stepDetail}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Advanced Code Review Agent"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this playbook does..."
              rows={4}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Price (SUI)</Label>
              <Input
                id="price"
                type="number"
                required
                min="0.001"
                step="0.001"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="e.g. 5"
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={setCategory}
                required
                disabled={isPending}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="e.g. agent, code-review, security"
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label>Playbook Files</Label>
            <FileDropZone
              files={files}
              onFilesChange={setFiles}
              maxFiles={MAX_FILES_PER_LISTING}
              maxTotalSize={MAX_TOTAL_FILE_SIZE_BYTES}
              acceptExtensions={ALLOWED_FILE_EXTENSIONS}
              disabled={isPending}
            />
            {files.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="epochs">Storage Duration</Label>
                <Select
                  value={String(epochs)}
                  onValueChange={(v) => setEpochs(Number(v))}
                  disabled={isPending}
                >
                  <SelectTrigger id="epochs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 5, 10, 20, 53].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} epoch{n !== 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <StorageCostEstimate estimate={storageEstimate} />
            <p className="text-xs text-muted-foreground">
              Upload {ALLOWED_FILE_EXTENSIONS.map((ext, i) => (
                <span key={ext}>{i > 0 && (i === ALLOWED_FILE_EXTENSIONS.length - 1 ? ", or " : ", ")}<code>{ext}</code></span>
              ))} files (up to {MAX_FILES_PER_LISTING.toLocaleString()} files, 50MB total).
              Files are encrypted with Seal before upload. Only buyers with a
              valid purchase receipt can decrypt them.
            </p>
          </div>

          <ErrorAlert error={error ? new Error(error) : null} />

          <Button type="submit" disabled={isPending || !category}>
            {isPending ? stepDetail : "Create Listing"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
