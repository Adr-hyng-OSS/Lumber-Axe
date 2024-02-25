import { GameMode, Player } from "@minecraft/server";
import { __Configuration } from "./Configuration";
import { OverTakes } from "../index";
const screenConfigs = new WeakMap();
OverTakes(Player.prototype, {
    isSurvival() {
        return this.dimension.getPlayers({ gameMode: GameMode.survival, name: this.name, location: this.location, maxDistance: 1, closest: 1 }).length > 0;
    },
    get Configuration() {
        let sc = screenConfigs.get(this);
        if (!sc)
            screenConfigs.set(this, sc = new __Configuration(this));
        return sc;
    }
});
