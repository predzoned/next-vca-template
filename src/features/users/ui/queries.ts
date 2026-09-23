import { apiClient } from "@/kernel/api-client";
import type {
  CreateUserInput,
  CreateUserResult,
  UserDto,
} from "../contracts/user-dto";

export function fetchUsers(): Promise<UserDto[]> {
  return apiClient.get<UserDto[]>("/api/users");
}

export function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  return apiClient.post<CreateUserResult>("/api/users", input);
}
