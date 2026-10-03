import { Course } from "./db/Course.entity";
import * as courseRepo from "./db/courseRepository";

export async function getOrCreate(name: string): Promise<Course | null> {
  await courseRepo.upsert(name);
  return courseRepo.findByName(name);
}

