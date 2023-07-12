<<<<<<< HEAD
import { world} from "mojang-minecraft"
import {LumberCount, LumberJack} from "./lumber.js"

/**
 * !NOTE:
 * - IF YOU ARE HERE FOR THE CODE, AND COPIED SOME OF MY CODE. AT LEAST GIVE CREDITS BY TAGGING THE ORIGINAL CREATOR.
 * - THEN YOU CAN COPY MY CODE, ANY WHERE PROJECTS YOU LIKE.
 * - PROVIDE CONSENT.
 * 
 * ? Feel free to have question and feedbacks with me @ Twitter via (Twitter Account)[https://twitter.com/h_YanG_0A]
 */

class LumberSystem{

  constructor(){
    /**
     * For Deleting broken axes in player's inventory.
     */
    this.lumber_axes = ["yn:wooden_lumber_axe", "yn:stone_lumber_axe", "yn:golden_lumber_axe", "yn:iron_lumber_axe", "yn:diamond_lumber_axe", "yn:netherite_lumber_axe"];
    this.newLogs = ["minecraft:crimson_stem", "minecraft:warped_stem"];

    this._ticker = world.events.tick.subscribe( t => {
      for (const player of world.getPlayers()) {
        let inventory = player.getComponent("inventory").container;
        let held_item = inventory.getItem(player.selectedSlot);
        try{
          for(let slot = 0; slot < inventory.size; slot++){
            if(this.lumber_axes.includes(inventory.getItem(slot).id)){
              let found_axe = inventory.getItem(slot);
              if(found_axe.getComponent("durability").damage >= found_axe.getComponent("durability").maxDurability){
                player.runCommand(`clear ${player.name} ${inventory.getItem(slot).id} ${found_axe.getComponent("durability").damage} 1`);
              }
            }
          }
        } catch (error) {
        }
      }
    });

    this._break = world.events.blockBreak.subscribe((data) => {
      /**
       * For Triggering an event when player breaks a block which is a log type or has a tag or "log".
       */
      let held_item = data.player.getComponent("inventory").container.getItem(data.player.selectedSlot);
      if(this.lumber_axes.includes(held_item.id) && (data.brokenBlockPermutation.hasTag("wood") || this.newLogs.includes(data.brokenBlockPermutation.type.id))){
        try {
          let lumber = new LumberJack(data.player, data.block.location, data.brokenBlockPermutation, held_item);
        } catch (error) {
          this.print(`${error} ${error.stack}`);
        }
      }
    });

    this._itemUse = world.events.beforeItemUseOn.subscribe((useOn) =>{
      /**
       * When player wants to check if he can destroy the tree, with his current lumberjack.
       */
      let source = {
        player: useOn.source,
        block: world.getDimension(useOn.source.dimension.id).getBlock(useOn.blockLocation)
      };
      let held_item = useOn.item.id;
      try{
        if(this.lumber_axes.includes(held_item) && source.player.isSneaking && (source.block.hasTag("wood") || this.newLogs.includes(source.block.id))){
          let l = new LumberCount(source.player, source.block, useOn.item);
        }
      } catch(error){
        this.print(error + " " + error.stack);
      }
    });
  }
  print(x){
    world.getDimension("overworld").runCommand(`say ${x}`);
  }
}

let l = new LumberSystem();

=======
import { world} from "mojang-minecraft"; import {LumberCount, LumberJack} from "./lumber.js";

/**
 * !NOTE:
 * - IF YOU ARE HERE FOR THE CODE, AND COPIED SOME OF MY CODE. AT LEAST GIVE CREDITS BY TAGGING THE ORIGINAL CREATOR.
 * - THEN YOU CAN COPY MY CODE, ANY WHERE PROJECTS YOU LIKE.
 * - PROVIDE CONSENT.
 * 
 * ? Feel free to have question and feedbacks with me @ Twitter via (Twitter Account)[https://twitter.com/h_YanG_0A]
 */

class LumberSystem{

  constructor(){
    this.lumber_axes = ["yn:wooden_lumber_axe", "yn:stone_lumber_axe", "yn:golden_lumber_axe", "yn:iron_lumber_axe", "yn:diamond_lumber_axe", "yn:netherite_lumber_axe"]; this.newLogs = ["minecraft:crimson_stem", "minecraft:warped_stem"];

    this._ticker = world.events.tick.subscribe( t => { for (const player of world.getPlayers()) { let inventory = player.getComponent("inventory").container; let held_item = inventory.getItem(player.selectedSlot); try{ for(let slot = 0; slot < inventory.size; slot++){ if(this.lumber_axes.includes(inventory.getItem(slot).id)){ let found_axe = inventory.getItem(slot); if(found_axe.getComponent("durability").damage >= found_axe.getComponent("durability").maxDurability){ player.runCommand(`clear ${player.name} ${inventory.getItem(slot).id} ${found_axe.getComponent("durability").damage} 1`); } } } } catch (error) { } } });

    this._break = world.events.blockBreak.subscribe((data) => { let held_item = data.player.getComponent("inventory").container.getItem(data.player.selectedSlot); if(this.lumber_axes.includes(held_item.id) && (data.brokenBlockPermutation.hasTag("wood") || this.newLogs.includes(data.brokenBlockPermutation.type.id))){ try { let lumber = new LumberJack(data.player, data.block.location, data.brokenBlockPermutation, held_item); } catch (error) { this.print(`${error} ${error.stack}`); } } });

    this._itemUse = world.events.beforeItemUseOn.subscribe((useOn) =>{ let source = { player: useOn.source, block: world.getDimension(useOn.source.dimension.id).getBlock(useOn.blockLocation) }; let held_item = useOn.item.id; try{ if(this.lumber_axes.includes(held_item) && source.player.isSneaking && (source.block.hasTag("wood") || this.newLogs.includes(source.block.id))){ let l = new LumberCount(source.player, source.block, useOn.item); } } catch(error){ this.print(error + " " + error.stack); } });
  }
  print(x){ world.getDimension("overworld").runCommand(`say ${x}`); }
}

let l = new LumberSystem();

>>>>>>> 3f384d7b263a47ff6ec929dd1248cd626c3a9e92
export {LumberSystem};