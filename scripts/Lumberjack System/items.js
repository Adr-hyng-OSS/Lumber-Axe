import {ItemStack, Items} from "mojang-minecraft"

var lumber_axes = ["yn:wooden_lumber_axe", "yn:stone_lumber_axe", "yn:golden_lumber_axe", "yn:iron_lumber_axe", "yn:diamond_lumber_axe", "yn:netherite_lumber_axe"];

function damageItem(item, damage) {
    if(item.getComponent("durability").maxDurability > item.getComponent("durability").damage){
      let newItem = new ItemStack(Items.get(item.id), item.amount, item.data);
      newItem.nameTag = item.nameTag;
      newItem.getComponents = item.getComponents
      newItem.setLore(item.getLore());
      newItem.getComponent('enchantments').enchantments = item.getComponent('enchantments').enchantments;
      newItem.getComponent("durability").damage = item.getComponent("durability").damage + damage;
      return newItem;
    }
}
  
function replaceItem(player, item, damage){
  if(lumber_axes.includes(item.id)) {
    if(item.getComponent("durability").damage > item.getComponent("durability").maxDurability){
      player.runCommandAsync(`replaceitem entity ${player.name} slot.weapon.mainhand 0 air 1`);
    }
    player.getComponent("inventory").container.setItem(player.selectedSlot, damageItem(item, damage));
  }
}

export {replaceItem};