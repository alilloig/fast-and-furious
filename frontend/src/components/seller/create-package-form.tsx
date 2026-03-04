"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorAlert } from "@/components/error-alert";
import { useCreatePackage } from "@/hooks/use-create-package";
import { useMyListings } from "@/hooks/use-my-listings";
import { formatSui } from "@/lib/utils";
import { MIST_PER_SUI } from "@/lib/constants";

export function CreatePackageForm() {
  const router = useRouter();
  const createPackageMutation = useCreatePackage();
  const { data: myListings } = useMyListings();
  const activeListings = myListings?.filter((l) => l.listing.isActive) ?? [];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [discountStr, setDiscountStr] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSkill = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sumIndividualPrices = activeListings
    .filter((l) => selectedIds.has(l.listing.id))
    .reduce((sum, l) => sum + l.listing.price, 0n);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0) return;

    const priceSui = parseFloat(priceStr);
    if (isNaN(priceSui) || priceSui <= 0) return;

    const price = BigInt(Math.floor(priceSui * Number(MIST_PER_SUI)));
    const discountBps = Math.round(parseFloat(discountStr || "0") * 100);
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    createPackageMutation.mutate(
      {
        title,
        description,
        skillIds: Array.from(selectedIds),
        price,
        discountBps,
        tags,
      },
      {
        onSuccess: () => router.push("/seller/dashboard"),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Package Listing</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Developer Toolkit Bundle"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this package..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Select Skills</Label>
            {activeListings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You have no active skill listings. Create skills first.
              </p>
            ) : (
              <div className="space-y-2 rounded-md border p-3">
                {activeListings.map(({ listing }) => (
                  <label
                    key={listing.id}
                    className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(listing.id)}
                      onChange={() => toggleSkill(listing.id)}
                      className="h-4 w-4"
                    />
                    <span className="flex-1 text-sm">{listing.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatSui(listing.price)}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {selectedIds.size > 0 && (
              <p className="text-xs text-muted-foreground">
                Sum of individual prices: {formatSui(sumIndividualPrices)}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Package Price (SUI)</Label>
              <Input
                id="price"
                type="number"
                required
                min="0.001"
                step="0.001"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="e.g. 12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount">Discount (%)</Label>
              <Input
                id="discount"
                type="number"
                min="0"
                max="50"
                step="1"
                value={discountStr}
                onChange={(e) => setDiscountStr(e.target.value)}
                placeholder="e.g. 20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="e.g. bundle, development, security"
            />
          </div>

          <ErrorAlert
            error={
              createPackageMutation.error instanceof Error
                ? createPackageMutation.error
                : null
            }
          />

          <Button
            type="submit"
            disabled={createPackageMutation.isPending || selectedIds.size === 0}
          >
            {createPackageMutation.isPending ? "Creating..." : "Create Package"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
