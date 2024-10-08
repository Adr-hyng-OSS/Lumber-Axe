import { GameMode, Player } from "@minecraft/server";
import { OverTakes } from "./partial_overtakes";
import { Configuration } from "configuration/configuration_screen";

declare module "@minecraft/server" {
  interface Player {
    configuration: Configuration;
    isSurvival(): boolean;
  }
}

const screenConfigs = new WeakMap<Player, Configuration>();

OverTakes(Player.prototype, {
  isSurvival(): boolean {
    return this.getGameMode() === GameMode.survival;
  },
  get configuration() {
    let sc = screenConfigs.get(this);
    if(!sc) screenConfigs.set(this, sc = new Configuration(this));
    return sc;
  }
});