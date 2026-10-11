import data from "../src/data/players.generated.json";
import type { Player } from "../src/types";
import { validatePlayers } from "./player-validation";
const result = validatePlayers(data.players as Player[]);
console.log(JSON.stringify(result.summary, null, 2));
if (result.errors.length) {
  console.error(result.errors.join("\n"));
  process.exitCode = 1;
}
