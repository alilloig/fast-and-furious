"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MOCK_CATEGORIES } from "@/lib/mock-data";

export type ListingType = "all" | "skills" | "packages";
export type SortOption = "newest" | "price-asc" | "price-desc";

interface ListingFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  type: ListingType;
  onTypeChange: (value: ListingType) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
}

export function ListingFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  type,
  onTypeChange,
  sort,
  onSortChange,
}: ListingFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search skills..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {MOCK_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => onSortChange(v as SortOption)}>
          <SelectTrigger className="sm:w-[160px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price-asc">Price: Low to High</SelectItem>
            <SelectItem value="price-desc">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["all", "skills", "packages"] as const).map((t) => (
          <Badge
            key={t}
            variant={type === t ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => onTypeChange(t)}
          >
            {t === "all" ? "All" : t === "skills" ? "Skills" : "Packages"}
          </Badge>
        ))}
      </div>
    </div>
  );
}
