import { describe, expect, it } from "vitest";
import { DataSource, DataSourceOptions } from "typeorm";
import { dataSource } from "../dataSource";

describe("dataSource", () => {
  // Verified against MariaDB 11 with this TypeORM and mysql2: with these two options BIGINT reads as a
  // number on every path. TypeORM's defaults return it as a string from raw queries and from columns
  // declared type "bigint".
  it("reads BIGINT chat ids as numbers", () => {
    expect(dataSource.options).toMatchObject({ supportBigNumbers: true, bigNumberStrings: false });
  });

  it("declares every chat id column as BIGINT, as the tables have it", async () => {
    // The bot's own entities and options; the database name is only needed to validate the metadata.
    const metadataOnly = new DataSource({ ...dataSource.options, database: "metadata-only" } as DataSourceOptions);
    await metadataOnly["buildMetadatas"]();
    const chatIdColumns = metadataOnly.entityMetadatas.flatMap(metadata =>
      metadata.columns.filter(column => column.databaseName === "chat_id" || (metadata.tableName === "chats" && column.databaseName === "id"))
        .map(column => [metadata.tableName, column.databaseName, column.type]));
    expect(chatIdColumns).toEqual(expect.arrayContaining([
      ["chats", "id", "bigint"], ["competitions", "chat_id", "bigint"], ["aces", "chat_id", "bigint"],
    ]));
    expect(chatIdColumns.every(([, , type]) => type === "bigint")).toBe(true);
  });
});
