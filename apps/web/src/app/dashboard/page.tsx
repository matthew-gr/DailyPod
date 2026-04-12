import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GenerateButton } from "@/components/GenerateButton";

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/login");

  const [connection, latestRuns] = await Promise.all([
    prisma.googleConnection.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.briefingRun.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const latestRun = latestRuns[0] || null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-gray-600">
          Welcome back, {session.user.name || session.user.email}
        </p>
      </div>

      {/* Connection Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
          Google Calendar
        </h2>
        {connection ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm text-gray-700">
              Connected as {connection.googleEmail}
            </span>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-gray-600 mb-2">
              Connect your Google Calendar to generate briefings.
            </p>
            <Link
              href="/integrations"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Connect now &rarr;
            </Link>
          </div>
        )}
      </div>

      {/* Generate */}
      {connection && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Generate Briefing
          </h2>
          <GenerateButton />
        </div>
      )}

      {/* Latest Briefing */}
      {latestRun && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Latest Briefing
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {latestRun.date}
              </p>
              <p className="text-sm text-gray-500">
                Status:{" "}
                <span
                  className={
                    latestRun.status === "completed"
                      ? "text-green-600"
                      : latestRun.status === "failed"
                      ? "text-red-600"
                      : "text-yellow-600"
                  }
                >
                  {latestRun.status}
                </span>
                {latestRun.selectedMeetingTitle && (
                  <> &middot; Focus: {latestRun.selectedMeetingTitle}</>
                )}
                {latestRun.audioDurationSeconds && (
                  <>
                    {" "}
                    &middot;{" "}
                    {Math.round(latestRun.audioDurationSeconds / 60)} min
                  </>
                )}
              </p>
            </div>
            {latestRun.status === "completed" && (
              <Link
                href={`/episodes/${latestRun.runId}`}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Listen &rarr;
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Recent Runs */}
      {latestRuns.length > 1 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Recent Episodes
          </h2>
          <div className="divide-y divide-gray-100">
            {latestRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <span className="text-sm text-gray-900">{run.date}</span>
                  <span
                    className={`ml-2 text-xs ${
                      run.status === "completed"
                        ? "text-green-600"
                        : run.status === "failed"
                        ? "text-red-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {run.status}
                  </span>
                </div>
                {run.status === "completed" && (
                  <Link
                    href={`/episodes/${run.runId}`}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    View
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
