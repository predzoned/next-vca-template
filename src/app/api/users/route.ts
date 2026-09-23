import { NextResponse } from "next/server";
import { createUserInputSchema } from "@/features/users/contracts/user-dto";
import { createUser, listUsers } from "@/features/users/server";

export async function GET() {
  return NextResponse.json(await listUsers());
}

export async function POST(request: Request) {
  const parsed = createUserInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ issues: parsed.error.issues }, { status: 400 });
  }

  const result = await createUser(parsed.data);
  return NextResponse.json(result, { status: result.ok ? 201 : 409 });
}
