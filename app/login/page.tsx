import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./login-form";
import { defaultSettings, getSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  let store = defaultSettings;
  try { store = await getSettings(); } catch { /* use safe defaults while database is unavailable */ }
  return <LoginForm storeName={store.storeName} branchName={store.branchName} legalName={store.legalName} />;
}
