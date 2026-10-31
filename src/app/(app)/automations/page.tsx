import { Workflow } from "lucide-react";
import { PlannedPage } from "@/components/planned";
export const metadata = { title: "Automations" };
export default function Page() {
  return <PlannedPage title="Automations" phase={4} icon={Workflow} summary="Durable in-app workflows (no n8n/Zapier) backed by a PostgreSQL job queue."
    items={["Observable job state with retries and idempotency keys", "No duplicate outbound messages on retry", "Lead imported → consent check → authorized outreach → qualification → underwriting", "Owner notifications for passing deals and approvals", "Kill switch for external communications and paid AI actions"]} />;
}
