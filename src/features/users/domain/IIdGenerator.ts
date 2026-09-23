import type { UserId } from "./UserId";

export interface IIdGenerator {
  next(): UserId;
}
