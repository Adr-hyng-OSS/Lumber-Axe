import { world, system, ItemDurabilityComponent, ItemEnchantableComponent, WatchdogTerminateReason } from '@minecraft/server';
import { FormCancelationReason, ActionFormData } from "@minecraft/server-ui";
import { disableWatchDogTerminateLog, durabilityDamagePerBlock, axeEquipments, forceShow, getTreeLogs, isLogIncluded, treeCut } from "./index";
import { MinecraftEnchantmentTypes } from './modules/vanilla-types/index';
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
world.afterEvents.playerBreakBlock.subscribe(async (e) => {
    const { dimension, player, block } = e;
    const currentBreakBlock = e.brokenBlockPermutation;
    const blockTypeId = currentBreakBlock.type.id;
    treeCut(player, dimension, block.location, blockTypeId);
});
world.beforeEvents.itemUseOn.subscribe(async (e) => {
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
    const enchantments = currentHeldAxe.getComponent(ItemEnchantableComponent.componentId);
    const level = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
    const currentDurability = itemDurability.damage;
    const maxDurability = itemDurability.maxDurability;
    const unbreakingMultiplier = (100 / (level + 1)) / 100;
    const unbreakingDamage = durabilityDamagePerBlock * unbreakingMultiplier;
    const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
    const tree = await getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1);
    const totalDamage = (tree.size) * unbreakingDamage;
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
                text: ` ${tree.size !== 0 ? tree.size : 1}${canBeChopped ? "" : "+"} `
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
});
