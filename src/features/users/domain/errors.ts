export class InvalidUserError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidUserError";
  }
}

export class DuplicateEmailError extends Error {
  constructor(readonly email: string) {
    super(`A user with email ${email} already exists`);
    this.name = "DuplicateEmailError";
  }
}
