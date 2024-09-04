import { EntityEquippableComponent, ItemDurabilityComponent, ItemEnchantableComponent, Player, world } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { axeEquipments, forceShow, getTreeLogs, isLogIncluded, playerInteractionMap, serverConfigurationCopy, treeCut } from "index";
import { MinecraftEnchantmentTypes } from "modules/vanilla-types/index";
import { Logger } from "utils/logger";
world.beforeEvents.worldInitialize.subscribe((registry) => {
    registry.itemComponentRegistry.registerCustomComponent('yn:tool_durability', {
        onHitEntity(arg) {
            if (!(arg.attackingEntity instanceof Player))
                return;
            const player = arg.attackingEntity;
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
            if (playerInteractionMap.get(player.id))
                return;
            playerInteractionMap.set(player.id, true);
            const itemDurability = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId);
            const enchantments = currentHeldAxe.getComponent(ItemEnchantableComponent.componentId);
            const level = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
            const currentDurability = itemDurability.damage;
            const maxDurability = itemDurability.maxDurability;
            const unbreakingMultiplier = (100 / (level + 1)) / 100;
            const unbreakingDamage = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
            const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
            getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1).then((treeCollected) => {
                const totalDamage = (treeCollected.size) * unbreakingDamage;
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
                            text: ` ${treeCollected.size !== 0 ? treeCollected.size : 1}${canBeChopped ? "" : "+"} `
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
                    playerInteractionMap.set(player.id, false);
                    if (response.canceled || response.selection === undefined || response.cancelationReason === FormCancelationReason.UserClosed)
                        return;
                }).catch((error) => {
                    Logger.error("Form Error: ", error, error.stack);
                });
            }).catch((error) => {
                Logger.error("Tree Error: ", error, error.stack);
                playerInteractionMap.set(player.id, false);
            });
        },
    });
});
