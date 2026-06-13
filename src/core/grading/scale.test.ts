import { describe, expect, it } from "vitest";
import {
  gradeForScore,
  overallScale,
  scaleFromRaw,
  scaleFromSubscaleAverage,
} from "./scale";

describe("scaleFromRaw (proportion anchors)", () => {
  it("hits the documented anchors exactly", () => {
    expect(scaleFromRaw(20, 100)).toBe(142);
    expect(scaleFromRaw(40, 100)).toBe(160);
    expect(scaleFromRaw(60, 100)).toBe(180);
    expect(scaleFromRaw(73, 100)).toBe(193);
    expect(scaleFromRaw(80, 100)).toBe(200);
    expect(scaleFromRaw(100, 100)).toBe(210);
  });

  it("interpolates linearly between anchors", () => {
    // halfway between p=0.6 (180) and p=0.73 (193)
    expect(scaleFromRaw(665, 1000)).toBe(187);
    // halfway between p=0.8 (200) and p=1.0 (210)
    expect(scaleFromRaw(90, 100)).toBe(205);
  });

  it("clamps at the extremes", () => {
    expect(scaleFromRaw(0, 100)).toBe(122);
    expect(scaleFromRaw(150, 100)).toBe(210);
    expect(scaleFromRaw(5, 0)).toBe(122);
  });
});

describe("scaleFromSubscaleAverage (Writing/Speaking)", () => {
  it("hits the documented anchors exactly", () => {
    expect(scaleFromSubscaleAverage(1)).toBe(142);
    expect(scaleFromSubscaleAverage(2)).toBe(160);
    expect(scaleFromSubscaleAverage(3)).toBe(180);
    expect(scaleFromSubscaleAverage(4)).toBe(200);
    expect(scaleFromSubscaleAverage(5)).toBe(210);
  });

  it("interpolates between bands and clamps out-of-range input", () => {
    expect(scaleFromSubscaleAverage(3.5)).toBe(190);
    expect(scaleFromSubscaleAverage(-1)).toBe(122);
    expect(scaleFromSubscaleAverage(9)).toBe(210);
  });
});

describe("gradeForScore", () => {
  it("maps scores to Cambridge grades", () => {
    expect(gradeForScore(210).grade).toBe("A");
    expect(gradeForScore(200).grade).toBe("A");
    expect(gradeForScore(199).grade).toBe("B");
    expect(gradeForScore(193).grade).toBe("B");
    expect(gradeForScore(192).grade).toBe("C");
    expect(gradeForScore(180).grade).toBe("C");
    expect(gradeForScore(179).grade).toBe("B2");
    expect(gradeForScore(160).grade).toBe("B2");
    expect(gradeForScore(159).grade).toBe("Fail");
  });

  it("marks pass/fail correctly", () => {
    expect(gradeForScore(180).pass).toBe(true);
    expect(gradeForScore(179).pass).toBe(false);
  });
});

describe("overallScale", () => {
  it("averages and rounds skill scores", () => {
    expect(overallScale([180, 190, 200, 170, 185])).toBe(185);
    expect(overallScale([181, 182])).toBe(182);
  });

  it("returns null with no scores", () => {
    expect(overallScale([])).toBeNull();
  });
});
