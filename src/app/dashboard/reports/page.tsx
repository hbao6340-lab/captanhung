"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

type ReportRecord = {
  attendance_reference: string;
  event_code: string | null;
  event_title: string | null;
  venue: string | null;
  participant_name: string;
  participant_phone: string;
  participant_identifier: string | null;
  participant_organization: string | null;
  participant_category: string | null;
  checkin_at: string | null;
  checkin_latitude: number | null;
  checkin_longitude: number | null;
  checkin_accuracy: number | null;
  checkin_verification: string | null;
  checkout_at: string | null;
  checkout_latitude: number | null;
  checkout_longitude: number | null;
  checkout_accuracy: number | null;
  checkout_verification: string | null;
  attendance_duration_seconds: number | null;
  attendance_status: string;
  evidence_count: number;
  created_at: string | null;
};

async function fetchReports(params: URLSearchParams) {
  const res = await fetch(`/api/admin/reports?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load reports");
  return res.json();
}

async function exportReport(params: URLSearchParams) {
  const res = await fetch(`/api/admin/reports/export?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Export failed");
  return res;
}

export default function ReportsPage() {
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    event_id: "",
    status: "",
    date_from: "",
    date_to: "",
    participant: "",
    organization: "",
    format: "csv" as "csv" | "xlsx" | "pdf",
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.set("format", filters.format);
        if (filters.event_id) params.set("event_id", filters.event_id);
        if (filters.status) params.set("status", filters.status);
        if (filters.date_from) params.set("date_from", filters.date_from);
        if (filters.date_to) params.set("date_to", filters.date_to);
        if (filters.participant) params.set("participant", filters.participant);
        if (filters.organization) params.set("organization", filters.organization);
        const data = await fetchReports(params);
        setRecords(data.records ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load reports");
      } finally {
        setLoading(false);
      }
    })();
  }, [filters]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("format", filters.format);
      if (filters.event_id) params.set("event_id", filters.event_id);
      if (filters.status) params.set("status", filters.status);
      if (filters.date_from) params.set("date_from", filters.date_from);
      if (filters.date_to) params.set("date_to", filters.date_to);
      if (filters.participant) params.set("participant", filters.participant);
      if (filters.organization) params.set("organization", filters.organization);
      const res = await exportReport(params);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-report.${filters.format === "xlsx" ? "xlsx" : filters.format === "pdf" ? "pdf" : "csv"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="py-10 text-center text-gray-500">Loading reports…</div>;
  if (error) return <div className="py-10 text-center text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reports & Exports</h2>
        <p className="text-gray-600 mt-1">Generate and export attendance reports filtered by event, date, status, and participant.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Event</label>
            <input value={filters.event_id} onChange={(e) => setFilters({ ...filters, event_id: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Event ID" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white">
              <option value="">All</option>
              <option value="NOT_CHECKED_IN">Not Checked In</option>
              <option value="CHECKED_IN">Checked In</option>
              <option value="COMPLETED">Completed</option>
              <option value="MISSING_CHECKOUT">Missing Check-out</option>
              <option value="FLAGGED">Flagged</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">From date</label>
            <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">To date</label>
            <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Participant</label>
            <input value={filters.participant} onChange={(e) => setFilters({ ...filters, participant: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Organization</label>
            <input value={filters.organization} onChange={(e) => setFilters({ ...filters, organization: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="Organization" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Format</label>
            <select value={filters.format} onChange={(e) => setFilters({ ...filters, format: e.target.value as any })} className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white">
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              {exporting ? "Exporting…" : "Export Report"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Reference</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Participant</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Event</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Check-in</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Check-out</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Duration</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {records.length > 0 ? (
              records.map((r) => (
                <tr key={r.attendance_reference}>
                  <td className="px-4 py-3 text-gray-900 font-mono text-xs">{r.attendance_reference}</td>
                  <td className="px-4 py-3 text-gray-800">
                    <div>{r.participant_name}</div>
                    <div className="text-xs text-gray-500">{r.participant_organization ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.event_title ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{r.checkin_at ? new Date(r.checkin_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{r.checkout_at ? new Date(r.checkout_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.attendance_duration_seconds != null ? Math.round(r.attendance_duration_seconds / 60) + " min" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      r.attendance_status === "COMPLETED" ? "bg-green-100 text-green-700" :
                      r.attendance_status === "CHECKED_IN" ? "bg-blue-100 text-blue-700" :
                      r.attendance_status === "MISSING_CHECKOUT" ? "bg-yellow-100 text-yellow-700" :
                      r.attendance_status === "FLAGGED" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {r.attendance_status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No records match the filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-gray-500">
        {records.length} record{records.length !== 1 ? "s" : ""} matched the current filters.
      </div>
    </div>
  );
}
