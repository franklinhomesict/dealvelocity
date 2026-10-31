import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./form";
import { LogoMark } from "@/components/shell/logo";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getSessionUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-app px-4">
      <div className="w-full max-w-[340px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="mb-4 h-9 w-9" />
          <h1 className="text-lg font-semibold">Home Buyers ICT</h1>
          <p className="mt-0.5 text-sm text-fg-3">Acquisition OS</p>
        </div>
        <LoginForm next={next ?? "/"} />
        <p className="mt-6 text-center text-xs text-fg-3">Access is limited to authorized team members. Activity is audited.</p>
      </div>
    </div>
  );
}
