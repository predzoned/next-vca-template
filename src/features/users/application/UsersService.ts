import type { CreateUserInput } from "../contracts/user-dto";
import { DuplicateEmailError } from "../domain/errors";
import type { IIdGenerator } from "../domain/IIdGenerator";
import type { IUserRepository } from "../domain/IUserRepository";
import { User } from "../domain/User";
import type { UserId } from "../domain/UserId";

export class UsersService {
  constructor(
    private readonly users: IUserRepository,
    private readonly ids: IIdGenerator,
  ) {}

  list(): Promise<User[]> {
    return this.users.findAll();
  }

  getById(id: UserId): Promise<User | null> {
    return this.users.findById(id);
  }

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.users.findByEmail(input.email.toLowerCase());
    if (existing) {
      throw new DuplicateEmailError(input.email);
    }

    const user = User.create({ id: this.ids.next(), ...input });
    await this.users.save(user);
    return user;
  }
}
