import Link from "next/link";
import { Button } from "@/kernel/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start gap-6 p-6">
      <h1 className="font-semibold text-2xl">next-vca-template</h1>
      <p className="text-muted-foreground">
        A Next.js starter organized as vertical slices with clean architecture
        inside each slice. The <code>users</code> slice shows the pattern end to
        end.
      </p>
      <Button asChild>
        <Link href="/users">Open the users example</Link>
      </Button>
    </main>
  );
}
