"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreatePlaybookForm } from "@/components/seller/create-playbook-form";

export default function CreatePlaybookPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/seller/dashboard">Back to Dashboard</Link>
      </Button>
      <CreatePlaybookForm />
    </div>
  );
}
