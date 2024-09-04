import { Block, Dimension, Entity, EntityEquippableComponent, EquipmentSlot, ItemDurabilityComponent, ItemEnchantableComponent, ItemLockMode, ItemStack, Player, System, Vector3, system } from "@minecraft/server";
import { MinecraftBlockTypes, MinecraftEnchantmentTypes} from "../modules/vanilla-types/index";

import { validLogBlocks, axeEquipments, stackDistribution, serverConfigurationCopy } from "../index";


function treeCut(player: Player, dimension: Dimension, location: Vector3, blockTypeId: string): void {
    const equipment = player.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent;
    const currentHeldAxe = equipment.getEquipment(EquipmentSlot.Mainhand);
    if (!axeEquipments.includes(currentHeldAxe?.typeId)) return;

    if (!player.isSurvival()) return;
    if (player.isSurvival()) currentHeldAxe.lockMode = ItemLockMode.slot;

    const itemDurability: ItemDurabilityComponent = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId) as ItemDurabilityComponent;
    const enchantments: ItemEnchantableComponent = (currentHeldAxe.getComponent(ItemEnchantableComponent.componentId) as ItemEnchantableComponent);
    const level: number = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
    const unbreakingMultiplier: number = (100 / (level + 1)) / 100;
    const unbreakingDamage: number = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
    
    system.run(async () => {

        const visited: Set<string> = (await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / unbreakingDamage) as VisitedBlockResult).visited;
        const totalDamage: number = visited.size * unbreakingDamage;
        const postDamagedDurability: number = itemDurability.damage + totalDamage;
    
        // Check if durabiliy is exact that can chop the tree but broke the axe, then broke it.
        if (postDamagedDurability + 1 === itemDurability.maxDurability) {
            equipment.setEquipment(EquipmentSlot.Mainhand, undefined);
        // Check if the durability is not enough to chop the tree. Then don't apply the 3 damage.
        } else if (postDamagedDurability > itemDurability.maxDurability) {
            currentHeldAxe.lockMode = ItemLockMode.none;
            return;
        // Check if total durability will consume is still enough and not near the max durability
        } else if (postDamagedDurability < itemDurability.maxDurability){
            itemDurability.damage = itemDurability.damage +  totalDamage;
            currentHeldAxe.lockMode = ItemLockMode.none;
            equipment.setEquipment(EquipmentSlot.Mainhand, currentHeldAxe.clone());
        }
        
        //! Use this when fillBlocks is in stable.
        // for (const group of groupAdjacentBlocks(visited)) {
        //     const firstElement = JSON.parse(group[0]);
        //     const lastElement = JSON.parse(group[group.length - 1]);
        //     if (firstElement === lastElement) {
        //         dimension.getBlock(firstElement).setType(MinecraftBlockTypes.Air);
        //         continue;
        //     } else {
        //         dimension.fillBlocks(firstElement, lastElement, MinecraftBlockTypes.Air);
        //     }
        // }
        for(const visitedLogLocation of visited) {
            system.run(() => dimension.setBlockType(JSON.parse(visitedLogLocation), MinecraftBlockTypes.Air));
        }
        
        system.runTimeout( () => {
            for (const group of stackDistribution(visited.size)) {
                system.run(() => dimension.spawnItem(new ItemStack(blockTypeId, group), location));
            }
        }, 5);
    });
}

function isLogIncluded(blockTypeId: string): boolean {
    if(serverConfigurationCopy.excludedLog.values.includes(blockTypeId) || blockTypeId.includes('stripped_')) return false;
    if(serverConfigurationCopy.includedLog.values.includes(blockTypeId) || validLogBlocks.test(blockTypeId)) return true;
    return false;
}

export type VisitedBlockResult = {
    visited: Set<string>;
    blockOutlines: Entity[];
}

function getTreeLogs(dimension: Dimension, location: Vector3, blockTypeId: string, maxNeeded: number): Promise<VisitedBlockResult> {
    return new Promise<VisitedBlockResult>((resolve) => {
        const traversingTreeInterval: number = system.runJob(function*(){
            const _visited: Set<string> = new Set<string>();
            const _blockOutlines: Entity[] = [];
            let queue: Block[] = getBlockNearInitialize(dimension, location);
            while (queue.length > 0) {
                if(_visited.size >= parseInt(serverConfigurationCopy.chopLimit.defaultValue + "") || _visited.size >= maxNeeded) {
                    system.clearJob(traversingTreeInterval);
                    resolve({visited: _visited, blockOutlines: _blockOutlines});
                }
                const _block: Block = queue.shift();
                if (!_block?.isValid() || !isLogIncluded(_block?.typeId)) continue;
                if (_block.typeId !== blockTypeId) continue;
                const pos: string = JSON.stringify(_block.location);
                if (_visited.has(pos)) continue;
                _visited.add(pos);
                const block = dimension.spawnEntity('outlined_entities:example', {x: _block.x + 0.5, y: _block.y, z: _block.z + 0.5});
                block.triggerEvent("status.active.set");
                _blockOutlines.push(block);
                for(const block of getBlockNear(dimension, _block.location)) {
                    queue.push(block);
                    yield;
                }
                yield;
            }
            queue = [];
            system.clearJob(traversingTreeInterval);
            resolve({visited: _visited, blockOutlines: _blockOutlines});
        }());
    });
}

function* getBlockNear(dimension: Dimension, location: Vector3, radius: number = 1): Generator< Block, any, unknown> {
    const centerX: number = location.x;
    const centerY: number = location.y;
    const centerZ: number = location.z;
    let _block: Block;
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                if(centerX === x && centerY === y && centerZ === z) continue;
                _block = dimension.getBlock({ x, y, z });
                if(_block.isAir) continue;
                yield _block
            }
        }
    }
}

function getBlockNearInitialize(dimension: Dimension, location: Vector3, radius: number = 1): Block[] {
    const centerX: number = location.x;
    const centerY: number = location.y;
    const centerZ: number = location.z;
    const blocks: Block[] = [];
    let _block: Block;
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                if(centerX === x && centerY === y && centerZ === z) continue;
                _block = dimension.getBlock({ x, y, z });
                if(_block.isAir) continue;
                blocks.push(_block);
            }
        }
    }
    return blocks;
}

// Gets all the visited blocks and groups them together.
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