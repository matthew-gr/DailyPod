"use client";

import { useRef, useState, useEffect } from "react";

interface AudioPlayerProps {
  runId: string;
}

export function AudioPlayer({ runId }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const time = Number(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }

  const SPEEDS = [1, 1.25, 1.5, 1.75, 2];

  function cycleSpeed() {
    const audio = audioRef.current;
    if (!audio) return;
    const nextIndex = (SPEEDS.indexOf(speed) + 1) % SPEEDS.length;
    const nextSpeed = SPEEDS[nextIndex];
    audio.playbackRate = nextSpeed;
    setSpeed(nextSpeed);
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <audio ref={audioRef} src={`/api/briefing/${runId}/audio`} preload="metadata" />
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          {playing ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <rect x="5" y="4" width="3" height="12" rx="1" />
              <rect x="12" y="4" width="3" height="12" rx="1" />
            </svg>
          ) : (
            <svg className="h-4 w-4 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 4l10 6-10 6V4z" />
            </svg>
          )}
        </button>
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 accent-blue-600"
          />
        </div>
        <span className="text-sm text-gray-500 tabular-nums min-w-[4rem] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <button
          onClick={cycleSpeed}
          className="text-xs font-medium text-gray-600 bg-gray-200 hover:bg-gray-300 rounded px-2 py-1 min-w-[3rem] transition-colors"
          title="Playback speed"
        >
          {speed}x
        </button>
      </div>
    </div>
  );
}
