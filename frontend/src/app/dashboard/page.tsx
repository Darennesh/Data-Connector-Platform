"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";
import Link from "next/link";

interface Stats {
  connections: number;
  submissions: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ connections: 0, submissions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [connRes, subRes] = await Promise.all([
          api.get("/connectors/"),
          api.get("/submissions/"),
        ]);
        setStats({
          connections:
            connRes.data?.count ??
            connRes.data?.results?.length ??
            connRes.data?.length ??
            0,
          submissions:
            subRes.data?.count ??
            subRes.data?.results?.length ??
            subRes.data?.length ??
            0,
        });
      } catch {
        // keep defaults
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const cards = [
    {
      title: "Connections",
      value: stats.connections,
      description: "Active database connections",
      href: "/dashboard/connections",
      bg: "bg-brand-50",
      textColor: "text-brand-700",
      color: "from-brand-500 to-brand-700",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      ),
    },
    {
      title: "Submissions",
      value: stats.submissions,
      description: "Data extraction batches",
      href: "/dashboard/submissions",
      bg: "bg-amber-50",
      textColor: "text-accent-700",
      color: "from-accent-400 to-accent-600",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
      ),
    },
    {
      title: "Data Browser",
      value: "Browse",
      description: "Query & preview live data",
      href: "/dashboard/browser",
      bg: "bg-emerald-50",
      textColor: "text-emerald-700",
      color: "from-emerald-500 to-emerald-700",
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Welcome back, <span className="text-brand-600">{user?.username}</span>
        </h1>
        <p className="mt-1 text-gray-500">
          Here&apos;s an overview of your data platform activity.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group relative bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg hover:border-brand-200 transition-all duration-300 overflow-hidden"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {card.title}
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {loading ? (
                    <span className="inline-block w-12 h-8 bg-gray-100 rounded animate-pulse" />
                  ) : (
                    card.value
                  )}
                </p>
                <p className="mt-1 text-xs text-gray-400">{card.description}</p>
              </div>
              <div
                className={`${card.bg} p-3 rounded-xl ${card.textColor} group-hover:scale-110 transition-transform duration-300`}
              >
                {card.icon}
              </div>
            </div>
            <div
              className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${card.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
            />
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/dashboard/connections"
            className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shrink-0">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
                New Connection
              </p>
              <p className="text-xs text-gray-400">
                Connect to PostgreSQL, MySQL, MongoDB, and more
              </p>
            </div>
          </Link>
          <Link
            href="/dashboard/browser"
            className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-emerald-300 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shrink-0">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                Browse Data
              </p>
              <p className="text-xs text-gray-400">
                Query and preview data from your connections
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
