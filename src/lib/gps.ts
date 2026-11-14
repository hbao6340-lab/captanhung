/**
 * GPS / geofence helpers.
 *
 * Distance is calculated with the Haversine formula.
 * Earth mean radius = 6,371,000 meters.
 */

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate the great-circle distance between two points on Earth in meters.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Validate that coordinates are within valid GPS ranges.
 */
export function isValidCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/**
 * Check whether a captured point is inside the geofence radius.
 */
export function isWithinGeofence(
  capturedLat: number,
  capturedLon: number,
  eventLat: number,
  eventLon: number,
  radiusMeters: number
): { within: boolean; distanceMeters: number } {
  const distance = haversineDistanceMeters(capturedLat, capturedLon, eventLat, eventLon);
  return { within: distance <= radiusMeters, distanceMeters: distance };
}

/**
 * Determine if a GPS reading is fresh enough (not stale).
 * maxAgeMs defaults to 5 minutes.
 */
export function isGpsFresh(timestamp: Date | string, maxAgeMs = 5 * 60 * 1000): boolean {
  const captured = new Date(timestamp).getTime();
  if (!Number.isFinite(captured)) return false;
  return Date.now() - captured <= maxAgeMs;
}
