import { v4 as uuidv4 } from "uuid";

export function generateUuids(count: number): string[] {
  const n = Math.max(1, Math.floor(count) || 1);
  return Array.from({ length: n }, () => uuidv4());
}
