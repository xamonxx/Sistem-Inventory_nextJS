import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

async function logout() {
  await destroySession();
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/login",
    },
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return logout();
}

export async function GET() {
  return logout();
}
