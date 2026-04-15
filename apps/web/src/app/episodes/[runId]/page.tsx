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

  const artifactsBase = process.env.ARTIFACTS_BASE_PATH || "data";
  const runArtifactDir = resolve(artifactsBase, "artifacts", session.user.id, runId);

  const scriptPath = resolve(runArtifactDir, "script.json");

  if (existsSync(scriptPath)) {
    try {
      const raw = await readFile(scriptPath, "utf-8");
      script = JSON.parse(raw);
    } catch {
      // Script not available
    }
  }

  const hasAudio = existsSync(resolve(runArtifactDir, "briefing.mp3")) || (run.audioDurationSeconds != null && run.audioDurationSeconds > 0);

  const selectedNews = run.selectedNewsJson
    ? JSON.parse(run.selectedNewsJson)
    : null;

  const meetingContext = run.meetingContextJson
    ? JSON.parse(run.meetingContextJson)
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
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Listen
            </h2>
            <a
              href={`/api/briefing/${runId}/audio?download=1`}
              download={`briefing-${run.date}.mp3`}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              &#8595; Download MP3
            </a>
          </div>
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

      {/* Meeting Context */}
      {meetingContext && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Meeting Context
          </h2>

          {meetingContext.summary && (
            <div className="mb-4">
              <h3 className="text-xs font-medium text-gray-400 uppercase mb-1">Summary</h3>
              <p className="text-sm text-gray-800 leading-relaxed">{meetingContext.summary}</p>
            </div>
          )}

          {meetingContext.keyInsights?.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-medium text-gray-400 uppercase mb-1">Key Insights</h3>
              <ul className="text-sm text-gray-800 space-y-1">
                {meetingContext.keyInsights.map((insight: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-blue-500 mt-0.5">&#8227;</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {meetingContext.pendingItems?.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-medium text-gray-400 uppercase mb-1">Pending Items</h3>
              <ul className="text-sm text-gray-800 space-y-1">
                {meetingContext.pendingItems.map((item: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-orange-500 mt-0.5">&#9679;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {meetingContext.suggestedPrepQuestions?.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-medium text-gray-400 uppercase mb-1">Prep Questions</h3>
              <ul className="text-sm text-gray-800 space-y-1">
                {meetingContext.suggestedPrepQuestions.map((q: string, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-purple-500 mt-0.5">?</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {meetingContext.relatedDocuments?.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-400 uppercase mb-1">Related Documents</h3>
              <ul className="text-sm text-gray-600 space-y-0.5">
                {meetingContext.relatedDocuments.map((doc: { title: string; relevance: string }, i: number) => (
                  <li key={i}>{doc.title} <span className="text-gray-400">— {doc.relevance}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Context Audit — collapsible */}
      {run.scriptPromptUsed && (
        <details className="rounded-lg border border-gray-200 bg-white">
          <summary className="p-4 cursor-pointer text-sm font-medium text-gray-500 uppercase tracking-wide hover:text-gray-700">
            Context Audit — What was fed to the script writer
          </summary>
          <div className="px-6 pb-6">
            <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 rounded p-4 max-h-96 overflow-y-auto font-mono leading-relaxed">
              {run.scriptPromptUsed}
            </pre>
          </div>
        </details>
      )}

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
