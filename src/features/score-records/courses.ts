import { Course } from "./Course.entity";
import * as courseRepo from "./courseRepository";

export async function getOrCreate(name: string): Promise<Course | null> {
  await courseRepo.upsert(name);
  return courseRepo.findByName(name);
}

export async function findByName(name: string): Promise<Course | null> {
  return courseRepo.findByName(name);
}
