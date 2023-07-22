import { world, ItemStack, MinecraftBlockTypes, GameMode, ItemLockMode, system, Dimension, Vector3, Block, BlockPermutation, Player, EntityInventoryComponent, ContainerSlot, ItemDurabilityComponent, ItemEnchantsComponent, ItemUseOnBeforeEvent, WatchdogTerminateBeforeEvent, WatchdogTerminateReason, EnchantmentList, PlayerLeaveAfterEvent, EntityEquipmentInventoryComponent, MinecraftItemTypes, EquipmentSlot } from '@minecraft/server';
import { FormCancelationReason, ActionFormData, ActionFormResponse} from "@minecraft/server-ui";
import {config as Configuration} from "./config";


const axeEquipments: string[] = [ "yn:wooden_lumber_axe", "yn:stone_lumber_axe", "yn:iron_lumber_axe", "yn:diamond_lumber_axe", "yn:golden_lumber_axe", "yn:netherite_lumber_axe" ];
const logMap: Map<string, number> = new Map<string, number>();
const playerInteractionMap: Map<string, boolean> = new Map<string, boolean>();
const validLogBlocks: RegExp = /(_log|crimson_stem|warped_stem)$/;

// Config
const {durabilityDamagePerBlock, chopLimit, excludedLog, includedLog, disableWatchDogTerminateLog} = Configuration

