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
    const chatIdColumns = (await buildMetadata()).entityMetadatas.flatMap(metadata =>
      metadata.columns.filter(column => column.databaseName === "chat_id" || (metadata.tableName === "chats" && column.databaseName === "id"))
        .map(column => [metadata.tableName, column.databaseName, column.type]));
    expect(chatIdColumns).toEqual(expect.arrayContaining([
      ["chats", "id", "bigint"], ["competitions", "chat_id", "bigint"], ["aces", "chat_id", "bigint"],
    ]));
    expect(chatIdColumns.every(([, , type]) => type === "bigint")).toBe(true);
  });

  it("declares the unique keys the migrations add", async () => {
    const uniqueKeys = (await buildMetadata()).entityMetadatas.flatMap(metadata => metadata.indices
      .filter(index => index.isUnique)
      .map(index => [metadata.tableName, index.name, index.columns.map(column => column.databaseName).join(", ")]));

    expect(uniqueKeys).toEqual(expect.arrayContaining([
      ["player_to_chat", "uq_player_to_chat_player_chat", "player_id, chat_id"],
      ["players", "uq_players_name", "name"],
      ["courses", "uq_courses_name", "name"],
      ["aces", "uq_aces_player_hole", "competition_id, player_id, hole_number"],
    ]));
  });

  it("relates each player link to its player and chat", async () => {
    const link = (await buildMetadata()).entityMetadatas.find(metadata => metadata.tableName === "player_to_chat");

    expect(link?.relations.map(relation => [relation.propertyName, relation.inverseEntityMetadata.tableName]))
      .toEqual([["player", "players"], ["chat", "chats"]]);
  });
});

/** The bot's own entities and options; the database name is only needed to validate the metadata. */
async function buildMetadata(): Promise<DataSource> {
  const metadataOnly = new DataSource({ ...dataSource.options, database: "metadata-only" } as DataSourceOptions);
  await metadataOnly["buildMetadatas"]();

  return metadataOnly;
}
