"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";

type Role = { id: string; name: string; description: string | null };
type Permission = { id: string; name: string; description: string | null };

async function fetchRoles() {
  const res = await fetch("/api/admin/roles", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load roles");
  return res.json();
}

async function fetchPermissions() {
  const res = await fetch("/api/admin/permissions", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load permissions");
  return res.json();
}

export default function SettingsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [r, p] = await Promise.all([fetchRoles(), fetchPermissions()]);
        setRoles(r.roles ?? []);
        setPermissions(p.permissions ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="py-10 text-center text-gray-500">Loading settings…</div>;
  if (error) return <div className="py-10 text-center text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-600 mt-1">Configure roles, permissions, and system settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Roles</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-500 font-medium">Role</th>
                    <th className="px-4 py-3 text-left text-gray-500 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {roles.length > 0 ? (
                    roles.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 text-gray-900 font-medium">{r.name}</td>
                        <td className="px-4 py-3 text-gray-600">{r.description ?? "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-500">No roles.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Permissions</h3>
            <div className="space-y-2">
              {permissions.length > 0 ? (
                permissions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-800">{p.name}</span>
                    <span className="text-xs text-gray-500">{p.description ?? "—"}</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No permissions.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Environment</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Node environment</span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">production</span>
              </div>
              <div className="flex justify-between">
                <span>App URL</span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded truncate max-w-xs">https://captanhung.vercel.app</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-amber-800 mb-3">Security notes</h3>
            <ul className="text-sm text-amber-700 space-y-2 list-disc list-inside">
              <li>Rotate <code className="font-mono text-xs bg-amber-100 px-1">ACCESS_TOKEN_SECRET</code> and <code className="font-mono text-xs bg-amber-100 px-1">REFRESH_TOKEN_SECRET</code> periodically.</li>
              <li>Change the default admin password after first login.</li>
              <li>Restrict admin access by IP at your ingress/proxy layer if needed.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
