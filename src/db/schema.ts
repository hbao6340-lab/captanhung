import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  pgEnum,
  index,
  primaryKey,
  foreignKey,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const eventStatusEnum = pgEnum("event_status", [
  "DRAFT",
  "UPCOMING",
  "OPEN",
  "PAUSED",
  "CLOSED",
  "CANCELLED",
  "COMPLETED",
]);

export const eventAccessTypeEnum = pgEnum("event_access_type", [
  "PUBLIC",
  "ACCESS_CODE",
  "INVITATION_ONLY",
  "LOGIN_REQUIRED",
]);

export const evidenceModeEnum = pgEnum("evidence_mode", ["NONE", "OPTIONAL", "MANDATORY"]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "NOT_CHECKED_IN",
  "CHECKED_IN",
  "COMPLETED",
  "MISSING_CHECKOUT",
  "FLAGGED",
  "REJECTED",
  "ADMIN_REVIEWED",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "PENDING",
  "PASSED",
  "FAILED",
  "FLAGGED",
]);

export const evidenceStageEnum = pgEnum("evidence_stage", ["CHECK_IN", "CHECK_OUT"]);

export const evidenceReviewStatusEnum = pgEnum("evidence_review_status", [
  "PENDING",
  "REVIEWED",
  "FLAGGED",
  "APPROVED",
]);

export const actionResultEnum = pgEnum("action_result", ["SUCCESS", "FAILURE"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    email: varchar("email", { length: 300 }).notNull().unique(),
    phone: varchar("phone", { length: 50 }),
    passwordHash: text("password_hash").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    emailVerified: boolean("email_verified").notNull().default(false),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: index("users_email_idx").on(t.email),
    statusIdx: index("users_status_idx").on(t.status),
  })
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 50 }).notNull().unique(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: index("roles_name_idx").on(t.name),
  })
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: index("permissions_name_idx").on(t.name),
  })
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    roleId: uuid("role_id").notNull(),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
    assignedBy: uuid("assigned_by"),
  },
  (t) => ({
    userIdIdx: index("user_roles_user_id_idx").on(t.userId),
    roleIdIdx: index("user_roles_role_id_idx").on(t.roleId),
    uniq: primaryKey({ columns: [t.userId, t.roleId] }),
  })
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleId: uuid("role_id").notNull(),
    permissionId: uuid("permission_id").notNull(),
    grantedAt: timestamp("granted_at").notNull().defaultNow(),
  },
  (t) => ({
    roleIdIdx: index("role_permissions_role_id_idx").on(t.roleId),
    permIdIdx: index("role_permissions_permission_id_idx").on(t.permissionId),
    uniq: primaryKey({ columns: [t.roleId, t.permissionId] }),
  })
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    refreshTokenHash: text("refresh_token_hash").unique(),
    expiresAt: timestamp("expires_at").notNull(),
    refreshExpiresAt: timestamp("refresh_expires_at"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => ({
    userIdIdx: index("sessions_user_id_idx").on(t.userId),
    tokenHashIdx: index("sessions_token_hash_idx").on(t.tokenHash),
  })
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventCode: varchar("event_code", { length: 40 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    bannerImage: text("banner_image"),
    venueName: varchar("venue_name", { length: 200 }),
    venueAddress: text("venue_address"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    geofenceRadiusMeters: integer("geofence_radius_meters").notNull().default(100),
    checkinStartAt: timestamp("checkin_start_at").notNull(),
    checkinEndAt: timestamp("checkin_end_at").notNull(),
    checkoutStartAt: timestamp("checkout_start_at"),
    checkoutEndAt: timestamp("checkout_end_at"),
    timezone: varchar("timezone", { length: 60 }).notNull().default("Asia/Ho_Chi_Minh"),
    status: eventStatusEnum("status").notNull().default("DRAFT"),
    accessType: eventAccessTypeEnum("access_type").notNull().default("PUBLIC"),
    accessCodeHash: text("access_code_hash"),
    requireLogin: boolean("require_login").notNull().default(false),
    requireGpsCheckin: boolean("require_gps_checkin").notNull().default(true),
    requireGpsCheckout: boolean("require_gps_checkout").notNull().default(true),
    gpsAccuracyThresholdMeters: integer("gps_accuracy_threshold_meters").notNull().default(20),
    requireGeofence: boolean("require_geofence").notNull().default(true),
    requireCheckoutEvidence: evidenceModeEnum("require_checkout_evidence").notNull().default("MANDATORY"),
    evidenceMode: evidenceModeEnum("evidence_mode").notNull().default("MANDATORY"),
    allowMultipleAttendance: boolean("allow_multiple_attendance").notNull().default(false),
    maxAttendance: integer("max_attendance"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    publishedAt: timestamp("published_at"),
    closedAt: timestamp("closed_at"),
  },
  (t) => ({
    eventCodeIdx: index("events_event_code_idx").on(t.eventCode),
    statusIdx: index("events_status_idx").on(t.status),
    createdAtIdx: index("events_created_at_idx").on(t.createdAt),
    checkinWindowIdx: index("events_checkin_window_idx").on(t.checkinStartAt, t.checkinEndAt),
  })
);

export const eventCustomFields = pgTable(
  "event_custom_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull(),
    fieldName: varchar("field_name", { length: 200 }).notNull(),
    fieldType: varchar("field_type", { length: 30 }).notNull(),
    required: boolean("required").notNull().default(false),
    options: text("options"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    eventIdIdx: index("event_custom_fields_event_id_idx").on(t.eventId),
  })
);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull(),
    attendanceReference: varchar("attendance_reference", { length: 80 }).notNull().unique(),
    idempotencyKey: uuid("idempotency_key").unique(),
    participantUserId: uuid("participant_user_id"),
    participantName: varchar("participant_name", { length: 200 }).notNull(),
    participantPhone: varchar("participant_phone", { length: 100 }).notNull(),
    participantIdentifier: varchar("participant_identifier", { length: 100 }),
    participantOrganization: varchar("participant_organization", { length: 200 }),
    participantCategory: varchar("participant_category", { length: 100 }),
    checkinAt: timestamp("checkin_at"),
    checkinLatitude: doublePrecision("checkin_latitude"),
    checkinLongitude: doublePrecision("checkin_longitude"),
    checkinAccuracy: doublePrecision("checkin_accuracy"),
    checkinGpsTimestamp: timestamp("checkin_gps_timestamp"),
    checkinVerificationStatus: verificationStatusEnum("checkin_verification_status").notNull().default("PENDING"),
    checkoutAt: timestamp("checkout_at"),
    checkoutLatitude: doublePrecision("checkout_latitude"),
    checkoutLongitude: doublePrecision("checkout_longitude"),
    checkoutAccuracy: doublePrecision("checkout_accuracy"),
    checkoutGpsTimestamp: timestamp("checkout_gps_timestamp"),
    checkoutVerificationStatus: verificationStatusEnum("checkout_verification_status").notNull().default("PENDING"),
    attendanceDurationSeconds: integer("attendance_duration_seconds"),
    attendanceStatus: attendanceStatusEnum("attendance_status").notNull().default("NOT_CHECKED_IN"),
    checkoutEvidenceRequired: boolean("checkout_evidence_required").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    eventIdIdx: index("attendance_records_event_id_idx").on(t.eventId),
    referenceIdx: index("attendance_records_reference_idx").on(t.attendanceReference),
    phoneIdx: index("attendance_records_phone_idx").on(t.participantPhone),
    statusIdx: index("attendance_records_status_idx").on(t.attendanceStatus),
    checkinAtIdx: index("attendance_records_checkin_at_idx").on(t.checkinAt),
  })
);

