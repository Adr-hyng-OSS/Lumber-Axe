import { EntityEquippableComponent, ItemDurabilityComponent, ItemEnchantableComponent, Player, system, TicksPerSecond, world } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { axeEquipments, forceShow, getTreeLogs, isLogIncluded, playerInteractedTimeLogMap, serverConfigurationCopy, treeCut } from "index";
import { MinecraftEnchantmentTypes } from "modules/vanilla-types/index";
import { Logger } from "utils/logger";
const visitedLogs = [];
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
            const itemDurability = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId);
            const enchantments = currentHeldAxe.getComponent(ItemEnchantableComponent.componentId);
            const level = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
            const currentDurability = itemDurability.damage;
            const maxDurability = itemDurability.maxDurability;
            const unbreakingMultiplier = (100 / (level + 1)) / 100;
            const unbreakingDamage = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
            const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
            if (blockOutlines.length && blockOutlines[0]?.isValid()) {
                console.warn("HAS BLOCK OUITLINE");
                let inspectedTree;
                for (const c_blockOutline of visitedLogs) {
                    const index = c_blockOutline.indexOf(blockOutlines[0]);
                    if (index === -1)
                        continue;
                    inspectedTree = visitedLogs[visitedLogs.indexOf(c_blockOutline)];
                    break;
                }
                const size = inspectedTree.length;
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
                        for (const _blockOutline of inspectedTree) {
                            if (!_blockOutline?.isValid())
                                continue;
                            system.run(() => _blockOutline.triggerEvent('despawn'));
                        }
                        return;
                    }
                }).catch((error) => {
                    Logger.error("Form Error: ", error, error.stack);
                });
            }
            else {
                console.warn("DOESNT HAVE BLOCK OUITLINE");
                system.run(async () => {
                    const treeCollectedResult = await getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1);
                    visitedLogs.push(treeCollectedResult.blockOutlines);
                    system.runTimeout(() => {
                        visitedLogs.splice(visitedLogs.indexOf(treeCollectedResult.blockOutlines));
                        console.warn("RESET");
                    }, 5 * TicksPerSecond);
                });
            }
        },
    });
});
