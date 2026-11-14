"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

type AuditLog = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: string | null;
  newValues: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};

async function fetchAuditLogs(params: URLSearchParams) {
  const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load audit logs");
  return res.json();
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.set("page", String(pagination.page));
        params.set("pageSize", String(pagination.pageSize));
        if (search) params.set("search", search);
        const data = await fetchAuditLogs(params);
        setLogs(data.logs ?? []);
        setPagination((p) => ({ ...p, total: data.pagination?.total ?? 0, totalPages: data.pagination?.totalPages ?? 0 }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    })();
  }, [pagination.page, pagination.pageSize, search]);

  if (loading) return <div className="py-10 text-center text-gray-500">Loading audit logs…</div>;
  if (error) return <div className="py-10 text-center text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
        <p className="text-gray-600 mt-1">Full audit trail of administrator actions and system events.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-4">
        <div className="relative">
          <input
            type="search"
            placeholder="Search action, entity type, or actor…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="w-full rounded-md border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Time</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Actor</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Action</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Entity</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">Entity ID</th>
              <th className="px-4 py-3 text-left text-gray-500 font-medium">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.length > 0 ? (
              logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-800">
                    <div>{l.actor?.fullName ?? "System"}</div>
                    <div className="text-xs text-gray-500">{l.actor?.email ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{l.action}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{l.entityType}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{l.entityId ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{l.ipAddress ?? "—"}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No audit logs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
