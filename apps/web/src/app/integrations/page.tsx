import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ConnectGoogleButton } from "./ConnectGoogleButton";
import { ConnectActionBotButton } from "./ConnectActionBotButton";

export default async function IntegrationsPage() {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/login");

  const [connection, actionBotConnection] = await Promise.all([
    prisma.googleConnection.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.actionBotConnection.findUnique({
      where: { userId: session.user.id },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="mt-1 text-gray-600">
          Connect your accounts to enable calendar, document, and task access.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Google Calendar & Drive
            </h2>
            {connection ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-700">Connected</span>
                </div>
                <p className="text-sm text-gray-500">
                  Email: {connection.googleEmail}
                </p>
                <p className="text-sm text-gray-500">
                  Calendar: {connection.calendarId}
                </p>
                <p className="text-sm text-gray-500">
                  Scopes: {connection.scope}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-500">
                Not connected. Connect to enable daily briefings from your
                calendar.
              </p>
            )}
          </div>

          <ConnectGoogleButton connected={!!connection} />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Action Bot
            </h2>
            {actionBotConnection ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm text-gray-700">Connected</span>
                </div>
                <p className="text-sm text-gray-500">
                  Endpoint: {actionBotConnection.mcpEndpoint}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-500">
                Not connected. Connect to include task and workload data in your
                daily briefings.
              </p>
            )}
          </div>

          <ConnectActionBotButton connected={!!actionBotConnection} />
        </div>
      </div>
    </div>
  );
}
