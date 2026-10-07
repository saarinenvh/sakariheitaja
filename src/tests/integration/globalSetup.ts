import type { TestProject } from "vitest/node";
import { MariaDbContainer, StartedMariaDbContainer } from "@testcontainers/mariadb";

/** Where the run's MariaDB listens; root, so each test file can recreate the database. */
export interface IntegrationDatabase {
  host: string;
  port: number;
  user: string;
  password: string;
}

declare module "vitest" {
  export interface ProvidedContext {
    database: IntegrationDatabase;
  }
}

// The server runs MariaDB 11 too.
const MARIADB_IMAGE = "mariadb:11";

let container: StartedMariaDbContainer | undefined;

export async function setup(project: TestProject): Promise<void> {
  container = await new MariaDbContainer(MARIADB_IMAGE).withRootPassword("integration").start();

  project.provide("database", {
    host: container.getHost(), port: container.getPort(), user: "root", password: container.getRootPassword(),
  });
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
