import { describe, expect, it } from "vitest";
import { isChordLine, matchLabel, parseSongText } from "./lyrics-parser";

describe("parseSongText", () => {
  it("returns nothing for empty or whitespace-only input", () => {
    expect(parseSongText("")).toEqual([]);
    expect(parseSongText("   \n\n  \t ")).toEqual([]);
  });

  it("treats unlabelled blocks as sequentially numbered verses", () => {
    const out = parseSongText("first stanza\nline two\n\nsecond stanza\nline two");

    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      type: "verse",
      title: "Verse 1",
      lyrics: "first stanza\nline two",
    });
    expect(out[1].title).toBe("Verse 2");
  });

  it("reads labels and keeps their numbering", () => {
    const out = parseSongText(
      [
        "Verse 1",
        "Amazing grace how sweet the sound",
        "",
        "Chorus",
        "Praise the Lord",
        "",
        "Verse 2",
        "Twas grace that taught",
        "",
        "Bridge",
        "How sweet the sound",
      ].join("\n"),
    );

    expect(out.map((s) => [s.type, s.title])).toEqual([
      ["verse", "Verse 1"],
      ["chorus", "Chorus"],
      ["verse", "Verse 2"],
      ["bridge", "Bridge"],
    ]);
    expect(out[0].lyrics).toBe("Amazing grace how sweet the sound");
  });

  it("numbers unlabelled verses independently of labelled sections", () => {
    const out = parseSongText("Chorus\nsing it\n\nan unlabelled stanza\n\nanother one");

    expect(out.map((s) => s.title)).toEqual(["Chorus", "Verse 1", "Verse 2"]);
  });

  it("accepts bracket, paren and colon label styles", () => {
    const out = parseSongText(
      "[Verse 1]\nline a\n\n(Chorus)\nline b\n\nVerse 2:\nline c",
    );

    expect(out.map((s) => [s.type, s.title])).toEqual([
      ["verse", "Verse 1"],
      ["chorus", "Chorus"],
      ["verse", "Verse 2"],
    ]);
  });

  it("accepts short labels only when numbered or colon-terminated", () => {
    const out = parseSongText("V1\nline a\n\nC:\nline b");
    expect(out.map((s) => [s.type, s.title])).toEqual([
      ["verse", "Verse 1"],
      ["chorus", "Chorus"],
    ]);
  });

  it("does not mistake a bare 'C' line for a chorus label", () => {
    // With chord-stripping off the "C" survives as words, proving it was never
    // read as a heading. With stripping on it is removed as a chord, which is
    // what you want from a pasted chord chart -- covered by the next test.
    const out = parseSongText("C\nthis is a lyric", { stripChords: false });

    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("verse");
    expect(out[0].title).toBe("Verse 1");
    expect(out[0].lyrics).toBe("C\nthis is a lyric");
  });

  it("strips a lone chord letter sitting above a lyric", () => {
    const out = parseSongText("C\nthis is a lyric");

    expect(out).toHaveLength(1);
    expect(out[0].lyrics).toBe("this is a lyric");
  });

  it("attaches a lone heading to the block beneath it", () => {
    const out = parseSongText("Chorus\n\nthese are the words\nsecond line");

    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      type: "chorus",
      title: "Chorus",
      lyrics: "these are the words\nsecond line",
    });
  });

  it("maps pre-chorus, tag and vamp to custom but keeps the label", () => {
    const out = parseSongText(
      "Pre-Chorus\nrising\n\nTag\nrepeat\n\nVamp\nhold\n\nEnding\nlast",
    );

    expect(out.map((s) => [s.type, s.title])).toEqual([
      ["custom", "Pre-Chorus"],
      ["custom", "Tag"],
      ["custom", "Vamp"],
      ["outro", "Ending"],
    ]);
  });

  it("handles CRLF line endings", () => {
    const out = parseSongText("Verse 1\r\nline a\r\n\r\nChorus\r\nline b");

    expect(out).toHaveLength(2);
    expect(out[0].lyrics).toBe("line a");
    expect(out[1].type).toBe("chorus");
  });

  it("strips chord lines and CCLI footers by default", () => {
    const out = parseSongText(
      "Verse 1\nG        D/F#   Em7\nAmazing grace\nC  G\nhow sweet\n\nCCLI Song #12345",
    );

    expect(out).toHaveLength(1);
    expect(out[0].lyrics).toBe("Amazing grace\nhow sweet");
  });

  it("keeps chord lines when stripping is disabled", () => {
    const out = parseSongText("Verse 1\nG  D\nAmazing grace", { stripChords: false });

    expect(out[0].lyrics).toBe("G  D\nAmazing grace");
  });

  it("collapses runs of blank lines rather than emitting empty sections", () => {
    const out = parseSongText("one\n\n\n\ntwo");

    expect(out).toHaveLength(2);
    expect(out.every((s) => s.lyrics.length > 0)).toBe(true);
  });
});

describe("matchLabel", () => {
  it("matches headings and rejects lyric lines", () => {
    expect(matchLabel("Verse 1")?.type).toBe("verse");
    expect(matchLabel("  chorus  ")?.type).toBe("chorus");
    expect(matchLabel("Amazing grace how sweet")).toBeNull();
    expect(matchLabel("C")).toBeNull();
    expect(matchLabel("")).toBeNull();
  });
});

describe("isChordLine", () => {
  it("recognises chord-only lines", () => {
    expect(isChordLine("G D Em C")).toBe(true);
    expect(isChordLine("D/F#  Asus4  Bm7")).toBe(true);
    expect(isChordLine("N.C.")).toBe(true);
  });

  it("leaves lyrics alone", () => {
    expect(isChordLine("Amazing grace")).toBe(false);
    expect(isChordLine("")).toBe(false);
    // "Be" starts with B but isn't a chord.
    expect(isChordLine("Be Thou my vision")).toBe(false);
  });
});
