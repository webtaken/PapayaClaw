import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { user as userTable } from "./schema";

export type Role = "user" | "staff";

export type AuthContext = {
  user: { id: string; email: string; role: Role };
  isStaff: boolean;
};

/** Parse the server-only STAFF_EMAILS allowlist and test an email against it. */
export function isStaffEmail(email: string): boolean {
  const list = (process.env.STAFF_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/** The env allowlist is the source of truth for staff status. */
export function resolveRole(email: string): Role {
  return isStaffEmail(email) ? "staff" : "user";
}

/** The single ownership/staff access rule. */
export function canAccessInstance(
  ctx: { user: { id: string }; isStaff: boolean },
  inst: { userId: string },
): boolean {
  return ctx.isStaff || inst.userId === ctx.user.id;
}

/**
 * Resolve the authenticated user + staff status.
 * Self-healing: if the env allowlist disagrees with the persisted role,
 * update the column (only when it actually differs — no write on the
 * common path where role already matches).
 *
 * `headers` is passed explicitly so this works both in Next.js routes
 * (`await headers()`) and in the custom Socket.IO server (hand-built Headers).
 */
export async function getSessionContext(
  headers: Headers,
): Promise<AuthContext | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  const { id, email } = session.user;
  const rawRole = (session.user as Record<string, unknown>).role;
  const currentRole: Role = rawRole === "staff" ? "staff" : "user";
  const desired = resolveRole(email);

  if (desired !== currentRole) {
    await db.update(userTable).set({ role: desired }).where(eq(userTable.id, id));
  }

  return {
    user: { id, email, role: desired },
    isStaff: desired === "staff",
  };
}
