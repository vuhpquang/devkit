import { describe, it, expect } from "vitest";
import { chmodCommand, fromOctal, fromSymbolic, parseMode, toOctal, toSymbolic, type Perms } from "./logic";

const perms = (s: string): Perms => {
  const r = parseMode(s);
  if (!r.ok) throw new Error(r.error);
  return r.perms;
};

describe("octal ↔ symbolic", () => {
  it.each([
    ["755", "rwxr-xr-x"],
    ["644", "rw-r--r--"],
    ["600", "rw-------"],
    ["000", "---------"],
    ["777", "rwxrwxrwx"],
  ])("%s is %s", (oct, sym) => {
    expect(toSymbolic(perms(oct))).toBe(sym);
    expect(toOctal(perms(sym))).toBe(oct);
  });

  it("shows special bits as s/S and t/T", () => {
    expect(toSymbolic(perms("4755"))).toBe("rwsr-xr-x");
    expect(toSymbolic(perms("4644"))).toBe("rwSr--r--");
    expect(toSymbolic(perms("2775"))).toBe("rwxrwsr-x");
    expect(toSymbolic(perms("1777"))).toBe("rwxrwxrwt");
    expect(toSymbolic(perms("1776"))).toBe("rwxrwxrwT");
    expect(toSymbolic(perms("7000"))).toBe("--S--S--T");
  });

  it("reads special bits back from symbolic", () => {
    expect(toOctal(perms("rwsr-xr-x"))).toBe("4755");
    expect(toOctal(perms("rwxrwxrwt"))).toBe("1777");
    expect(toOctal(perms("drwxr-sr-x"))).toBe("2755");
    expect(toOctal(perms("-rw-r--r--"))).toBe("644");
  });

  it("writes 4 digits only when needed or asked", () => {
    expect(toOctal(perms("0755"))).toBe("755");
    expect(toOctal(perms("755"), true)).toBe("0755");
  });
});

describe("validation", () => {
  it("rejects bad modes", () => {
    expect(fromOctal("75").ok).toBe(false);
    expect(fromOctal("789").ok).toBe(false);
    expect(fromOctal("17777").ok).toBe(false);
    expect(fromSymbolic("rwxrwxrw").ok).toBe(false);
    expect(fromSymbolic("rwzr-xr-x").ok).toBe(false);
    expect(parseMode("").ok).toBe(false);
  });
});

describe("chmodCommand", () => {
  it("quotes file names that need it", () => {
    expect(chmodCommand(perms("755"), "deploy.sh")).toBe("chmod 755 deploy.sh");
    expect(chmodCommand(perms("644"), "my file's.txt")).toBe(`chmod 644 'my file'\\''s.txt'`);
    expect(chmodCommand(perms("4755"), "")).toBe("chmod 4755 file");
  });
});
