import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { DataSource } from "typeorm";
import { Ace, Albatross, Eagle } from "../SpecialScore.entity";
import { Course } from "../Course.entity";
import { Player } from "../../../players";

// Builds TypeORM's metadata from the entities without connecting, so a wrong table, column,
// index or relation fails here instead of at the bot's start.
async function buildMetadata(): Promise<DataSource> {
  const dataSource = new DataSource({ type: "mysql", database: "metadata-only", entities: [Ace, Eagle, Albatross, Course, Player] });
  await dataSource["buildMetadatas"]();
  return dataSource;
}

describe("special score entities", () => {
  it.each([["aces", Ace], ["eagles", Eagle], ["albatrosses", Albatross]] as const)("maps the %s table as the migration left it", async (table, entity) => {
    const metadata = (await buildMetadata()).getMetadata(entity);

    expect(metadata.tableName).toBe(table);
    expect(metadata.columns.map(column => column.databaseName).sort()).toEqual(
      ["chat_id", "competition_id", "course_id", "date", "hole_number", "id", "player_id"],
    );
    expect(metadata.indices.map(index => ({ name: index.name, unique: index.isUnique, columns: index.columns.map(column => column.databaseName) })))
      .toEqual([{ name: `uq_${table}_player_hole`, unique: true, columns: ["competition_id", "player_id", "hole_number"] }]);
    expect(metadata.relations.map(relation => [relation.propertyName, relation.inverseEntityMetadata.tableName])).toEqual(
      [["player", "players"], ["course", "courses"]],
    );
  });
});