export const attendanceCustomFieldValues = pgTable(
  "attendance_custom_field_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attendanceRecordId: uuid("attendance_record_id").notNull(),
    fieldId: uuid("field_id").notNull(),
    value: text("value").notNull(),
  },
  (t) => ({
    attendanceRecordIdIdx: index("attendance_cfv_attendance_record_id_idx").on(t.attendanceRecordId),
    fieldIdIdx: index("attendance_cvf_field_id_idx").on(t.fieldId),
    uniq: primaryKey({ columns: [t.attendanceRecordId, t.fieldId] }),
  })
);

export const attendanceEvidence = pgTable(
  "attendance_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attendanceRecordId: uuid("attendance_record_id").notNull(),
    stage: evidenceStageEnum("stage").notNull(),
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename"),
    mimeType: text("mime_type"),
    fileSize: integer("file_size"),
    uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
    reviewedBy: uuid("reviewed_by"),
    reviewStatus: evidenceReviewStatusEnum("review_status").notNull().default("PENDING"),
    reviewNotes: text("review_notes"),
    reviewedAt: timestamp("reviewed_at"),
  },
  (t) => ({
    attendanceRecordIdIdx: index("attendance_evidence_attendance_record_id_idx").on(t.attendanceRecordId),
    stageIdx: index("attendance_evidence_stage_idx").on(t.stage),
    reviewStatusIdx: index("attendance_evidence_review_status_idx").on(t.reviewStatus),
  })
);

export const attendanceVerificationLogs = pgTable(
  "attendance_verification_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attendanceRecordId: uuid("attendance_record_id").notNull(),
    stage: evidenceStageEnum("stage").notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    accuracy: doublePrecision("accuracy"),
    calculatedDistance: doublePrecision("calculated_distance"),
    geofenceResult: boolean("geofence_result"),
    verificationResult: verificationStatusEnum("verification_result").notNull(),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    attendanceRecordIdIdx: index("attendance_verif_logs_attendance_record_id_idx").on(t.attendanceRecordId),
    stageIdx: index("attendance_verif_logs_stage_idx").on(t.stage),
    createdAtIdx: index("attendance_verif_logs_created_at_idx").on(t.createdAt),
  })
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    oldValues: text("old_values"),
    newValues: text("new_values"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: index("audit_logs_actor_id_idx").on(t.actorUserId),
    entityIdx: index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    createdAtIdx: index("audit_logs_created_at_idx").on(t.createdAt),
    actionIdx: index("audit_logs_action_idx").on(t.action),
  })
);

export const accessLogs = pgTable(
  "access_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id"),
    accessAttemptType: text("access_attempt_type").notNull(),
    result: actionResultEnum("result").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    eventIdIdx: index("access_logs_event_id_idx").on(t.eventId),
    createdAtIdx: index("access_logs_created_at_idx").on(t.createdAt),
    resultIdx: index("access_logs_result_idx").on(t.result),
  })
);

export const reportExports = pgTable(
  "report_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id"),
    format: varchar("format", { length: 20 }).notNull(),
    filePath: text("file_path").notNull(),
    rowCount: integer("row_count"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    eventIdIdx: index("report_exports_event_id_idx").on(t.eventId),
    createdAtIdx: index("report_exports_created_at_idx").on(t.createdAt),
  })
);

// Foreign key relations (declared for documentation; drizzle-kit uses them)
export const eventForeignKeys = {
  eventCustomFieldsEventId: foreignKey({
    columns: [eventCustomFields.eventId],
    foreignColumns: [events.id],
  }),
  attendanceRecordsEventId: foreignKey({
    columns: [attendanceRecords.eventId],
    foreignColumns: [events.id],
  }),
};
