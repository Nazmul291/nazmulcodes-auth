import { ShieldCheck } from "lucide-react";
import { NavTabs } from "./NavTabs";

export function AccountNav() {
  return <NavTabs items={[{ to: "/account/security", label: "Security", icon: <ShieldCheck className="h-4 w-4" /> }]} />;
}
