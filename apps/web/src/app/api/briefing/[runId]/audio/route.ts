import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
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

  const artifactsBase = process.env.ARTIFACTS_BASE_PATH || "/app/data";
  const audioPath = resolve(artifactsBase, "artifacts", session.user.id, runId, "briefing.mp3");

  if (!existsSync(audioPath)) {
    return NextResponse.json(
      { error: "Audio not yet available" },
      { status: 404 }
    );
  }

  const audioBuffer = await readFile(audioPath);

  const url = new URL(request.url);
  const isDownload = url.searchParams.get("download") === "1";

  const headers: Record<string, string> = {
    "Content-Type": "audio/mpeg",
    "Content-Length": String(audioBuffer.length),
    "Cache-Control": "public, max-age=86400",
  };

  if (isDownload) {
    headers["Content-Disposition"] = `attachment; filename="briefing-${run.date}.mp3"`;
  }

  return new NextResponse(audioBuffer, { headers });
}
