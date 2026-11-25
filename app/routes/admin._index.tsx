import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { requireSuperAdmin } from "~/services/super-admin.server";

export function loader({ request }: LoaderFunctionArgs) {
  requireSuperAdmin(request);
  return redirect("/admin/apps");
}
