import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/require-auth";
import { getState } from "@/lib/logic";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isAuthed())) redirect("/login");
  const initial = getState();
  return <Dashboard initial={initial} />;
}
