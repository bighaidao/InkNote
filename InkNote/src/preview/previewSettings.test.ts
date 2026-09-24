import { afterEach, describe, expect, it } from "vitest";
import { resetSettingsStoreForTests, setStoredValue } from "../lib/settingsStore";
import {
  DEFAULT_EXCLUDED_DIRS,
  getHideHiddenFiles,
  getPreviewFeatures,
  getSearchExcludedDirs,
  isPreviewCategoryEnabled,
  setHideHiddenFiles,
  setPreviewFeatureEnabled,
  setSearchExcludedDirs,
} from "./previewSettings";

afterEach(() => {
  localStorage.clear();
  resetSettingsStoreForTests();
});

describe("previewSettings", () => {
  it("defaults every feature to enabled", () => {
    const features = getPreviewFeatures();
    expect(Object.values(features).every(Boolean)).toBe(true);
    expect(isPreviewCategoryEnabled("office-word")).toBe(true);
    expect(isPreviewCategoryEnabled("email")).toBe(true);
  });

  it("persists feature toggles and maps office subcategories", () => {
    setPreviewFeatureEnabled("office", false);
    expect(getPreviewFeatures().office).toBe(false);
    expect(isPreviewCategoryEnabled("office-word")).toBe(false);
    expect(isPreviewCategoryEnabled("office-sheet")).toBe(false);
    expect(isPreviewCategoryEnabled("office-slides")).toBe(false);
    expect(isPreviewCategoryEnabled("pdf")).toBe(true);

    setPreviewFeatureEnabled("office", true);
    expect(isPreviewCategoryEnabled("office-word")).toBe(true);
  });

  it("parses, trims and stores excluded directory names", () => {
    setSearchExcludedDirs([" custom_dir ", "dist", "", "target"]);
    expect(getSearchExcludedDirs()).toEqual([...DEFAULT_EXCLUDED_DIRS, "custom_dir"]);
  });

  it("falls back to default excluded dirs on uninitialized or malformed storage", () => {
    localStorage.clear();
    expect(getSearchExcludedDirs()).toEqual(DEFAULT_EXCLUDED_DIRS);
    setStoredValue("mdnote.searchExcludedDirs", "not-json");
    expect(getSearchExcludedDirs()).toEqual(DEFAULT_EXCLUDED_DIRS);
    setStoredValue("mdnote.searchExcludedDirs", JSON.stringify({ bogus: true }));
    expect(getSearchExcludedDirs()).toEqual(DEFAULT_EXCLUDED_DIRS);
  });

  it("manages hideHiddenFiles toggle defaulting to true", () => {
    expect(getHideHiddenFiles()).toBe(true);
    setHideHiddenFiles(false);
    expect(getHideHiddenFiles()).toBe(false);
    setHideHiddenFiles(true);
    expect(getHideHiddenFiles()).toBe(true);
  });
});
