"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/integrations", label: "Integrations" },
  { href: "/preferences", label: "Preferences" },
  { href: "/guide", label: "Guide" },
  { href: "/episodes", label: "Episodes" },
];

export function NavBar() {
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-lg font-semibold text-gray-900"
            >
              DailyPod
            </Link>
            <div className="hidden sm:flex items-center gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {session.user?.image ? (
              <img
                src={session.user.image}
                alt=""
                className="h-7 w-7 rounded-full"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                {(session.user?.name || session.user?.email || "?")[0].toUpperCase()}
              </div>
            )}
            <span className="text-sm text-gray-700">
              {session.user?.name || session.user?.email}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
