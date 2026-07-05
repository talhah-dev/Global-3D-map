import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  const accessKey =
    process.env.UNSPLASH_ACCESS_KEY ??
    process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    return NextResponse.json(
      { error: "Missing Unsplash access key", results: [] },
      { status: 500 }
    );
  }

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "4");
  url.searchParams.set("client_id", accessKey);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  const data = await response.json();

  return NextResponse.json(data, { status: response.status });
}
