import { NextResponse } from "next/server";
import { universalSearch } from "@/components/CommandPaletteActions";
import { getSession } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/requestGuards";

export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const results = await universalSearch(query);
  return NextResponse.json({ results });
}
