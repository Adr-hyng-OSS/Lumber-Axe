import { world, system, ItemDurabilityComponent, ItemEnchantsComponent, WatchdogTerminateReason } from '@minecraft/server';
import { FormCancelationReason, ActionFormData } from "@minecraft/server-ui";
import { disableWatchDogTerminateLog, durabilityDamagePerBlock, axeEquipments, forceShow, getTreeLogs, isLogIncluded, treeCut } from "./index";
const logMap = new Map();
const playerInteractionMap = new Map();
system.beforeEvents.watchdogTerminate.subscribe((e) => {
    e.cancel = true;
    if (e.terminateReason === WatchdogTerminateReason.Hang) {
        for (const key of playerInteractionMap.keys()) {
            playerInteractionMap.set(key, false);
        }
        if (!disableWatchDogTerminateLog)
            world.sendMessage({
                rawtext: [
                    {
                        translate: "LumberAxe.watchdogError.hang.text"
                    }
                ]
            });
        if (disableWatchDogTerminateLog)
            console.warn(`Scripting Error: Try chopping or inspecting smaller trees or different angle.`);
    }
    console.warn(`Watchdog Error: ${e.terminateReason}`);
});
world.afterEvents.playerLeave.subscribe((e) => {
    playerInteractionMap.set(e.playerId, false);
});
world.afterEvents.blockBreak.subscribe(async (e) => {
    const { dimension, player, block } = e;
    const currentBreakBlock = e.brokenBlockPermutation;
    const blockTypeId = currentBreakBlock.type.id;
    treeCut(player, dimension, block.location, blockTypeId);
});
world.beforeEvents.itemUseOn.subscribe((e) => {
    const currentHeldAxe = e.itemStack;
    const blockInteracted = e.block;
    const player = e.source;
    const oldLog = logMap.get(player.name);
    logMap.set(player.name, Date.now());
    if ((oldLog + 1000) >= Date.now())
        return;
    if (!axeEquipments.includes(currentHeldAxe.typeId) || !isLogIncluded(blockInteracted.typeId))
        return;
    if (playerInteractionMap.get(player.id))
        return;
    playerInteractionMap.set(player.id, true);
    const itemDurability = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId);
    const enchantments = currentHeldAxe?.getComponent(ItemEnchantsComponent.componentId)?.enchantments;
    const level = enchantments.hasEnchantment('unbreaking');
    const currentDurability = itemDurability.damage;
    const maxDurability = itemDurability.maxDurability;
    const unbreakingMultiplier = (100 / (level + 1)) / 100;
    const unbreakingDamage = durabilityDamagePerBlock * unbreakingMultiplier;
    const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
    getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1).then(async (treeCollected) => {
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
                    text: ` ${treeCollected.size}${canBeChopped ? "" : "+"} `
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
            console.warn("Form Error: ", error, error.stack);
        });
    }).catch((error) => {
        console.warn("Tree Error: ", error, error.stack);
        playerInteractionMap.set(player.id, false);
    });
});
