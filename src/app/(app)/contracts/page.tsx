import { FileSignature } from "lucide-react";
import { PlannedPage } from "@/components/planned";
export const metadata = { title: "Contracts" };
export default function Page() {
  return <PlannedPage title="Contracts" phase={6} icon={FileSignature} summary="Purchase agreements generated from your attorney-reviewed Kansas template, only after owner approval."
    items={["Requires the attorney-reviewed Kansas purchase agreement from the owner", "Generate from approved offers with version history", "E-signature integration and signature tracking", "Automatic transaction tasks after execution"]} />;
}
