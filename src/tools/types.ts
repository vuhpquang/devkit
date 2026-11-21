import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

export type Category =
  | "Formatters"
  | "Diff"
  | "Converters"
  | "Encoders"
  | "Generators"
  | "Text"
  | "Design"
  | "Network";

export interface ToolDef {
  id: string;
  name: string;
  category: Category;
  /** One short line shown under the name (header, home grid, palette). */
  description: string;
  icon: LucideIcon;
  keywords: string[];
  component: ComponentType;
  online?: boolean;
}
