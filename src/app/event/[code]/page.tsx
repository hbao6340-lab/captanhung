"use client";

import { getJson } from "@/lib/api";
import { notFound } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";

type EventConfig = {
  id: string;
  event_code: string;
  title: string;
  description: string | null;
  venue_name: string | null;
  venue_address: string | null;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_meters: number;
  checkin_start_at: string;
  checkin_end_at: string;
  checkout_start_at: string | null;
  checkout_end_at: string | null;
  timezone: string;
  status: string;
  access_type: string;
  require_gps_checkin: boolean;
  require_gps_checkout: boolean;
  gps_accuracy_threshold_meters: number;
  require_geofence: boolean;
  require_checkout_evidence: string;
  allow_multiple_attendance: boolean;
  max_attendance: number | null;
  custom_fields: Array<{
    id: string;
    field_name: string;
    field_type: string;
    required: boolean;
    options: string | null;
    sort_order: number;
  }>;
};

type Stage =
  | "info"
  | "checkin-gps"
  | "checkin-confirm"
  | "attending"
  | "checkout-gps"
  | "checkout-photo"
  | "complete"
  | "error";

export default function EventPage({ params }: { params: { code: string } }) {
  const [event, setEvent] = useState<EventConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("info");
  const [stageStatus, setStageStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [stageMessage, setStageMessage] = useState<string>("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [gps, setGps] = useState<{ lat: number; lon: number; acc: number; ts: string } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<{ status: string; checkin_at: string | null; checkout_at: string | null } | null>(null);

  const code = params.code;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/events/${encodeURIComponent(code)}`, { cache: "no-store" });
        if (res.status === 404) { notFound(); return; }
        if (!res.ok) throw new Error("Failed to load event");
        const data = await res.json();
        if (!data.event) { notFound(); return; }
        setEvent(data.event);
        setServerTime(data.serverTime);
        // If there's an existing attendance reference stored locally for this event, restore stage
        const storedRef = sessionStorage.getItem(`cap_attendance_ref_${code}`);
        if (storedRef) {
          setReference(storedRef);
          try {
            const ar = await fetch(`/api/attendance/${encodeURIComponent(storedRef)}`, { cache: "no-store" });
            if (ar.ok) {
              const rec = (await ar.json()).record;
              setAttendance({ status: rec.attendance_status, checkin_at: rec.checkin_at, checkout_at: rec.checkout_at });
              setStage(rec.attendance_status === "COMPLETED" ? "complete" : rec.attendance_status === "CHECKED_IN" ? "attending" : "info");
            }
          } catch { /* ignore */ }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
          <p className="text-gray-600">Loading event…</p>
        </div>
      </div>
    );
  }
  if (error || !event) {
    notFound();
  }

  // If event closed, show event-ended page
  if (["CLOSED", "CANCELLED", "COMPLETED"].includes(event.status)) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] py-12 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <span>🏁</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Event ended</h2>
          <p className="text-gray-600 mb-6">{event.title} is no longer open for attendance.</p>
          <a href="/" className="text-indigo-600 hover:underline text-sm">Browse other events</a>
        </div>
      </div>
    );
  }

  const canCheckIn = stage === "checkin-gps" || stage === "checkin-confirm";
  const canCheckout = stage === "checkout-gps" || stage === "checkout-photo";

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <a href="/" className="text-indigo-600 hover:text-indigo-800 text-sm">&larr; Back to events</a>
          <span className="text-xs text-gray-400">/</span>
          <h1 className="text-lg font-bold text-gray-900 flex-1 truncate">{event.title}</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Event info card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{event.title}</h2>
          <p className="text-gray-600 text-sm mb-4">{event.description ?? "No description provided."}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
            <div><span className="font-medium text-gray-900">Venue</span><br />{event.venue_name ?? "—"}</div>
            <div><span className="font-medium text-gray-900">Check-in</span><br />{new Date(event.checkin_start_at).toLocaleString()} – {new Date(event.checkin_end_at).toLocaleString()}</div>
            {event.checkout_start_at && event.checkout_end_at && (
              <div><span className="font-medium text-gray-900">Check-out</span><br />{new Date(event.checkout_start_at).toLocaleString()} – {new Date(event.checkout_end_at).toLocaleString()}</div>
            )}
            <div><span className="font-medium text-gray-900">Status</span><br />
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${event.status === "OPEN" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {event.status}
              </span>
            </div>
          </div>
        </div>

        {/* Attendance flow */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            {[ "info", "checkin-gps", "attending", "checkout-gps", "checkout-photo", "complete" ].map((s, i) => {
              const active = stage === s;
              const done = ["info","checkin-gps","checkin-confirm","attending","checkout-gps","checkout-photo","complete"].indexOf(s) < ["info","checkin-gps","checkin-confirm","attending","checkout-gps","checkout-photo","complete"].indexOf(stage);
              return (
                <div key={s} className="flex flex-col items-center gap-1 relative z-0">
                  <span className={`w-2 h-2 rounded-full transition ${active ? "bg-indigo-600" : done ? "bg-green-500" : "bg-gray-300"}`}></span>
                  <span className={`text-xs font-medium transition ${active ? "text-indigo-700" : done ? "text-green-600" : "text-gray-400"}`}>
                    {s === "info" ? "Info" : s === "checkin-gps" ? "GPS Check-in" : s === "attending" ? "Attending" : s === "checkout-gps" ? "GPS Check-out" : s === "checkout-photo" ? "Photo" : "Complete"}
                  </span>
                </div>
              );
            })}
          </div>

          {stageMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${stageStatus === "error" ? "bg-red-50 border border-red-200 text-red-700" : stageStatus === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-blue-50 border border-blue-200 text-blue-700"}`}>
              {stageMessage}
            </div>
          )}
          {gpsError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">{gpsError}</div>
          )}

          {stage === "info" && <ParticipantInfoForm event={event} onNext={setFormData} onProceed={() => setStage("checkin-gps")} />}
          {stage === "checkin-gps" && (
            <GpsCapture
              event={event}
              onCapture={setGps}
              onError={setGpsError}
              onLoading={s => setStageStatus(s ? "loading" : "idle")}
            />
          )}
          {stage === "checkin-confirm" && (
            <CheckinConfirm event={event} formData={formData} gps={gps} onSubmit={handleCheckIn} />
          )}
          {stage === "attending" && <AttendingState reference={reference} attendance={attendance} />}
          {stage === "checkout-gps" && (
            <GpsCapture event={event} onCapture={setGps} onError={setGpsError} onLoading={s => setStageStatus(s ? "loading" : "idle")} />
          )}
          {stage === "checkout-photo" && (
            <PhotoCapture onPhoto={setPhoto} onPreview={setPhotoPreview} onSubmit={handleCheckOut} />
          )}
          {stage === "complete" && <CompleteState attendance={attendance} reference={reference} />}
        </div>
      </div>
    </div>
  );

  async function handleCheckIn() {
    if (!gps || !event) return;
    setStageStatus("loading");
    setStageMessage("");
    try {
      const payload: any = {
        participant_name: formData.participant_name ?? "",
        participant_phone: formData.participant_phone ?? "",
        participant_identifier: formData.participant_identifier ?? undefined,
        participant_organization: formData.participant_organization ?? undefined,
        participant_category: formData.participant_category ?? undefined,
        latitude: gps.lat,
        longitude: gps.lon,
        accuracy: gps.acc,
        gps_timestamp: gps.ts,
        custom_fields: {},
      };
      for (const f of event.custom_fields) {
        payload.custom_fields[f.id] = formData[f.id] ?? "";
      }
      const res = await fetch(`/api/events/${encodeURIComponent(event.event_code)}/check-in`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setStageStatus("error");
        setStageMessage(data.error || "Check-in failed");
        if (data.details) setStageMessage(data.error + "\n" + Object.values(data.details).flat().join("; "));
        setGps(null);
        setStage("checkin-gps");
        return;
      }
      setReference(data.attendance_reference);
      sessionStorage.setItem(`cap_attendance_ref_${event.event_code}`, data.attendance_reference);
      setAttendance({ status: data.attendance_status, checkin_at: data.checkin_at, checkout_at: null });
      setStageStatus("success");
      setStageMessage("Checked in successfully!");
      setStage("attending");
    } catch (e) {
      setStageStatus("error");
      setStageMessage(e instanceof Error ? e.message : "Check-in failed");
      setGps(null);
      setStage("checkin-gps");
    }
  }

  async function handleCheckOut() {
    if (!gps || !reference) return;
    setStageStatus("loading");
    setStageMessage("");
    const formData2 = new FormData();
    formData2.append("attendance_reference", reference);
    formData2.append("latitude", String(gps.lat));
    formData2.append("longitude", String(gps.lon));
    formData2.append("accuracy", String(gps.acc));
    formData2.append("gps_timestamp", gps.ts);
    if (photo) formData2.append("evidence", photo);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event!.event_code)}/check-out`, {
        method: "POST",
        body: formData2,
      });
      const data = await res.json();
      if (!res.ok) {
        setStageStatus("error");
        setStageMessage(data.error || "Check-out failed");
        setGps(null);
        setStage("checkout-gps");
        return;
      }
      setAttendance({ status: data.attendance_status, checkin_at: attendance?.checkin_at ?? null, checkout_at: data.checkout_at });
      setStageStatus("success");
      setStageMessage("Checked out successfully!");
      setStage("complete");
    } catch (e) {
      setStageStatus("error");
      setStageMessage(e instanceof Error ? e.message : "Check-out failed");
      setGps(null);
      setStage("checkout-gps");
    }
  }
}

function ParticipantInfoForm({ event, onNext, onProceed }: { event: EventConfig; onNext: (d: Record<string,string>) => void; onProceed: () => void }) {
  const [data, setData] = useState<Record<string,string>>({});
  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Participant information</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Full name" name="participant_name" required value={data.participant_name ?? ""} onChange={(e) => setData({ ...data, participant_name: e.target.value })} />
          <Field label="Phone number" name="participant_phone" type="tel" required value={data.participant_phone ?? ""} onChange={(e) => setData({ ...data, participant_phone: e.target.value })} />
        </div>
        <Field label="Organization / unit" name="participant_organization" value={data.participant_organization ?? ""} onChange={(e) => setData({ ...data, participant_organization: e.target.value })} />
        <Field label="Participant category" name="participant_category" value={data.participant_category ?? ""} onChange={(e) => setData({ ...data, participant_category: e.target.value })} />
        <Field label="ID / reference number" name="participant_identifier" value={data.participant_identifier ?? ""} onChange={(e) => setData({ ...data, participant_identifier: e.target.value })} />
        {event.custom_fields.map((f) => (
          <Field key={f.id} label={f.field_name + (f.required ? " *" : "")} name={f.id} required={f.required} value={data[f.id] ?? ""} onChange={(e) => setData({ ...data, [f.id]: e.target.value })} />
        ))}
      </div>
      <div className="mt-6">
        <button
          onClick={() => {
            // basic required check
            const missing = event.custom_fields.filter(f => f.required && !data[f.id]).length;
            if (!data.participant_name || !data.participant_phone || missing > 0) {
              alert("Please fill in all required fields.");
              return;
            }
            onNext(data);
            onProceed();
          }}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-white font-semibold hover:bg-indigo-700 focus:outline-none"
        >
          Continue to GPS check-in
        </button>
      </div>
    </div>
  );
}

function Field({ label, name, type = "text", required = false, value, onChange }: { label: string; name: string; type?: string; required?: boolean; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700 flex items-center gap-1">{label}{required ? " <span className='text-red-500'>*</span>" : null}</label>
      <input type={type} name={name} value={value} onChange={onChange} className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" required={required} />
    </div>
  );
}

function GpsCapture({ event, onCapture, onError, onLoading }: { event: EventConfig; onCapture: (g: { lat: number; lon: number; acc: number; ts: string }) => void; onError: (m: string | null) => void; onLoading: (l: boolean) => void }) {
  const [buttonBusy, setButtonBusy] = useState(false);

  const capture = useCallback(() => {
    setButtonBusy(true);
    onLoading(true);
    onError(null);
    if (!("geolocation" in navigator)) {
      onError("Geolocation is not available in this browser.");
      setButtonBusy(false);
      onLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        onCapture({ lat: latitude, lon: longitude, acc: accuracy, ts: new Date(pos.timestamp).toISOString() });
        setButtonBusy(false);
        onLoading(false);
      },
      (err) => {
        let msg = "Unable to obtain GPS location.";
        if (err.code === 1) msg = "Location permission was denied. Please enable location access and try again.";
        else if (err.code === 2) msg = "Location is unavailable. Please check your device's location settings.";
        else if (err.code === 3) msg = "Location request timed out. Please try again.";
        onError(msg);
        setButtonBusy(false);
        onLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  }, [onCapture, onError, onLoading]);

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">GPS verification</h3>
      <p className="text-sm text-gray-600 mb-4">We need your current location to verify attendance at {event.venue_name ?? "the event venue"}.</p>
      <div className="flex flex-col gap-3">
        <button
          disabled={buttonBusy}
          onClick={capture}
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 focus:outline-none flex items-center justify-center gap-2"
        >
          {buttonBusy ? <span className="flex items-center gap-2"><span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Locating…</span> : "Capture GPS location"}
        </button>
        <p className="text-xs text-gray-500">High-accuracy GPS required. Allow browser location access when prompted.</p>
      </div>
    </div>
  );
}

function CheckinConfirm({ event, formData, gps, onSubmit }: { event: EventConfig; formData: Record<string,string>; gps: { lat: number; lon: number; acc: number; ts: string } | null; onSubmit: () => void }) {
  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Confirm check-in</h3>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between"><span className="text-gray-600">Location</span><span className="font-medium">{gps?.lat?.toFixed(5)}, {gps?.lon?.toFixed(5)}</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Accuracy</span><span className="font-medium">{gps?.acc?.toFixed(1)} m (required ≤ {event.gps_accuracy_threshold_meters} m)</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Name</span><span className="font-medium">{formData.participant_name}</span></div>
      </div>
      <div className="mt-6">
        <button onClick={onSubmit} className="w-full rounded-lg bg-green-600 px-4 py-3 text-white font-semibold hover:bg-green-700 focus:outline-none">Confirm check-in</button>
        <button onClick={() => {}} className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-700 font-semibold hover:bg-gray-50 focus:outline-none">Retake location</button>
      </div>
    </div>
  );
}

function AttendingState({ reference, attendance }: { reference: string | null; attendance: { status: string; checkin_at: string | null; checkout_at: string | null } | null }) {
  return (
    <div className="text-center py-10">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">✅</span>
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">Checked in</h3>
      <p className="text-gray-600 mb-6">You are currently checked in. Reference: <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{reference}</span></p>
      {attendance?.checkin_at && (
        <div className="text-sm text-gray-500 mb-6">Checked in at {new Date(attendance.checkin_at).toLocaleString()}</div>
      )}
      <button
        onClick={() => {}}
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-white font-semibold hover:bg-indigo-700 focus:outline-none"
        disabled
      >
        Check out (available at check-out time)
      </button>
    </div>
  );
}

function PhotoCapture({ onPhoto, onPreview, onSubmit }: { onPhoto: (f: File | null) => void; onPreview: (u: string | null) => void; onSubmit: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <div>
      <h3 className="text-base font-bold text-gray-900 mb-4">Photo evidence</h3>
      <p className="text-sm text-gray-600 mb-4">Take a photo or upload an image as check-out evidence.</p>
      <div className="flex flex-col gap-3">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFile(f);
            onPhoto(f);
            const url = URL.createObjectURL(f);
            setPreview(url);
            onPreview(url);
          }}
          className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
        {preview && (
          <div className="relative">
            <img src={preview} alt="Preview" className="w-48 h-48 rounded-lg border border-gray-200 object-cover" />
            <button
              onClick={() => { setFile(null); setPreview(null); onPhoto(null); onPreview(null); }}
              className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
              aria-label="Remove"
            >
              <span className="text-xs">✕</span>
            </button>
          </div>
        )}
      </div>
      <div className="mt-6">
        <button
          disabled={!file || uploading}
          onClick={onSubmit}
          className={`w-full rounded-lg px-4 py-3 text-white font-semibold focus:outline-none transition ${!file ? "bg-gray-300 text-gray-400" : "bg-indigo-600 hover:bg-indigo-700"}`}
        >
          {uploading ? "Uploading…" : "Confirm &amp; check out"}
        </button>
      </div>
    </div>
  );
}

function CompleteState({ attendance, reference }: { attendance: { status: string; checkin_at: string | null; checkout_at: string | null } | null; reference: string | null }) {
  const duration = attendance?.checkin_at && attendance?.checkout_at
    ? Math.round((new Date(attendance.checkout_at).getTime() - new Date(attendance.checkin_at).getTime()) / 60000)
    : null;
  return (
    <div className="text-center py-10">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
        <span className="text-2xl">🎉</span>
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">Attendance complete</h3>
      <p className="text-gray-600 mb-4">Thank you. Your check-in and check-out have both been recorded.</p>
      <div className="text-sm text-gray-600 mb-6">
        <div>Reference: <span className="font-mono">{reference}</span></div>
        {duration !== null && <div>Duration: {duration} minutes</div>}
      </div>
    </div>
  );
}
