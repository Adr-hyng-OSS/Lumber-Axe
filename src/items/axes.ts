import { EntityEquippableComponent, Player, world } from "@minecraft/server";
import "classes/player";
import { isLogIncluded } from "functions/tree_utils";

world.beforeEvents.worldInitialize.subscribe((registry) => {
  registry.itemComponentRegistry.registerCustomComponent('yn:tool_durability', {
    onHitEntity(arg) {
      if(!(arg.attackingEntity instanceof Player)) return;
      const player: Player = arg.attackingEntity;
      if(!player.isSurvival()) return;
      const axe = (player.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent);
      axe.damageDurability(1);
    },
    onUseOn(arg) {
      
    },
    onMineBlock(arg) {
      const player = arg.source;
      const axe = (player.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent);
      axe.damageDurability(2);
    },
  })
});