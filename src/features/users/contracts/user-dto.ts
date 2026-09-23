import { z } from "zod";

export const userDtoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
});
export type UserDto = z.infer<typeof userDtoSchema>;

export const createUserInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email("Enter a valid email address"),
});
export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export type CreateUserResult =
  | { ok: true; user: UserDto }
  | { ok: false; error: "duplicate-email" };
