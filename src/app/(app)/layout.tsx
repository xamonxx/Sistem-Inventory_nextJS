import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { TopNav } from "@/components/TopNav";
import { CommandPalette } from "@/components/CommandPalette";
import { FloatingActionButton } from "@/components/FloatingActionButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const cookieStore = await cookies();
  const defaultCollapsed = cookieStore.get("si_sidebar_collapsed")?.value === "true";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-[#f8f9fb]">
      {/* Universal Command Palette */}
      <CommandPalette role={user.role} />

      {/* Floating Action Button */}
      <FloatingActionButton role={user.role} />

      {/* Left Sidebar Menu */}
      <Sidebar role={user.role} nama={user.nama} defaultCollapsed={defaultCollapsed} />
      
      {/* Main Viewport Container */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Desktop Header Top Nav */}
        <TopNav nama={user.nama} role={user.role} />

        {/* Spacious Content Area — extra bottom padding so the floating action
            button never overlaps page content / action buttons */}
        <main className="min-w-0 flex-1 p-4 md:p-8 lg:p-10 pb-28 md:pb-28 lg:pb-28">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

