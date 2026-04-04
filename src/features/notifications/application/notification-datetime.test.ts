import { describe, expect, it, spyOn } from "bun:test";
import {
  formatMatchKickoffForSubscriber,
  resolveIanaTimeZone,
} from "./notification-datetime";

describe("resolveIanaTimeZone", () => {
  it("usa countryCode ISO cuando está mapeado (ES → Europe/Madrid)", () => {
    expect(resolveIanaTimeZone({ countryCode: "ES" })).toBe("Europe/Madrid");
    expect(resolveIanaTimeZone({ countryCode: "es" })).toBe("Europe/Madrid");
  });

  it("infiere país por dialCode cuando no hay countryCode (54 → Argentina)", () => {
    expect(resolveIanaTimeZone({ dialCode: "54" })).toBe("America/Argentina/Buenos_Aires");
    expect(resolveIanaTimeZone({ dialCode: "+54" })).toBe("America/Argentina/Buenos_Aires");
  });

  it("prioriza countryCode sobre dialCode cuando ambos existen", () => {
    expect(
      resolveIanaTimeZone({ countryCode: "ES", dialCode: "54" })
    ).toBe("Europe/Madrid");
  });

  it("cae a UTC sin datos o país/prefijo desconocidos", () => {
    expect(resolveIanaTimeZone({})).toBe("UTC");
    expect(resolveIanaTimeZone({ countryCode: "ZZ" })).toBe("UTC");
    expect(resolveIanaTimeZone({ dialCode: "999" })).toBe("UTC");
    expect(resolveIanaTimeZone({ countryCode: "X" })).toBe("UTC");
  });
});

describe("formatMatchKickoffForSubscriber", () => {
  const sample = new Date("2024-07-15T17:00:00.000Z");

  it("indica UTC explícitamente en fallback", () => {
    const out = formatMatchKickoffForSubscriber(sample, {});
    expect(out).toContain("(UTC)");
  });

  it("usa DateTimeFormat con la zona IANA esperada (subscriber España)", () => {
    const spy = spyOn(Intl, "DateTimeFormat");
    formatMatchKickoffForSubscriber(sample, { countryCode: "ES" });
    expect(spy).toHaveBeenCalled();
    const call = spy.mock.calls[0];
    expect(call?.[0]).toBe("es");
    expect(call?.[1]).toMatchObject({ timeZone: "Europe/Madrid" });
    spy.mockRestore();
  });
});
