import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId } = await params;

  const run = await prisma.briefingRun.findUnique({
    where: { runId },
  });

  if (!run || run.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    runId: run.runId,
    date: run.date,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    error: run.error,
    stagesJson: run.stagesJson ? JSON.parse(run.stagesJson) : null,
    selectedMeetingTitle: run.selectedMeetingTitle,
    selectedNewsJson: run.selectedNewsJson
      ? JSON.parse(run.selectedNewsJson)
      : null,
    audioDurationSeconds: run.audioDurationSeconds,
  });
}
