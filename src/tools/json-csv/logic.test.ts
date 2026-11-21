import { describe, it, expect } from "vitest";
import { csvField, csvToJson, detectType, jsonToCsv, parseCsv } from "./logic";

const ok = (r: { ok: boolean; value?: string; error?: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r.value!;
};

describe("jsonToCsv", () => {
  it("writes a header from the union of keys, in first-seen order", () => {
    const csv = ok(jsonToCsv('[{"a":1,"b":"x"},{"b":"y","c":true}]'));
    expect(csv).toBe("a,b,c\n1,x,\n,y,true");
  });

  it("quotes commas, quotes and newlines; stringifies nested values", () => {
    const csv = ok(jsonToCsv('[{"name":"Vu, Ha","quote":"say \\"hi\\"","note":"a\\nb","tags":["x","y"],"n":null}]'));
    expect(csv).toBe('name,quote,note,tags,n\n"Vu, Ha","say ""hi""","a\nb","[""x"",""y""]",');
  });

  it("handles arrays of arrays, plain values, a single object and empty arrays", () => {
    expect(ok(jsonToCsv("[[1,2],[3,4]]"))).toBe("1,2\n3,4");
    expect(ok(jsonToCsv('["a","b"]'))).toBe("value\na\nb");
    expect(ok(jsonToCsv('{"a":1}'))).toBe("a\n1");
    expect(ok(jsonToCsv("[]"))).toBe("");
  });

  it("uses the chosen delimiter", () => {
    expect(ok(jsonToCsv('[{"a":"1;2","b":3}]', ";"))).toBe('a;b\n"1;2";3');
    expect(ok(jsonToCsv('[{"a":1,"b":2}]', "\t"))).toBe("a\tb\n1\t2");
  });

  it("rejects bad input", () => {
    expect(jsonToCsv("{oops").ok).toBe(false);
    expect(jsonToCsv("42").ok).toBe(false);
    expect(jsonToCsv('[{"a":1},[1]]').ok).toBe(false);
  });
});

describe("parseCsv", () => {
  it("parses quoted fields, escaped quotes, CRLF and newlines inside quotes", () => {
    expect(parseCsv('a,b\r\n"x, y","he said ""hi"""\r\n"multi\nline",z\n')).toEqual([
      ["a", "b"],
      ["x, y", 'he said "hi"'],
      ["multi\nline", "z"],
    ]);
  });

  it("keeps empty fields and skips blank lines", () => {
    expect(parseCsv("a,,c\n\n1,2,\n")).toEqual([
      ["a", "", "c"],
      ["1", "2", ""],
    ]);
  });

  it("reports an unclosed quote with its line", () => {
    expect(() => parseCsv('a\n"oops')).toThrow("line 2");
  });
});

describe("csvToJson", () => {
  it("turns rows into objects keyed by the header, with type detection", () => {
    expect(JSON.parse(ok(csvToJson("id,name,active,zip\n1,Vu,true,007\n2,Ha,false,")))).toEqual([
      { id: 1, name: "Vu", active: true, zip: "007" },
      { id: 2, name: "Ha", active: false, zip: "" },
    ]);
  });

  it("keeps strings when detection is off", () => {
    expect(JSON.parse(ok(csvToJson("n\n42", ",", false)))).toEqual([{ n: "42" }]);
  });

  it("names missing and duplicate headers", () => {
    expect(JSON.parse(ok(csvToJson("a,a,\n1,2,3,4")))).toEqual([{ a: 1, a_2: 2, field3: 3, field4: 4 }]);
  });

  it("reads semicolon and tab files", () => {
    expect(JSON.parse(ok(csvToJson("a;b\n1;x", ";")))).toEqual([{ a: 1, b: "x" }]);
    expect(JSON.parse(ok(csvToJson("a\tb\n1\tx", "\t")))).toEqual([{ a: 1, b: "x" }]);
  });

  it("round-trips JSON → CSV → JSON", () => {
    const data = [
      { id: 1, name: "Comma, inc", note: 'quote "x"', multi: "l1\nl2", ok: true, score: 1.5 },
      { id: 2, name: "Plain", note: "", multi: "", ok: false, score: -3e-2 },
    ];
    const csv = ok(jsonToCsv(JSON.stringify(data)));
    expect(JSON.parse(ok(csvToJson(csv)))).toEqual(data);
  });
});

describe("helpers", () => {
  it("csvField quotes only when needed", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField("a;b", ",")).toBe("a;b");
  });
  it("detectType leaves leading zeros and empties alone", () => {
    expect(detectType("0")).toBe(0);
    expect(detectType("007")).toBe("007");
    expect(detectType("1e3")).toBe(1000);
    expect(detectType("")).toBe("");
    expect(detectType("null")).toBeNull();
  });
});
