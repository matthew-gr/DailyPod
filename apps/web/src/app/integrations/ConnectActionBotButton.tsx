"use client";

import { useRouter } from "next/navigation";

interface Props {
  connected: boolean;
}

export function ConnectActionBotButton({ connected }: Props) {
  const router = useRouter();

  async function handleDisconnect() {
    await fetch("/api/integrations/actionbot/status", { method: "DELETE" });
    router.refresh();
  }

  if (connected) {
    return (
      <button
        onClick={handleDisconnect}
        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
      >
        Disconnect
      </button>
    );
  }

  return (
    <a
      href="/api/integrations/actionbot/connect"
      className="inline-flex items-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
    >
      Connect Action Bot
    </a>
  );
}
