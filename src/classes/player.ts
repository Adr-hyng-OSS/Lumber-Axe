import { GameMode, Player } from "@minecraft/server";
import { OverTakes } from "./partial_overtakes";
import { Configuration } from "configuration/configuration_screen";
import { InteractedTreeResult } from "index";

declare module "@minecraft/server" {
  interface Player {
    visitedLogs: InteractedTreeResult[];
    configuration: Configuration;
    get hasOpenInspection(): boolean;
    set hasOpenInspection(value: boolean);
    isSurvival(): boolean;
  }
}

const screenConfigs = new WeakMap<Player, Configuration>();
const inspectionMap = new WeakMap<Player, boolean>();

OverTakes(Player.prototype, {
  isSurvival(): boolean {
    return this.getGameMode() === GameMode.survival;
  },
  get hasOpenInspection() {
    let inspection = inspectionMap.get(this);
    if (inspection === undefined) {
      inspection = false;
      inspectionMap.set(this, inspection); // Set it to false if not defined
    }
    return inspection;
  },
  set hasOpenInspection(value: boolean) {
    inspectionMap.set(this, value);
  },
  get configuration() {
    let sc = screenConfigs.get(this);
    if(!sc) screenConfigs.set(this, sc = new Configuration(this));
    return sc;
  }
});