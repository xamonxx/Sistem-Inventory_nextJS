import { NextResponse } from "next/server";
import { universalSearch } from "@/components/CommandPaletteActions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const results = await universalSearch(query);
  return NextResponse.json({ results });
}
