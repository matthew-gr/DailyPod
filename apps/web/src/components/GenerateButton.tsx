"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export function GenerateButton() {
  const router = useRouter();
  const [state, setState] = useState<
    "idle" | "starting" | "running" | "completed" | "failed"
  >("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stages, setStages] = useState<
    Array<{ stageName: string; output: string }> | null
  >(null);

  const poll = useCallback(async () => {
    if (!runId) return;
    try {
      const res = await fetch(`/api/briefing/${runId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.stagesJson) setStages(data.stagesJson);
      if (data.status === "completed") {
        setState("completed");
        router.push(`/episodes/${runId}`);
      } else if (data.status === "failed") {
        setState("failed");
        setError(data.error || "Pipeline failed");
      }
    } catch {
      // Retry on next poll
    }
  }, [runId, router]);

  useEffect(() => {
    if (state !== "running" || !runId) return;
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [state, runId, poll]);

  async function handleGenerate() {
    setState("starting");
    setError(null);
    setStages(null);

    try {
      const res = await fetch("/api/briefing/generate", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setState("failed");
        setError(data.error || "Failed to start");
        return;
      }

      setRunId(data.runId);
      setState("running");
    } catch {
      setState("failed");
      setError("Network error");
    }
  }

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={state === "starting" || state === "running"}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {state === "idle" && "Generate Today's Briefing"}
        {state === "starting" && "Starting..."}
        {state === "running" && "Generating..."}
        {state === "completed" && "Done!"}
        {state === "failed" && "Try Again"}
      </button>

      {state === "running" && stages && stages.length > 0 && (
        <div className="mt-3 space-y-1">
          {stages.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-green-600">&#10003;</span>
              <span className="text-gray-600">
                {s.stageName.replace(/-/g, " ")}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span className="text-gray-500">Processing...</span>
          </div>
        </div>
      )}

      {state === "running" && (!stages || stages.length === 0) && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          Pipeline running...
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
