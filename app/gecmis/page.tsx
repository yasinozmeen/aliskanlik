import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/require-auth";
import { getHistory } from "@/lib/logic";
import Gecmis from "./gecmis";

export const dynamic = "force-dynamic";

export default async function GecmisPage() {
  if (!(await isAuthed())) redirect("/login");
  return <Gecmis initial={getHistory(90)} />;
}
