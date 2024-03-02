import { world, ItemStack, system, Block, BlockPermutation, Player, ItemDurabilityComponent, ItemEnchantableComponent, ItemUseOnBeforeEvent, WatchdogTerminateBeforeEvent, WatchdogTerminateReason, PlayerLeaveAfterEvent, PlayerBreakBlockAfterEvent, ChatSendBeforeEvent } from '@minecraft/server';
import { FormCancelationReason, ActionFormData, ActionFormResponse} from "@minecraft/server-ui";
import { axeEquipments, forceShow, getTreeLogs, isLogIncluded, treeCut, SERVER_CONFIGURATION} from "./index"
import { MinecraftEnchantmentTypes } from './modules/vanilla-types/index';
import { CommandRegistry } from 'cmd_setup/handler';
import { CommandHandler, ICommandBase } from 'cmd_setup/setup';
import { Vector } from 'modules/Vector';
import { Graph } from 'classes/Graph';
import { BlockGraph } from 'classes/BlockGraph';
const logMap: Map<string, number> = new Map<string, number>();
const playerInteractionMap: Map<string, boolean> = new Map<string, boolean>();

const playerBeingShown: Map<string, boolean> = new Map<string, boolean>();

import('@minecraft/server-ui').then((ui) => {
    var [userBusy, userClosed] = Object.values(ui.FormCancelationReason), formData;
    for (formData of [ui.ActionFormData, ui.MessageFormData, ui.ModalFormData]) {
        const formShow = Object.getOwnPropertyDescriptor(formData.prototype, "show").value;
        Object.defineProperty(formData.prototype, "show", {
            value: function (player, persistent = false, trials = 50) {
                const show = formShow.bind(this,player);
                if (player.id in playerBeingShown) return;
                playerBeingShown[player.id] = true;
                return new Promise(async (resolve) => {
                    let result;
                    do {
                        result = await show();
                        if (!trials-- || persistent && result.cancelationReason === userClosed) return delete playerBeingShown[player.id];
                    } while (result.cancelationReason === userBusy);
                    delete playerBeingShown[player.id];
                    resolve(result);
                })
            }
        })
    };
});

system.beforeEvents.watchdogTerminate.subscribe((e: WatchdogTerminateBeforeEvent) => {
    e.cancel = true;
    if(e.terminateReason === WatchdogTerminateReason.Hang){
        for(const key of playerInteractionMap.keys()) {
            playerInteractionMap.set(key, false);
        }
        if(!SERVER_CONFIGURATION.disableWatchDogTerminateLog) world.sendMessage({
            rawtext: [
            {
                translate: "LumberAxe.watchdogError.hang.text"
            }
        ]});
        if(SERVER_CONFIGURATION.disableWatchDogTerminateLog) console.warn(`Scripting Error: Try chopping or inspecting smaller trees or different angle.`);
    }
    console.warn(`Watchdog Error: ${(e.terminateReason as WatchdogTerminateReason)}`)
});

world.afterEvents.playerLeave.subscribe((e: PlayerLeaveAfterEvent) => {
    playerInteractionMap.set(e.playerId, false);
    delete playerBeingShown[e.playerId];
});

// Put this to each player.
let blocksVisited: BlockGraph = new BlockGraph();

world.afterEvents.playerBreakBlock.subscribe((e: PlayerBreakBlockAfterEvent) => {
    const { dimension, player, block } = e;
    const currentBreakBlock: BlockPermutation = e.brokenBlockPermutation;
    const blockTypeId: string = currentBreakBlock.type.id;
    system.run(async () => await treeCut(player, dimension, block, blockTypeId, blocksVisited));
});

