import { world, system, ItemDurabilityComponent, ItemEnchantableComponent, WatchdogTerminateReason } from '@minecraft/server';
import { FormCancelationReason, ActionFormData } from "@minecraft/server-ui";
import { axeEquipments, forceShow, getTreeLogs, isLogIncluded, treeCut, SERVER_CONFIGURATION } from "./index";
import { MinecraftEnchantmentTypes } from './modules/vanilla-types/index';
import { CommandRegistry } from 'cmd_setup/handler';
import { CommandHandler } from 'cmd_setup/setup';
import { Vector } from 'modules/Vector';
const logMap = new Map();
const playerInteractionMap = new Map();
const playerBeingShown = new Map();
import('@minecraft/server-ui').then((ui) => {
    var [userBusy, userClosed] = Object.values(ui.FormCancelationReason), formData;
    for (formData of [ui.ActionFormData, ui.MessageFormData, ui.ModalFormData]) {
        const formShow = Object.getOwnPropertyDescriptor(formData.prototype, "show").value;
        Object.defineProperty(formData.prototype, "show", {
            value: function (player, persistent = false, trials = 50) {
                const show = formShow.bind(this, player);
                if (player.id in playerBeingShown)
                    return;
                playerBeingShown[player.id] = true;
                return new Promise(async (resolve) => {
                    let result;
                    do {
                        result = await show();
                        if (!trials-- || persistent && result.cancelationReason === userClosed)
                            return delete playerBeingShown[player.id];
                    } while (result.cancelationReason === userBusy);
                    delete playerBeingShown[player.id];
                    resolve(result);
                });
            }
        });
    }
    ;
});
system.beforeEvents.watchdogTerminate.subscribe((e) => {
    e.cancel = true;
    if (e.terminateReason === WatchdogTerminateReason.Hang) {
        for (const key of playerInteractionMap.keys()) {
            playerInteractionMap.set(key, false);
        }
        if (!SERVER_CONFIGURATION.disableWatchDogTerminateLog)
            world.sendMessage({
                rawtext: [
                    {
                        translate: "LumberAxe.watchdogError.hang.text"
                    }
                ]
            });
        if (SERVER_CONFIGURATION.disableWatchDogTerminateLog)
            console.warn(`Scripting Error: Try chopping or inspecting smaller trees or different angle.`);
    }
    console.warn(`Watchdog Error: ${e.terminateReason}`);
});
world.afterEvents.playerLeave.subscribe((e) => {
    playerInteractionMap.set(e.playerId, false);
    delete playerBeingShown[e.playerId];
});
let blocksVisited = [];
world.afterEvents.playerBreakBlock.subscribe((e) => {
    const { dimension, player, block } = e;
    const currentBreakBlock = e.brokenBlockPermutation;
    const blockTypeId = currentBreakBlock.type.id;
    system.run(async () => await treeCut(player, dimension, new Vector(block.location), blockTypeId, blocksVisited));
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
    const unbreakingDamage = SERVER_CONFIGURATION.durabilityDamagePerBlock * unbreakingMultiplier;
    const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
    const tree = await getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs);
    blocksVisited = tree;
    system.runTimeout(() => {
        blocksVisited = [];
        player.sendMessage("Reseted");
    }, 80);
    const totalDamage = (tree.length) * unbreakingDamage;
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
                text: ` ${tree.length !== 0 ? tree.length + 1 : 1}${canBeChopped ? "" : "+"} `
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
world.beforeEvents.chatSend.subscribe((chat) => {
    if (!chat.message.startsWith(CommandHandler.prefix))
        return;
    chat.cancel = true;
    const player = chat.sender;
    const message = chat.message;
    const args = message.slice(CommandHandler.prefix.length).trim().split(/ +/g);
    const cmd = args.shift().toLowerCase();
    try {
        const CommandObject = CommandRegistry.get(cmd);
        CommandObject.execute(chat, player, args);
    }
    catch (err) {
        if (err instanceof ReferenceError) {
            player.sendMessage(`§cInvalid Command ${cmd}\nCheck If The Command Actually Exists.`);
        }
        else {
            console.error(err);
        }
    }
});
