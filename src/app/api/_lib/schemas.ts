import { z } from "zod";

export const eventCodeSchema = z.object({
  code: z.string().min(1, "Event code is required"),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
});

export const createEventSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  description: z.string().optional(),
  venue_name: z.string().optional(),
  venue_address: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  geofence_radius_meters: z.coerce.number().int().positive().max(50000).default(100),
  checkin_start_at: z.string().datetime({ offset: true }),
  checkin_end_at: z.string().datetime({ offset: true }),
  checkout_start_at: z.string().datetime({ offset: true }).optional(),
  checkout_end_at: z.string().datetime({ offset: true }).optional(),
  timezone: z.string().default("Asia/Ho_Chi_Minh"),
  access_type: z.enum(["PUBLIC", "ACCESS_CODE", "INVITATION_ONLY", "LOGIN_REQUIRED"]).default("PUBLIC"),
  access_code: z.string().optional(),
  require_login: z.boolean().default(false),
  require_gps_checkin: z.boolean().default(true),
  require_gps_checkout: z.boolean().default(true),
  gps_accuracy_threshold_meters: z.coerce.number().int().positive().max(1000).default(20),
  require_geofence: z.boolean().default(true),
  require_checkout_evidence: z.enum(["NONE", "OPTIONAL", "MANDATORY"]).default("MANDATORY"),
  allow_multiple_attendance: z.boolean().default(false),
  max_attendance: z.coerce.number().int().positive().optional(),
  custom_fields: z.array(
    z.object({
      field_name: z.string().min(1),
      field_type: z.enum(["text", "number", "dropdown", "radio", "checkbox", "date"]),
      required: z.boolean().default(false),
      options: z.string().optional(),
      sort_order: z.coerce.number().int().default(0),
    })
  ).default([]),
});

export const updateEventSchema = createEventSchema.partial();

export const checkInSchema = z.object({
  participant_name: z.string().min(1, "Full name is required"),
  participant_phone: z.string().min(1, "Phone number is required"),
  participant_identifier: z.string().optional(),
  participant_organization: z.string().optional(),
  participant_category: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().positive(),
  gps_timestamp: z.string().datetime(),
  idempotency_key: z.string().uuid().optional(),
  custom_fields: z.record(z.string(), z.string()).optional(),
  user_agent: z.string().optional(),
});

export const checkOutSchema = z.object({
  attendance_reference: z.string().min(1, "Attendance reference is required"),
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().positive(),
  gps_timestamp: z.string().datetime(),
  idempotency_key: z.string().uuid().optional(),
  user_agent: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const attendanceStatusUpdateSchema = z.object({
  attendance_status: z.enum([
    "NOT_CHECKED_IN",
    "CHECKED_IN",
    "COMPLETED",
    "MISSING_CHECKOUT",
    "FLAGGED",
    "REJECTED",
    "ADMIN_REVIEWED",
  ]),
  admin_notes: z.string().optional(),
});

export const exportReportSchema = z.object({
  event_id: z.string().uuid().optional(),
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
  status: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  participant: z.string().optional(),
  organization: z.string().optional(),
});
