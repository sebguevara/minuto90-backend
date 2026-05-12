import { describe, expect, it } from "bun:test";
import {
  getCountryForTimezone,
  getFeaturedInsightsPrewarmVariants,
} from "./featured-insights-prewarm";

describe("featured insights prewarm helpers", () => {
  it("maps configured timezones to their primary country", () => {
    expect(getCountryForTimezone("America/Argentina/Buenos_Aires")).toBe("Argentina");
    expect(getCountryForTimezone("America/Bogota")).toBe("Colombia");
    expect(getCountryForTimezone("America/Sao_Paulo")).toBe("Brazil");
    expect(getCountryForTimezone("Etc/UTC")).toBeNull();
  });

  it("includes the global variant plus deduped timezone variants", () => {
    const variants = getFeaturedInsightsPrewarmVariants([
      "America/Bogota",
      "America/Argentina/Buenos_Aires",
      "America/Bogota",
    ]);

    expect(variants).toEqual([
      { timezone: "UTC", label: "UTC" },
      { timezone: "America/Bogota", label: "America/Bogota" },
      { timezone: "America/Argentina/Buenos_Aires", label: "America/Argentina/Buenos_Aires" },
    ]);
  });
});
