// Server-safe exports for other slices. Reach this slice through here (via a port + adapter), never through its internals.
export type { UserDto } from "./contracts/user-dto";
export { getUser, listUsers } from "./server";
