import { GameMode, Player } from "@minecraft/server";
import { OverTakes } from "./partial_overtakes";
import { Configuration } from "configuration/configuration_screen";
const screenConfigs = new WeakMap();
OverTakes(Player.prototype, {
    isSurvival() {
        return this.getGameMode() === GameMode.survival;
    },
    get configuration() {
        let sc = screenConfigs.get(this);
        if (!sc)
            screenConfigs.set(this, sc = new Configuration(this));
        return sc;
    }
});
