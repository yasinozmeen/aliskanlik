import { NextResponse } from "next/server";
import { runNotify } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("token") !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runNotify(searchParams.get("force") === "1");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
