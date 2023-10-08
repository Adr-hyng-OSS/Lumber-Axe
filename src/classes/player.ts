import { GameMode, Player } from "@minecraft/server";

declare module "@minecraft/server" {
  interface Player {
    isSurvival(this: Player): boolean;
  }
}

Player.prototype.isSurvival = function(): boolean {
  return this.dimension.getPlayers({ gameMode: GameMode.survival, name: this.name, location: this.location, maxDistance: 1, closest: 1 }).length > 0;
}