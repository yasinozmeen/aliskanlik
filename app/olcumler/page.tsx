import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/require-auth";
import { getMeasurementHistory } from "@/lib/logic";
import Olcumler from "./olcumler";

export const dynamic = "force-dynamic";

export default async function OlcumlerPage() {
  if (!(await isAuthed())) redirect("/login");
  return <Olcumler initial={getMeasurementHistory()} />;
}
