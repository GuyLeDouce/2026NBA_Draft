import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Player } from "../src/types";
import { workbookDiff } from "../src/lib/workbookDiff";
import { parseWorkbook } from "../src/lib/workbookParser";
import { validatePlayers } from "./player-validation";
const sourceWorkbook =
  process.env.PLAYER_WORKBOOK ??
  "NBA_2026_27_Custom_Draft_Board_600_DraftDay_2026-10-10.xlsx";
const sourcePath = path.resolve(process.cwd(), sourceWorkbook);
const bytes = fs.readFileSync(sourcePath);
const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
const players = parseWorkbook(bytes);
const { errors, summary } = validatePlayers(players);
console.log(JSON.stringify(summary, null, 2));
if (errors.length) throw Error(errors.join("\n"));
const previousPath = path.join(
  process.cwd(),
  "src/data/players.generated.json",
);
if (fs.existsSync(previousPath)) {
  const previous = JSON.parse(fs.readFileSync(previousPath, "utf8")) as {
    players: Player[];
  };
  const preview = workbookDiff(previous.players, players);
  if (!preview.canApply)
    throw Error(
      "Refresh identity review required: " + preview.issues.join("; "),
    );
}
const metadata = {
  season: "2026-27",
  dataVersion: process.env.DATA_VERSION ?? "2026-10-10-draft-day-refresh",
  lastUpdated: process.env.DATA_UPDATED ?? "2026-10-10",
  draftDate: "2026-10-13",
  playerCount: players.length,
  sourceWorkbook: path.basename(sourcePath),
  sha256,
};
fs.mkdirSync("src/data", { recursive: true });
fs.writeFileSync(
  "src/data/players.generated.json",
  JSON.stringify({ metadata, players }, null, 2) + "\n",
);
if (
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(sourcePath))
    .digest("hex") !== sha256
)
  throw Error("Source workbook changed");
console.log(
  "Imported ONLY Draft Board. Workbook fingerprint unchanged: " + sha256,
);
