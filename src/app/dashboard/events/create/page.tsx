"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { postJson } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function CreateEventPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    venue_name: "",
    venue_address: "",
    latitude: "",
    longitude: "",
    geofence_radius_meters: "100",
    checkin_start_at: "",
    checkin_end_at: "",
    checkout_start_at: "",
    checkout_end_at: "",
    timezone: "Asia/Ho_Chi_Minh",
    access_type: "PUBLIC",
    access_code: "",
    require_gps_checkin: "true",
    require_gps_checkout: "true",
    gps_accuracy_threshold_meters: "20",
    require_geofence: "true",
    require_checkout_evidence: "MANDATORY",
    allow_multiple_attendance: "false",
    max_attendance: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const payload = {
      ...form,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
      geofence_radius_meters: Number(form.geofence_radius_meters || 100),
      gps_accuracy_threshold_meters: Number(form.gps_accuracy_threshold_meters || 20),
      require_gps_checkin: form.require_gps_checkin === "true",
      require_gps_checkout: form.require_gps_checkout === "true",
      require_geofence: form.require_geofence === "true",
      allow_multiple_attendance: form.allow_multiple_attendance === "true",
      max_attendance: form.max_attendance ? Number(form.max_attendance) : undefined,
      checkout_start_at: form.checkout_start_at || undefined,
      checkout_end_at: form.checkout_end_at || undefined,
    };
    try {
      const res = await postJson("/api/admin/events", payload);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || data.details ? "Validation failed" : "Create failed");
        setLoading(false);
        return;
      }
      const data = await res.json();
      router.push(`/dashboard/events/${data.event.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Create event</h2>
        <p className="text-gray-600 mt-1">Set up a new attendance event.</p>
      </div>
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4 max-w-xl">
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">Event title *</label>
          <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">Description</label>
          <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent" rows={3} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Venue name</label>
            <input value={form.venue_name} onChange={e => setForm({...form, venue_name: e.target.value})} className="rounded-md border border-gray-300 px-3 py-2" />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Venue address</label>
            <input value={form.venue_address} onChange={e => setForm({...form, venue_address: e.target.value})} className="rounded-md border border-gray-300 px-3 py-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Latitude</label>
            <input value={form.latitude} onChange={e => setForm({...form, latitude: e.target.value})} className="rounded-md border border-gray-300 px-3 py-2" />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Longitude</label>
            <input value={form.longitude} onChange={e => setForm({...form, longitude: e.target.value})} className="rounded-md border border-gray-300 px-3 py-2" />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Geofence radius (m)</label>
            <input value={form.geofence_radius_meters} onChange={e => setForm({...form, geofence_radius_meters: e.target.value})} className="rounded-md border border-gray-300 px-3 py-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Check-in starts at</label>
            <input type="datetime-local" required value={form.checkin_start_at} onChange={e => setForm({...form, checkin_start_at: e.target.value})} className="rounded-md border border-gray-300 px-3 py-2" />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Check-in ends at</label>
            <input type="datetime-local" required value={form.checkin_end_at} onChange={e => setForm({...form, checkin_end_at: e.target.value})} className="rounded-md border border-gray-300 px-3 py-2" />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Check-out starts at</label>
            <input type="datetime-local" value={form.checkout_start_at} onChange={e => setForm({...form, checkout_start_at: e.target.value})} className="rounded-md border border-gray-300 px-3 py-2" />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Check-out ends at</label>
            <input type="datetime-local" value={form.checkout_end_at} onChange={e => setForm({...form, checkout_end_at: e.target.value})} className="rounded-md border border-gray-300 px-3 py-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">GPS accuracy threshold (m)</label>
            <input value={form.gps_accuracy_threshold_meters} onChange={e => setForm({...form, gps_accuracy_threshold_meters: e.target.value})} className="rounded-md border border-gray-300 px-3 py-2" />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Access type</label>
            <select value={form.access_type} onChange={e => setForm({...form, access_type: e.target.value})} className="rounded-md border border-gray-300 px-3 py-2">
              <option>PUBLIC</option>
              <option>ACCESS_CODE</option>
              <option>LOGIN_REQUIRED</option>
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Access code (if access code)</label>
            <input value={form.access_code} onChange={e => setForm({...form, access_code: e.target.value})} className="rounded-md border border-gray-300 px-3 py-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.require_gps_checkin === "true"} onChange={e => setForm({...form, require_gps_checkin: e.target.checked ? "true" : "false"})} /> Require GPS check-in</label>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.require_gps_checkout === "true"} onChange={e => setForm({...form, require_gps_checkout: e.target.checked ? "true" : "false"})} /> Require GPS check-out</label>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.require_geofence === "true"} onChange={e => setForm({...form, require_geofence: e.target.checked ? "true" : "false"})} /> Require geofence</label>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.require_checkout_evidence === "MANDATORY"} onChange={e => setForm({...form, require_checkout_evidence: e.target.checked ? "MANDATORY" : "NONE"})} /> Require check-out photo</label>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.allow_multiple_attendance === "true"} onChange={e => setForm({...form, allow_multiple_attendance: e.target.checked ? "true" : "false"})} /> Allow multiple attendance</label>
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700">Max attendance</label>
            <input value={form.max_attendance} onChange={e => setForm({...form, max_attendance: e.target.value})} className="rounded-md border border-gray-300 px-3 py-2" />
          </div>
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60">
          {loading ? "Creating…" : "Create event"}
        </button>
      </form>
    </div>
  );
}
