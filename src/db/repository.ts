import { eq, and, or, ilike, count as countRows, desc, asc, sql } from "drizzle-orm";
import { getDb } from "./index";
import * as schema from "./schema";

let _db: ReturnType<typeof getDb> | null = null;
function getDbInst() { if (!_db) _db = getDb(); return _db; }


function toCamelKeys(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const camel = k.replace(/[_-]([a-z0-9])/g, (_, c) => c.toUpperCase());
    result[camel] = v;
  }
  return result;
}

function eqEnum(col: any, val: any) {
  return eq(col, val as any);
}

/* ------------------------------------------------------------------ */
/* Users                                                              */
/* ------------------------------------------------------------------ */
export async function getUserByEmail(email: string) {
  const [row] = await getDbInst().select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  return row ?? null;
}

export async function getUserById(id: string) {
  const [row] = await getDbInst().select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return row ?? null;
}

export async function createUser(data: {
  fullName: string;
  email: string;
  phone?: string | null;
  passwordHash: string;
  status?: string;
}) {
  const [row] = await getDbInst()
    .insert(schema.users)
    .values(toCamelKeys({ fullName: data.fullName, email: data.email, phone: data.phone ?? null, passwordHash: data.passwordHash, status: data.status ?? "active" }) as any)
    .returning();
  return row;
}

export async function updateUser(id: string, data: Record<string, any>) {
  const [row] = await getDbInst()
    .update(schema.users)
    .set({ ...(toCamelKeys(data) as any), updatedAt: new Date() })
    .where(eq(schema.users.id, id))
    .returning();
  return row;
}

export async function repoListUsers() {
  return getDbInst().select().from(schema.users).orderBy(desc(schema.users.createdAt));
}

/* ------------------------------------------------------------------ */
/* Roles / Permissions                                                */
/* ------------------------------------------------------------------ */
export async function listRoles() {
  return getDbInst().select().from(schema.roles).orderBy(asc(schema.roles.name));
}

export async function listPermissions() {
  return getDbInst().select().from(schema.permissions).orderBy(asc(schema.permissions.name));
}

export async function getRoleByName(name: string) {
  const [row] = await getDbInst().select().from(schema.roles).where(eq(schema.roles.name, name)).limit(1);
  return row ?? null;
}

export async function upsertRole(name: string, description?: string) {
  const existing = await getRoleByName(name);
  if (existing) {
    const [row] = await getDbInst()
      .update(schema.roles)
      .set({ description: description ?? existing.description, updatedAt: new Date() })
      .where(eq(schema.roles.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await getDbInst().insert(schema.roles).values({ name, description }).returning();
  return row;
}

export async function setRolePermissions(roleId: string, permissionIds: string[]) {
  await getDbInst().delete(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, roleId));
  if (permissionIds.length) {
    await getDbInst().insert(schema.rolePermissions).values(
      permissionIds.map((pid) => ({ roleId, permissionId: pid }))
    );
  }
}

export async function getUserRolesWithPermissions(userId: string) {
  const rows = await getDbInst()
    .select({
      role: schema.roles,
      permissions: schema.permissions,
    })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
    .leftJoin(schema.rolePermissions, eq(schema.rolePermissions.roleId, schema.roles.id))
    .leftJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
    .where(eq(schema.userRoles.userId, userId));
  return rows;
}

export async function assignUserRole(userId: string, roleId: string, assignedBy?: string) {
  await getDbInst().insert(schema.userRoles).values({ userId, roleId, assignedBy });
}

/* ------------------------------------------------------------------ */
/* Sessions                                                           */
/* ------------------------------------------------------------------ */
export async function createSession(data: {
  userId: string;
  tokenHash: string;
  refreshTokenHash?: string | null;
  expiresAt: Date;
  refreshExpiresAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const [row] = await getDbInst().insert(schema.sessions).values({
    userId: data.userId,
    tokenHash: data.tokenHash,
    refreshTokenHash: data.refreshTokenHash ?? null,
    expiresAt: data.expiresAt,
    refreshExpiresAt: data.refreshExpiresAt ?? null,
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null,
  }).returning();
  return row;
}

export async function revokeSessionByTokenHash(tokenHash: string) {
  await getDbInst().update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.tokenHash, tokenHash));
}

export async function revokeSessionByRefreshHash(hash: string) {
  await getDbInst().update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.refreshTokenHash, hash));
}

