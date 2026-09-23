import "server-only";
import { UsersService } from "./application/UsersService";
import {
  type CreateUserInput,
  type CreateUserResult,
  type UserDto,
  userDtoSchema,
} from "./contracts/user-dto";
import { DuplicateEmailError } from "./domain/errors";
import type { User } from "./domain/User";
import type { UserId } from "./domain/UserId";
import { CryptoIdGenerator } from "./infra/crypto/CryptoIdGenerator";
import { InMemoryUserRepository } from "./infra/in-memory/InMemoryUserRepository";

// Swap the repository here when a database arrives (e.g. new DrizzleUserRepository(db)).
// The in-memory store lives as long as the server process; it resets on restart.
const service = new UsersService(
  new InMemoryUserRepository(),
  new CryptoIdGenerator(),
);

function toUserDto(user: User): UserDto {
  return userDtoSchema.parse({
    id: user.id,
    name: user.name,
    email: user.email,
  });
}

export async function listUsers(): Promise<UserDto[]> {
  const users = await service.list();
  return users.map(toUserDto);
}

export async function getUser(id: string): Promise<UserDto | null> {
  const user = await service.getById(id as UserId);
  return user ? toUserDto(user) : null;
}

export async function createUser(
  input: CreateUserInput,
): Promise<CreateUserResult> {
  try {
    const user = await service.create(input);
    return { ok: true, user: toUserDto(user) };
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      return { ok: false, error: "duplicate-email" };
    }
    throw error;
  }
}
