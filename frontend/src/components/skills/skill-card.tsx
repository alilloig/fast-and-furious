import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "./price-display";
import { truncateAddress } from "@/lib/utils";
import type { SkillListing } from "@/lib/types";

export function SkillCard({ skill }: { skill: SkillListing }) {
  return (
    <Link href={`/skill/${skill.id}`}>
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-1 text-base">{skill.title}</CardTitle>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {skill.category}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {skill.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {skill.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {skill.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{skill.tags.length - 3}
              </Badge>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between text-sm">
          <PriceDisplay price={skill.price} className="font-semibold" />
          <span className="text-muted-foreground">
            {truncateAddress(skill.seller)}
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
