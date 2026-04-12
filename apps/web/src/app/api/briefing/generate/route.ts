import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { startRun } from "@/lib/background-runner";

export async function POST() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const { runId } = await startRun(session.user.id, today);
    return NextResponse.json({ runId, status: "running" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start run";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
