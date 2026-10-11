import fs from "node:fs";
import path from "node:path";
import { parseWorkbook } from "../src/lib/workbookParser";
import { workbookDiff } from "../src/lib/workbookDiff";
import dataset from "../src/data/players.generated.json";
import type { Player } from "../src/types";
const input = process.argv[process.argv[1]?.endsWith("run-ts.cjs") ? 3 : 2];
if (!input)
  throw Error('Usage: npm run preview-players -- "updated-workbook.xlsx"');
const file = path.resolve(process.cwd(), input);
const bytes = fs.readFileSync(file);
if (bytes.length > 10_000_000)
  throw Error("Workbook exceeds 10 MB preview limit");
const diff = workbookDiff(dataset.players as Player[], parseWorkbook(bytes));
console.log(JSON.stringify(diff, null, 2));
if (!diff.canApply) process.exitCode = 1;
