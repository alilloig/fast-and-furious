"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { MOCK_CATEGORIES, } from "@/lib/mock-data";
import { MIST_PER_SUI } from "@/lib/constants";

export function CreateSkillForm() {
  const router = useRouter();
  const createSkillMutation = useCreateSkill();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [category, setCategory] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const priceSui = parseFloat(priceStr);
    if (isNaN(priceSui) || priceSui <= 0) return;

    const price = BigInt(Math.floor(priceSui * Number(MIST_PER_SUI)));
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    let walrusBlobId = "placeholder";

    if (file) {
      setUploading(true);
      try {
        const bytes = await file.arrayBuffer();
        const response = await fetch("/api/walrus/upload", {
          method: "POST",
          body: bytes,
          headers: { "Content-Type": "application/octet-stream" },
        });
        const result = await response.json();
        walrusBlobId =
          result.newlyCreated?.blobObject?.blobId ??
          result.alreadyCertified?.blobId ??
          "unknown";
      } catch {
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    createSkillMutation.mutate(
      {
        title,
        description,
        price,
        category,
        tags,
        walrusBlobId,
        walrusQuiltId: null,
        sealKeyId: [0], // placeholder for MVP
      },
      {
        onSuccess: () => router.push("/seller/dashboard"),
      },
    );
  };

  const isPending = uploading || createSkillMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Skill Listing</CardTitle>
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
              placeholder="e.g. Advanced Code Review Agent"
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory} required>
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Skill File</Label>
            <Input
              id="file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Note: For MVP, files are uploaded unencrypted to Walrus. Seal
              encryption requires a contract update to support pre-upload
              encryption.
            </p>
          </div>

          <ErrorAlert
            error={
              createSkillMutation.error instanceof Error
                ? createSkillMutation.error
                : null
            }
          />

          <Button type="submit" disabled={isPending || !category}>
            {isPending ? "Creating..." : "Create Listing"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
