"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";

type RecordRow = {
  id: string;
  attendanceReference: string;
  participantName: string;
  participantPhone: string;
  attendanceStatus: string;
  checkinAt: string | null;
  checkoutAt: string | null;
  checkinLatitude: number | null;
  checkinLongitude: number | null;
  checkinAccuracy: number | null;
  checkinVerificationStatus: string;
  checkoutLatitude: number | null;
  checkoutLongitude: number | null;
  checkoutAccuracy: number | null;
  checkoutVerificationStatus: string;
  evidence: Array<{ id: string; stage: string; storageKey: string; originalFilename: string | null; mimeType: string | null; uploadedAt: string; reviewStatus: string }>;
};

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const [event, setEvent] = useState<any>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [evRes, recRes] = await Promise.all([
          fetch(`/api/admin/events/${params.id}`, { cache: "no-store" }),
          fetch(`/api/admin/events/${params.id}/attendance`, { cache: "no-store" }),
        ]);
        if (evRes.ok) setEvent(await evRes.json());
        if (recRes.ok) {
          const data = await recRes.json();
          setRecords(data.records ?? []);
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  if (loading) return <div className="py-8 text-center text-gray-500">Loading…</div>;
  if (!event) return <div className="py-8 text-center text-red-600">Event not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <Link href="/dashboard/events" className="text-sm text-gray-600 hover:underline mb-2 block">&larr; Back to events</Link>
          <h2 className="text-2xl font-bold text-gray-900">{event.event.title}</h2>
          <p className="text-gray-600 mt-1">{event.event.event_code} &mdash; {event.event.status}</p>
        </div>
        <Link href={`/dashboard/events/${params.id}/attendance`} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-white font-semibold hover:bg-indigo-700">Full attendance table</Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Participant</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Reference</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Status</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Check-in</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Check-out</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {records.length > 0 ? (
              records.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-gray-800">{r.participantName}</td>
                  <td className="px-4 py-3 text-gray-900 font-mono text-xs">{r.attendanceReference}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.attendanceStatus === "COMPLETED" ? "bg-green-100 text-green-700" : r.attendanceStatus === "CHECKED_IN" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                      {r.attendanceStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.checkinAt ? <span>{new Date(r.checkinAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span> : "—"}
                    <div className="text-xs text-gray-400 mt-1">Acc: {r.checkinAccuracy?.toFixed(1)} m</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.checkoutAt ? <span>{new Date(r.checkoutAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span> : "—"}
                    <div className="text-xs text-gray-400 mt-1">Acc: {r.checkoutAccuracy?.toFixed(1)} m</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.evidence.length > 0 ? r.evidence.map((e, i) => (
                      <div key={i} className="text-xs">
                        {e.originalFilename} ({e.reviewStatus})
                      </div>
                    )) : "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No attendance records yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
