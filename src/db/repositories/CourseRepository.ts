import Logger from "js-logger";
import { dataSource } from "../dataSource";
import { Course } from "../entities/Course";

function repo() {
  return dataSource.getRepository(Course);
}

export async function findByName(name: string): Promise<Course | null> {
  return repo().findOneBy({ name });
}

export async function upsert(name: string): Promise<void> {
  const result = await dataSource.query(
    "INSERT INTO courses (name) SELECT ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM courses WHERE name = ?)",
    [name, name]
  );
  if (result.affectedRows > 0) {
    Logger.info(`Course: ${name} - added successfully`);
  } else {
    Logger.debug(`Course: ${name} - already exists, nothing to do`);
  }
}
