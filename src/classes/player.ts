import { GameMode, Player } from "@minecraft/server";

declare module "@minecraft/server" {
  interface Player {
    isSurvival(this: Player): boolean;
  }
}

Player.prototype.isSurvival = function(): boolean {
  return this.getGameMode() === GameMode.survival;
}