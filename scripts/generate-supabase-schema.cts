import fs from "node:fs";
import path from "node:path";
import { getSupabaseSchemaSql } from "../supabase/schema.cjs";

const projectRoot = process.cwd();
const schemaPath = path.join(projectRoot, "supabase", "schema.sql");

fs.mkdirSync(path.dirname(schemaPath), { recursive: true });
fs.writeFileSync(schemaPath, getSupabaseSchemaSql());

console.log(`Generated Supabase schema at ${schemaPath}`);
