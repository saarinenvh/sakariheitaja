import { describe, expect, it, vi } from "vitest";
import { readPlanWithModel, StructuredModel } from "../planReader";
import { planReadingExample, planReadingJsonSchema } from "../schema";

const INPUT = { text: "pekan ja matin kanssa karjaa + härkälinna lauantaina. Lähtö 9.00.", writerName: "Ville", today: "2026-10-08", rules: "Säännöt." };

function modelAnswering(reply: unknown): StructuredModel {
  return vi.fn().mockResolvedValue(typeof reply === "string" ? reply : JSON.stringify(reply));
}

describe("the plan reader", () => {
  it("asks the model with the rules, the writer, the calendar and the message, in the answer's JSON schema", async () => {
    const model = vi.fn<StructuredModel>().mockResolvedValue(JSON.stringify(planReadingExample));

    await readPlanWithModel(INPUT, model);

    const [messages, jsonSchema] = model.mock.calls[0];
    expect(jsonSchema).toBe(planReadingJsonSchema);
    expect(messages[0]).toEqual({ role: "system", content: "Säännöt." });
    expect(messages[1].content).toContain("Kirjoittaja: Ville");
    expect(messages[1].content).toContain("- torstai (to) 8.10.2026 = 2026-10-08, tällä viikolla, tänään");
    expect(messages[1].content.endsWith(`Viesti: ${INPUT.text}`)).toBe(true);
  });

  it("returns the plan the model read", async () => {
    await expect(readPlanWithModel(INPUT, modelAnswering(planReadingExample)))
      .resolves.toEqual({ kind: "plan", reading: planReadingExample });
  });

  it("says when the message isn't a plan", async () => {
    const notAPlan = { isPlan: false, day: null, time: null, courses: [], players: [], creatorPlays: false };

    await expect(readPlanWithModel(INPUT, modelAnswering(notAPlan))).resolves.toEqual({ kind: "not-a-plan" });
  });

  it("fails with the reply when it isn't JSON, or isn't a valid reading", async () => {
    await expect(readPlanWithModel(INPUT, modelAnswering("Lauantaina Karjaa!")))
      .resolves.toMatchObject({ kind: "failed", reply: "Lauantaina Karjaa!" });
    await expect(readPlanWithModel(INPUT, modelAnswering({ ...planReadingExample, day: "lauantai" })))
      .resolves.toMatchObject({ kind: "failed", reason: "the answer isn't a valid plan reading" });
  });

  it("fails, without throwing, when the model call does", async () => {
    const model: StructuredModel = vi.fn().mockRejectedValue(new Error("Ollama HTTP 500"));

    await expect(readPlanWithModel(INPUT, model)).resolves.toEqual({
      kind: "failed", reason: "the model failed: Ollama HTTP 500", reply: null,
    });
  });
});
