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
} from "@/lib/constants";

type Step =
  | "form"
  | "creating"
  | "encrypting"
  | "uploading"
  | "finalizing"
  | "done";

const STEP_LABELS: Record<Step, string> = {
  form: "Fill in details",
  creating: "Creating listing on-chain...",
  encrypting: "Encrypting content with Seal...",
  uploading: "Uploading to Walrus...",
  finalizing: "Finalizing listing...",
  done: "Done!",
};

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
  const [file, setFile] = useState<File | null>(null);

  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const priceSui = parseFloat(priceStr);
    if (isNaN(priceSui) || priceSui <= 0) return;
    if (!file) {
      setError("Please select a skill file to upload.");
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

      // Step 2: Encrypt file content with Seal using the listing ID
      setStep("encrypting");
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      const { id: sealId, sealKeyId } = buildSealIdentity(listingId);

      const sealClient = getSealClient(suiClient);
      const { encryptedObject } = await sealClient.encrypt({
        threshold: SEAL_THRESHOLD,
        packageId: MARKETPLACE_PACKAGE_ID,
        id: sealId,
        data: fileBytes,
      });

      // Step 3: Upload encrypted bytes to Walrus
      setStep("uploading");
      const uploadResponse = await fetch("/api/walrus/upload", {
        method: "POST",
        body: encryptedObject,
        headers: { "Content-Type": "application/octet-stream" },
      });
      if (!uploadResponse.ok) {
        throw new Error(
          `Walrus upload failed: ${uploadResponse.statusText}`,
        );
      }
      const uploadResult = await uploadResponse.json();
      const walrusBlobId =
        uploadResult.newlyCreated?.blobObject?.blobId ??
        uploadResult.alreadyCertified?.blobId;
      if (!walrusBlobId) {
        throw new Error("No blob ID returned from Walrus");
      }

      // Step 4: Finalize listing on-chain (store walrus/seal data, activate, register)
      setStep("finalizing");
      await finalizeMutation.mutateAsync({
        sellerCapId,
        listingId,
        walrusBlobId,
        walrusQuiltId: null,
        sealKeyId,
      });

      setStep("done");
      router.push("/seller/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      // Reset to form so the user can retry
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
            {STEP_LABELS[step]}
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
            <Label htmlFor="file">Skill File</Label>
            <Input
              id="file"
              type="file"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Your file will be encrypted with Seal before upload. Only buyers
              with a valid purchase receipt can decrypt it.
            </p>
          </div>

          <ErrorAlert
            error={error ? new Error(error) : null}
          />

          <Button type="submit" disabled={isPending || !category}>
            {isPending ? STEP_LABELS[step] : "Create Listing"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
