import { describe, expect, it } from "vitest";
import { createProgram } from "../program.js";
import { parseForecastSelectArgs, parseForecastShowArgs } from "../commands/forecast.js";

function findForecast(programArg = createProgram()) {
  return programArg.commands.find((command) => command.name() === "forecast");
}

describe("forecast command", () => {
  it("registers forecast create/show/select subcommands", () => {
    const forecast = findForecast();
    expect(forecast).toBeDefined();
    const names = forecast?.commands.map((command) => command.name());
    expect(names).toContain("create");
    expect(names).toContain("show");
    expect(names).toContain("select");
  });

  it("exposes divergence/branches/horizon/json options on forecast create", () => {
    const create = findForecast()?.commands.find((command) => command.name() === "create");
    const optionNames = new Set(create?.options.map((option) => option.long));

    expect(optionNames).toContain("--divergence");
    expect(optionNames).toContain("--branches");
    expect(optionNames).toContain("--horizon");
    expect(optionNames).toContain("--json");
    const divergence = create?.options.find((option) => option.long === "--divergence");
    expect(divergence?.required).toBe(true);
  });

  it("exposes --json on show and select", () => {
    const forecast = findForecast();
    for (const name of ["show", "select"]) {
      const sub = forecast?.commands.find((command) => command.name() === name);
      expect(sub?.options.some((option) => option.long === "--json")).toBe(true);
    }
  });
});

describe("forecast positional argument parsing", () => {
  it("show: one arg is the forecast id, two args are book id + forecast id", () => {
    expect(parseForecastShowArgs(["fc-1"])).toEqual({ forecastId: "fc-1" });
    expect(parseForecastShowArgs(["book-a", "fc-1"])).toEqual({ bookIdArg: "book-a", forecastId: "fc-1" });
    expect(() => parseForecastShowArgs([])).toThrow(/forecast-id/);
    expect(() => parseForecastShowArgs(["a", "b", "c"])).toThrow(/forecast-id/);
  });

  it("select: two args are forecast id + branch id, three args add the book id", () => {
    expect(parseForecastSelectArgs(["fc-1", "branch-2"])).toEqual({ forecastId: "fc-1", branchId: "branch-2" });
    expect(parseForecastSelectArgs(["book-a", "fc-1", "branch-2"]))
      .toEqual({ bookIdArg: "book-a", forecastId: "fc-1", branchId: "branch-2" });
    expect(() => parseForecastSelectArgs(["fc-1"])).toThrow(/branch-id/);
    expect(() => parseForecastSelectArgs(["a", "b", "c", "d"])).toThrow(/branch-id/);
  });
});
