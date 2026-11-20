import { describe, expect, it } from "vitest";
import { MAX_MUSIC_FILE_BYTES, musicStoragePath, musicTitle, validateMusicFile } from "./my-music";

describe("personal music uploads", () => {
  it("accepts common audio formats up to 50 MB", () => {
    expect(validateMusicFile({ name: "my-song.mp3", size: MAX_MUSIC_FILE_BYTES })).toBeNull();
    expect(validateMusicFile({ name: "demo.WAV", size: 1024 })).toBeNull();
  });

  it("rejects files larger than 50 MB", () => {
    expect(validateMusicFile({ name: "too-large.mp3", size: MAX_MUSIC_FILE_BYTES + 1 })).toBe(
      "Each song must be 50 MB or smaller.",
    );
  });

  it("rejects empty and non-audio files", () => {
    expect(validateMusicFile({ name: "empty.mp3", size: 0 })).toBe("That audio file is empty.");
    expect(validateMusicFile({ name: "notes.pdf", size: 1024 })).toMatch("Choose an MP3");
  });

  it("turns a filename into a readable song title", () => {
    expect(musicTitle("01_My-first_song.mp3")).toBe("01 My first song");
  });

  it("places each file inside its owner's private folder", () => {
    expect(musicStoragePath("owner-id", "song.mp3", "music-id")).toBe("owner-id/music-id.mp3");
  });
});
