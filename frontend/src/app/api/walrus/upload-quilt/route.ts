import { NextRequest, NextResponse } from "next/server";

const WALRUS_PUBLISHER_URL = process.env.WALRUS_PUBLISHER_URL;

export async function POST(req: NextRequest) {
  if (!WALRUS_PUBLISHER_URL) {
    return NextResponse.json(
      { error: "Walrus publisher not configured" },
      { status: 503 },
    );
  }

  const formData = await req.formData();

  const outgoing = new FormData();
  for (const [key, value] of formData.entries()) {
    outgoing.append(key, value);
  }

  const epochs = req.nextUrl.searchParams.get("epochs") ?? "5";
  const sendTo = req.nextUrl.searchParams.get("send_object_to") ?? "";
  let url = `${WALRUS_PUBLISHER_URL}/v1/quilts?epochs=${epochs}`;
  if (sendTo) url += `&send_object_to=${sendTo}`;
  const response = await fetch(
    url,
    {
      method: "PUT",
      body: outgoing,
    },
  );
  const result = await response.json();
  if (!response.ok) {
    console.error("[upload-quilt] Walrus error:", response.status, result);
  }
  return NextResponse.json(result, { status: response.status });
}
