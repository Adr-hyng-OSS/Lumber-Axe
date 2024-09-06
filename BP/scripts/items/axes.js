import { EntityEquippableComponent, EquipmentSlot, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, ItemStack, Player, system, TicksPerSecond, world } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { axeEquipments, forceShow, getTreeLogs, isLogIncluded, playerInteractedTimeLogMap, serverConfigurationCopy, stackDistribution } from "index";
import { MinecraftBlockTypes, MinecraftEnchantmentTypes } from "modules/vanilla-types/index";
import { Logger } from "utils/logger";
import "classes/player";
const blockOutlinesDespawnTimer = 10;
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
        async onMineBlock(arg) {
            if (!(arg.source instanceof Player))
                return;
            const player = arg.source;
            const axe = player.getComponent(EntityEquippableComponent.componentId);
            const dimension = player.dimension;
            const blockInteracted = arg.block;
            const location = blockInteracted.location;
            const currentHeldAxe = arg.itemStack;
            const currentBreakBlock = arg.minedBlockPermutation;
            const blockTypeId = currentBreakBlock.type.id;
            if (!player.isSurvival())
                return;
            if (!isLogIncluded(blockTypeId)) {
                axe.damageDurability(1);
                return;
            }
            const equipment = player.getComponent(EntityEquippableComponent.componentId);
            currentHeldAxe.lockMode = ItemLockMode.slot;
            const itemDurability = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId);
            const enchantments = currentHeldAxe.getComponent(ItemEnchantableComponent.componentId);
            const level = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
            const unbreakingMultiplier = (100 / (level + 1)) / 100;
            const unbreakingDamage = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
            const blockOutline = player.dimension.getEntities({
                closest: 1,
                maxDistance: 1,
                type: "yn:block_outline",
                location: blockInteracted.bottomCenter()
            })[0];
            let visited;
            let inspectedTree;
            if (blockOutline) {
                for (const visitedLogsGraph of player.visitedLogs) {
                    const interactedNode = visitedLogsGraph.visitedLogs.source.getNode(blockInteracted.location);
                    if (!interactedNode)
                        continue;
                    const index = player.visitedLogs.indexOf(visitedLogsGraph);
                    if (index === -1)
                        continue;
                    inspectedTree = player.visitedLogs[index];
                    break;
                }
                if (!inspectedTree)
                    return;
                visited = inspectedTree.visitedLogs.source;
            }
            else {
                visited = (await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage, true)).source;
            }
            if (!visited)
                return;
            const size = visited.getSize();
            const totalDamage = size * unbreakingDamage;
            const postDamagedDurability = itemDurability.damage + totalDamage;
            if (postDamagedDurability + 1 === itemDurability.maxDurability) {
                equipment.setEquipment(EquipmentSlot.Mainhand, undefined);
            }
            else if (postDamagedDurability > itemDurability.maxDurability) {
                currentHeldAxe.lockMode = ItemLockMode.none;
                return;
            }
            else if (postDamagedDurability < itemDurability.maxDurability) {
                itemDurability.damage = itemDurability.damage + totalDamage;
                currentHeldAxe.lockMode = ItemLockMode.none;
                equipment.setEquipment(EquipmentSlot.Mainhand, currentHeldAxe.clone());
            }
            if (inspectedTree)
                player.visitedLogs.splice(player.visitedLogs.indexOf(inspectedTree));
            visited.bfs(location, (node) => {
                system.run(() => dimension.setBlockType(node.location, MinecraftBlockTypes.Air));
            });
            system.runTimeout(() => {
                for (const group of stackDistribution(size)) {
                    system.run(() => dimension.spawnItem(new ItemStack(blockTypeId, group), location));
                }
            }, 5);
        },
        onUseOn(arg) {
            const currentHeldAxe = arg.itemStack;
            const blockInteracted = arg.block;
            const player = arg.source;
            if (!axeEquipments.includes(currentHeldAxe.typeId) || !isLogIncluded(blockInteracted.typeId))
                return;
            const oldLog = playerInteractedTimeLogMap.get(player.id);
            playerInteractedTimeLogMap.set(player.id, system.currentTick);
            if ((oldLog + 2) >= system.currentTick)
                return;
            const itemDurability = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId);
            const enchantments = currentHeldAxe.getComponent(ItemEnchantableComponent.componentId);
            const level = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
            const currentDurability = itemDurability.damage;
            const maxDurability = itemDurability.maxDurability;
            const unbreakingMultiplier = (100 / (level + 1)) / 100;
            const unbreakingDamage = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
            const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
            const blockOutline = player.dimension.getEntities({ closest: 1, maxDistance: 1, type: "yn:block_outline", location: blockInteracted.bottomCenter() })[0];
            try {
                system.run(async () => {
                    if (blockOutline?.isValid()) {
                        let size = 0;
                        let inspectedTree;
                        for (const visitedLogsGraph of player.visitedLogs) {
                            const interactedNode = visitedLogsGraph.visitedLogs.source.getNode(blockInteracted.location);
                            if (!interactedNode)
                                continue;
                            const index = player.visitedLogs.indexOf(visitedLogsGraph);
                            if (index === -1)
                                continue;
                            inspectedTree = player.visitedLogs[index];
                            break;
                        }
                        if (!inspectedTree)
                            return;
                        for (const blockOutline of inspectedTree.visitedLogs.blockOutlines) {
                            if (blockOutline?.isValid()) {
                                blockOutline.setProperty('yn:stay_persistent', true);
                                continue;
                            }
                            let { x, y, z } = blockOutline.lastLocation;
                            x -= 0.5;
                            z -= 0.5;
                            inspectedTree.visitedLogs.source.removeNode({ x, y, z });
                        }
                        let isInSameNeighbor = false;
                        inspectedTree.visitedLogs.source.dfsIterative(blockInteracted.location, (node) => {
                            const inspectedNode = inspectedTree.visitedLogs.source.getNode(inspectedTree.initialInteraction);
                            if (inspectedNode) {
                                if (node.neighbors.has(inspectedNode))
                                    isInSameNeighbor = true;
                            }
                            if (node)
                                size++;
                        });
                        console.warn(inspectedTree.visitedLogs.source.getSize());
                        const totalDamage = size * unbreakingDamage;
                        const totalDurabilityConsumed = currentDurability + totalDamage;
                        const canBeChopped = (totalDurabilityConsumed === maxDurability) || (totalDurabilityConsumed < maxDurability);
                        const inspectionForm = new ActionFormData()
                            .title({
                            rawtext: [
                                {
                                    translate: "LumberAxe.form.title.text"
                                }
                            ]
                        })
                            .button({
                            rawtext: [
                                {
                                    translate: `LumberAxe.form.treeSizeAbrev.text`
                                },
                                {
                                    text: ` ${size !== 0 ? size : 1}${canBeChopped ? "" : "+"} `
                                },
                                {
                                    translate: `LumberAxe.form.treeSizeAbrevLogs.text`
                                }
                            ]
                        }, "textures/InfoUI/blocks.png")
                            .button({
                            rawtext: [
                                {
                                    translate: `LumberAxe.form.durabilityAbrev.text`
                                },
                                {
                                    text: ` ${currentDurability}`
                                }
                            ]
                        }, "textures/InfoUI/axe_durability.png")
                            .button({
                            rawtext: [
                                {
                                    translate: `LumberAxe.form.maxDurabilityAbrev.text`
                                },
                                {
                                    text: ` ${maxDurability}`
                                }
                            ]
                        }, "textures/InfoUI/required_durability.png")
                            .button({
                            rawtext: [
                                {
                                    text: "§l"
                                },
                                {
                                    translate: `${canBeChopped ? "LumberAxe.form.canBeChopped.text" : "LumberAxe.form.cannotBeChopped.text"}`
                                }
                            ]
                        }, "textures/InfoUI/canBeCut.png");
                        forceShow(player, inspectionForm).then((response) => {
                            if (response.canceled || response.selection === undefined || response.cancelationReason === FormCancelationReason.UserClosed) {
                                for (const blockOutline of inspectedTree.visitedLogs.blockOutlines) {
                                    if (!blockOutline?.isValid())
                                        continue;
                                    blockOutline.setProperty('yn:stay_persistent', false);
                                }
                                return;
                            }
                        }).catch((error) => {
                            Logger.error("Form Error: ", error, error.stack);
                        });
                    }
                    else {
                        const treeCollectedResult = await getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1);
                        player.visitedLogs = player.visitedLogs ?? [];
                        const result = { initialInteraction: blockInteracted.location, visitedLogs: treeCollectedResult, isBeingInspected: false };
                        player.visitedLogs.push(result);
                        system.runTimeout(() => {
                            resetOutlinedTrees(player, result);
                        }, blockOutlinesDespawnTimer * TicksPerSecond);
                    }
                });
            }
            catch (e) {
                console.warn(e, e.stack);
            }
        },
    });
});
function resetOutlinedTrees(player, result) {
    let shouldDespawn = false;
    for (const blockOutline of result.visitedLogs.blockOutlines) {
        if (!blockOutline?.isValid())
            continue;
        const isPersistent = blockOutline.getProperty('yn:stay_persistent');
        if (isPersistent)
            continue;
        shouldDespawn = true;
        blockOutline.triggerEvent('despawn');
    }
    if (shouldDespawn)
        player.visitedLogs.splice(player.visitedLogs.indexOf(result));
}
