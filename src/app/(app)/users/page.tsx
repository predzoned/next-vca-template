import type { Metadata } from "next";
import { listUsers } from "@/features/users/server";
import { CreateUserForm, UserList } from "@/features/users/ui";

export const metadata: Metadata = { title: "Users" };

// The list changes at runtime, so never prerender it.
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await listUsers();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <h1 className="font-semibold text-2xl">Users</h1>
      <UserList users={users} />
      <CreateUserForm />
    </main>
  );
}
