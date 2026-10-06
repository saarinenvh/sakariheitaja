import { readFileSync } from "fs";
import { join } from "path";
import { inject } from "vitest";
import { createConnection } from "mysql2/promise";
import type { DataSource } from "typeorm";

const PROD_SCHEMA = readFileSync(join(__dirname, "fixtures", "prodSchema.sql"), "utf8");

/**
 * Recreates the database from the prod schema and initialises the bot's own data source on it,
 * which runs every migration. Call once per test file, before anything imports the data source:
 * it reads the database settings from the environment when it is first imported.
 */
export async function startBotDatabase(name: string, rowsBeforeMigrations = ""): Promise<DataSource> {
  const database = inject("database");
  await recreateDatabase(name, rowsBeforeMigrations);

  // The bot's config reads these, as it reads them from .env in prod.
  Object.assign(process.env, {
    DB_HOST: database.host, DB_PORT: String(database.port), DB_USERNAME: database.user,
    DB_PASSWORD: database.password, DB_NAME: name,
  });
  const { dataSource } = await import("../../db/dataSource");
  await dataSource.initialize();

  return dataSource;
}

/** `rowsBeforeMigrations`: SQL that adds rows as prod could have them before the migrations run. */
async function recreateDatabase(name: string, rowsBeforeMigrations: string): Promise<void> {
  const database = inject("database");
  const connection = await createConnection({ ...database, multipleStatements: true });

  await connection.query(`DROP DATABASE IF EXISTS \`${name}\`; CREATE DATABASE \`${name}\`; USE \`${name}\`;`);
  await connection.query(PROD_SCHEMA);
  if (rowsBeforeMigrations) await connection.query(rowsBeforeMigrations);

  await connection.end();
}
