import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchSystemNotifications } from "@/components/NotificationActions";

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifications = await fetchSystemNotifications();
  return NextResponse.json({ notifications });
}
