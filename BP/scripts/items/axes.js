import { EntityEquippableComponent, ItemDurabilityComponent, ItemEnchantableComponent, Player, system, world } from "@minecraft/server";
import { axeEquipments, getTreeLogs, isLogIncluded, playerInteractedTimeLogMap, serverConfigurationCopy, treeCut } from "index";
import { MinecraftEnchantmentTypes } from "modules/vanilla-types/index";
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
        onMineBlock(arg) {
            if (!(arg.source instanceof Player))
                return;
            const player = arg.source;
            const axe = player.getComponent(EntityEquippableComponent.componentId);
            const dimension = player.dimension;
            const block = arg.block;
            const currentBreakBlock = arg.minedBlockPermutation;
            const blockTypeId = currentBreakBlock.type.id;
            if (!player.isSurvival())
                return;
            if (!isLogIncluded(blockTypeId)) {
                axe.damageDurability(1);
                return;
            }
            treeCut(player, dimension, block.location, blockTypeId);
        },
        onUseOn(arg) {
            const currentHeldAxe = arg.itemStack;
            const blockInteracted = arg.block;
            const player = arg.source;
            if (!axeEquipments.includes(currentHeldAxe.typeId) || !isLogIncluded(blockInteracted.typeId))
                return;
            const oldLog = playerInteractedTimeLogMap.get(player.id);
            playerInteractedTimeLogMap.set(player.id, system.currentTick);
            if ((oldLog + 20) >= Date.now())
                return;
            const blockOutlines = player.dimension.getEntities({ closest: 1, maxDistance: 1, type: "yn:block_outline", location: blockInteracted.bottomCenter() });
            if (blockOutlines.length && blockOutlines[0]?.isValid()) {
                console.warn("HAS BLOCK OUITLINE");
            }
            else {
                console.warn("DOESNT HAVE BLOCK OUITLINE");
                const itemDurability = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId);
                const enchantments = currentHeldAxe.getComponent(ItemEnchantableComponent.componentId);
                const level = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
                const currentDurability = itemDurability.damage;
                const maxDurability = itemDurability.maxDurability;
                const unbreakingMultiplier = (100 / (level + 1)) / 100;
                const unbreakingDamage = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
                const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
                system.run(async () => {
                    const treeCollectedResult = await getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1);
                    const size = treeCollectedResult.visited.size;
                    const totalDamage = size * unbreakingDamage;
                    const totalDurabilityConsumed = currentDurability + totalDamage;
                    const canBeChopped = (totalDurabilityConsumed === maxDurability) || (totalDurabilityConsumed < maxDurability);
                    console.warn("RESET");
                });
            }
        },
    });
});
