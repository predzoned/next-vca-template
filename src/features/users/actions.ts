"use server";

import "server-only";
import {
  type CreateUserInput,
  type CreateUserResult,
  createUserInputSchema,
} from "./contracts/user-dto";
import { createUser } from "./server";

// Server Actions are public POST endpoints: parse every argument, then delegate to server.ts.
// Keep this file thin so it can be swapped for route handlers or an external API later.

export async function createUserAction(
  input: CreateUserInput,
): Promise<CreateUserResult> {
  return createUser(createUserInputSchema.parse(input));
}
