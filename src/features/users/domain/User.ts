import { InvalidUserError } from "./errors";
import type { UserId } from "./UserId";

type UserProps = {
  id: UserId;
  name: string;
  email: string;
};

export class User {
  private constructor(
    readonly id: UserId,
    readonly name: string,
    readonly email: string,
  ) {}

  static create(props: UserProps): User {
    const name = props.name.trim();
    const email = props.email.trim().toLowerCase();

    if (name.length === 0) {
      throw new InvalidUserError("Name must not be empty");
    }
    if (!email.includes("@")) {
      throw new InvalidUserError("Email must contain @");
    }

    return new User(props.id, name, email);
  }

  // Rebuilds a user from storage; the invariants were checked when it was created.
  static reconstitute(props: UserProps): User {
    return new User(props.id, props.name, props.email);
  }
}
