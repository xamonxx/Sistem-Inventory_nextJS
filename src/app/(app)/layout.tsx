import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { CommandPalette } from "@/components/CommandPalette";
import { FloatingActionButton } from "@/components/FloatingActionButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const defaultCollapsed = cookieStore.get("si_sidebar_collapsed")?.value === "true";

  return (
    <div className="app-shell-bg flex min-h-screen flex-col overflow-x-clip lg:flex-row">
      <CommandPalette role={user.role} />
      <FloatingActionButton role={user.role} />
      <Sidebar role={user.role} nama={user.nama} defaultCollapsed={defaultCollapsed} />
      <div className="app-shell-main app-content-surface flex flex-1 flex-col min-w-0">
        <TopNav nama={user.nama} role={user.role} />
        <main id="main-content" className="min-w-0 flex-1 overflow-x-clip px-3 py-4 pb-28 sm:px-4 md:px-6 md:py-7 lg:px-8 lg:py-8 lg:pb-28">
          <div className="mx-auto w-full max-w-[1600px] min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
