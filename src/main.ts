import { world, ItemStack, MinecraftBlockTypes, GameMode, ItemLockMode, system, Dimension, Vector3, Block, BlockPermutation, Player, EntityInventoryComponent, ContainerSlot, ItemDurabilityComponent, ItemEnchantsComponent, ItemUseOnBeforeEvent, WatchdogTerminateBeforeEvent, WatchdogTerminateReason, EnchantmentList, PlayerLeaveAfterEventSignal, PlayerLeaveAfterEvent } from '@minecraft/server';
import { FormCancelationReason, ActionFormData, ActionFormResponse} from "@minecraft/server-ui";
import {config as Configuration} from "config";

const axeEquipments: string[] = [ "yn:wooden_lumber_axe", "yn:stone_lumber_axe", "yn:iron_lumber_axe", "yn:diamond_lumber_axe", "yn:golden_lumber_axe", "yn:netherite_lumber_axe" ];
const logMap: Map<string, number> = new Map<string, number>();
const playerInteractionMap: Map<string, boolean> = new Map<string, boolean>();
const validLogBlocks: RegExp = /(_log|crimson_stem|warped_stem)$/;

// Config
const {durabilityDamagePerBlock, chopLimit, excludedLog, includedLog} = Configuration

world.afterEvents.playerLeave.subscribe((e: PlayerLeaveAfterEvent) => {
    playerInteractionMap.set(e.playerId, false);
});

world.afterEvents.blockBreak.subscribe(async (e) => {
    const { dimension, player, block } = e;
    const currentBreakBlock: BlockPermutation = e.brokenBlockPermutation;
    const blockTypeId: string = currentBreakBlock.type.id;
    treeCut(player, dimension, block.location, blockTypeId);
});

world.beforeEvents.itemUseOn.subscribe(async (e: ItemUseOnBeforeEvent) => {
    const currentItemHeld: ItemStack = e.itemStack;
    const blockInteracted: Block = e.block;
    const player: Player = e.source as Player;
    const oldLog: number = logMap.get(player.name);
    logMap.set(player.name, Date.now());
    if ((oldLog + 1_000) >= Date.now()) return;
    if (!axeEquipments.includes(currentItemHeld.typeId) || !isLogIncluded(blockInteracted.typeId)) return;
    if(playerInteractionMap.get(player.id)) return;
    playerInteractionMap.set(player.id, true);
    const currentSlotItem: ItemStack = (player.getComponent(EntityInventoryComponent.componentId) as EntityInventoryComponent).container.getItem(player.selectedSlot);
    const itemDurability: ItemDurabilityComponent = currentSlotItem.getComponent(ItemDurabilityComponent.componentId) as ItemDurabilityComponent;
    const enchantments: EnchantmentList = (currentSlotItem?.getComponent(ItemEnchantsComponent.componentId) as ItemEnchantsComponent)?.enchantments;
    const level: number = enchantments.hasEnchantment('unbreaking');
    const currentDurability = itemDurability.damage;
    const maxDurability = itemDurability.maxDurability;
    const unbreakingMultiplier: number = (100 / (level + 1)) / 100;
    const unbreakingDamage: number = durabilityDamagePerBlock * unbreakingMultiplier;
    const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
    getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs).then((treeInteracted: Set<string>) => {
        const totalDamage: number = (treeInteracted.size) * unbreakingDamage;
        const totalDurabilityConsumed: number = currentDurability + totalDamage;
        const canBeChopped: boolean = (totalDurabilityConsumed >= maxDurability) ? false : true;

        const inspectionForm: ActionFormData = new ActionFormData()
            .title("LOG INFORMATION")
            .button(`HAS ${treeInteracted.size}${canBeChopped ? "" : "+" } LOG/S`, "textures/InfoUI/blocks.png")
            .button(`DMG: ${currentDurability}`, "textures/InfoUI/axe_durability.png")
            .button(`MAX: ${maxDurability}`, "textures/InfoUI/required_durability.png")
            .button(`§l${canBeChopped ? "§aChoppable": "§cCannot be chopped"}`, "textures/InfoUI/canBeCut.png");

        forceShow(player, inspectionForm).then((response: ActionFormResponse) => {
            playerInteractionMap.set(player.id, false);
            if(response.canceled || response.selection === undefined || response.cancelationReason === FormCancelationReason.userClosed) return;
        }).catch((error: Error) => {
            console.warn("Form Error: ", error, error.stack);
        });
    }).catch((error: Error) => {
        console.warn("Tree Error: ", error, error.stack);
        playerInteractionMap.set(player.id, false);
    });
});

function isLogIncluded(blockTypeId: string): boolean {
    return (
        ((excludedLog.includes(blockTypeId) && 
        !includedLog.includes(blockTypeId)) ||
        blockTypeId.includes('stripped_'))  != 
        validLogBlocks.test(blockTypeId)
    )
}

