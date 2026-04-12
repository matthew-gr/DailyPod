import { redirect, notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AudioPlayer } from "@/components/AudioPlayer";
import { FeedbackForm } from "@/components/FeedbackForm";

interface ScriptLine {
  speaker: string;
  text: string;
  segmentType: string;
}

export default async function EpisodeDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/login");

  const { runId } = await params;

  const run = await prisma.briefingRun.findUnique({
    where: { runId },
    include: { feedback: true },
  });

  if (!run || run.userId !== session.user.id) {
    notFound();
  }

  // Load script from artifacts
  let script: { lines: ScriptLine[]; estimatedDurationSeconds: number } | null =
    null;

  const scriptPath = resolve(
    "data",
    "artifacts",
    session.user.id,
    runId,
    "script.json"
  );

  if (existsSync(scriptPath)) {
    try {
      const raw = await readFile(scriptPath, "utf-8");
      script = JSON.parse(raw);
    } catch {
      // Script not available
    }
  }

  const hasAudio = existsSync(
    resolve("data", "artifacts", session.user.id, runId, "briefing.mp3")
  );

  const selectedNews = run.selectedNewsJson
    ? JSON.parse(run.selectedNewsJson)
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Episode: {run.date}</h1>
        <p className="mt-1 text-gray-600">
          {run.status === "completed" ? "Completed" : run.status}
          {run.audioDurationSeconds &&
            ` | ${Math.round(run.audioDurationSeconds / 60)} minutes`}
        </p>
      </div>

      {/* Audio Player */}
      {hasAudio && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
            Listen
          </h2>
          <AudioPlayer runId={runId} />
        </div>
      )}

      {/* Meeting & News Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {run.selectedMeetingTitle && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-1">
              Focus Meeting
            </h3>
            <p className="text-sm text-gray-900">
              {run.selectedMeetingTitle}
            </p>
          </div>
        )}
        {selectedNews && selectedNews.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-1">
              News Stories
            </h3>
            <ul className="text-sm text-gray-900 space-y-0.5">
              {selectedNews.map((title: string, i: number) => (
                <li key={i}>{title}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Script */}
      {script && script.lines.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Script
          </h2>
          <div className="space-y-3">
            {(() => {
              let currentSegment = "";
              return script.lines.map((line, i) => {
                const showSegment = line.segmentType !== currentSegment;
                if (showSegment) currentSegment = line.segmentType;
                return (
                  <div key={i}>
                    {showSegment && (
                      <div className="mt-4 mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
                        {line.segmentType.replace(/-/g, " ")}
                      </div>
                    )}
                    <div className="flex gap-3">
                      <span
                        className={`text-xs font-medium mt-0.5 min-w-[3rem] ${
                          line.speaker === "host-a"
                            ? "text-blue-600"
                            : "text-purple-600"
                        }`}
                      >
                        {line.speaker === "host-a" ? "Alex" : "Jordan"}
                      </span>
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {line.text}
                      </p>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Feedback */}
      {run.status === "completed" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Feedback
          </h2>
          {run.feedback ? (
            <div className="text-sm text-gray-600">
              <p>
                Rating: {run.feedback.overall}/5
              </p>
              {run.feedback.freeText && (
                <p className="mt-1">{run.feedback.freeText}</p>
              )}
              <p className="mt-2 text-xs text-gray-400">
                Feedback submitted. Thank you!
              </p>
            </div>
          ) : (
            <FeedbackForm runId={runId} />
          )}
        </div>
      )}
    </div>
  );
}
