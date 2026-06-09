import { prisma } from '../utils/prisma';
import { User, Role } from '../generated/prisma';

export interface CreateUserInput {
  email: string;
  password: string;
  nickname: string;
  role: Role;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function createUser(input: CreateUserInput): Promise<User> {
  return prisma.user.create({ data: input });
}
