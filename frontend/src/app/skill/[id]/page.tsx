"use client";

import { use } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PriceDisplay } from "@/components/skills/price-display";
import { useSkillDetail } from "@/hooks/use-skill-detail";
import { truncateAddress } from "@/lib/utils";

export default function SkillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: skill, isLoading } = useSkillDetail(id);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8 text-center">
        <h1 className="text-2xl font-bold">Skill not found</h1>
        <Button asChild variant="ghost" className="mt-4">
          <Link href="/explore">Back to Explore</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/explore">Back</Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-2xl">{skill.title}</CardTitle>
            <Badge variant="secondary">{skill.category}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">{skill.description}</p>

          <div className="flex flex-wrap gap-2">
            {skill.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm text-muted-foreground">Price</div>
              <PriceDisplay price={skill.price} className="text-xl font-bold" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Seller</div>
              <div className="font-mono text-sm">{truncateAddress(skill.seller, 8)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Listed Epoch</div>
              <div className="text-sm">{skill.createdAtEpoch}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Walrus Blob</div>
              <div className="truncate font-mono text-sm">{skill.walrusBlobId}</div>
            </div>
          </div>

          <Separator />

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <Button size="lg" disabled>
                  Purchase
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Coming in Phase 4</TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>
    </div>
  );
}
