import { Database } from "lucide-react";
import type { ToolDef } from "../types";
import { TransformTool, type TransformMode } from "../../lib/ui";
import { formatSql } from "./logic";

const SAMPLE = "select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.active = true group by u.id, u.name order by orders desc limit 10;";

const MODES: TransformMode<"format">[] = [
  { value: "format", label: "Format", run: formatSql, inputLang: "sql", outputLang: "sql", okText: "Formatted", placeholder: "select * from users where id = 1" },
];

function SqlFormat() {
  return <TransformTool modes={MODES} sample={SAMPLE} />;
}

export const tool: ToolDef = {
  id: "sql-format",
  name: "SQL Formatter",
  category: "Formatters",
  description: "Lay out SQL queries with consistent indentation",
  icon: Database,
  keywords: ["sql", "format", "beautify", "query"],
  component: SqlFormat,
};
