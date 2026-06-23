import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const cookieStore = await cookies();
  const defaultCollapsed = cookieStore.get("si_sidebar_collapsed")?.value === "true";

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-slate-50/50">
      <Sidebar role={user.role} nama={user.nama} defaultCollapsed={defaultCollapsed} />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-[1400px] p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
