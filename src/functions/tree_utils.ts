import { Block, Dimension, EnchantmentList, EntityEquipmentInventoryComponent, EquipmentSlot, ItemDurabilityComponent, ItemEnchantsComponent, ItemLockMode, ItemStack, MinecraftBlockTypes, Player, Vector3, system } from "@minecraft/server";

import { validLogBlocks, axeEquipments, isGameModeSurvival, stackDistribution, durabilityDamagePerBlock, excludedLog, includedLog, chopLimit } from "../index";


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
    const postDamagedDurability: number = itemDurability.damage + totalDamage;

    //! USE Lumberjack Axe Interface / Class for this
    // Check if durabiliy is exact that can chop the tree but broke the axe, then broke it.
    if (postDamagedDurability + 1 === itemDurability.maxDurability) {
        equipment.setEquipment(EquipmentSlot.mainhand, undefined);
    // Check if the durability is not enough to chop the tree. Then don't apply the 3 damage.
    } else if (postDamagedDurability > itemDurability.maxDurability) {
        currentHeldAxe.lockMode = ItemLockMode.none;
        return;
    // Check if total durability will consume is still enough and not near the max durability
    } else if (postDamagedDurability < itemDurability.maxDurability){
        itemDurability.damage = itemDurability.damage +  totalDamage;
        currentHeldAxe.lockMode = ItemLockMode.none;
        equipment.setEquipment(EquipmentSlot.mainhand, currentHeldAxe.clone());
    }
    
    //! Lumberjack Axe Interface / Class
    for (const group of groupAdjacentBlocks(visited)) {
        const firstElement = JSON.parse(group[0]);
        const lastElement = JSON.parse(group[group.length - 1]);
        if (firstElement === lastElement) {
            await new Promise<void>((resolve) => {
                dimension.getBlock(firstElement).setType(MinecraftBlockTypes.air);
                resolve();
            });
            continue;
        } else {
            await new Promise<void>((resolve) => {
                dimension.fillBlocks(firstElement, lastElement, MinecraftBlockTypes.air);
                resolve();
            });
        }
    }
    
    for (const group of stackDistribution(visited.size)) {
        await new Promise<void>((resolve) => {
            dimension.spawnItem(new ItemStack(blockTypeId, group), location);
            resolve();
        });
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
        if(visited.size >= chopLimit || visited.size >= maxNeeded) {
            return visited;
        }
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

function getBlockNear(dimension: Dimension, location: Vector3, radius: number = 1): Block[] {
    // Modified Version
    // Author: Lete114 <https://github.com/Lete114>
    // Project: https://github.com/mcbe-mods/Cut-tree-one-click
    const centerX: number = location.x;
    const centerY: number = location.y;
    const centerZ: number = location.z;
    const positions: Block[] = [];
    let _block: Block;
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                if(centerX === x && centerY === y && centerZ === z) continue;
                _block = dimension.getBlock({ x, y, z });
                if(_block.isAir()) continue;
                positions.push(_block);
            }
        }
    }
    return positions;
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

export {treeCut, isLogIncluded, getTreeLogs}