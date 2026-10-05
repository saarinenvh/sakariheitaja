import { moduleLogger } from "../../../shared/logger";
import { dataSource } from "../../../db/dataSource";
import { Course } from "./Course.entity";

const log = moduleLogger("courses");

function repo() {
  return dataSource.getRepository(Course);
}

export async function findByName(name: string): Promise<Course | null> {
  return repo().findOneBy({ name });
}

export async function findById(id: number): Promise<Course | null> {
  return repo().findOneBy({ id });
}

/** Courses whose name contains the text, like /tulokset searches them. */
export async function searchByName(text: string): Promise<Course[]> {
  return repo().createQueryBuilder("course").where("course.name LIKE :pattern", { pattern: `%${text}%` }).orderBy("course.name").getMany();
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
