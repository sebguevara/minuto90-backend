import { describe, expect, it } from "bun:test";
import {
  FT_DISAPPEARED_SKIP_STATUSES,
  MIN_ELAPSED_FOR_FT_DISAPPEARED,
  isLikelyHalftime,
  missingPollThresholdFor,
} from "./live-fixtures-poller.policy";

describe("missingPollThresholdFor", () => {
  it("uses early-game threshold (12) for 1H with elapsed < 35", () => {
    expect(missingPollThresholdFor("1H", 1)).toBe(12);
    expect(missingPollThresholdFor("1H", 10)).toBe(12);
    expect(missingPollThresholdFor("1H", 34)).toBe(12);
  });

  it("uses halftime threshold (≥6) for 1H between 40 and 55", () => {
    expect(missingPollThresholdFor("1H", 40)).toBeGreaterThanOrEqual(6);
    expect(missingPollThresholdFor("1H", 45)).toBeGreaterThanOrEqual(6);
    expect(missingPollThresholdFor("1H", 55)).toBeGreaterThanOrEqual(6);
  });

  it("uses halftime threshold (≥6) for HT / BT / INT", () => {
    expect(missingPollThresholdFor("HT", null)).toBeGreaterThanOrEqual(6);
    expect(missingPollThresholdFor("BT", null)).toBeGreaterThanOrEqual(6);
    expect(missingPollThresholdFor("INT", null)).toBeGreaterThanOrEqual(6);
  });

  it("uses tight threshold (2) for 2H near the end", () => {
    expect(missingPollThresholdFor("2H", 70)).toBe(2);
    expect(missingPollThresholdFor("2H", 85)).toBe(2);
    expect(missingPollThresholdFor("2H", 90)).toBe(2);
  });

  it("falls back to default threshold for other states", () => {
    // 2H temprano (no es ni halftime ni cerca-del-final): default
    expect(missingPollThresholdFor("2H", 60)).toBe(3);
    // 1H justo arriba del corte de early-game: default
    expect(missingPollThresholdFor("1H", 35)).toBe(3);
    expect(missingPollThresholdFor("1H", 39)).toBe(3);
    // Status sin elapsed conocido: default
    expect(missingPollThresholdFor("NS", null)).toBe(3);
  });
});

describe("isLikelyHalftime", () => {
  it("detects HT/BT/INT regardless of elapsed", () => {
    expect(isLikelyHalftime("HT", null)).toBe(true);
    expect(isLikelyHalftime("BT", null)).toBe(true);
    expect(isLikelyHalftime("INT", null)).toBe(true);
  });

  it("detects 1H between 40 and 55 as likely halftime", () => {
    expect(isLikelyHalftime("1H", 40)).toBe(true);
    expect(isLikelyHalftime("1H", 50)).toBe(true);
    expect(isLikelyHalftime("1H", 55)).toBe(true);
  });

  it("does not flag early 1H or 2H as halftime", () => {
    expect(isLikelyHalftime("1H", 10)).toBe(false);
    expect(isLikelyHalftime("1H", 39)).toBe(false);
    expect(isLikelyHalftime("1H", 56)).toBe(false);
    expect(isLikelyHalftime("2H", 50)).toBe(false);
  });
});

describe("FT_DISAPPEARED_SKIP_STATUSES", () => {
  it("includes terminal statuses", () => {
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("FT")).toBe(true);
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("AET")).toBe(true);
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("PEN")).toBe(true);
  });

  it("includes suspended / interrupted / break statuses", () => {
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("SUSP")).toBe(true);
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("INT")).toBe(true);
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("BT")).toBe(true);
  });

  it("includes not-started statuses", () => {
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("NS")).toBe(true);
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("TBD")).toBe(true);
  });

  it("includes cancelled / postponed / abandoned / walkover statuses", () => {
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("CANC")).toBe(true);
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("PST")).toBe(true);
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("ABD")).toBe(true);
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("AWD")).toBe(true);
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("WO")).toBe(true);
  });

  it("does NOT include statuses where FT_DISAPPEARED is a valid fallback", () => {
    // Estos son los únicos estados donde tiene sentido el fallback de "desapareció → FT":
    // 2H tardío y similares, donde el proveedor saca el fixture antes de publicar status=FT.
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("2H")).toBe(false);
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("1H")).toBe(false);
    expect(FT_DISAPPEARED_SKIP_STATUSES.has("ET")).toBe(false);
  });
});

describe("MIN_ELAPSED_FOR_FT_DISAPPEARED", () => {
  it("defaults to 60 minutes (protege todo el primer tiempo)", () => {
    expect(MIN_ELAPSED_FOR_FT_DISAPPEARED).toBe(60);
  });
});
