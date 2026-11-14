"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type AttendanceRecord = {
  id: string;
  attendanceReference: string;
  participantName: string;
  participantPhone: string;
  participantOrganization: string | null;
  participantCategory: string | null;
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
  eventCode: string | null;
  eventTitle: string | null;
  evidence: Array<{
    id: string;
    stage: string;
    storageKey: string;
    originalFilename: string | null;
    mimeType: string | null;
    uploadedAt: string;
    reviewStatus: string;
  }>;
};

async function fetchAttendance(params: URLSearchParams) {
  const res = await fetch(`/api/admin/attendance?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load attendance");
  return res.json();
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    eventId: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("pageSize", String(pagination.pageSize));
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.eventId) params.set("event_id", filters.eventId);
      const data = await fetchAttendance(params);
      setRecords(data.records ?? []);
      setPagination((p) => ({
        ...p,
        total: data.pagination?.total ?? 0,
        totalPages: data.pagination?.totalPages ?? 0,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      COMPLETED: "bg-green-100 text-green-700",
      CHECKED_IN: "bg-blue-100 text-blue-700",
      MISSING_CHECKOUT: "bg-yellow-100 text-yellow-700",
      FLAGGED: "bg-red-100 text-red-700",
      REJECTED: "bg-gray-100 text-gray-700",
      ADMIN_REVIEWED: "bg-indigo-100 text-indigo-700",
      NOT_CHECKED_IN: "bg-gray-100 text-gray-700",
    };
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  if (loading) return <div className="py-10 text-center text-gray-500">Loading attendance…</div>;
  if (error) return <div className="py-10 text-center text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Attendance Management</h2>
          <p className="text-gray-600 mt-1">
            View, filter, and inspect all check-in/check-out records across events.
          </p>
        </div>
        <Link
          href="/dashboard/events/create"
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-white font-semibold hover:bg-indigo-700"
        >
          Create event
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <input
              type="search"
              placeholder="Search participant, phone, reference…"
              value={filters.search}
              onChange={(e) => {
                setFilters({ ...filters, search: e.target.value });
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value });
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white"
            >
              <option value="">All statuses</option>
              <option value="NOT_CHECKED_IN">Not Checked In</option>
              <option value="CHECKED_IN">Checked In</option>
              <option value="COMPLETED">Completed</option>
              <option value="MISSING_CHECKOUT">Missing Check-out</option>
              <option value="FLAGGED">Flagged</option>
              <option value="REJECTED">Rejected</option>
              <option value="ADMIN_REVIEWED">Admin Reviewed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Event</label>
            <select
              value={filters.eventId}
              onChange={(e) => {
                setFilters({ ...filters, eventId: e.target.value });
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white"
            >
              <option value="">All events</option>
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.eventTitle ?? r.eventCode}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={load}
              className="w-full rounded-md bg-indigo-600 px-3 py-2 text-white font-sm hover:bg-indigo-700"
            >
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-gray-500 font-medium">Reference</th>
                <th className="px-4 py-3 text-left text-gray-500 font-medium">Participant</th>
                <th className="px-4 py-3 text-left text-gray-500 font-medium">Event</th>
                <th className="px-4 py-3 text-left text-gray-500 font-medium">Status</th>
                <th className="px-4 py-3 text-left text-gray-500 font-medium">Check-in</th>
                <th className="px-4 py-3 text-left text-gray-500 font-medium">Check-out</th>
                <th className="px-4 py-3 text-left text-gray-500 font-medium">Evidence</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.length > 0 ? (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-mono text-xs">
                      {r.attendanceReference}
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      <div>{r.participantName}</div>
                      {r.participantPhone && (
                        <div className="text-xs text-gray-500">{r.participantPhone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.eventTitle ?? r.eventCode ?? "—"}
                    </td>
                    <td className="px-4 py-3">{statusBadge(r.attendanceStatus)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.checkinAt ? new Date(r.checkinAt).toLocaleString() : "—"}
                      {r.checkinAccuracy != null && (
                        <div className="text-xs text-gray-400 mt-1">
                          Acc: {r.checkinAccuracy.toFixed(1)} m
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.checkoutAt ? new Date(r.checkoutAt).toLocaleString() : "—"}
                      {r.checkoutAccuracy != null && (
                        <div className="text-xs text-gray-400 mt-1">
                          Acc: {r.checkoutAccuracy.toFixed(1)} m
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.evidence.length > 0 ? (
                        <span className="text-xs font-medium text-green-600">
                          {r.evidence.length} file{s(r.evidence.length)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/attendance/${r.id}`}
                        className="text-indigo-600 hover:underline text-sm font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No attendance records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages} &nbsp;|&nbsp; {pagination.total} records
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page === 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                className="px-3 py-1 rounded-md border border-gray-300 text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Prev
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                className="px-3 py-1 rounded-md border border-gray-300 text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function s(n: number) {
  return n === 1 ? "" : "s";
}
