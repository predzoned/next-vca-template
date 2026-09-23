import "server-only";
import type { IIdGenerator } from "../../domain/IIdGenerator";
import type { UserId } from "../../domain/UserId";

export class InMemoryIdGenerator implements IIdGenerator {
  private counter = 0;

  next(): UserId {
    this.counter += 1;
    return `user-${this.counter}` as UserId;
  }
}
