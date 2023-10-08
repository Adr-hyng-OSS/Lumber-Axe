import { GameMode, Player } from "@minecraft/server";
Player.prototype.isSurvival = function () {
    return this.dimension.getPlayers({ gameMode: GameMode.survival, name: this.name, location: this.location, maxDistance: 1, closest: 1 }).length > 0;
};
