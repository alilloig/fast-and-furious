import { NextRequest, NextResponse } from "next/server";

const WALRUS_PUBLISHER_URL = process.env.WALRUS_PUBLISHER_URL;

export async function POST(req: NextRequest) {
  if (!WALRUS_PUBLISHER_URL) {
    return NextResponse.json(
      { error: "Walrus publisher not configured" },
      { status: 503 },
    );
  }

  const epochs = req.nextUrl.searchParams.get("epochs") ?? "5";
  const sendTo = req.nextUrl.searchParams.get("send_object_to") ?? "";
  const body = await req.arrayBuffer();
  let url = `${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=${epochs}&deletable=true`;
  if (sendTo) url += `&send_object_to=${sendTo}`;
  const response = await fetch(url, {
    method: "PUT",
    body,
    headers: { "Content-Type": "application/octet-stream" },
  });
  const result = await response.json();
  return NextResponse.json(result, { status: response.status });
}
