import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, loginAttempts, type User } from "@/db/schema";

export const SESSION_COOKIE = "aos_session";
const SESSION_DAYS = 30;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export type SessionUser = Pick<User, "id" | "email" | "name" | "role">;

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  const h = await headers();
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    ip: await clientIp(),
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, disabled: users.disabled })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const u = rows[0];
  if (!u || u.disabled) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role };
});

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return u;
}

/** Role gate for mutations. Viewers are read-only; owner-only actions pass ["owner"]. */
export async function requireRole(roles: SessionUser["role"][]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw new Error("You do not have permission to perform this action.");
  return u;
}

export async function verifyCredentials(
  emailRaw: string,
  password: string,
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const email = emailRaw.trim().toLowerCase();
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60e3);
  const [{ failures }] = await db
    .select({ failures: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, email), eq(loginAttempts.success, false), gt(loginAttempts.at, since)));
  if (failures >= MAX_FAILED_ATTEMPTS) {
    return { ok: false, error: `Too many attempts. Try again in ${LOCKOUT_MINUTES} minutes.` };
  }
  const [u] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  // Always run bcrypt to keep timing uniform whether or not the user exists.
  const valid = await bcrypt.compare(password, u?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  const success = !!u && valid && !u.disabled;
  await db.insert(loginAttempts).values({ email, ip: await clientIp(), success });
  if (!success) return { ok: false, error: "Email or password is incorrect." };
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
  return { ok: true, user: { id: u.id, email: u.email, name: u.name, role: u.role } };
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
