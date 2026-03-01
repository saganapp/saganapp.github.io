import { describe, it, expect } from "vitest";
import { detectFiles, _detectByFilename, _detectByContent } from "@/parsers/detect";

function fakeFile(name: string): File {
  return new File([""], name, { type: "application/octet-stream" });
}

describe("detectByFilename (tier 1)", () => {
  it("detects Google Takeout zip files", () => {
    const result = _detectByFilename(fakeFile("takeout-20250101T120000Z-001-001.zip"));
    expect(result).not.toBeNull();
    expect(result!.platform).toBe("google");
    expect(result!.fileType).toBe("zip");
    expect(result!.confidence).toBe("filename");
  });

  it("detects Twitter archive zip files", () => {
    const result = _detectByFilename(
      fakeFile("twitter-2026-02-26-0743d8917269cfebe03f5c4e8f3ba5c8e292fc1c5e903d207835f9c13211839c.zip"),
    );
    expect(result).not.toBeNull();
    expect(result!.platform).toBe("twitter");
    expect(result!.fileType).toBe("zip");
    expect(result!.confidence).toBe("filename");
  });

  it("detects mbox files as google", () => {
    const result = _detectByFilename(fakeFile("inbox.mbox"));
    expect(result).not.toBeNull();
    expect(result!.platform).toBe("google");
    expect(result!.fileType).toBe("mbox");
    expect(result!.confidence).toBe("filename");
  });

  it("detects Instagram archive zip files", () => {
    const result = _detectByFilename(fakeFile("instagram-sombrerotron-2026-02-27-mvKhKVm6.zip"));
    expect(result).not.toBeNull();
    expect(result!.platform).toBe("instagram");
    expect(result!.fileType).toBe("zip");
    expect(result!.confidence).toBe("filename");
  });

  it("detects Telegram result.json by filename", () => {
    const result = _detectByFilename(fakeFile("result.json"));
    expect(result).not.toBeNull();
    expect(result!.platform).toBe("telegram");
    expect(result!.fileType).toBe("json");
    expect(result!.confidence).toBe("filename");
  });

  it("detects TikTok archive zip files", () => {
    const result = _detectByFilename(fakeFile("TikTok_Data_1772234252.zip"));
    expect(result).not.toBeNull();
    expect(result!.platform).toBe("tiktok");
    expect(result!.fileType).toBe("zip");
    expect(result!.confidence).toBe("filename");
  });

  it("returns null for unrecognized files", () => {
    expect(_detectByFilename(fakeFile("random-archive.zip"))).toBeNull();
    expect(_detectByFilename(fakeFile("photo.jpg"))).toBeNull();
    expect(_detectByFilename(fakeFile("readme.txt"))).toBeNull();
  });
});

describe("detectByContent (tier 2)", () => {
  it("detects Twitter by data/account.js", () => {
    const entries = ["data/account.js", "data/tweets.js", "data/manifest.js"];
    expect(_detectByContent(entries)).toBe("twitter");
  });

  it("detects Twitter by data/like.js alone", () => {
    const entries = ["data/like.js", "data/other.js"];
    expect(_detectByContent(entries)).toBe("twitter");
  });

  it("detects Google by Takeout/ prefix", () => {
    const entries = ["Takeout/My Activity/Search/MyActivity.json", "Takeout/Chrome/BrowserHistory.json"];
    expect(_detectByContent(entries)).toBe("google");
  });

  it("returns null for unknown zip contents", () => {
    const entries = ["readme.md", "photos/img001.jpg", "data.csv"];
    expect(_detectByContent(entries)).toBeNull();
  });

  it("detects Instagram by message paths", () => {
    const entries = [
      "your_instagram_activity/messages/message_requests/user_123/message_1.html",
      "personal_information/personal_information/personal_information.html",
    ];
    expect(_detectByContent(entries)).toBe("instagram");
  });

  it("detects Telegram by result.json entry", () => {
    const entries = ["result.json"];
    expect(_detectByContent(entries)).toBe("telegram");
  });

  it("detects TikTok by user_data_tiktok.json entry", () => {
    const entries = ["user_data_tiktok.json"];
    expect(_detectByContent(entries)).toBe("tiktok");
  });

  it("detects WhatsApp by whatsapp_account_information/ path", () => {
    const entries = [
      "whatsapp_account_information/registration_information.json",
      "whatsapp_account_information/user_information.json",
      "whatsapp_settings/account_settings.json",
    ];
    expect(_detectByContent(entries)).toBe("whatsapp");
  });

  it("detects Garmin by IT_GLOBAL_EVENT/events.json entry", () => {
    const entries = [
      "IT_GLOBAL_EVENT/events.json",
      "DI_CONNECT/DI-Connect-User/user_profile.json",
    ];
    expect(_detectByContent(entries)).toBe("garmin");
  });

  it("returns null for empty entry list", () => {
    expect(_detectByContent([])).toBeNull();
  });
});

