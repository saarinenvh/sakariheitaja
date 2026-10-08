import { describe, expect, it, vi } from "vitest";
import { TextModel, writePlanComment } from "../planComment";
import { planComments } from "../phrases";
import type { GamePlan } from "../db/GamePlan.entity";

const PLAN = {
  id: 12, day: "2026-10-10", startTime: "09:00:00", courses: ["Karjaa", "Härkälinna"],
  players: [{ name: "Ville" }, { name: "Pekka" }],
} as GamePlan;

describe("Sakke's comment on a plan", () => {
  it("asks the model with the rules, who made the plan, and its line", async () => {
    const model: TextModel = vi.fn().mockResolvedValue("Ennenkaikkea layuppi!");

    await writePlanComment(PLAN, "Ville", model, "Säännöt.");

    expect(model).toHaveBeenCalledWith([
      { role: "system", content: "Säännöt." },
      {
        role: "user",
        content: "Suunnitelman teki: Ville\nSuunnitelma: la 10.10. klo 9.00 Karjaa + Härkälinna — Ville, Pekka\n\nKommentoi lyhyesti Saken tyylillä.",
      },
    ]);
  });

  it("uses the model's line without the quote marks around it", async () => {
    const model: TextModel = vi.fn().mockResolvedValue('  "Ennenkaikkea layuppi!"\n');

    await expect(writePlanComment(PLAN, "Ville", model, "Säännöt.")).resolves.toEqual({ source: "model", text: "Ennenkaikkea layuppi!" });
  });

  it.each<[string, TextModel | null]>([
    ["without a model", null],
    ["when the model fails", vi.fn().mockRejectedValue(new Error("Ollama HTTP 500"))],
    ["when the model says nothing", vi.fn().mockResolvedValue("  \n")],
  ])("falls back to a canned line %s", async (_, model) => {
    const comment = await writePlanComment(PLAN, "Ville", model, "Säännöt.");

    expect(comment.source).toBe("canned");
    expect(planComments).toContain(comment.text);
  });
});
