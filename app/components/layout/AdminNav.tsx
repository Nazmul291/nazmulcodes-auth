import { Boxes } from "lucide-react";
import { NavTabs } from "./NavTabs";

export function AdminNav() {
  return <NavTabs items={[{ to: "/admin/apps", label: "Client apps", icon: <Boxes className="h-4 w-4" /> }]} />;
}