describe("detectFiles (full pipeline)", () => {
  it("detects Google Takeout zip by filename", async () => {
    const files = [fakeFile("takeout-20250101T120000Z-001-001.zip")];
    const result = await detectFiles(files);
    expect(result).toHaveLength(1);
    expect(result[0].platform).toBe("google");
    expect(result[0].confidence).toBe("filename");
  });

  it("detects multiple Takeout zips", async () => {
    const files = [
      fakeFile("takeout-20250101T120000Z-10-001.zip"),
      fakeFile("takeout-20250101T120000Z-12-001.zip"),
      fakeFile("takeout-20250101T120000Z-8-001.zip"),
    ];
    const result = await detectFiles(files);
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.platform === "google")).toBe(true);
  });

  it("detects Twitter archive by filename", async () => {
    const files = [
      fakeFile("twitter-2026-02-26-0743d8917269cfebe03f5c4e8f3ba5c8e292fc1c5e903d207835f9c13211839c.zip"),
    ];
    const result = await detectFiles(files);
    expect(result).toHaveLength(1);
    expect(result[0].platform).toBe("twitter");
    expect(result[0].confidence).toBe("filename");
  });

  it("detects both Twitter and Google archives together", async () => {
    const files = [
      fakeFile("takeout-20250101T120000Z-001-001.zip"),
      fakeFile("twitter-2026-02-26-abc123def456.zip"),
    ];
    const result = await detectFiles(files);
    expect(result).toHaveLength(2);
    expect(result[0].platform).toBe("google");
    expect(result[1].platform).toBe("twitter");
  });

  it("detects mbox files as google", async () => {
    const files = [
      fakeFile("takeout-20250101T120000Z-10-001.zip"),
      fakeFile("All mail Including Spam and Trash-002.mbox"),
    ];
    const result = await detectFiles(files);
    expect(result).toHaveLength(2);
    expect(result[0].fileType).toBe("zip");
    expect(result[1].fileType).toBe("mbox");
    expect(result[1].platform).toBe("google");
    expect(result[1].confidence).toBe("filename");
  });

  it("handles standalone mbox without takeout zips", async () => {
    const files = [fakeFile("inbox.mbox")];
    const result = await detectFiles(files);
    expect(result).toHaveLength(1);
    expect(result[0].platform).toBe("google");
    expect(result[0].fileType).toBe("mbox");
  });

  it("detects Instagram archive by filename", async () => {
    const files = [fakeFile("instagram-sombrerotron-2026-02-27-mvKhKVm6.zip")];
    const result = await detectFiles(files);
    expect(result).toHaveLength(1);
    expect(result[0].platform).toBe("instagram");
    expect(result[0].confidence).toBe("filename");
  });

  it("detects Telegram result.json by filename", async () => {
    const files = [fakeFile("result.json")];
    const result = await detectFiles(files);
    expect(result).toHaveLength(1);
    expect(result[0].platform).toBe("telegram");
    expect(result[0].confidence).toBe("filename");
    expect(result[0].fileType).toBe("json");
  });

  it("detects Telegram JSON by content for non-standard filenames", async () => {
    const content = '{"about":"...","personal_information":{},"chats":{}}';
    const file = new File([content], "export.json", { type: "application/json" });
    const result = await detectFiles([file]);
    expect(result).toHaveLength(1);
    expect(result[0].platform).toBe("telegram");
    expect(result[0].confidence).toBe("content");
    expect(result[0].fileType).toBe("json");
  });

  it("ignores non-zip/mbox/json files", async () => {
    const files = [fakeFile("readme.txt"), fakeFile("photo.jpg")];
    const result = await detectFiles(files);
    expect(result).toHaveLength(0);
  });

  it("returns null platform for unknown zip files (empty content)", async () => {
    // A File with empty content isn't a valid zip, so content detection will fail
    // and the file should get platform: null
    const files = [fakeFile("random-archive.zip")];
    const result = await detectFiles(files);
    expect(result).toHaveLength(1);
    expect(result[0].platform).toBeNull();
    expect(result[0].confidence).toBe("none");
    expect(result[0].fileType).toBe("zip");
  });
});
