import { Block, BlockPermutation, EntityEquippableComponent, ItemDurabilityComponent, ItemEnchantableComponent, ItemStack, Player, system, world } from "@minecraft/server";
import { ActionFormData, ActionFormResponse, FormCancelationReason } from "@minecraft/server-ui";
import { axeEquipments, durabilityDamagePerBlock, forceShow, getTreeLogs, isLogIncluded, logMap, playerInteractionMap, treeCut } from "index"
import { MinecraftEnchantmentTypes } from "modules/vanilla-types";
import { Logger } from "utils/logger";

world.beforeEvents.worldInitialize.subscribe((registry) => {
  registry.itemComponentRegistry.registerCustomComponent("yn:tool_durability", {
    onHitEntity(arg) {
      if(!(arg.attackingEntity instanceof Player)) return;
      const player: Player = arg.attackingEntity;
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

      const oldLog: number = logMap.get(player.name);
      logMap.set(player.name, Date.now());
      if ((oldLog + 1_000) >= Date.now()) return;
      if (!axeEquipments.includes(currentHeldAxe.typeId) || !isLogIncluded(blockInteracted.typeId)) return;
      if(playerInteractionMap.get(player.id)) return;
      playerInteractionMap.set(player.id, true);
      
      const itemDurability: ItemDurabilityComponent = currentHeldAxe.getComponent(ItemDurabilityComponent.componentId) as ItemDurabilityComponent;
      const enchantments: ItemEnchantableComponent = (currentHeldAxe.getComponent(ItemEnchantableComponent.componentId) as ItemEnchantableComponent);
      const level: number = enchantments.getEnchantment(MinecraftEnchantmentTypes.Unbreaking)?.level | 0;
      const currentDurability = itemDurability.damage;
      const maxDurability = itemDurability.maxDurability;
      const unbreakingMultiplier: number = (100 / (level + 1)) / 100;
      const unbreakingDamage: number = durabilityDamagePerBlock * unbreakingMultiplier;
      const reachableLogs = (maxDurability - currentDurability) / unbreakingDamage;
      getTreeLogs(player.dimension, blockInteracted.location, blockInteracted.typeId, reachableLogs + 1).then( (treeCollected: Set<string>) => {
          const totalDamage: number = (treeCollected.size) * unbreakingDamage;
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
              Logger.error("Form Error: ", error, error.stack);
          });
      }).catch((error: Error) => {
          Logger.error("Tree Error: ", error, error.stack);
          playerInteractionMap.set(player.id, false);
      });
    },
  })
})