world.beforeEvents.itemUseOn.subscribe(async (e: ItemUseOnBeforeEvent) => {
    const currentHeldAxe: ItemStack = e.itemStack;
    const blockInteracted: Block = e.block as Block;
    const player: Player = e.source as Player;

    const oldLog: number = logMap.get(player.name);
    logMap.set(player.name, Date.now());
    if ((oldLog + 1_000) >= Date.now()) return;
    if (!axeEquipments.includes(currentHeldAxe.typeId) || !isLogIncluded(blockInteracted.typeId)) return;
    if(playerInteractionMap.get(player.id)) return;
    playerInteractionMap.set(player.id, true);

    //! MAKE THIS D-R-Y
    const itemDurability: ItemDurabilityComponent = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId) as ItemDurabilityComponent;
    const enchantments: ItemEnchantableComponent = (currentHeldAxe.getComponent(ItemEnchantableComponent.componentId) as ItemEnchantableComponent);
    const level: number = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
    const currentDurability: number = itemDurability.damage;
    const maxDurability: number = itemDurability.maxDurability;
    const unbreakingMultiplier: number = (100 / (level + 1)) / 100;
    const unbreakingDamage: number = SERVER_CONFIGURATION.durabilityDamagePerBlock * unbreakingMultiplier;
    const reachableLogs: number = (maxDurability - currentDurability) / unbreakingDamage;
    
    let tree: BlockGraph;
    let size: number;
    if(blocksVisited.size){
        tree = blocksVisited.filter(block => isLogIncluded(block?.typeId));
        size = tree.traverse(blockInteracted, "bfs").size;
    } else {
        tree = await getTreeLogs(player.dimension, blockInteracted, blockInteracted.typeId, reachableLogs);
        size = tree.size;
    }
    blocksVisited = tree;
    //Todo: Make this reset when I interact it again, so it doesn't repeatedly execute in the future.
    system.runTimeout(() => {
        blocksVisited.clear();
        player.sendMessage("Reseted");
    }, 80);

    const totalDamage: number = (size) * unbreakingDamage;
    const totalDurabilityConsumed: number = currentDurability + totalDamage;
    const canBeChopped: boolean = (totalDurabilityConsumed === maxDurability) || (totalDurabilityConsumed < maxDurability);
    const inspectionForm: ActionFormData = new ActionFormData()
    .title({
        rawtext: [
        {
            translate: "LumberAxe.form.title.text"
        }
        ]})
    .button(
        {
            rawtext: [
            {
                translate: `LumberAxe.form.treeSizeAbrev.text`
            },
            {
                text: ` ${size !== 0 ? size : 1}${canBeChopped ? "" : "+" } `
            },
            {
                translate: `LumberAxe.form.treeSizeAbrevLogs.text`
            }
        ]}, "textures/InfoUI/blocks.png")
    .button(
        {
            rawtext: [
            {
                translate: `LumberAxe.form.durabilityAbrev.text`
            },
            {
                text: ` ${currentDurability}`
            }
        ]}, "textures/InfoUI/axe_durability.png")
    .button(
        {
            rawtext: [
            {
                translate: `LumberAxe.form.maxDurabilityAbrev.text`
            },
            {
                text: ` ${maxDurability}`
            }
        ]}, "textures/InfoUI/required_durability.png")
    .button(
        {
            rawtext: [
            {
                text: "§l"
            },
            {
                translate: `${canBeChopped ? "LumberAxe.form.canBeChopped.text": "LumberAxe.form.cannotBeChopped.text"}`
            }
        ]}, "textures/InfoUI/canBeCut.png");
    
    system.run(() => {
        forceShow(player, inspectionForm).then((response: ActionFormResponse) => {
            playerInteractionMap.set(player.id, false);
            if(response.canceled || response.selection === undefined || response.cancelationReason === FormCancelationReason.UserClosed) return;
        }).catch((error: Error) => {
            console.warn("Form Error: ", error, error.stack);
        });
    });
});

world.beforeEvents.chatSend.subscribe((chat: ChatSendBeforeEvent) => {
    if (!chat.message.startsWith(CommandHandler.prefix)) return;
    chat.cancel = true;
    const player = chat.sender;
    const message = chat.message;
    const args = message.slice(CommandHandler.prefix.length).trim().split(/ +/g);
    const cmd = args.shift().toLowerCase();
    try {
        const CommandObject: ICommandBase = CommandRegistry.get(cmd);
        CommandObject.execute(chat, player, args);
    } catch (err) {
        if (err instanceof ReferenceError) {
            player.sendMessage(`§cInvalid Command ${cmd}\nCheck If The Command Actually Exists.`);
        } else {
            console.error(err);
        }
    }
});