import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getUser } from "~/services/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  return redirect(user ? "/account/security" : "/login");
}
