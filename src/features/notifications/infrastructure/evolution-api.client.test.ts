import { describe, expect, it } from "bun:test";
import { normalizeArgentinaPhone, normalizePhoneNumber } from "./evolution-api.client";

describe("normalizeArgentinaPhone", () => {
  it("colapsa las tres formas equivalentes de un mobile argentino al mismo canonico", () => {
    const canonical = "543794619729";
    expect(normalizeArgentinaPhone("5493794619729")).toBe(canonical); // con 9 mobile internacional
    expect(normalizeArgentinaPhone("5403794619729")).toBe(canonical); // con 0 trunk domestico
    expect(normalizeArgentinaPhone("543794619729")).toBe(canonical); // ya canonico
  });

  it("limpia prefijos combinados como 540 9 o 549 0", () => {
    const canonical = "543794619729";
    expect(normalizeArgentinaPhone("5409 3794619729".replace(/\s/g, ""))).toBe(canonical);
    expect(normalizeArgentinaPhone("54903794619729")).toBe(canonical);
  });

  it("no toca numeros de otros paises", () => {
    expect(normalizeArgentinaPhone("5491133334444")).toBe("541133334444");
    expect(normalizeArgentinaPhone("5511999998888")).toBe("5511999998888"); // BR
    expect(normalizeArgentinaPhone("19295551234")).toBe("19295551234"); // US
  });
});

describe("normalizePhoneNumber", () => {
  it("strippea simbolos y aplica la regla AR", () => {
    expect(normalizePhoneNumber("+54 9 3794-619-729")).toBe("543794619729");
    expect(normalizePhoneNumber("+54 0379 4619729")).toBe("543794619729");
    expect(normalizePhoneNumber("+54 379 4619729")).toBe("543794619729");
  });

  it("tira si la entrada no tiene digitos", () => {
    expect(() => normalizePhoneNumber("---")).toThrow();
  });
});
