import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import OfflineBanner from "@/components/OfflineBanner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }
  if (!profile.active) {
    redirect("/login?erro=inativo");
  }

  return (
    <div className="flex min-h-screen">
      <OfflineBanner />
      <Sidebar role={profile.role} name={profile.full_name} />
      <div className="flex min-h-screen flex-1 flex-col pb-20 md:pb-0">{children}</div>
      <BottomNav role={profile.role} />
    </div>
  );
}
