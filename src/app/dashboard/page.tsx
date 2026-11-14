"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

type Stats = {
  total_events: number;
  upcoming_events: number;
  open_events: number;
  closed_events: number;
  total_checkins: number;
  completed_attendance: number;
  missing_checkouts: number;
  flagged_submissions: number;
};

type Activity = {
  reference: string;
  name: string;
  status: string;
  checkin_at: string | null;
  checkout_at: string | null;
  eventTitle: string;
  eventCode: string;
};

async function loadDashboard() {
  const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json();
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadDashboard();
        if (!cancelled) {
          setStats(data.stats);
          setActivity(data.recent_activity ?? []);
        }
      } catch {
        if (!cancelled) setStats({
          total_events: 0, upcoming_events: 0, open_events: 0, closed_events: 0,
          total_checkins: 0, completed_attendance: 0, missing_checkouts: 0, flagged_submissions: 0,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const s = stats ?? {
    total_events: 0, upcoming_events: 0, open_events: 0, closed_events: 0,
    total_checkins: 0, completed_attendance: 0, missing_checkouts: 0, flagged_submissions: 0,
  };

  const statCards: { label: string; value: string | number; delta?: string }[] = [
    { label: "Total events", value: s.total_events },
    { label: "Upcoming", value: s.upcoming_events },
    { label: "Open now", value: s.open_events },
    { label: "Closed", value: s.closed_events },
    { label: "Total check-ins", value: s.total_checkins },
    { label: "Completed", value: s.completed_attendance },
    { label: "Missing check-outs", value: s.missing_checkouts, delta: s.missing_checkouts > 0 ? "needs review" : undefined },
    { label: "Flagged submissions", value: s.flagged_submissions, delta: s.flagged_submissions > 0 ? "needs review" : undefined },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
        <p className="text-gray-600 mt-1">Attendance summary across all events.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <p className="text-sm text-gray-500">{s.label}</p>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-2xl font-bold text-gray-900">{s.value}</span>
              {s.delta && <span className="text-xs text-red-600 font-medium">{s.delta}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-900">Recent attendance activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-gray-500 font-medium">Reference</th>
                <th className="px-4 py-3 text-left text-gray-500 font-medium">Participant</th>
                <th className="px-4 py-3 text-left text-gray-500 font-medium">Event</th>
                <th className="px-4 py-3 text-left text-gray-500 font-medium">Status</th>
                <th className="px-4 py-3 text-left text-gray-500 font-medium">Check-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activity.length > 0 ? (
                activity.map((a) => (
                  <tr key={a.reference}>
                    <td className="px-4 py-3 text-gray-900 font-mono text-xs">{a.reference}</td>
                    <td className="px-4 py-3 text-gray-800">{a.name}</td>
                    <td className="px-4 py-3 text-gray-800">{a.eventTitle} ({a.eventCode})</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${a.status === "COMPLETED" ? "bg-green-100 text-green-700" : a.status === "CHECKED_IN" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{a.checkin_at ? new Date(a.checkin_at).toLocaleString() : "—"}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No recent activity.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
