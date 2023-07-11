import { world, ItemStack, MinecraftBlockTypes, GameMode, ItemLockMode, system, Dimension, Vector3, Block, BlockPermutation, Player, EntityInventoryComponent, ContainerSlot, ItemDurabilityComponent, ItemEnchantsComponent } from '@minecraft/server';
const axeEquipments: string[] = ["minecraft:wooden_axe", "minecraft:stone_axe", "minecraft:golden_axe", "minecraft:iron_axe", "minecraft:diamond_axe", "minecraft:netherite_axe"];
const durabilityDamagePerBlock: number = 5;

/**
 * Version: 1.20.x
 * To-Do:
 * - Config: DurabilityDamagePerBlock, includedBlocks, excludedBlocks, chopLimit = 300 (1000 Max), includeWoodBlocks (block endswith _wood)
 * - Modal for: Total Blocks Inspected, Required Durability, Current Durability / Max Durability, canBeChopped.
 * - Particle Splash depending on the block type texture.
 */

world.afterEvents.blockBreak.subscribe(async (e) => {
    const { dimension, player, block } = e;
    const currentBreakBlock: BlockPermutation = e.brokenBlockPermutation;
    const blockTypeId: string = currentBreakBlock.type.id;
    
    treeCut(player, dimension, block.location, blockTypeId);
});
async function getTreeLogs(dimension: Dimension, location: Vector3, blockTypeId: string): Promise<Set<string>> {
    const visited: Set<string> = new Set();
    let stack: Block[] = [...getBlockNear(dimension, location)];
    while (stack.length > 0) {
        const _block: Block = stack.shift();
        if (!_block || _block?.typeId.includes('stripped_')) continue;
        const typeId: string = _block.typeId;
        const reg: RegExp = /(_log|crimson_stem|warped_stem)$/;
        if (reg.test(typeId) && typeId === blockTypeId) {
            const pos: string = JSON.stringify(_block.location);
            if (visited.has(pos)) continue;
            visited.add(pos);
            stack.push(...getBlockNear(dimension, _block.location));
        }
    }
    return visited;
}
async function treeCut(player: Player, dimension: Dimension, location: Vector3, blockTypeId: string): Promise<void> {
    const currentSlot: number = player.selectedSlot;
    const inventory: EntityInventoryComponent = player.getComponent('inventory') as EntityInventoryComponent;
    const currentSlotItem: ItemStack = inventory.container.getItem(currentSlot);
    const axeSlot: ContainerSlot = inventory.container.getSlot(currentSlot);
    if (!axeEquipments.includes(currentSlotItem?.typeId)) return;
    const isSurvivalMode: boolean = isGameModeSurvival(player);
    if (isSurvivalMode) axeSlot.lockMode = ItemLockMode.slot;
    const itemDurability: ItemDurabilityComponent = currentSlotItem.getComponent('minecraft:durability') as ItemDurabilityComponent;
    const enchantments: ItemEnchantsComponent = currentSlotItem.getComponent('minecraft:enchantments') as ItemEnchantsComponent;
    const level: number = enchantments.enchantments.hasEnchantment('unbreaking');
    let unbreakingMultiplier: number = (100 / (level + 1)) / 100;
    let unbreakingDamage: number = durabilityDamagePerBlock * unbreakingMultiplier;
    if (!isSurvivalMode) return;
    const visited: Set<string> = await getTreeLogs(dimension, location, blockTypeId);
    
    const totalDamage: number = (visited.size+1) * unbreakingDamage;
    const totalDurabilityConsumed: number = itemDurability.damage + totalDamage;
    const lastDurabilityConsumed: number = itemDurability.damage + durabilityDamagePerBlock;
    if (totalDurabilityConsumed >= lastDurabilityConsumed && lastDurabilityConsumed >= itemDurability.maxDurability) {
        axeSlot.lockMode = ItemLockMode.none;
        player.runCommand(`replaceitem entity @s slot.weapon.mainhand ${currentSlot} air`);
        world.sendMessage(`Your ${currentSlotItem?.typeId} is broken`);
        return;
    } else if (totalDurabilityConsumed >= itemDurability.maxDurability) {
        axeSlot.lockMode = ItemLockMode.none;
        world.sendMessage(`You cannot chop this. You need ${(itemDurability.damage + totalDamage) - itemDurability.maxDurability}`);
        return;
    }
    itemDurability.damage = itemDurability.damage +  totalDamage;
    (inventory.container).setItem(currentSlot, currentSlotItem);
    axeSlot.lockMode = ItemLockMode.none;
    
    let blockLocation: Vector3 = null;
    let _block: Block = null;
    let deforestingInterval = system.runTimeout( async () => {
        for (let visit of visited) {
            blockLocation = JSON.parse(visit);
            _block = dimension.getBlock(blockLocation);
            _block.setType(MinecraftBlockTypes.air);
        }
        for(let group of splitGroups(visited.size)) {
            dimension.spawnItem(new ItemStack(blockTypeId, group), location);
        }
        system.clearRun(deforestingInterval);
    }, 1);
}
function isGameModeSurvival(player: Player) {
    return player.dimension.getPlayers({ gameMode: GameMode.survival, name: player.name, location: player.location, maxDistance: 1, closest: 1 }).length > 0;
}
function splitGroups(number: number, groupSize: number = 64): number[] {
    const groups: number[] = [];
    while (number > 0) {
        const group: number = Math.min(number, groupSize);
        groups.push(group);
        number -= group;
    }
    return groups;
}
function getBlockNear(dimension: Dimension, location: Vector3, radius: number = 1): Block[] {
    const centerX: number = location.x;
    const centerY: number = location.y;
    const centerZ: number = location.z;
    const positions: Block[] = [];
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                const _location: Vector3 = { x, y, z };
                const _block: Block = dimension.getBlock(_location);
                positions.push(_block);
            }
        }
    }
    return positions;
}
