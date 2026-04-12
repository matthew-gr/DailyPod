"use client";

import { useState, useEffect } from "react";

const voiceOptions = ["Charon", "Aoede", "Kore", "Puck", "Fenrir", "Leda", "Orus", "Zephyr"];

const timezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
];

interface Prefs {
  briefingLengthMinutes: number;
  tone: string;
  hostAVoice: string;
  hostBVoice: string;
  newsInterests: string[];
  newsToIgnore: string[];
  timezone: string;
}

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newsInterestsText, setNewsInterestsText] = useState("");
  const [newsIgnoreText, setNewsIgnoreText] = useState("");

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => {
        setPrefs(data);
        setNewsInterestsText((data.newsInterests || []).join(", "));
        setNewsIgnoreText((data.newsToIgnore || []).join(", "));
      });
  }, []);

  async function handleSave() {
    if (!prefs) return;
    setSaving(true);
    setSaved(false);

    const newsInterests = newsInterestsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const newsToIgnore = newsIgnoreText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...prefs, newsInterests, newsToIgnore }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (!prefs) {
    return (
      <div className="text-gray-500 text-sm">Loading preferences...</div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Preferences</h1>
        <p className="mt-1 text-gray-600">
          Customize your daily briefing format and content.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-6">
        {/* Briefing Length */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Briefing Length: {prefs.briefingLengthMinutes} minutes
          </label>
          <input
            type="range"
            min={3}
            max={10}
            value={prefs.briefingLengthMinutes}
            onChange={(e) =>
              setPrefs({ ...prefs, briefingLengthMinutes: Number(e.target.value) })
            }
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>3 min</span>
            <span>10 min</span>
          </div>
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timezone
          </label>
          <select
            value={prefs.timezone}
            onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        {/* Tone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tone
          </label>
          <input
            type="text"
            value={prefs.tone}
            onChange={(e) => setPrefs({ ...prefs, tone: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="e.g., calm, intelligent, practical"
          />
        </div>

        {/* Host Voices */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Host A Voice
            </label>
            <select
              value={prefs.hostAVoice}
              onChange={(e) =>
                setPrefs({ ...prefs, hostAVoice: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              {voiceOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Host B Voice
            </label>
            <select
              value={prefs.hostBVoice}
              onChange={(e) =>
                setPrefs({ ...prefs, hostBVoice: e.target.value })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              {voiceOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* News Interests */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            News Interests (comma-separated)
          </label>
          <textarea
            value={newsInterestsText}
            onChange={(e) => setNewsInterestsText(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="e.g., AI, climate tech, startups"
          />
        </div>

        {/* News to Ignore */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Topics to Ignore (comma-separated)
          </label>
          <textarea
            value={newsIgnoreText}
            onChange={(e) => setNewsIgnoreText(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="e.g., celebrity gossip, sports scores"
          />
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Preferences"}
          </button>
          {saved && (
            <span className="text-sm text-green-600">Saved!</span>
          )}
        </div>
      </div>
    </div>
  );
}
