import { MessagesSquare } from "lucide-react";
import { PlannedPage } from "@/components/planned";
export const metadata = { title: "Conversations" };
export default function Page() {
  return <PlannedPage title="Conversations" phase={4} icon={MessagesSquare} summary="A unified inbox for calls and texts with sellers, built on Twilio with consent and Do Not Contact enforcement."
    items={["Inbound calls, routing and voicemail", "Manual SMS plus consent-gated automations — never to scraped numbers", "Opt-out (STOP) processing and consent records", "Transcription summaries logged to each property timeline", "Global kill switch for all outbound communication"]} />;
}