async function getTreeLogs(dimension: Dimension, location: Vector3, blockTypeId: string, maxNeeded: number): Promise<Set<string>> {
    // Modified Version
    // Author: Lete114 <https://github.com/Lete114>
    // Project: https://github.com/mcbe-mods/Cut-tree-one-click
    const visited: Set<string> = new Set();
    let queue: Block[] = getBlockNear(dimension, location);
    while (queue.length > 0) {
        if(visited.size >= chopLimit) return visited;
        if(visited.size >= maxNeeded) return visited;
        const _block: Block = queue.shift();
        if (!_block || !isLogIncluded(_block?.typeId)) continue;
        if (_block.typeId !== blockTypeId) continue;
        const pos: string = JSON.stringify(_block.location);
        if (visited.has(pos)) continue;
        visited.add(pos);
        queue.push(...getBlockNear(dimension, _block.location));
    }
    queue = [];
    return visited;
}
async function treeCut(player: Player, dimension: Dimension, location: Vector3, blockTypeId: string): Promise<void> {
    // Modified Version
    // Author: Lete114 <https://github.com/Lete114>
    // Project: https://github.com/mcbe-mods/Cut-tree-one-click
    const currentSlot: number = player.selectedSlot;
    const inventory: EntityInventoryComponent = player.getComponent('inventory') as EntityInventoryComponent;
    const currentSlotItem: ItemStack = inventory.container.getItem(currentSlot);
    const axeSlot: ContainerSlot = inventory.container.getSlot(currentSlot);
    if (!axeEquipments.includes(currentSlotItem?.typeId)) return;
    if (!isLogIncluded(blockTypeId)) return;

    const isSurvivalMode: boolean = isGameModeSurvival(player);
    if (!isSurvivalMode) return;
    if (isSurvivalMode) axeSlot.lockMode = ItemLockMode.slot;
    const itemDurability: ItemDurabilityComponent = currentSlotItem.getComponent('minecraft:durability') as ItemDurabilityComponent;
    const enchantments: ItemEnchantsComponent = currentSlotItem.getComponent('minecraft:enchantments') as ItemEnchantsComponent;
    const level: number = enchantments.enchantments.hasEnchantment('unbreaking');
    let unbreakingMultiplier: number = (100 / (level + 1)) / 100;
    let unbreakingDamage: number = durabilityDamagePerBlock * unbreakingMultiplier;
    
    const visited: Set<string> = await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / durabilityDamagePerBlock);
    
    const totalDamage: number = visited.size * unbreakingDamage;
    const totalDurabilityConsumed: number = itemDurability.damage + totalDamage;
    const lastDurabilityConsumed: number = itemDurability.damage + durabilityDamagePerBlock;
    if (totalDurabilityConsumed >= lastDurabilityConsumed && lastDurabilityConsumed >= itemDurability.maxDurability) {
        axeSlot.lockMode = ItemLockMode.none;
        player.runCommand(`replaceitem entity @s slot.weapon.mainhand ${currentSlot} air`);
        return;
    } else if (totalDurabilityConsumed >= itemDurability.maxDurability) {
        axeSlot.lockMode = ItemLockMode.none;
        return;
    }
    itemDurability.damage = itemDurability.damage +  totalDamage;
    (inventory.container).setItem(currentSlot, currentSlotItem);
    axeSlot.lockMode = ItemLockMode.none;
    
    let blockLocation: Vector3 = null;
    let _block: Block = null;
    let deforestingInterval: number = system.runTimeout( async () => {
        for (let visit of visited) {
            blockLocation = JSON.parse(visit);
            _block = dimension.getBlock(blockLocation);
            _block.setType(MinecraftBlockTypes.air);
        }
        for(let group of stackDistribution(visited.size)) {
            dimension.spawnItem(new ItemStack(blockTypeId, group), location);
        }
        system.clearRun(deforestingInterval);
    }, 1);
}
function isGameModeSurvival(player: Player): boolean {
    // Modified Version
    // Author: Lete114 <https://github.com/Lete114>
    // Project: https://github.com/mcbe-mods/Cut-tree-one-click
    return player.dimension.getPlayers({ gameMode: GameMode.survival, name: player.name, location: player.location, maxDistance: 1, closest: 1 }).length > 0;
}
function stackDistribution(number: number, groupSize: number = 64): number[] {
    // Author: Lete114 <https://github.com/Lete114>
    // Project: https://github.com/mcbe-mods/Cut-tree-one-click
    const groups: number[] = [];
    while (number > 0) {
        const group: number = Math.min(number, groupSize);
        groups.push(group);
        number -= group;
    }
    return groups;
}
function getBlockNear(dimension: Dimension, location: Vector3, radius: number = 1): Block[] {
    // Modified Version
    // Author: Lete114 <https://github.com/Lete114>
    // Project: https://github.com/mcbe-mods/Cut-tree-one-click
    const centerX: number = location.x;
    const centerY: number = location.y;
    const centerZ: number = location.z;
    const positions: Block[] = [];
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                const _location: Vector3 = { x, y, z };
                const _block: Block = dimension.getBlock(_location);
                if(_block.isAir()) continue;
                positions.push(_block);
            }
        }
    }
    return positions;
}
async function forceShow(player: Player, form: ActionFormData, timeout: number = Infinity): Promise<ActionFormResponse> {
    // Script example for ScriptAPI
    // Author: Jayly#1397 <Jayly Discord>
    //         Worldwidebrine#9037 <Bedrock Add-Ons>
    // Project: https://github.com/JaylyDev/ScriptAPI
    const startTick: number = system.currentTick;
    while ((system.currentTick - startTick) < timeout) {
        const response: ActionFormResponse = await (form.show(player)).catch(er=>console.error(er,er.stack)) as ActionFormResponse;
        if (response.cancelationReason !== FormCancelationReason.userBusy) {
            return response;
        }
    };
    throw new Error(`Timed out after ${timeout} ticks`);
};

system.events.beforeWatchdogTerminate.subscribe((e: WatchdogTerminateBeforeEvent) => {
    e.cancel = true;
    if(e.terminateReason === WatchdogTerminateReason.hang){
        for(const key of playerInteractionMap.keys()) {
            playerInteractionMap.set(key, false);
        }
        world.sendMessage(`Scripting Error: Try chopping or inspecting smaller trees or different angle.`);
    }
    console.warn(`Watchdog Error: ${(e.terminateReason as WatchdogTerminateReason)}`)
});