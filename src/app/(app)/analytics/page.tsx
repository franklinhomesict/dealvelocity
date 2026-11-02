import { ChartColumn } from "lucide-react";
import { PlannedPage } from "@/components/planned";
export const metadata = { title: "Analytics" };
export default function Page() {
  return <PlannedPage title="Analytics" phase={7} icon={ChartColumn} summary="Conversion, source ROI and cost reporting once real lead volume exists."
    items={["Stage conversion and time-in-stage by source", "DealMachine credit and messaging cost per contract", "Offer-to-contract rate vs. MAO spread", "Budget alerts for paid services"]} />;
}
