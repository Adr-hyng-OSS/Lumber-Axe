import { ItemComponentTypes } from "@minecraft/server";
import { EntityEquippableComponent, EquipmentSlot } from "@minecraft/server";
import { MinecraftEnchantmentTypes, MinecraftItemTypes } from "modules/vanilla-types/index";
import { OverTakes } from "./partial_overtakes";
OverTakes(EntityEquippableComponent.prototype, {
    get equipment() {
        return this.getEquipment(EquipmentSlot.Mainhand);
    },
    get isEquipped() {
        return (this.equipment?.typeId === MinecraftItemTypes.FishingRod);
    },
    damageDurability(damageApplied) {
        const equipmentToDamage = this.getEquipment(EquipmentSlot.Mainhand);
        if (!equipmentToDamage)
            return false;
        const player = this.entity;
        if (!player.isSurvival())
            return false;
        if (!equipmentToDamage?.hasComponent(ItemComponentTypes.Durability))
            throw "Item doesn't have durability to damage with";
        let level = 0;
        const itemDurability = equipmentToDamage.getComponent(ItemComponentTypes.Durability);
        if (equipmentToDamage.hasComponent(ItemComponentTypes.Enchantable)) {
            const enchantment = equipmentToDamage.getComponent(ItemComponentTypes.Enchantable);
            if (enchantment.hasEnchantment(MinecraftEnchantmentTypes.Unbreaking))
                level = enchantment.getEnchantment(MinecraftEnchantmentTypes.Unbreaking).level;
        }
        const unbreakingMultiplier = (100 / (level + 1)) / 100;
        const unbreakingDamage = damageApplied * unbreakingMultiplier;
        if (itemDurability.damage + unbreakingDamage >= itemDurability.maxDurability) {
            this.setEquipment(EquipmentSlot.Mainhand, undefined);
            player.playSound("random.break");
            return true;
        }
        else if (itemDurability.damage + unbreakingDamage < itemDurability.maxDurability) {
            equipmentToDamage.getComponent(ItemComponentTypes.Durability).damage += unbreakingDamage;
            this.setEquipment(EquipmentSlot.Mainhand, equipmentToDamage);
            return false;
        }
    }
});
