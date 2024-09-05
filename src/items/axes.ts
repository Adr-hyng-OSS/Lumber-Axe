import { Block, BlockPermutation, Entity, EntityEquippableComponent, ItemDurabilityComponent, ItemEnchantableComponent, ItemStack, Player, system, TicksPerSecond, world } from "@minecraft/server";
import { ActionFormData, ActionFormResponse, FormCancelationReason } from "@minecraft/server-ui";
import { axeEquipments, forceShow, getTreeLogs, isLogIncluded, playerInteractedTimeLogMap, playerInteractionMap, serverConfigurationCopy, treeCut, VisitedBlockResult } from "index"
import { MinecraftEnchantmentTypes } from "modules/vanilla-types/index";
import { Graph } from "utils/graph";
import { Logger } from "utils/logger";

const visitedLogs: VisitedBlockResult[] = [];

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
            let inspectedTree: VisitedBlockResult;
            for(const visitedLogsGraph of visitedLogs) {
                const interactedNode = visitedLogsGraph.graph.getNode(blockInteracted.location);
                // const interactedNode = visitedLogsGraph.graph.getNode(blockOutlines[0].location);
                if(!interactedNode) continue; 
                const index = visitedLogs.indexOf(visitedLogsGraph);
                // if(index === -1) continue;
                inspectedTree = visitedLogs[index];
                break;
            }
            // Traverse again to final check what branch should be included.
            console.warn("PRE: ", inspectedTree.graph.getSize());
            // Already removed
            for(const _blockOutline of inspectedTree.blockOutlines) {
                if(_blockOutline?.isValid()) continue;
                const {x, y, z} = _blockOutline.lastLocation;
                inspectedTree.graph.removeNode({x: x - 0.5, y: y, z: z - 0.5});
            }

            // After the node has been removed, it should get only the neigbors
            let tsize = 0;
            // inspectedTree.graph.bfs({x: -3255, y: 69, z: 1759}, (node) => {
            inspectedTree.graph.dfsIterative(blockInteracted.location, (node) => {
                if(node) tsize++;
            });
            console.warn("POST: ", tsize);

            const size = inspectedTree.graph.getSize();
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

                // Despawn all the block outlnies
                // inspectedTree.graph.bfs(blockOutlines[0].location, (node) => {

                // });
                // for(const _blockOutline of ) {
                //     if(!_blockOutline?.isValid()) continue;
                //     system.run(() => _blockOutline.triggerEvent('despawn'));
                // }
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
                visitedLogs.push(treeCollectedResult);
                system.runTimeout(() => {
                    visitedLogs.splice(visitedLogs.indexOf(treeCollectedResult));
                    console.warn("RESET");
                }, 5 * TicksPerSecond);
            });
        }
    },
  })
})