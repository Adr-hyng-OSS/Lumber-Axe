import { EntityEquippableComponent, Player, world } from "@minecraft/server";
import "classes/player";
world.beforeEvents.worldInitialize.subscribe((registry) => {
    registry.itemComponentRegistry.registerCustomComponent('yn:tool_durability', {
        onHitEntity(arg) {
            if (!(arg.attackingEntity instanceof Player))
                return;
            const player = arg.attackingEntity;
            if (!player.isSurvival())
                return;
            const axe = player.getComponent(EntityEquippableComponent.componentId);
            axe.damageDurability(1);
        },
        onUseOn(arg) {
        },
        onMineBlock(arg) {
            const player = arg.source;
            const axe = player.getComponent(EntityEquippableComponent.componentId);
            axe.damageDurability(2);
        },
    });
});
