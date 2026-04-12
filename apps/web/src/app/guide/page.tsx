"use client";

import { useState, useEffect } from "react";

export default function GuidePage() {
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/guide")
      .then((r) => r.json())
      .then((data) => {
        setMarkdown(data.markdown || "");
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    await fetch("/api/guide", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading guide...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Briefing Guide</h1>
        <p className="mt-1 text-gray-600">
          Define your VIP contacts, priorities, and preferences in markdown.
          This guide shapes what your daily briefing focuses on.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Guide Markdown
          </label>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            rows={20}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="# Briefing Guide&#10;&#10;## VIP Contacts&#10;- Name: John Doe&#10;  Email: john@example.com&#10;  Context: CTO at partner company&#10;&#10;## Current Priorities&#10;- Ship Q2 product launch&#10;- Prepare board presentation"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Guide"}
          </button>
          {saved && (
            <span className="text-sm text-green-600">Saved!</span>
          )}
        </div>
      </div>

      {/* Preview */}
      {markdown && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Preview
          </h2>
          <div className="prose prose-sm max-w-none text-gray-700">
            {markdown.split("\n").map((line, i) => {
              if (line.startsWith("# ")) {
                return (
                  <h1 key={i} className="text-xl font-bold mt-4 mb-2">
                    {line.slice(2)}
                  </h1>
                );
              }
              if (line.startsWith("## ")) {
                return (
                  <h2 key={i} className="text-lg font-semibold mt-3 mb-1">
                    {line.slice(3)}
                  </h2>
                );
              }
              if (line.startsWith("- ")) {
                return (
                  <li key={i} className="ml-4">
                    {line.slice(2)}
                  </li>
                );
              }
              if (line.trim() === "") {
                return <br key={i} />;
              }
              return (
                <p key={i} className="mb-1">
                  {line}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
