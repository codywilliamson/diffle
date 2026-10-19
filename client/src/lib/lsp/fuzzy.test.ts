import { describe, expect, it } from "vitest";
import { matchSymbol, nameSegments, rankByName, wordStarts } from "./fuzzy";

describe("nameSegments", () => {
  it("cuts the name into matched and unmatched runs", () => {
    expect(nameSegments("GreeterService", [0, 1, 7])).toEqual([
      { text: "Gr", hit: true }, { text: "eeter", hit: false }, { text: "S", hit: true }, { text: "ervice", hit: false },
    ]);
    expect(nameSegments("abc", [])).toEqual([{ text: "abc", hit: false }]);
  });
});

describe("wordStarts", () => {
  it("splits camel case, snake case, acronyms and digits", () => {
    expect(wordStarts("getUserName")).toEqual([0, 3, 7]);
    expect(wordStarts("get_user.name")).toEqual([0, 4, 9]);
    expect(wordStarts("HTMLParser")).toEqual([0, 4]);
    expect(wordStarts("utf8Decode")).toEqual([0, 3, 4]);
  });
});

describe("matchSymbol", () => {
  it("matches a prefix of a word, ignoring case", () => {
    expect(matchSymbol("gre", "Greeter")?.indices).toEqual([0, 1, 2]);
    expect(matchSymbol("GREET", "greeter")).not.toBeNull();
    expect(matchSymbol("ser", "GreeterService")?.indices).toEqual([7, 8, 9]);
  });

  it("does not match the middle of a word", () => {
    expect(matchSymbol("eet", "Greeter")).toBeNull();
    expect(matchSymbol("vice", "GreeterService")).toBeNull();
  });

  it("lets a term spend itself on the starts of consecutive words", () => {
    expect(matchSymbol("gs", "GreeterService")?.indices).toEqual([0, 7]);
    expect(matchSymbol("greser", "GreeterService")?.indices).toEqual([0, 1, 2, 7, 8, 9]);
    expect(matchSymbol("gsx", "GreeterService")).toBeNull();
  });

  it("requires every space-separated term", () => {
    expect(matchSymbol("greet shout", "greeterShout")).not.toBeNull();
    expect(matchSymbol("greet nope", "greeterShout")).toBeNull();
  });

  it("matches everything for an empty query", () => {
    expect(matchSymbol("   ", "anything")).toEqual({ score: 0, indices: [] });
  });

  it("matches after a dot or underscore", () => {
    expect(matchSymbol("name", "user.name")?.indices).toEqual([5, 6, 7, 8]);
    expect(matchSymbol("n", "user_name")?.indices).toEqual([5]);
  });

  it("does not let letters before the first word start leak in", () => {
    expect(matchSymbol("ee", "Greeter")).toBeNull();
  });
});

describe("rankByName", () => {
  const names = ["shoutLoud", "Greeter", "greetAll", "GreeterService", "regreet"];

  it("puts exact, then prefix, then deeper-word matches first", () => {
    const ranked = rankByName(names, "greeter", (n) => n).map((r) => r.item);
    expect(ranked).toEqual(["Greeter", "GreeterService"]);
    expect(rankByName(names, "greet", (n) => n).map((r) => r.item)).toEqual(["Greeter", "greetAll", "GreeterService"]);
  });

  it("ranks a name-start match above a later-word match", () => {
    const ranked = rankByName(["thisIsLoud", "loudThing"], "loud", (n) => n).map((r) => r.item);
    expect(ranked).toEqual(["loudThing", "thisIsLoud"]);
  });

  it("keeps input order for equal scores and drops non-matches", () => {
    expect(rankByName(["bb", "ba"], "b", (n) => n).map((r) => r.item)).toEqual(["bb", "ba"]);
    expect(rankByName(["x"], "y", (n) => n)).toEqual([]);
  });
});
