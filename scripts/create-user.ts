import { db } from "../server/db";
import { users } from "../shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { nanoid } from "nanoid";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createUser() {
  const username = "admin";
  const password = "admin123";
  const email = "admin@example.com";
  
  const hashedPassword = await hashPassword(password);
  
  await db.insert(users).values({
    id: nanoid(),
    username,
    email,
    password: hashedPassword,
    firstName: "Admin",
    lastName: "User",
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  console.log("User created successfully!");
  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);
  console.log(`Email: ${email}`);
}

createUser().catch(console.error);