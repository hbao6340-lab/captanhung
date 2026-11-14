import { getDb } from "@/db/index";
import * as schema from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";

const PERMISSIONS = [
  { name: "event:create", description: "Create events" },
  { name: "event:edit", description: "Edit events" },
  { name: "event:publish", description: "Publish events" },
  { name: "event:open", description: "Open/pause/reopen events" },
  { name: "event:close", description: "Close events" },
  { name: "attendance:view", description: "View attendance records" },
  { name: "attendance:export", description: "Export attendance reports" },
  { name: "attendance:correct", description: "Correct attendance records" },
  { name: "evidence:review", description: "Review check-out evidence" },
  { name: "user:manage", description: "Manage administrator accounts" },
  { name: "settings:read", description: "Read settings" },
  { name: "audit:view", description: "View audit logs" },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.name),
  MANAGER: [
    "event:create", "event:edit", "event:publish", "event:open", "event:close",
    "attendance:view", "attendance:export", "attendance:correct", "evidence:review", "settings:read",
  ],
  STAFF: ["attendance:view", "evidence:review"],
};

async function main() {
  const db = getDb();

  // Permissions
  for (const p of PERMISSIONS) {
    await db.insert(schema.permissions).values(p).onConflictDoNothing({ target: schema.permissions.name });
  }

  // Roles
  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
    const [role] = await db
      .insert(schema.roles)
      .values({ name: roleName, description: `${roleName} role` })
      .onConflictDoNothing({ target: schema.roles.name })
      .returning();
    const existing = role ?? (await db.select().from(schema.roles).where(eq(schema.roles.name, roleName)).limit(1)).at(0)!;
    // replace permissions
    await db.delete(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, existing.id));
    for (const permName of permNames) {
      const [perm] = await db.select().from(schema.permissions).where(eq(schema.permissions.name, permName)).limit(1);
      if (perm) {
        await db.insert(schema.rolePermissions).values({ roleId: existing.id, permissionId: perm.id });
      }
    }
  }

  // Default admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@captanhung.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123456";
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, adminEmail)).limit(1);
  if (existing.length === 0) {
    const passwordHash = await hashPassword(adminPassword);
    const [user] = await db.insert(schema.users).values({ fullName: "System Administrator", email: adminEmail, passwordHash, status: "active" }).returning();
    const [adminRole] = await db.select().from(schema.roles).where(eq(schema.roles.name, "ADMIN")).limit(1);
    if (adminRole) {
      await db.insert(schema.userRoles).values({ userId: user.id, roleId: adminRole.id });
    }
    console.log(`Seeded admin: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log(`Admin already exists: ${adminEmail}`);
  }

  console.log("Seed complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
