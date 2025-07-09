import { storage } from "./storage";
import { nanoid } from "nanoid";
import crypto from "crypto";

export async function createSuperuserIfNotExists(): Promise<void> {
  try {
    // Проверяем существует ли суперпользователь
    const existingSuperuser = await storage.getUserByUsername("entize");
    
    if (existingSuperuser) {
      if (process.env.NODE_ENV === 'development') {
        console.log("Суперпользователь уже существует");
      }
      return;
    }

    // Создаем суперпользователя (используем простое хеширование)
    const hashedPassword = crypto.createHash('sha256').update("cd5d56a8").digest('hex');
    
    const superuser = await storage.createUser({
      id: nanoid(),
      username: "entize",
      email: "admin@entize.com",
      password: hashedPassword,
      firstName: "Администратор",
      lastName: "Системы",
      role: "superuser",
    });

    if (process.env.NODE_ENV === 'development') {
      console.log("Суперпользователь создан:", superuser.username);
    }
  } catch (error) {
    console.error("Ошибка при создании суперпользователя:", error);
  }
}