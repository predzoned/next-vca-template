import "server-only";
import { randomUUID } from "node:crypto";
import type { IIdGenerator } from "../../domain/IIdGenerator";
import type { UserId } from "../../domain/UserId";

export class CryptoIdGenerator implements IIdGenerator {
  next(): UserId {
    return randomUUID() as UserId;
  }
}
