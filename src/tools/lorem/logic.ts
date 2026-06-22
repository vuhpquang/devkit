const WORDS =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat".split(
    " "
  );

function sentence(): string {
  const len = 8 + Math.floor(Math.random() * 8);
  const words = Array.from({ length: len }, () => WORDS[Math.floor(Math.random() * WORDS.length)]);
  const s = words.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

export function generateLorem(paragraphs: number): string {
  const n = Math.max(1, Math.floor(paragraphs) || 1);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const count = 3 + Math.floor(Math.random() * 3);
    const sentences = Array.from({ length: count }, sentence);
    out.push(sentences.join(" "));
  }
  out[0] = "Lorem ipsum " + out[0];
  return out.join("\n\n");
}
