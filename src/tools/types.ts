import type { ComponentType } from "react";

export type Category =
  | "Formatters"
  | "Diff"
  | "Converters"
  | "Encoders"
  | "Generators"
  | "Network";

export interface ToolDef {
  id: string;
  name: string;
  category: Category;
  keywords: string[];
  component: ComponentType;
  online?: boolean;
}
