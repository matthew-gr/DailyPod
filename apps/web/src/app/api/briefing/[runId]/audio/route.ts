import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
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

  const audioPath = resolve(
    "data",
    "artifacts",
    session.user.id,
    runId,
    "briefing.mp3"
  );

  if (!existsSync(audioPath)) {
    return NextResponse.json(
      { error: "Audio not yet available" },
      { status: 404 }
    );
  }

  const audioBuffer = await readFile(audioPath);

  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBuffer.length),
      "Cache-Control": "public, max-age=86400",
    },
  });
}