system.beforeEvents.watchdogTerminate.subscribe((e: WatchdogTerminateBeforeEvent) => {
    e.cancel = true;
    if(e.terminateReason === WatchdogTerminateReason.Hang){
        for(const key of playerInteractionMap.keys()) {
            playerInteractionMap.set(key, false);
        }
        if(!disableWatchDogTerminateLog) world.sendMessage(`Scripting Error: Try chopping or inspecting smaller trees or different angle.`);
        if(disableWatchDogTerminateLog) console.warn(`Scripting Error: Try chopping or inspecting smaller trees or different angle.`);
    }
    console.warn(`Watchdog Error: ${(e.terminateReason as WatchdogTerminateReason)}`)
});

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
    const enchantments: EnchantmentList = (currentHeldAxe?.getComponent(ItemEnchantsComponent.componentId) as ItemEnchantsComponent)?.enchantments;
    const level: number = enchantments.hasEnchantment('unbreaking');
    const currentDurability = itemDurability.damage;
    const maxDurability = itemDurability.maxDurability;
    const unbreakingMultiplier: number = (100 / (level + 1)) / 100;
    const unbreakingDamage: number = durabilityDamagePerBlock * unbreakingMultiplier;
    const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;

    getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1).then(async(treeCollected: Set<string>) => {
        const totalDamage: number = (treeCollected.size) * unbreakingDamage;
        const totalDurabilityConsumed: number = currentDurability + totalDamage;
        const canBeChopped: boolean = (totalDurabilityConsumed === maxDurability) || (totalDurabilityConsumed < maxDurability);
        
        const inspectionForm: ActionFormData = new ActionFormData()
            .title("LOG INFORMATION")
            .button(`HAS ${treeCollected.size}${canBeChopped ? "" : "+" } LOG/S`, "textures/InfoUI/blocks.png")
            .button(`DMG: ${currentDurability}`, "textures/InfoUI/axe_durability.png")
            .button(`MAX: ${maxDurability}`, "textures/InfoUI/required_durability.png")
            .button(`§l${canBeChopped ? "§aChoppable": "§cCannot be chopped"}`, "textures/InfoUI/canBeCut.png");

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

async function treeCut(player: Player, dimension: Dimension, location: Vector3, blockTypeId: string): Promise<void> {
    // Modified Version
    // Author: Lete114 <https://github.com/Lete114>
    // Project: https://github.com/mcbe-mods/Cut-tree-one-click

    //! Make Lumberjack (extends Player) Interface / class for this.
    const equipment = player.getComponent(EntityEquipmentInventoryComponent.componentId) as EntityEquipmentInventoryComponent;
    const currentHeldAxe = equipment.getEquipment(EquipmentSlot.mainhand);
    if (!axeEquipments.includes(currentHeldAxe?.typeId)) return;
    if (!isLogIncluded(blockTypeId)) return;

    const isSurvivalMode: boolean = isGameModeSurvival(player);
    if (!isSurvivalMode) return;
    if (isSurvivalMode) currentHeldAxe.lockMode = ItemLockMode.slot;

    //! MAKE THIS D-R-Y
    const itemDurability: ItemDurabilityComponent = currentHeldAxe.getComponent('minecraft:durability') as ItemDurabilityComponent;
    const enchantments: EnchantmentList = (currentHeldAxe.getComponent('minecraft:enchantments') as ItemEnchantsComponent).enchantments;
    const level: number = enchantments.hasEnchantment('unbreaking');
    const unbreakingMultiplier: number = (100 / (level + 1)) / 100;
    const unbreakingDamage: number = durabilityDamagePerBlock * unbreakingMultiplier;
    
    const visited: Set<string> = await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage);
    
    const totalDamage: number = visited.size * unbreakingDamage;
    const totalDurabilityConsumed: number = itemDurability.damage + totalDamage;

    //! USE Lumberjack Axe Interface / Class for this
    // Check if durabiliy is exact that can chop the tree but broke the axe, then broke it.
    if (totalDurabilityConsumed + 1 === itemDurability.maxDurability) {
        equipment.setEquipment(EquipmentSlot.mainhand, undefined);
    // Check if the durability is not enough to chop the tree. Then don't apply the 3 damage.
    } else if (totalDurabilityConsumed > itemDurability.maxDurability) {
        currentHeldAxe.lockMode = ItemLockMode.none;
        return;
    // Check if total durability will consume is still enough and not near the max durability
    } else if (totalDurabilityConsumed < itemDurability.maxDurability){
        itemDurability.damage = itemDurability.damage +  totalDamage;
        currentHeldAxe.lockMode = ItemLockMode.none;
        equipment.setEquipment(EquipmentSlot.mainhand, currentHeldAxe.clone());
    }
    
    //! Lumberjack Axe Interface / Class
    for await (const group of groupAdjacentBlocks(visited)) {
        const firstElement = JSON.parse(group[0]);
        const lastElement = JSON.parse(group[group.length - 1]);
        if (firstElement === lastElement) {
            dimension.getBlock(firstElement).setType(MinecraftBlockTypes.air);
            continue;
        } else {
            dimension.fillBlocks(firstElement, lastElement, MinecraftBlockTypes.air);
        }
    }
    
    for await (const group of stackDistribution(visited.size)) {
        dimension.spawnItem(new ItemStack(blockTypeId, group), location);
    }
}

function isLogIncluded(blockTypeId: string): boolean {
    if(excludedLog.includes(blockTypeId) || blockTypeId.includes('stripped_')) return false;
    if(includedLog.includes(blockTypeId) || validLogBlocks.test(blockTypeId)) return true;
    return false;
}

async function getTreeLogs(dimension: Dimension, location: Vector3, blockTypeId: string, maxNeeded: number): Promise<Set<string>> {
    // Modified Version
    // Author: Lete114 <https://github.com/Lete114>
    // Project: https://github.com/mcbe-mods/Cut-tree-one-click
    const visited: Set<string> = new Set<string>();
    let queue: Block[] = getBlockNear(dimension, location);
    while (queue.length > 0) {
        if(visited.size >= chopLimit) {
            console.warn(`Limit: ${visited.size}`);
            return visited;
        }
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

// Gets all the visited blocks and groups them together. O(1) | O(log n) | O(n)
function groupAdjacentBlocks(visited: Set<string>): string[][] {
    // Author: Adr-hyng <https://github.com/Adr-hyng>
    // Project: https://github.com/Adr-hyng-OSS/Lumber-Axe
    // Convert Set to Array and parse each string to JSON object
    const array = Array.from(visited).map(item => JSON.parse(item));

    // Sort the array based on "x", "z", and "y"
    array.sort((a, b) => a.x - b.x || a.z - b.z || a.y - b.y);

    const groups: string[][] = [];
    let currentGroup: string[] = [];

    for (let i = 0; i < array.length; i++) {
        // If it's the first element or "x" and "z" didn't change and "y" difference is less or equal to 2, add it to the current group
        if (i === 0 || (array[i].x === array[i - 1].x && array[i].z === array[i - 1].z && Math.abs(array[i].y - JSON.parse(currentGroup[currentGroup.length - 1]).y) <= 2)) {
            currentGroup.push(JSON.stringify(array[i]));
        } else {
            // Otherwise, add the current group to the groups array and start a new group
            groups.push(currentGroup);
            currentGroup = [JSON.stringify(array[i])];
        }
    }
    // Add the last group to the groups array
    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }
    return groups;
}

// Calculates the amount of items to be dropped in each stack. O(1)
function stackDistribution(number: number, groupSize: number = 64): number[] {
    // Author: Adr-hyng <https://github.com/Adr-hyng>
    // Project: https://github.com/Adr-hyng-OSS/Lumber-Axe
    const fullGroupsCount = Math.floor(number / groupSize);
    const remainder = number % groupSize;
    // Create an array with the size of each full group
    const groups = new Array(fullGroupsCount).fill(groupSize);
    // If there's a remainder, add it as the last group
    if (remainder > 0) {
        groups.push(remainder);
    }

    return groups;
}

function isGameModeSurvival(player: Player): boolean {
    // Modified Version
    // Author: Lete114 <https://github.com/Lete114>
    // Project: https://github.com/mcbe-mods/Cut-tree-one-click
    return player.dimension.getPlayers({ gameMode: GameMode.survival, name: player.name, location: player.location, maxDistance: 1, closest: 1 }).length > 0;
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
        if (response.cancelationReason !== FormCancelationReason.UserBusy) {
            return response;
        }
    };
    throw new Error(`Timed out after ${timeout} ticks`);
}
