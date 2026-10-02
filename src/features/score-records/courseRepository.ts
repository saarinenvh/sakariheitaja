import { moduleLogger } from "../../shared/logger";
import { dataSource } from "../../db/dataSource";
import { Course } from "./Course.entity";

const log = moduleLogger("courses");

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
    log.info({ course: name }, "course added");
  } else {
    log.debug({ course: name }, "course already exists");
  }
}
