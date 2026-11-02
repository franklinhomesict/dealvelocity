import "server-only";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { clientIp } from "./auth";

export async function audit(
  actorUserId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  changes?: Record<string, unknown>,
) {
  await db.insert(auditLog).values({ actorUserId, action, entity, entityId, changes: changes ?? null, ip: await clientIp() });
}
