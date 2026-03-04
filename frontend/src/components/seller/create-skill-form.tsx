"use client";

import { useState } from "react";
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
import { useCreateSkill } from "@/hooks/use-create-skill";
import { useFinalizeSkill } from "@/hooks/use-finalize-skill";
import { getSealClient } from "@/lib/seal";
import { MOCK_CATEGORIES } from "@/lib/mock-data";
import {
  MIST_PER_SUI,
  MARKETPLACE_PACKAGE_ID,
  SEAL_THRESHOLD,
  MAX_FILES_PER_LISTING,
  MAX_TOTAL_FILE_SIZE_BYTES,
  ALLOWED_FILE_EXTENSIONS,
} from "@/lib/constants";

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
      return `File type "${ext || "(no extension)"}" is not allowed.`;
  }
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CreateSkillForm() {
  const router = useRouter();
  const createSkillMutation = useCreateSkill();
  const finalizeMutation = useFinalizeSkill();
  const suiClient = useCurrentClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [category, setCategory] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [files, setFiles] = useState<File[]>([]);

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
      const createResult = await createSkillMutation.mutateAsync({
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

      // Step 3: Upload encrypted bytes to Walrus
      setStep("uploading");
      let walrusBlobId: string;
      let walrusQuiltId: string | null = null;

      if (encryptedFiles.length === 1) {
        // Single file — use existing blob upload
        setStepDetail("Uploading file to Walrus...");
        const uploadResponse = await fetch("/api/walrus/upload", {
          method: "POST",
          body: encryptedFiles[0].data as BodyInit,
          headers: { "Content-Type": "application/octet-stream" },
        });
        if (!uploadResponse.ok) {
          throw new Error(
            `Walrus upload failed: ${uploadResponse.statusText}`,
          );
        }
        const uploadResult = await uploadResponse.json();
        walrusBlobId =
          uploadResult.newlyCreated?.blobObject?.blobId ??
          uploadResult.alreadyCertified?.blobId;
        if (!walrusBlobId) {
          throw new Error("No blob ID returned from Walrus");
        }
      } else {
        // Multiple files — use quilt upload
        setStepDetail(`Uploading ${encryptedFiles.length} files to Walrus...`);
        const formData = new FormData();
        for (const ef of encryptedFiles) {
          formData.append(
            ef.name,
            new Blob([ef.data as BlobPart], { type: "application/octet-stream" }),
            ef.name,
          );
        }

        const uploadResponse = await fetch("/api/walrus/upload-quilt", {
          method: "POST",
          body: formData,
        });
        if (!uploadResponse.ok) {
          throw new Error(
            `Walrus upload failed: ${uploadResponse.statusText}`,
          );
        }
        const quiltResult = await uploadResponse.json();

        // Walrus quilt API wraps the blob store result under `blobStoreResult`
        const blobStore = quiltResult.blobStoreResult;
        walrusBlobId =
          blobStore?.newlyCreated?.blobObject?.blobId ??
          blobStore?.alreadyCertified?.blobId ??
          "";

        // The quilt ID IS the blobId (Walrus docs: "the quilt ID (blobId)")
        walrusQuiltId = walrusBlobId || null;

        if (!walrusQuiltId) {
          throw new Error("No file ID returned from Walrus");
        }
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
        <CardTitle>New Skill Listing</CardTitle>
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
              placeholder="Describe what this skill does..."
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
            <Label htmlFor="file">Skill Files</Label>
            <Input
              id="file"
              type="file"
              required
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              disabled={isPending}
            />
            {files.length > 0 && (
              <div className="space-y-1 rounded-md border p-2">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="truncate font-mono">{f.name}</span>
                    <span className="ml-2 shrink-0 text-muted-foreground">
                      {formatFileSize(f.size)}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-1 text-xs text-muted-foreground">
                  {files.length} file{files.length !== 1 ? "s" : ""},{" "}
                  {formatFileSize(files.reduce((s, f) => s + f.size, 0))} total
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Upload up to {MAX_FILES_PER_LISTING} files (50MB total). Files
              are encrypted with Seal before upload. Only buyers with a valid
              purchase receipt can decrypt them.
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
