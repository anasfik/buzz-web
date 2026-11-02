import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "@/shared/i18n";
import html from "../../../index.html?raw";
import configText from "../../../public/config.json?raw";
import manifestText from "../../../public/manifest.webmanifest?raw";

afterEach(() => vi.unstubAllGlobals());

describe("Nusuk brand contract", () => {
  it("uses fresh favicon URLs and correctly sized install icons", () => {
    const manifest = JSON.parse(manifestText);
    expect(html).toContain("%BASE_URL%nusuk-favicon.ico");
    expect(html).toContain("%BASE_URL%nusuk-favicon-32.png");
    expect(html).toContain("%BASE_URL%nusuk-apple-touch-icon.png");
    expect(manifest.icons).toEqual([
      { src: "./nusuk-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "./nusuk-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ]);
  });
  it("ships Nusuk metadata and public relay defaults without invented agents", () => {
    const config = JSON.parse(configText);
    const manifest = JSON.parse(manifestText);
    expect(config.communityName).toBe("Nusuk Buzz");
    expect(config.relayUrl).toBe("wss://relay.nusuk.buzz");
    expect(config.agents).toEqual([]);
    expect(manifest.name).toBe("Nusuk Buzz");
    expect(html).toContain("<title>Nusuk Buzz</title>");
  });

  it("names the product and welcome experience in both supported languages", () => {
    for (const language of ["en-US", "zh-CN"]) {
      vi.stubGlobal("navigator", { language, languages: [language] });
      expect(t("app.title")).toBe("Nusuk Buzz");
      expect(t("identity.createTitle")).toContain("Nusuk Buzz");
    }
  });
});
