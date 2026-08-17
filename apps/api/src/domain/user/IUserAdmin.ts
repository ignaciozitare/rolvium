/**
 * Port: privileged user operations that require the identity provider's
 * admin API (service role). Only the API process may hold that credential.
 */
export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  roleId: string;
}

export interface CreatedUser {
  id: string;
  email: string;
}

export interface IUserAdmin {
  createUser(input: CreateUserInput): Promise<CreatedUser>;
  setPassword(userId: string, password: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}
