import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { CommandPalette } from "@/components/CommandPalette";
import { FloatingActionButton } from "@/components/FloatingActionButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();

  if (!user) {
    return (
      <html lang="id">
        <head>
          <meta httpEquiv="refresh" content="0;url=/login" />
        </head>
        <body>
          <p>Redirecting...</p>
        </body>
      </html>
    );
  }

  const cookieStore = await cookies();
  const defaultCollapsed = cookieStore.get("si_sidebar_collapsed")?.value === "true";

  return (
    <div className="flex min-h-screen flex-col bg-transparent lg:flex-row">
      <CommandPalette role={user.role} />
      <FloatingActionButton role={user.role} />
      <Sidebar role={user.role} nama={user.nama} defaultCollapsed={defaultCollapsed} />
      <div className="flex flex-1 flex-col min-w-0">
        <TopNav nama={user.nama} role={user.role} />
        <main className="min-w-0 flex-1 p-4 md:p-7 lg:p-8 pb-28 md:pb-28 lg:pb-28">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
