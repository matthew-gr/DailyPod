"use client";

import { useRouter } from "next/navigation";

interface Props {
  connected: boolean;
}

export function ConnectGoogleButton({ connected }: Props) {
  const router = useRouter();

  async function handleDisconnect() {
    await fetch("/api/integrations/google/status", { method: "DELETE" });
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
      href="/api/integrations/google/connect"
      className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
    >
      Connect Google
    </a>
  );
}
