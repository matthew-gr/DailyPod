import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
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

  const body = await request.json();
  const { overall, segments, freeText, annotations } = body;

  // Save feedback
  await prisma.briefingFeedback.upsert({
    where: { briefingRunId: run.id },
    create: {
      briefingRunId: run.id,
      overall: overall ?? 3,
      segmentsJson: segments ? JSON.stringify(segments) : null,
      freeText: freeText || null,
      annotationsJson: annotations ? JSON.stringify(annotations) : null,
    },
    update: {
      overall: overall ?? 3,
      segmentsJson: segments ? JSON.stringify(segments) : null,
      freeText: freeText || null,
      annotationsJson: annotations ? JSON.stringify(annotations) : null,
    },
  });

  // Update learned preferences based on accumulated feedback
  try {
    const allFeedback = await prisma.briefingFeedback.findMany({
      where: { briefingRun: { userId: session.user.id } },
      include: { briefingRun: true },
    });

    // Build simple learned preferences from feedback history
    const feedbackCount = allFeedback.length;
    const avgRating =
      allFeedback.reduce((sum, f) => sum + f.overall, 0) / feedbackCount;

    const moreOf: string[] = [];
    const lessOf: string[] = [];

    // Collect free text themes
    for (const fb of allFeedback) {
      if (fb.freeText) {
        if (fb.overall >= 4) {
          moreOf.push(fb.freeText);
        } else if (fb.overall <= 2) {
          lessOf.push(fb.freeText);
        }
      }
    }

    const learnedPrefs = {
      feedbackCount,
      averageRating: Math.round(avgRating * 10) / 10,
      meetingPrep: { moreOf: moreOf.slice(-3), lessOf: lessOf.slice(-3) },
      news: { moreOf: [], lessOf: [] },
      tone: { moreOf: [], lessOf: [] },
    };

    // Collect line annotations as examples
    const goodExamples: Array<{ line: string; note?: string }> = [];
    const badExamples: Array<{ line: string; note?: string }> = [];

    for (const fb of allFeedback) {
      if (fb.annotationsJson) {
        const anns = JSON.parse(fb.annotationsJson);
        for (const ann of anns) {
          if (ann.rating === "good") {
            goodExamples.push({ line: ann.text, note: ann.note });
          } else if (ann.rating === "bad") {
            badExamples.push({ line: ann.text, note: ann.note });
          }
        }
      }
    }

    const learnedExamples = {
      good: goodExamples.slice(-10),
      bad: badExamples.slice(-10),
    };

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        learnedPreferences: JSON.stringify(learnedPrefs),
        learnedExamples: JSON.stringify(learnedExamples),
      },
    });
  } catch {
    // Non-critical — feedback is already saved
    console.error("Failed to update learned preferences");
  }

  return NextResponse.json({ success: true });
}
