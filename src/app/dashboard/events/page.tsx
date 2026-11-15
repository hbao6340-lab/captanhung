"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { postJson } from "@/lib/api";
import Link from "next/link";
import QRCode from "qrcode";

type EventRow = {
  id: string;
  eventCode: string;
  title: string;
  status: string;
  checkin_start_at: string;
  checkin_end_at: string;
  checkout_start_at: string | null;
  checkout_end_at: string | null;
  venue_name: string | null;
  _count: { attendance_records: number };
};

function getEventUrl(eventCode: string): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return `${window.location.origin.replace("vercel.app", "vercel.app")}/event/${eventCode}`;
  }
  return `https://captanhung.vercel.app/event/${eventCode}`;
}

type QrCodeCache = { [eventCode: string]: string };
const qrCache: QrCodeCache = {};

async function generateQrCode(eventCode: string): Promise<string> {
  if (qrCache[eventCode]) return qrCache[eventCode];
  const url = getEventUrl(eventCode);
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    });
    qrCache[eventCode] = dataUrl;
    return dataUrl;
  } catch {
    return "";
  }
}

type QrCodeCellProps = { eventCode: string };
function QrCodeCell({ eventCode }: QrCodeCellProps) {
  const [qrData, setQrData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateQrCode(eventCode).then((data) => {
      setQrData(data);
      setLoading(false);
    });
  }, [eventCode]);

  if (loading) return <div className="h-12 w-12 animate-pulse rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">QR</div>;
  if (!qrData) return <div className="h-12 w-12 flex items-center justify-center text-xs text-gray-400">–</div>;

  return (
    <div className="flex flex-col items-center gap-1">
      <img src={qrData} alt="QR code" className="h-10 w-10" />
      <button
        onClick={() => {
          navigator.clipboard.writeText(getEventUrl(eventCode));
        }}
        className="text-[10px] text-indigo-600 hover:underline px-1"
        title="Copy event link"
      >
        Copy link
      </button>
    </div>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/events", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load events");
        const data = await res.json();
        setEvents(data.events ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load events");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function changeStatus(id: string, action: string) {
    if (!confirm(`Are you sure you want to ${action} this event?`)) return;
    try {
      const res = await postJson(`/api/admin/events/${id}/${action}`, {});
      if (!res.ok) { alert("Failed to " + action); return; }
      await loadEvents();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/events", { cache: "no-store" });
      const data = await res.json();
      setEvents(data.events ?? []);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="py-8 text-center text-gray-500">Loading events…</div>;
  }
  if (error) return <div className="py-8 text-center text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Event management</h2>
          <p className="text-gray-600 mt-1">Create, publish, open, pause, and close events.</p>
        </div>
        <Link href="/dashboard/events/create" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-white font-semibold hover:bg-indigo-700">Create event</Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Event</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Code</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">QR Code</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Date / windows</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Venue</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Status</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Check-ins</th>
              <th className="px-4 py-3 text-right text-gray-500 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.length > 0 ? (
              events.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/events/${e.id}`} className="font-medium text-gray-900 hover:text-indigo-600">{e.title}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-800 font-mono text-xs">{e.eventCode}</td>
                  <td className="px-4 py-3">
                    <QrCodeCell eventCode={e.eventCode} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{new Date(e.checkin_start_at).toLocaleDateString()}</div>
                    <div className="text-xs text-gray-400 mt-1">In: {new Date(e.checkin_start_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{e.venue_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      e.status === "OPEN" ? "bg-green-100 text-green-700" :
                      e.status === "UPCOMING" ? "bg-blue-100 text-blue-700" :
                      e.status === "PAUSED" ? "bg-yellow-100 text-yellow-700" :
                      e.status === "CLOSED" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{e.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{e._count.attendance_records}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {e.status === "OPEN" && (
                        <>
                          <button onClick={() => changeStatus(e.id, "pause")} className="text-xs text-yellow-700 hover:underline">Pause</button>
                          <button onClick={() => changeStatus(e.id, "close")} className="text-xs text-red-600 hover:underline">Close</button>
                        </>
                      )}
                      {e.status === "PAUSED" && (
                        <>
                          <button onClick={() => changeStatus(e.id, "open")} className="text-xs text-indigo-600 hover:underline">Open</button>
                          <button onClick={() => changeStatus(e.id, "close")} className="text-xs text-red-600 hover:underline">Close</button>
                        </>
                      )}
                      {e.status === "CLOSED" && (
                        <>
                          <button onClick={() => changeStatus(e.id, "reopen")} className="text-xs text-indigo-600 hover:underline">Reopen</button>
                        </>
                      )}
                      <Link href={`/dashboard/events/${e.id}`} className="text-xs text-gray-600 hover:underline">View</Link>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No events yet. Create your first event.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
