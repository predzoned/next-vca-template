import Link from "next/link";
import { Button } from "@/kernel/ui/button";
import { SITE_NAME, SITE_TAGLINE } from "./site";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start gap-6 p-6">
      <h1 className="font-semibold text-2xl">{SITE_NAME}</h1>
      <p className="text-muted-foreground">{SITE_TAGLINE}</p>
      <Button asChild>
        <Link href="/users">Open the users example</Link>
      </Button>
    </main>
  );
}
