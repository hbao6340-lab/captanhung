"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";

type RecordDetail = {
  id: string;
  attendanceReference: string;
  event: {
    id: string;
    eventCode: string;
    title: string;
    status: string;
  } | null;
  participantName: string;
  participantPhone: string;
  participantIdentifier: string | null;
  participantOrganization: string | null;
  participantCategory: string | null;
  attendanceStatus: string;
  checkinAt: string | null;
  checkoutAt: string | null;
  attendanceDurationSeconds: number | null;
  checkoutEvidenceRequired: boolean;
  checkinLatitude: number | null;
  checkinLongitude: number | null;
  checkinAccuracy: number | null;
  checkinGpsTimestamp: string | null;
  checkinVerificationStatus: string;
  checkoutLatitude: number | null;
  checkoutLongitude: number | null;
  checkoutAccuracy: number | null;
  checkoutGpsTimestamp: string | null;
  checkoutVerificationStatus: string;
  evidence: Array<{
    id: string;
    stage: string;
    storageKey: string;
    originalFilename: string | null;
    mimeType: string | null;
    fileSize: number | null;
    uploadedAt: string;
    reviewStatus: string;
    reviewNotes: string | null;
    reviewedAt: string | null;
  }>;
  verification_logs: Array<{
    id: string;
    stage: string;
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    calculatedDistance: number | null;
    geofenceResult: boolean | null;
    verificationResult: string;
    failureReason: string | null;
    createdAt: string;
  }>;
  custom_field_values: Array<{
    value: string;
    field: {
      id: string;
      fieldName: string;
      fieldType: string;
      required: boolean;
      options: string | null;
    };
  }>;
};

async function fetchRecord(id: string) {
  const res = await fetch(`/api/admin/attendance/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load record");
  return res.json();
}

async function updateStatus(id: string, status: string, notes?: string) {
  const res = await fetch(`/api/admin/attendance/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ attendance_status: status, admin_notes: notes ?? null }),
  });
  if (!res.ok) throw new Error("Failed to update record");
  return res.json();
}

