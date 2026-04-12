"use client";

import { useState } from "react";

interface FeedbackFormProps {
  runId: string;
}

export function FeedbackForm({ runId }: FeedbackFormProps) {
  const [overall, setOverall] = useState(3);
  const [freeText, setFreeText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`/api/briefing/${runId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overall, freeText }),
      });

      if (res.ok) {
        setSubmitted(true);
      }
    } catch {
      // Ignore
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Thank you for your feedback! It helps improve future briefings.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Overall Rating
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setOverall(n)}
              className={`h-10 w-10 rounded-lg border text-sm font-medium transition-colors ${
                n <= overall
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 bg-white text-gray-500 hover:border-gray-400"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          1 = not useful, 5 = excellent
        </p>
      </div>

      <div>
        <label
          htmlFor="feedback-text"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          What could be better? (optional)
        </label>
        <textarea
          id="feedback-text"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          placeholder="e.g., Too much news detail, wanted more meeting prep..."
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {submitting ? "Submitting..." : "Submit Feedback"}
      </button>
    </form>
  );
}
