"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";

type EvidenceItem = {
  id: string;
  attendance_record_id: string;
  stage: string;
  storage_key: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  review_status: string;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  attendance_record: {
    attendance_reference: string;
    participant_name: string;
    participant_phone: string;
    event: {
      id: string;
      event_code: string;
      title: string;
    };
  };
};

async function fetchEvidence(params: URLSearchParams) {
  const res = await fetch(`/api/admin/evidence/list?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load evidence");
  return res.json();
}

async function reviewEvidence(id: string, status: string, notes?: string) {
  const res = await fetch(`/api/admin/evidence/${id}/review`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ review_status: status, review_notes: notes ?? null }),
  });
  if (!res.ok) throw new Error("Failed to review evidence");
  return res.json();
}

export default function EvidencePage() {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({ stage: "", review_status: "", search: "" });

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams();
        if (filter.stage) params.set("stage", filter.stage);
        if (filter.review_status) params.set("review_status", filter.review_status);
        if (filter.search) params.set("search", filter.search);
        const data = await fetchEvidence(params);
        setItems(data.items ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load evidence");
      } finally {
        setLoading(false);
      }
    })();
  }, [filter]);

  if (loading) return <div className="py-10 text-center text-gray-500">Loading evidence…</div>;
  if (error) return <div className="py-10 text-center text-red-600">{error}</div>;

  const statusColor = (s: string) => {
    switch (s) {
      case "REVIEWED": return "bg-green-100 text-green-700";
      case "FLAGGED": return "bg-red-100 text-red-700";
      case "APPROVED": return "bg-blue-100 text-blue-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Evidence Review</h2>
        <p className="text-gray-600 mt-1">Review check-out photo evidence submitted by participants.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Stage</label>
            <select value={filter.stage} onChange={(e) => setFilter({ ...filter, stage: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white">
              <option value="">All stages</option>
              <option value="CHECK_IN">Check-in</option>
              <option value="CHECK_OUT">Check-out</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Review status</label>
            <select value={filter.review_status} onChange={(e) => setFilter({ ...filter, review_status: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white">
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="FLAGGED">Flagged</option>
              <option value="APPROVED">Approved</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => {}} className="w-full rounded-md bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700">Filter</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Evidence</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Participant</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Event</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Stage</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Status</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Uploaded</th>
              <th className="px-4 py-3 text-right text-gray-500 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.length > 0 ? (
              items.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                        {e.mime_type?.startsWith("image") ? (
                          <img src={`/api/admin/evidence?key=${encodeURIComponent(e.storage_key)}`} alt="Evidence" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-gray-400 text-xs">📄</span>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-900 font-medium truncate max-w-xs">{e.original_filename ?? "unknown"}</p>
                        <p className="text-xs text-gray-500">{e.mime_type ?? "—"} • {e.file_size != null ? (e.file_size / 1024).toFixed(1) + " KB" : "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    <div>{e.attendance_record.participant_name}</div>
                    <div className="text-xs text-gray-500">{e.attendance_record.participant_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{e.attendance_record.event.title}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{e.stage}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor(e.review_status)}`}>
                      {e.review_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{new Date(e.uploaded_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/api/admin/evidence?key=${encodeURIComponent(e.storage_key)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No evidence found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
