import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function EpisodesPage() {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/login");

  const runs = await prisma.briefingRun.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Episodes</h1>
        <p className="mt-1 text-gray-600">
          Your briefing history.
        </p>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-500">No episodes yet.</p>
          <Link
            href="/dashboard"
            className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Generate your first briefing &rarr;
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {runs.map((run) => (
            <div
              key={run.id}
              className="flex items-center justify-between px-5 py-4"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">
                    {run.date}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      run.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : run.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {run.status}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {run.selectedMeetingTitle && (
                    <span>Focus: {run.selectedMeetingTitle}</span>
                  )}
                  {run.audioDurationSeconds && (
                    <span className="ml-2">
                      {Math.round(run.audioDurationSeconds / 60)} min
                    </span>
                  )}
                </div>
              </div>
              {run.status === "completed" && (
                <Link
                  href={`/episodes/${run.runId}`}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  View
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
