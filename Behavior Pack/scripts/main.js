import { world, ItemStack, MinecraftBlockTypes, GameMode, ItemLockMode, system, EntityInventoryComponent, ItemDurabilityComponent, ItemEnchantsComponent, WatchdogTerminateReason } from '@minecraft/server';
import { FormCancelationReason, ActionFormData } from "@minecraft/server-ui";
import { config as Configuration } from "./config";
const axeEquipments = ["yn:wooden_lumber_axe", "yn:stone_lumber_axe", "yn:iron_lumber_axe", "yn:diamond_lumber_axe", "yn:golden_lumber_axe", "yn:netherite_lumber_axe"];
const logMap = new Map();
const playerInteractionMap = new Map();
const validLogBlocks = /(_log|crimson_stem|warped_stem)$/;
// Config
const { durabilityDamagePerBlock, chopLimit, excludedLog, includedLog } = Configuration;
world.afterEvents.playerLeave.subscribe((e) => {
    playerInteractionMap.set(e.playerId, false);
});
world.afterEvents.blockBreak.subscribe(async (e) => {
    const { dimension, player, block } = e;
    const currentBreakBlock = e.brokenBlockPermutation;
    const blockTypeId = currentBreakBlock.type.id;
    treeCut(player, dimension, block.location, blockTypeId);
});
world.beforeEvents.itemUseOn.subscribe(async (e) => {
    const currentItemHeld = e.itemStack;
    const blockInteracted = e.block;
    const player = e.source;
    const oldLog = logMap.get(player.name);
    logMap.set(player.name, Date.now());
    if ((oldLog + 1000) >= Date.now())
        return;
    if (!axeEquipments.includes(currentItemHeld.typeId) || !isLogIncluded(blockInteracted.typeId))
        return;
    if (playerInteractionMap.get(player.id))
        return;
    playerInteractionMap.set(player.id, true);
    const currentSlotItem = player.getComponent(EntityInventoryComponent.componentId).container.getItem(player.selectedSlot);
    const itemDurability = currentSlotItem.getComponent(ItemDurabilityComponent.componentId);
    const enchantments = currentSlotItem?.getComponent(ItemEnchantsComponent.componentId)?.enchantments;
    const level = enchantments.hasEnchantment('unbreaking');
    const currentDurability = itemDurability.damage;
    const maxDurability = itemDurability.maxDurability;
    const unbreakingMultiplier = (100 / (level + 1)) / 100;
    const unbreakingDamage = durabilityDamagePerBlock * unbreakingMultiplier;
    const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
    getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs).then((treeInteracted) => {
        const totalDamage = (treeInteracted.size) * unbreakingDamage;
        const totalDurabilityConsumed = currentDurability + totalDamage;
        const canBeChopped = (totalDurabilityConsumed >= maxDurability) ? false : true;
        const inspectionForm = new ActionFormData()
            .title("LOG INFORMATION")
            .button(`HAS ${treeInteracted.size}${canBeChopped ? "" : "+"} LOG/S`, "textures/InfoUI/blocks.png")
            .button(`DMG: ${currentDurability}`, "textures/InfoUI/axe_durability.png")
            .button(`MAX: ${maxDurability}`, "textures/InfoUI/required_durability.png")
            .button(`§l${canBeChopped ? "§aChoppable" : "§cCannot be chopped"}`, "textures/InfoUI/canBeCut.png");
        forceShow(player, inspectionForm).then((response) => {
            playerInteractionMap.set(player.id, false);
            if (response.canceled || response.selection === undefined || response.cancelationReason === FormCancelationReason.userClosed)
                return;
        }).catch((error) => {
            console.warn("Form Error: ", error, error.stack);
        });
    }).catch((error) => {
        console.warn("Tree Error: ", error, error.stack);
        playerInteractionMap.set(player.id, false);
    });
});
function isLogIncluded(blockTypeId) {
    if (excludedLog.includes(blockTypeId) || blockTypeId.includes('stripped_'))
        return false;
    if (includedLog.includes(blockTypeId) || validLogBlocks.test(blockTypeId))
        return true;
    return false;
}
async function getTreeLogs(dimension, location, blockTypeId, maxNeeded) {
    // Modified Version
    // Author: Lete114 <https://github.com/Lete114>
    // Project: https://github.com/mcbe-mods/Cut-tree-one-click
    const visited = new Set();
    let queue = getBlockNear(dimension, location);
    while (queue.length > 0) {
        if (visited.size >= chopLimit)
            return visited;
        if (visited.size >= maxNeeded)
            return visited;
        const _block = queue.shift();
        if (!_block || !isLogIncluded(_block?.typeId))
            continue;
        if (_block.typeId !== blockTypeId)
            continue;
        const pos = JSON.stringify(_block.location);
        if (visited.has(pos))
            continue;
        visited.add(pos);
        queue.push(...getBlockNear(dimension, _block.location));
    }
    queue = [];
    return visited;
}
async function treeCut(player, dimension, location, blockTypeId) {
    // Modified Version
    // Author: Lete114 <https://github.com/Lete114>
    // Project: https://github.com/mcbe-mods/Cut-tree-one-click
    const currentSlot = player.selectedSlot;
    const inventory = player.getComponent('inventory');
    const currentSlotItem = inventory.container.getItem(currentSlot);
    const axeSlot = inventory.container.getSlot(currentSlot);
    if (!axeEquipments.includes(currentSlotItem?.typeId))
        return;
    if (!isLogIncluded(blockTypeId))
        return;
    const isSurvivalMode = isGameModeSurvival(player);
    if (!isSurvivalMode)
        return;
    if (isSurvivalMode)
        axeSlot.lockMode = ItemLockMode.slot;
    const itemDurability = currentSlotItem.getComponent('minecraft:durability');
    const enchantments = currentSlotItem.getComponent('minecraft:enchantments');
    const level = enchantments.enchantments.hasEnchantment('unbreaking');
    let unbreakingMultiplier = (100 / (level + 1)) / 100;
    let unbreakingDamage = durabilityDamagePerBlock * unbreakingMultiplier;
    const visited = await getTreeLogs(dimension, location, blockTypeId, (itemDurability.maxDurability - itemDurability.damage) / durabilityDamagePerBlock);
    const totalDamage = visited.size * unbreakingDamage;
    const totalDurabilityConsumed = itemDurability.damage + totalDamage;
    const lastDurabilityConsumed = itemDurability.damage + durabilityDamagePerBlock;
    if (totalDurabilityConsumed >= lastDurabilityConsumed && lastDurabilityConsumed >= itemDurability.maxDurability) {
        axeSlot.lockMode = ItemLockMode.none;
        player.runCommand(`replaceitem entity @s slot.weapon.mainhand ${currentSlot} air`);
        return;
    }
    else if (totalDurabilityConsumed >= itemDurability.maxDurability) {
        axeSlot.lockMode = ItemLockMode.none;
        return;
    }
    itemDurability.damage = itemDurability.damage + totalDamage;
    (inventory.container).setItem(currentSlot, currentSlotItem);
    axeSlot.lockMode = ItemLockMode.none;
    let blockLocation = null;
    let _block = null;
    let deforestingInterval = system.runTimeout(async () => {
        for (let visit of visited) {
            blockLocation = JSON.parse(visit);
            _block = dimension.getBlock(blockLocation);
            _block.setType(MinecraftBlockTypes.air);
        }
        for (let group of stackDistribution(visited.size)) {
            dimension.spawnItem(new ItemStack(blockTypeId, group), location);
        }
        system.clearRun(deforestingInterval);
    }, 1);
}
function isGameModeSurvival(player) {
    // Modified Version
    // Author: Lete114 <https://github.com/Lete114>
    // Project: https://github.com/mcbe-mods/Cut-tree-one-click
    return player.dimension.getPlayers({ gameMode: GameMode.survival, name: player.name, location: player.location, maxDistance: 1, closest: 1 }).length > 0;
}
function stackDistribution(number, groupSize = 64) {
    // Author: Lete114 <https://github.com/Lete114>
    // Project: https://github.com/mcbe-mods/Cut-tree-one-click
    const groups = [];
    while (number > 0) {
        const group = Math.min(number, groupSize);
        groups.push(group);
        number -= group;
    }
    return groups;
}
function getBlockNear(dimension, location, radius = 1) {
    // Modified Version
    // Author: Lete114 <https://github.com/Lete114>
    // Project: https://github.com/mcbe-mods/Cut-tree-one-click
    const centerX = location.x;
    const centerY = location.y;
    const centerZ = location.z;
    const positions = [];
    for (let x = centerX - radius; x <= centerX + radius; x++) {
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
                const _location = { x, y, z };
                const _block = dimension.getBlock(_location);
                if (_block.isAir())
                    continue;
                positions.push(_block);
            }
        }
    }
    return positions;
}
async function forceShow(player, form, timeout = Infinity) {
    // Script example for ScriptAPI
    // Author: Jayly#1397 <Jayly Discord>
    //         Worldwidebrine#9037 <Bedrock Add-Ons>
    // Project: https://github.com/JaylyDev/ScriptAPI
    const startTick = system.currentTick;
    while ((system.currentTick - startTick) < timeout) {
        const response = await (form.show(player)).catch(er => console.error(er, er.stack));
        if (response.cancelationReason !== FormCancelationReason.userBusy) {
            return response;
        }
    }
    ;
    throw new Error(`Timed out after ${timeout} ticks`);
}
;
system.events.beforeWatchdogTerminate.subscribe((e) => {
    e.cancel = true;
    if (e.terminateReason === WatchdogTerminateReason.hang) {
        for (const key of playerInteractionMap.keys()) {
            playerInteractionMap.set(key, false);
        }
        world.sendMessage(`Scripting Error: Try chopping or inspecting smaller trees or different angle.`);
    }
    console.warn(`Watchdog Error: ${e.terminateReason}`);
});
