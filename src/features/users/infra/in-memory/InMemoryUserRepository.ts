import "server-only";
import type { IUserRepository } from "../../domain/IUserRepository";
import type { User } from "../../domain/User";
import type { UserId } from "../../domain/UserId";

export class InMemoryUserRepository implements IUserRepository {
  private readonly usersById = new Map<UserId, User>();

  async findById(id: UserId): Promise<User | null> {
    return this.usersById.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.usersById.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async findAll(): Promise<User[]> {
    return [...this.usersById.values()];
  }

  async save(user: User): Promise<void> {
    this.usersById.set(user.id, user);
  }
}
