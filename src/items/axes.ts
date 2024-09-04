import { Block, BlockPermutation, Entity, EntityEquippableComponent, ItemDurabilityComponent, ItemEnchantableComponent, ItemStack, Player, system, TicksPerSecond, world } from "@minecraft/server";
import { ActionFormData, ActionFormResponse, FormCancelationReason } from "@minecraft/server-ui";
import { axeEquipments, forceShow, getTreeLogs, isLogIncluded, playerInteractedTimeLogMap, playerInteractionMap, serverConfigurationCopy, treeCut } from "index"
import { MinecraftEnchantmentTypes } from "modules/vanilla-types/index";
import { Logger } from "utils/logger";

const visitedLogs: Entity[][] = [];

world.beforeEvents.worldInitialize.subscribe((registry) => {
  registry.itemComponentRegistry.registerCustomComponent('yn:tool_durability', {
    onHitEntity(arg) {
      if(!(arg.attackingEntity instanceof Player)) return;
      const player: Player = arg.attackingEntity;
      if(!player.isSurvival()) return;
      const axe = (player.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent);
      axe.damageDurability(1);
    },
    onMineBlock(arg) {
      if(!(arg.source instanceof Player)) return;
      const player: Player = arg.source;
      const axe = (player.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent);
      const dimension = player.dimension;
      const block = arg.block;
      const currentBreakBlock: BlockPermutation = arg.minedBlockPermutation;
      const blockTypeId: string = currentBreakBlock.type.id;
      if(!player.isSurvival()) return;
      if (!isLogIncluded(blockTypeId)) {
        axe.damageDurability(1);
        return;
      }
      treeCut(player, dimension, block.location, blockTypeId);
    },
    onUseOn(arg) {
        const currentHeldAxe: ItemStack = arg.itemStack;
        const blockInteracted: Block = arg.block;
        const player: Player = arg.source as Player;
        if (!axeEquipments.includes(currentHeldAxe.typeId) || !isLogIncluded(blockInteracted.typeId)) return;
        const oldLog = playerInteractedTimeLogMap.get(player.id);
        playerInteractedTimeLogMap.set(player.id, system.currentTick);
        if ((oldLog + 20) >= Date.now()) return;
        const blockOutlines = player.dimension.getEntities({closest: 1, maxDistance: 1, type: "yn:block_outline", location: blockInteracted.bottomCenter()});

        const itemDurability: ItemDurabilityComponent = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId) as ItemDurabilityComponent;
        const enchantments: ItemEnchantableComponent = (currentHeldAxe.getComponent(ItemEnchantableComponent.componentId) as ItemEnchantableComponent);
        const level: number = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
        const currentDurability = itemDurability.damage;
        const maxDurability = itemDurability.maxDurability;
        const unbreakingMultiplier: number = (100 / (level + 1)) / 100;
        const unbreakingDamage: number = parseInt(serverConfigurationCopy.durabilityDamagePerBlock.defaultValue + "") * unbreakingMultiplier;
        const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
        
        if(blockOutlines.length && blockOutlines[0]?.isValid()) {
            console.warn("HAS BLOCK OUITLINE");
            let inspectedTree: Entity[];
            for(const c_blockOutline of visitedLogs) {
                const index = c_blockOutline.indexOf(blockOutlines[0]);
                if(index === -1) continue;
                inspectedTree = visitedLogs[visitedLogs.indexOf(c_blockOutline)];
                break;
            }

            const size = inspectedTree.length;
            const totalDamage: number = size * unbreakingDamage;
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

            forceShow(player, inspectionForm).then((response: ActionFormResponse) => {
                // playerInteractionMap.set(player.id, false);
                if(response.canceled || response.selection === undefined || response.cancelationReason === FormCancelationReason.UserClosed) {
                for(const _blockOutline of inspectedTree) {
                    if(!_blockOutline?.isValid()) continue;
                    system.run(() => _blockOutline.triggerEvent('despawn'));
                }
                return;
            }
            }).catch((error: Error) => {
                Logger.error("Form Error: ", error, error.stack);
            });
        } else {
            console.warn("DOESNT HAVE BLOCK OUITLINE");
            system.run(async () => {
                // if(playerInteractionMap.get(player.id)) return;
                // playerInteractionMap.set(player.id, true);
                const treeCollectedResult = await getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1);
                visitedLogs.push(treeCollectedResult.blockOutlines);
                system.runTimeout(() => {
                    visitedLogs.splice(visitedLogs.indexOf(treeCollectedResult.blockOutlines));
                    console.warn("RESET");
                }, 5 * TicksPerSecond);
            });
        }
    },
  })
})