import { GameMode, Player } from "@minecraft/server";
import { OverTakes } from "./partial_overtakes";
import { Configuration } from "configuration/configuration_screen";
const screenConfigs = new WeakMap();
const inspectionMap = new WeakMap();
OverTakes(Player.prototype, {
    isSurvival() {
        return this.getGameMode() === GameMode.survival;
    },
    get hasOpenInspection() {
        let inspection = inspectionMap.get(this);
        if (inspection === undefined) {
            inspection = false;
            inspectionMap.set(this, inspection);
        }
        return inspection;
    },
    set hasOpenInspection(value) {
        inspectionMap.set(this, value);
    },
    get configuration() {
        let sc = screenConfigs.get(this);
        if (!sc)
            screenConfigs.set(this, sc = new Configuration(this));
        return sc;
    }
});
