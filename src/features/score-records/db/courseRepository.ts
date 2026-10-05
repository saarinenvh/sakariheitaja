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

/** Adds the course when no course has that name yet (names are unique, ignoring case). */
export async function addIfAbsent(name: string): Promise<void> {
  if (await repo().existsBy({ name })) return;

  await repo().createQueryBuilder().insert().into(Course).values({ name }).orIgnore().execute();

  log.info({ course: name }, "course added");
}
