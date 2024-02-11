import { world, ItemStack, system, Block, BlockPermutation, Player, ItemDurabilityComponent, ItemEnchantableComponent, ItemUseOnBeforeEvent, WatchdogTerminateBeforeEvent, WatchdogTerminateReason, PlayerLeaveAfterEvent, PlayerBreakBlockAfterEvent, EnchantmentType, EnchantmentTypes } from '@minecraft/server';
import { FormCancelationReason, ActionFormData, ActionFormResponse} from "@minecraft/server-ui";
import { disableWatchDogTerminateLog, durabilityDamagePerBlock ,axeEquipments, forceShow, getTreeLogs, isLogIncluded, treeCut} from "./index"
import { MinecraftEnchantmentTypes } from './modules/vanilla-types/index';

const logMap: Map<string, number> = new Map<string, number>();
const playerInteractionMap: Map<string, boolean> = new Map<string, boolean>();

system.beforeEvents.watchdogTerminate.subscribe((e: WatchdogTerminateBeforeEvent) => {
    e.cancel = true;
    if(e.terminateReason === WatchdogTerminateReason.Hang){
        for(const key of playerInteractionMap.keys()) {
            playerInteractionMap.set(key, false);
        }
        if(!disableWatchDogTerminateLog) world.sendMessage({
            rawtext: [
            {
                translate: "LumberAxe.watchdogError.hang.text"
            }
        ]});
        if(disableWatchDogTerminateLog) console.warn(`Scripting Error: Try chopping or inspecting smaller trees or different angle.`);
    }
    console.warn(`Watchdog Error: ${(e.terminateReason as WatchdogTerminateReason)}`)
});

world.afterEvents.playerLeave.subscribe((e: PlayerLeaveAfterEvent) => {
    playerInteractionMap.set(e.playerId, false);
});

world.afterEvents.playerBreakBlock.subscribe(async (e: PlayerBreakBlockAfterEvent) => {
    const { dimension, player, block } = e;
    const currentBreakBlock: BlockPermutation = e.brokenBlockPermutation;
    const blockTypeId: string = currentBreakBlock.type.id;
    treeCut(player, dimension, block.location, blockTypeId);
});

world.beforeEvents.itemUseOn.subscribe((e: ItemUseOnBeforeEvent) => {
    const currentHeldAxe: ItemStack = e.itemStack;
    const blockInteracted: Block = e.block; //! NEEDED
    const player: Player = e.source as Player; //! NEEDED

    const oldLog: number = logMap.get(player.name);
    logMap.set(player.name, Date.now());
    if ((oldLog + 1_000) >= Date.now()) return;
    if (!axeEquipments.includes(currentHeldAxe.typeId) || !isLogIncluded(blockInteracted.typeId)) return;
    if(playerInteractionMap.get(player.id)) return;
    playerInteractionMap.set(player.id, true);

    //! MAKE THIS D-R-Y
    const itemDurability: ItemDurabilityComponent = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId) as ItemDurabilityComponent;
    const enchantments: ItemEnchantableComponent = (currentHeldAxe.getComponent(ItemEnchantableComponent.componentId) as ItemEnchantableComponent);
    console.warn(JSON.stringify(enchantments));
    const level: number = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level;
    const currentDurability = itemDurability.damage;
    const maxDurability = itemDurability.maxDurability;
    const unbreakingMultiplier: number = (100 / (level + 1)) / 100;
    const unbreakingDamage: number = durabilityDamagePerBlock * unbreakingMultiplier;
    const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
    getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1).then( (treeCollected: Set<string>) => {
        const totalDamage: number = (treeCollected.size) * unbreakingDamage;
        const totalDurabilityConsumed: number = currentDurability + totalDamage;
        const canBeChopped: boolean = ((totalDurabilityConsumed === maxDurability) || (totalDurabilityConsumed < maxDurability));
        
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
                        text: ` ${treeCollected.size !== 0 ? treeCollected.size : 1}${canBeChopped ? "" : "+" } `
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
        forceShow(player, inspectionForm).then((response: ActionFormResponse) => {
            playerInteractionMap.set(player.id, false);
            if(response.canceled || response.selection === undefined || response.cancelationReason === FormCancelationReason.UserClosed) return;
        }).catch((error: Error) => {
            console.warn("Form Error: ", error, error.stack);
        });
    }).catch((error: Error) => {
        console.warn("Tree Error: ", error, error.stack);
        playerInteractionMap.set(player.id, false);
    });
});