/* ------------------------------------------------------------------ */
/* Events                                                             */
/* ------------------------------------------------------------------ */
export async function getEventByCode(code: string) {
  const [row] = await getDbInst().select().from(schema.events).where(eq(schema.events.eventCode, code)).limit(1);
  return row ?? null;
}

export async function getEventById(id: string) {
  const [row] = await getDbInst().select().from(schema.events).where(eq(schema.events.id, id)).limit(1);
  return row ?? null;
}

interface EventFilter {
  search?: string;
  status?: string;
  statuses?: string[];
  limit?: number;
  offset?: number;
}
export async function listEvents({ search, status, statuses, limit = 50, offset = 0 }: EventFilter) {
  const conditions: any[] = [];
  if (search) {
    conditions.push(
      or(
        ilike(schema.events.title, `%${search}%`),
        ilike(schema.events.eventCode, `%${search}%`),
        ilike(schema.events.venueName, `%${search}%`)
      )
    );
  }
  if (statuses && statuses.length) {
    conditions.push(or(...statuses.map((s) => eqEnum(schema.events.status, s))));
  } else if (status) {
    conditions.push(eqEnum(schema.events.status, status));
  }
  const where = and(...conditions);
  return getDbInst()
    .select()
    .from(schema.events)
    .where(where)
    .orderBy(desc(schema.events.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countEvents({ search, status, statuses }: EventFilter) {
  const conditions: any[] = [];
  if (search) {
    conditions.push(
      or(
        ilike(schema.events.title, `%${search}%`),
        ilike(schema.events.eventCode, `%${search}%`),
        ilike(schema.events.venueName, `%${search}%`)
      )
    );
  }
  if (statuses && statuses.length) {
    conditions.push(or(...statuses.map((s) => eqEnum(schema.events.status, s))));
  } else if (status) {
    conditions.push(eqEnum(schema.events.status, status));
  }
  const where = and(...conditions);
  const [{ count }] = await getDbInst().select({ count: countRows() }).from(schema.events).where(where);
  return Number(count);
}

export async function createEvent(data: Record<string, any>) {
  const [row] = await getDbInst().insert(schema.events).values(toCamelKeys(data) as any).returning();
  return row;
}

export async function updateEvent(id: string, data: Record<string, any>) {
  const [row] = await getDbInst().update(schema.events).set({ ...(toCamelKeys(data) as any), updatedAt: new Date() }).where(eq(schema.events.id, id)).returning();
  return row;
}

export async function listCustomFields(eventId: string) {
  return getDbInst().select().from(schema.eventCustomFields).where(eq(schema.eventCustomFields.eventId, eventId)).orderBy(asc(schema.eventCustomFields.sortOrder));
}

export async function createCustomFields(eventId: string, fields: any[]) {
  if (!fields.length) return;
  await getDbInst().insert(schema.eventCustomFields).values(fields.map((f) => toCamelKeys({ ...f, eventId }) as any));
}

/* ------------------------------------------------------------------ */
/* Attendance                                                         */
/* ------------------------------------------------------------------ */
export async function getAttendanceByReference(reference: string) {
  const [row] = await getDbInst().select().from(schema.attendanceRecords).where(eq(schema.attendanceRecords.attendanceReference, reference)).limit(1);
  return row ?? null;
}

export async function getAttendanceById(id: string) {
  const [row] = await getDbInst().select().from(schema.attendanceRecords).where(eq(schema.attendanceRecords.id, id)).limit(1);
  return row ?? null;
}

export async function getAttendanceByIdempotencyKey(key: string) {
  const [row] = await getDbInst().select().from(schema.attendanceRecords).where(eq(schema.attendanceRecords.idempotencyKey, key)).limit(1);
  return row ?? null;
}

export async function countAttendanceByEventPhone(eventId: string, phone: string) {
  const [{ count }] = await getDbInst()
    .select({ count: countRows() })
    .from(schema.attendanceRecords)
    .where(and(eq(schema.attendanceRecords.eventId, eventId), eq(schema.attendanceRecords.participantPhone, phone)));
  return Number(count);
}

export async function countAttendanceByEvent(eventId: string) {
  const [{ count }] = await getDbInst().select({ count: countRows() }).from(schema.attendanceRecords).where(eq(schema.attendanceRecords.eventId, eventId));
  return Number(count);
}

export async function createAttendanceRecord(data: Record<string, any>) {
  const [row] = await getDbInst().insert(schema.attendanceRecords).values(toCamelKeys(data) as any).returning();
  return row;
}

export async function updateAttendance(id: string, data: Record<string, any>) {
  const [row] = await getDbInst().update(schema.attendanceRecords).set({ ...(toCamelKeys(data) as any), updatedAt: new Date() }).where(eq(schema.attendanceRecords.id, id)).returning();
  return row;
}

interface AttendanceFilter {
  eventId?: string;
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}
export async function listAttendance({ eventId, search, status, limit = 50, offset = 0 }: AttendanceFilter) {
  const where = and(
    eventId ? eq(schema.attendanceRecords.eventId, eventId) : undefined,
    search
      ? or(
          ilike(schema.attendanceRecords.participantName, `%${search}%`),
          ilike(schema.attendanceRecords.participantPhone, `%${search}%`),
          ilike(schema.attendanceRecords.attendanceReference, `%${search}%`),
          ilike(schema.attendanceRecords.participantOrganization, `%${search}%`)
        )
      : undefined,
    status ? eqEnum(schema.attendanceRecords.attendanceStatus, status) : undefined
  );
  return getDbInst()
    .select()
    .from(schema.attendanceRecords)
    .where(where)
    .orderBy(desc(schema.attendanceRecords.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countAttendance({ eventId, search, status }: AttendanceFilter) {
  const where = and(
    eventId ? eq(schema.attendanceRecords.eventId, eventId) : undefined,
    search
      ? or(
          ilike(schema.attendanceRecords.participantName, `%${search}%`),
          ilike(schema.attendanceRecords.participantPhone, `%${search}%`),
          ilike(schema.attendanceRecords.attendanceReference, `%${search}%`),
          ilike(schema.attendanceRecords.participantOrganization, `%${search}%`)
        )
      : undefined,
    status ? eqEnum(schema.attendanceRecords.attendanceStatus, status) : undefined
  );
  const [{ count }] = await getDbInst().select({ count: countRows() }).from(schema.attendanceRecords).where(where);
  return Number(count);
}

export async function getEvidenceForRecord(attendanceRecordId: string) {
  return getDbInst().select().from(schema.attendanceEvidence).where(eq(schema.attendanceEvidence.attendanceRecordId, attendanceRecordId)).orderBy(desc(schema.attendanceEvidence.uploadedAt));
}

export async function getVerificationLogsForRecord(attendanceRecordId: string) {
  return getDbInst().select().from(schema.attendanceVerificationLogs).where(eq(schema.attendanceVerificationLogs.attendanceRecordId, attendanceRecordId)).orderBy(desc(schema.attendanceVerificationLogs.createdAt));
}

export async function getCustomFieldValuesForRecord(attendanceRecordId: string) {
  return getDbInst()
    .select({ value: schema.attendanceCustomFieldValues.value, field: schema.eventCustomFields })
    .from(schema.attendanceCustomFieldValues)
    .innerJoin(schema.eventCustomFields, eq(schema.attendanceCustomFieldValues.fieldId, schema.eventCustomFields.id))
    .where(eq(schema.attendanceCustomFieldValues.attendanceRecordId, attendanceRecordId));
}

export async function createAttendanceEvidence(data: Record<string, any>) {
  const [row] = await getDbInst().insert(schema.attendanceEvidence).values(toCamelKeys(data) as any).returning();
  return row;
}

export async function createVerificationLog(data: Record<string, any>) {
  const [row] = await getDbInst().insert(schema.attendanceVerificationLogs).values(toCamelKeys(data) as any).returning();
  return row;
}

export async function updateEvidenceReview(id: string, data: { reviewStatus: string; reviewedBy?: string; reviewNotes?: string }) {
  const [row] = await getDbInst().update(schema.attendanceEvidence)
    .set({ ...(toCamelKeys(data) as any), reviewedAt: new Date() })
    .where(eq(schema.attendanceEvidence.id, id))
    .returning();
  return row;
}

export async function getEvidenceByStorageKey(storageKey: string) {
  const [row] = await getDbInst().select().from(schema.attendanceEvidence).where(eq(schema.attendanceEvidence.storageKey, storageKey)).limit(1);
  return row ?? null;
}

/* ------------------------------------------------------------------ */
/* Audit / Access logs                                                */
/* ------------------------------------------------------------------ */
export async function createAccessLog(data: { eventId?: string | null; accessAttemptType: string; result: string; ipAddress?: string | null; userAgent?: string | null }) {
  await getDbInst().insert(schema.accessLogs).values({
    eventId: data.eventId ?? null,
    accessAttemptType: data.accessAttemptType,
    result: data.result as any,
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null,
  });
}

export async function createAuditLog(data: {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  await getDbInst().insert(schema.auditLogs).values({
    actorUserId: data.actorUserId ?? null,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId ?? null,
    oldValues: data.oldValues ? JSON.stringify(data.oldValues) : null,
    newValues: data.newValues ? JSON.stringify(data.newValues) : null,
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null,
  });
}

interface AuditFilter { search?: string }
export async function listAuditLogs({ search }: AuditFilter) {
  const where = search
    ? or(ilike(schema.auditLogs.action, `%${search}%`), ilike(schema.auditLogs.entityType, `%${search}%`))
    : undefined;
  return getDbInst().select().from(schema.auditLogs).where(where).orderBy(desc(schema.auditLogs.createdAt));
}

export async function countAuditLogs({ search }: AuditFilter) {
  const where = search
    ? or(ilike(schema.auditLogs.action, `%${search}%`), ilike(schema.auditLogs.entityType, `%${search}%`))
    : undefined;
  const [{ count }] = await getDbInst().select({ count: countRows() }).from(schema.auditLogs).where(where);
  return Number(count);
}

export async function createReportExport(data: { eventId?: string | null; format: string; filePath: string; rowCount?: number | null; createdBy?: string | null }) {
  const [row] = await getDbInst().insert(schema.reportExports).values({
    eventId: data.eventId ?? null,
    format: data.format,
    filePath: data.filePath,
    rowCount: data.rowCount ?? null,
    createdBy: data.createdBy ?? null,
  }).returning();
  return row;
}

/* ------------------------------------------------------------------ */
/* Dashboard stats                                                    */
/* ------------------------------------------------------------------ */
export async function dashboardStats() {
  const results = await Promise.all([
    getDbInst().select({ count: countRows() }).from(schema.events),
    getDbInst().select({ count: countRows() }).from(schema.events).where(eqEnum(schema.events.status, "UPCOMING")),
    getDbInst().select({ count: countRows() }).from(schema.events).where(eqEnum(schema.events.status, "OPEN")),
    getDbInst().select({ count: countRows() }).from(schema.events).where(eqEnum(schema.events.status, "CLOSED")),
    getDbInst().select({ count: countRows() }).from(schema.attendanceRecords).where(sql`${schema.attendanceRecords.checkinAt} IS NOT NULL`),
    getDbInst().select({ count: countRows() }).from(schema.attendanceRecords).where(eqEnum(schema.attendanceRecords.attendanceStatus, "COMPLETED")),
    getDbInst().select({ count: countRows() }).from(schema.attendanceRecords).where(eqEnum(schema.attendanceRecords.attendanceStatus, "MISSING_CHECKOUT")),
    getDbInst().select({ count: countRows() }).from(schema.attendanceRecords).where(eqEnum(schema.attendanceRecords.attendanceStatus, "FLAGGED")),
  ]);
  const g = (r: any[]) => Number(r[0]?.count);
  return {
    total_events: g(results[0]),
    upcoming_events: g(results[1]),
    open_events: g(results[2]),
    closed_events: g(results[3]),
    total_checkins: g(results[4]),
    completed_attendance: g(results[5]),
    missing_checkouts: g(results[6]),
    flagged_submissions: g(results[7]),
  };
}
export async function recentAttendanceActivity() {
  return getDbInst()
    .select({
      reference: schema.attendanceRecords.attendanceReference,
      name: schema.attendanceRecords.participantName,
      status: schema.attendanceRecords.attendanceStatus,
      checkinAt: schema.attendanceRecords.checkinAt,
      checkoutAt: schema.attendanceRecords.checkoutAt,
      eventTitle: schema.events.title,
      eventCode: schema.events.eventCode,
    })
    .from(schema.attendanceRecords)
    .leftJoin(schema.events, eq(schema.attendanceRecords.eventId, schema.events.id))
    .orderBy(desc(schema.attendanceRecords.createdAt))
    .limit(10);
}

interface ReportFilter {
  eventId?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  participant?: string;
  organization?: string;
  limit?: number;
  offset?: number;
}
export async function listAllAttendance({ eventId, status, dateFrom, dateTo, participant, organization, limit = 200, offset = 0 }: ReportFilter) {
  const conditions: any[] = [];
  if (eventId) conditions.push(eq(schema.attendanceRecords.eventId, eventId));
  if (status) conditions.push(eqEnum(schema.attendanceRecords.attendanceStatus, status));
  if (dateFrom) conditions.push(sql`${schema.attendanceRecords.checkinAt} >= ${dateFrom}`);
  if (dateTo) conditions.push(sql`${schema.attendanceRecords.checkinAt} <= ${dateTo}`);
  if (participant) conditions.push(ilike(schema.attendanceRecords.participantName, `%${participant}%`));
  if (organization) conditions.push(ilike(schema.attendanceRecords.participantOrganization, `%${organization}%`));
  const where = and(...conditions);
  return getDbInst()
    .select()
    .from(schema.attendanceRecords)
    .leftJoin(schema.events, eq(schema.attendanceRecords.eventId, schema.events.id))
    .where(where)
    .orderBy(desc(schema.attendanceRecords.checkinAt))
    .limit(limit)
    .offset(offset);
}

export async function countAllAttendance({ eventId, status, dateFrom, dateTo, participant, organization }: ReportFilter) {
  const conditions: any[] = [];
  if (eventId) conditions.push(eq(schema.attendanceRecords.eventId, eventId));
  if (status) conditions.push(eqEnum(schema.attendanceRecords.attendanceStatus, status));
  if (dateFrom) conditions.push(sql`${schema.attendanceRecords.checkinAt} >= ${dateFrom}`);
  if (dateTo) conditions.push(sql`${schema.attendanceRecords.checkinAt} <= ${dateTo}`);
  if (participant) conditions.push(ilike(schema.attendanceRecords.participantName, `%${participant}%`));
  if (organization) conditions.push(ilike(schema.attendanceRecords.participantOrganization, `%${organization}%`));
  const where = and(...conditions);
  const [{ count }] = await getDbInst().select({ count: countRows() }).from(schema.attendanceRecords).where(where);
  return Number(count);
}

