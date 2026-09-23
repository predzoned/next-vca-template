// The only place ui/ reaches the server. Components depend on these signatures, not on the transport:
// today they are Server Actions; to move the API out, reimplement them here with fetch.
export { createUserAction as createUser } from "../actions";
