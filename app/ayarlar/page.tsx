import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/require-auth";
import { getHabits } from "@/lib/logic";
import Ayarlar from "./ayarlar";

export const dynamic = "force-dynamic";

export default async function AyarlarPage() {
  if (!(await isAuthed())) redirect("/login");
  const habits = getHabits(false);
  return <Ayarlar initial={habits} />;
}
