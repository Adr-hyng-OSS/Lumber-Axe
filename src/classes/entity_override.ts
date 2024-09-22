import { Entity } from "@minecraft/server";
import { OverTakes } from "./partial_overtakes";

declare module "@minecraft/server" {
  interface Entity {
    lastLocation: Vector3;
  }
}

OverTakes(Entity.prototype, {
});