export default function AttendanceDetailPage({ params }: { params: { id: string } }) {
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "success" as "success" | "error" });

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchRecord(params.id);
        setRecord(data.record);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load record");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      COMPLETED: "bg-green-100 text-green-700",
      CHECKED_IN: "bg-blue-100 text-blue-700",
      MISSING_CHECKOUT: "bg-yellow-100 text-yellow-700",
      FLAGGED: "bg-red-100 text-red-700",
      REJECTED: "bg-gray-100 text-gray-700",
      ADMIN_REVIEWED: "bg-indigo-100 text-indigo-700",
      NOT_CHECKED_IN: "bg-gray-100 text-gray-600",
    };
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  if (loading) return <div className="py-10 text-center text-gray-500">Loading record…</div>;
  if (error) return <div className="py-10 text-center text-red-600">{error}</div>;
  if (!record) return <div className="py-10 text-center text-gray-500">Record not found.</div>;

  const durationMinutes = record.attendanceDurationSeconds
    ? Math.round(record.attendanceDurationSeconds / 60)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <Link href="/dashboard/attendance" className="text-sm text-gray-600 hover:underline mb-2 block">
            &larr; Back to attendance
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">Attendance Record</h2>
          <p className="text-gray-600 mt-1">{record.attendanceReference}</p>
        </div>
        <div className="flex gap-2">
          {message.text && (
            <div className={`px-3 py-2 rounded-md text-sm font-medium ${
              message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {message.text}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Record info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>👤</span> Participant Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500">Name</label>
                <p className="text-gray-900">{record.participantName}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Phone</label>
                <p className="text-gray-900">{record.participantPhone}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Identifier</label>
                <p className="text-gray-900">{record.participantIdentifier ?? "—"}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Organization</label>
                <p className="text-gray-900">{record.participantOrganization ?? "—"}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Category</label>
                <p className="text-gray-900">{record.participantCategory ?? "—"}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Event</label>
                <p className="text-gray-900">{record.event?.title ?? "—"} ({record.event?.eventCode ?? "—"})</p>
              </div>
            </div>
          </div>

          {/* Custom fields */}
          {record.custom_field_values && record.custom_field_values.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Custom Field Values</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {record.custom_field_values.map((f, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs font-medium text-gray-700">{f.field.fieldName}</div>
                    <div className="text-sm text-gray-900 mt-1">{f.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Status & actions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Current status</span>
                {statusBadge(record.attendanceStatus)}
              </div>
              <div className="space-y-3">
                {[
                  "NOT_CHECKED_IN",
                  "CHECKED_IN",
                  "COMPLETED",
                  "MISSING_CHECKOUT",
                  "FLAGGED",
                  "REJECTED",
                  "ADMIN_REVIEWED",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSaving(true);
                      updateStatus(params.id, s)
                        .then(() => {
                          setMessage({ text: `Status updated to ${s.replace(/_/g, " ")}`, type: "success" });
                          setRecord((r) => (r ? { ...r, attendanceStatus: s } : null));
                          setSaving(false);
                        })
                        .catch((e) => {
                          setMessage({ text: e instanceof Error ? e.message : "Update failed", type: "error" });
                          setSaving(false);
                        });
                    }}
                    disabled={saving}
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition ${
                      record.attendanceStatus === s
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Timing</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Check-in</span>
                <span className="text-gray-900">{record.checkinAt ? new Date(record.checkinAt).toLocaleString() : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Check-out</span>
                <span className="text-gray-900">{record.checkoutAt ? new Date(record.checkoutAt).toLocaleString() : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duration</span>
                <span className="text-gray-900 font-medium">{durationMinutes !== null ? `${durationMinutes} minutes` : "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* GPS Verification Logs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900 mb-4">GPS Verification Logs</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Stage</th>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Coordinates</th>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Accuracy</th>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Distance</th>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Geofence</th>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Result</th>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {record.verification_logs.length > 0 ? (
                record.verification_logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-gray-800">{log.stage}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {log.latitude != null && log.longitude != null ? `${log.latitude.toFixed(5)}, ${log.longitude.toFixed(5)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{log.accuracy?.toFixed(1) ?? "—"} m</td>
                    <td className="px-4 py-3 text-gray-600">{log.calculatedDistance?.toFixed(0) ?? "—"} m</td>
                    <td className="px-4 py-3 text-gray-600">{log.geofenceResult === true ? "Inside" : log.geofenceResult === false ? "Outside" : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        log.verificationResult === "PASSED" ? "bg-green-100 text-green-700" :
                        log.verificationResult === "FAILED" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {log.verificationResult}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No verification logs.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evidence */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Evidence</h3>
        {record.evidence.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {record.evidence.map((e) => (
              <div key={e.id} className="border rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-medium text-gray-700 uppercase">{e.stage}</span>
                  <span className={`text-xs font-medium ${
                    e.reviewStatus === "REVIEWED" ? "text-green-700" :
                    e.reviewStatus === "FLAGGED" ? "text-red-700" :
                    e.reviewStatus === "APPROVED" ? "text-blue-700" :
                    "text-gray-500"
                  }`}>
                    {e.reviewStatus}
                  </span>
                </div>
                <div className="mb-2">
                  <label className="text-xs text-gray-500">File</label>
                  <p className="text-sm text-gray-900 truncate max-w-xs">{e.originalFilename ?? "unknown"}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                  <span>{e.mimeType ?? "—"}</span>
                  <span>•</span>
                  <span>{e.fileSize != null ? (e.fileSize / 1024).toFixed(1) + " KB" : "—"}</span>
                  <span>•</span>
                  <span>{new Date(e.uploadedAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <a
                    href={`/api/admin/evidence?key=${encodeURIComponent(e.storageKey)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    View image
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No evidence uploaded.</p>
        )}
      </div>
    </div>
  );
}
