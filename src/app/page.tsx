"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getJson } from "@/lib/api";

type Event = {
  id: string;
  event_code: string;
  title: string;
  description: string | null;
  banner_image: string | null;
  venue_name: string | null;
  venue_address: string | null;
  checkin_start_at: string;
  checkin_end_at: string;
  status: string;
  _count?: { attendance_records: number };
};

async function fetchEvents(search = ""): Promise<Event[]> {
  try {
    const res = await getJson<{ events: Event[] }>(
      `/api/events?search=${encodeURIComponent(search ?? "")}`
    );
    return res.events ?? [];
  } catch {
    return [];
  }
}

export default function Home({ searchParams }: { searchParams?: { [key: string]: string } }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchEvents(searchParams?.search ?? "");
        if (!cancelled) setEvents(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams?.search]);

  // Auto-refresh listings every 30 seconds
  useEffect(() => {
    const t = setInterval(() => {
      fetchEvents(searchParams?.search ?? "").then((data) => setEvents(data));
    }, 30000);
    return () => clearInterval(t);
  }, [searchParams?.search]);

  return (
    <div className="flex flex-col min-h-screen bg-[#f3f4f6]">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="font-bold text-xl text-indigo-700 tracking-tight">
              CAPTANHUNG
            </Link>
            <div className="flex items-center gap-3">
              <a href="/admin-login" className="text-sm text-gray-600 hover:text-indigo-600 underline">
                Admin login
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Events open for attendance</h1>
          <p className="text-gray-600 mt-1">
            Browse public events and check in with GPS-verified attendance.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <input
              id="event-search"
              type="search"
              placeholder="Search events by name or venue…"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 ring-1 ring-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none sm:text-sm"
            />
            <button
              onClick={() => {
                const q = (document.getElementById("event-search") as HTMLInputElement | null)?.value ?? "";
                const url = new URL(window.location.href);
                url.searchParams.set("search", q);
                window.location.href = url.toString();
              }}
              className="mt-2 sm:mt-0 sm:absolute sm:right-1 sm:top-2 rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 focus:outline-none"
            >
              Search
            </button>
          </div>
        </div>

        {loading && <div className="text-center py-10 text-gray-500">Loading events…</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.length > 0 ? (
            events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))
          ) : (
            <div className="col-span-3 text-center py-20">
              <p className="text-gray-500">
                No events found{searchParams?.search ? ` matching "${searchParams.search}"` : ""}.
              </p>
              {searchParams?.search ? (
                <p className="text-gray-400 text-sm mt-2">Try adjusting your search.</p>
              ) : (
                <p className="text-gray-400 text-sm mt-2">
                  Check back soon \u2014 new events are published here.
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          CAPTANHUNG \u2014 GPS-Verified Event Attendance Management
        </div>
      </footer>
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  const canCheckIn = event.status === "OPEN";
  const statusLabel =
    event.status === "OPEN"
      ? "Open for check-in"
      : event.status === "UPCOMING"
        ? "Upcoming"
        : event.status === "CLOSED"
          ? "Closed"
          : event.status;
  const starts = new Date(event.checkin_start_at).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link href={`/event/${event.event_code}`} className="group block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition">
      <div className="h-40 bg-gray-100 relative">
        {event.banner_image ? (
          <img src={event.banner_image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
            Event banner
          </div>
        )}
        <span className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium ${canCheckIn ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
          {statusLabel}
        </span>
      </div>
      <div className="p-5">
        <h3 className="font-bold text-gray-900 leading-tight group-hover:text-indigo-600">
          {event.title}
        </h3>
        <p className="text-gray-600 text-sm line-clamp-2 mt-2">{event.description ?? ""}</p>
        <div className="mt-3 flex flex-col gap-1 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span className="w-5 text-gray-400">📍</span> {event.venue_name ?? "Venue TBD"}
          </div>
          <div className="flex items-center gap-1">
            <span className="w-5 text-gray-400">🕐</span> {starts}
          </div>
        </div>
      </div>
      <div className="bg-gray-50 px-5 py-3 border-t border-gray-200">
        <button
          disabled={!canCheckIn}
          className={`w-full rounded-md py-2 text-sm font-semibold transition ${canCheckIn ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
        >
          {canCheckIn ? "Check attendance" : "Not open yet"}
        </button>
      </div>
    </Link>
  );
}
