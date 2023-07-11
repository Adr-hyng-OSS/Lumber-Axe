import { world, MinecraftEnchantmentTypes} from 'mojang-minecraft'; import {replaceItem} from "./items.js"; import {setTimeout} from "./timers.js"; import {ActionFormData} from "mojang-minecraft-ui"; import { axeConfig } from "../AxeConfig.js"; let {axeDamage, recursionLimit} = axeConfig;



/**
 * !NOTE:
 * - IF YOU ARE HERE FOR THE CODE, AND COPIED SOME OF MY CODE. AT LEAST GIVE CREDITS BY TAGGING THE ORIGINAL CREATOR.
 * - THEN YOU CAN COPY MY CODE, ANY WHERE PROJECTS YOU LIKE.
 * - PROVIDE CONSENT.
 * 
 * ? Feel free to have question and feedbacks with me @ Twitter via (Twitter Account)[https:
 */

class LumberJack {
	constructor(player, blockLocation, brokenBlockPermutation, held_item){ this.player = player; this.lumberjack_axe = held_item; this.worldClient = world.getDimension(this.player.dimension.id); this.new_location = blockLocation; this.LEAFBLOCKS = ["minecraft:leaves", "minecraft:leaves2", "minecraft:mangrove_leaves", "minecraft:warped_wart_block", "minecraft:nether_wart_block"]; this.LOGBLOCKS = ["minecraft:log", "minecraft:log2", "minecraft:mangrove_log", "minecraft:warped_stem", "minecraft:crimson_stem"]; this.prevBlock = this.worldClient.getBlock(this.new_location); this.permutation = brokenBlockPermutation; brokenBlockPermutation.getAllProperties().forEach( (prop)=> { this.FIRSTBLOCK = { data: "None", id: brokenBlockPermutation.type.id}; switch(prop.name){ case "old_log_type": this.FIRSTBLOCK.data = brokenBlockPermutation.getProperty(prop.name).value; break; case "new_log_type": this.FIRSTBLOCK.data = brokenBlockPermutation.getProperty(prop.name).value; break; default: this.FIRSTBLOCK.data = brokenBlockPermutation.type.id.slice(1).trim().split(/:+/)[1]; break; } }); this.recursiveLimit = recursionLimit; this.totalBlocksDestroyed = this.getTotalBlocks(); this.itemDamage = axeDamage; this.enchantmentEffect(); if(this.canBeCut() && this.LOGBLOCKS.includes(this.permutation.type.id)){ this.treeChopper(); delete this; } else if(!this.canBeCut() && this.LOGBLOCKS.includes(this.permutation.type.id)){ this.player.runCommandAsync(`tellraw @s {"rawtext":[{"text":"§2§lTree Chop§r: Durability not enough."}]}`); } else{ return; } }

    isVisited(blockLoc, visited){ return visited.some(v => v.equals(blockLoc)); }
    
    enchantmentEffect(){ let enchantments = this.lumberjack_axe.getComponent("enchantments").enchantments; let level = enchantments.hasEnchantment(MinecraftEnchantmentTypes.unbreaking); let unbreakingEffect = (100 / (level + 1)) / 100; this.itemDamage = this.itemDamage * unbreakingEffect; }

    canBeCut(){ let currentDurability = this.lumberjack_axe.getComponent("durability").damage; let totalDurability = this.lumberjack_axe.getComponent("durability").maxDurability; let totalDamage = this.totalBlocksDestroyed * this.itemDamage; if(totalDamage + currentDurability > totalDurability) return false; else if(totalDamage + currentDurability <= totalDurability) return true; return; }

    getTotalBlocks(){ try { if(!this.LOGBLOCKS.includes(this.permutation.type.id)) return; let v = []; let q = []; v.push(this.prevBlock.location); q.push(this.prevBlock.location); while(q.length > 0){ if(v.length > this.recursiveLimit) break; let p = q.shift(); let netherOffset = this.player.dimension.id === "minecraft:nether" ? 2: 0; for (let y = -1; y < 2 + netherOffset; y++) { for (let x = -1; x < 2; x++) { for (let z = -1; z < 2; z++) { if(!this.isVisited(p.offset(x, y, z), v) && this.LOGBLOCKS.includes(this.worldClient.getBlock(p.offset(x, y, z)).id)){ let currentBlock = this.worldClient.getBlock(p.offset(x, y, z)); let logState; currentBlock.permutation.getAllProperties().forEach( (prop)=> { switch(prop.name){ case "old_log_type": logState = currentBlock.permutation.getProperty(prop.name).value; break; case "new_log_type": logState = currentBlock.permutation.getProperty(prop.name).value; break; default: logState = currentBlock.id.slice(1).trim().split(/:+/)[1]; break; } }); if(this.FIRSTBLOCK.data === logState){ v.push(p.offset(x, y, z)); q.push(p.offset(x, y, z)); } } } } } } return v.length; } catch (error) { this.worldClient.runCommand(`say ${error} ${error.stack}`); } }

    treeChopper(){
        try {
            if(!this.LOGBLOCKS.includes(this.permutation.type.id)) return; let v = []; let q = []; v.push(this.prevBlock.location); q.push(this.prevBlock.location); let start = true;
            while(q.length > 0){
                if(v.length > this.recursiveLimit) break; let p = q.shift(); let currentBlock = this.worldClient.getBlock(p); let netherOffset = this.player.dimension.id === "minecraft:nether" ? 2: 0; let logState = undefined;
                if(start){ this.permutation.getAllProperties().forEach( (prop)=> { switch(prop.name){ case "old_log_type": logState = this.permutation.getProperty(prop.name).value; break; case "new_log_type": logState = this.permutation.getProperty(prop.name).value; break; default: logState = this.permutation.type.id.slice(1).trim().split(/:+/)[1]; break; } }); start = false; } else if(!start){ currentBlock.permutation.getAllProperties().forEach( (prop)=> { switch(prop.name){ case "old_log_type": logState = currentBlock.permutation.getProperty(prop.name).value; break; case "new_log_type": logState = currentBlock.permutation.getProperty(prop.name).value; break; default: logState = currentBlock.id.slice(1).trim().split(/:+/)[1]; break; } }); }
                if(this.FIRSTBLOCK.data !== logState) continue;
                this.worldClient.runCommand(`setblock ${p.x} ${p.y} ${p.z} air 0 destroy`);
                for (let y = -1; y < 2 + netherOffset; y++) { for (let x = -1; x < 2; x++) { for (let z = -1; z < 2; z++) { if(!this.isVisited(p.offset(x, y, z), v) && this.LOGBLOCKS.includes(this.worldClient.getBlock(p.offset(x, y, z)).id) && this.FIRSTBLOCK.data === logState){ v.push(p.offset(x, y, z)); q.push(p.offset(x, y, z)); } } } }
                for (let y = -3; y < 5; y++) { for (let x = -3; x < 4; x++) { for (let z = -3; z < 4; z++) { let newBlock = this.worldClient.getBlock(p.offset(x, y, z)); let leafIndex = this.LOGBLOCKS.indexOf(this.FIRSTBLOCK.id); if(newBlock.id === this.LEAFBLOCKS[leafIndex]){ let leafState; let originBlock; if(["minecraft:leaves", "minecraft:leaves2"].includes(newBlock.id)){ newBlock.permutation.getAllProperties().forEach( (prop)=> { if(prop.name === "old_leaf_type"){ leafState = newBlock.permutation.getProperty(prop.name).value; } else if(prop.name === "new_leaf_type"){ leafState = newBlock.permutation.getProperty(prop.name).value; } if(this.FIRSTBLOCK.data === leafState){ this.worldClient.runCommand(`setblock ${newBlock.x} ${newBlock.y} ${newBlock.z} air 0 destroy`); } }); } else if(["minecraft:mangrove_leaves"].includes(newBlock.id)) { originBlock = JSON.stringify(this.FIRSTBLOCK.data).split('"')[1].replace(/_log/, ""); leafState = newBlock.id.match(/:(.*?)_/)[1]; if(originBlock === leafState){ this.worldClient.runCommand(`setblock ${newBlock.x} ${newBlock.y} ${newBlock.z} air 0 destroy`); } } else if(["minecraft:nether_wart_block", "minecraft:warped_wart_block"].includes(newBlock.id)) { leafState = newBlock.id.slice(1).trim().split(/:+/)[1]; let oppositeIndex = this.LEAFBLOCKS.indexOf(newBlock.id); if(this.LEAFBLOCKS[oppositeIndex].replace(/minecraft:/, "") === leafState){ this.worldClient.runCommand(`setblock ${newBlock.x} ${newBlock.y} ${newBlock.z} air 0 destroy`); } } } else if(["minecraft:shroomlight"].includes(newBlock.id) && ["minecraft:crimson_stem", "minecraft:warped_stem"].includes(this.FIRSTBLOCK.id)){ this.worldClient.runCommand(`setblock ${newBlock.x} ${newBlock.y} ${newBlock.z} air 0 destroy`); } } } }
            }
            setTimeout(replaceItem, 1, this.player, this.lumberjack_axe, this.totalBlocksDestroyed * this.itemDamage); return this.totalBlocksDestroyed;
        }
        catch (error) {
            this.worldClient.runCommand(`say ${error} ${error.stack}`);
        } 
    }
}

class LumberCount {
    constructor(player, block, held_item){ this.player = player; this.worldClient = world.getDimension(this.player.dimension.id); this.prevBlock = block; this.lumberjack_axe = held_item; this.LOGBLOCKS = ["minecraft:log", "minecraft:log2", "minecraft:mangrove_log", "minecraft:warped_stem", "minecraft:crimson_stem"]; this.prevBlock.permutation.getAllProperties().forEach( (prop)=> { this.FIRSTBLOCK = { data: "None", id: this.prevBlock.id}; switch(prop.name){ case "old_log_type": this.FIRSTBLOCK.data = this.prevBlock.permutation.getProperty(prop.name).value; break; case "new_log_type": this.FIRSTBLOCK.data = this.prevBlock.permutation.getProperty(prop.name).value; break; default: this.FIRSTBLOCK.data = this.prevBlock.id.slice(1).trim().split(/:+/)[1]; break; } }); this.recursiveLimit = recursionLimit; this.totalBlocksDestroyed = 0; this.itemDamage = axeDamage; this.enchantmentEffect(); this.durabilityChecker(); }

    isVisited(blockLoc, visited){ return visited.some(v => v.equals(blockLoc)); }

    durabilityChecker(){ this.totalBlocksDestroyed = this.getTotalBlocks(); let itemDurability = this.lumberjack_axe.getComponent("durability").damage; let maxDurability = this.lumberjack_axe.getComponent("durability").maxDurability; let totalNeeded = (maxDurability - ((this.totalBlocksDestroyed * this.itemDamage) + itemDurability)); const form = new ActionFormData() .title("TREE CHOPPING INFO") .button(`${this.totalBlocksDestroyed} block/s`, "textures/InfoUI/blocks.png") .button(`${totalNeeded} durability`, "textures/InfoUI/required_durability.png") .button(`${itemDurability} / ${maxDurability}`, "textures/InfoUI/axe_durability.png") .button(this.canBeCut() ? "Yes" : "No", "textures/InfoUI/canBeCut.png"); form.show(this.player).then((response) => { if (response.selection === 0) {} }); return delete this; }
    
    enchantmentEffect(){ let enchantments = this.lumberjack_axe.getComponent("enchantments").enchantments; let level = enchantments.hasEnchantment(MinecraftEnchantmentTypes.unbreaking); let unbreakingEffect = (100 / (level + 1)) / 100; this.itemDamage = this.itemDamage * unbreakingEffect; }

    canBeCut(){ let currentDurability = this.lumberjack_axe.getComponent("durability").damage; let totalDurability = this.lumberjack_axe.getComponent("durability").maxDurability; let totalDamage = this.totalBlocksDestroyed * this.itemDamage; if(totalDamage + currentDurability > totalDurability) return false; else if(totalDamage + currentDurability <= totalDurability) return true; }

    getTotalBlocks(){  
        try {
            if(!this.LOGBLOCKS.includes(this.worldClient.getBlock(this.prevBlock.location).id)) return; let v = []; let q = []; v.push(this.prevBlock.location); q.push(this.prevBlock.location);
            while(q.length > 0){
                if(v.length > this.recursiveLimit) break; let p = q.shift(); let netherOffset = this.player.dimension.id === "minecraft:nether" ? 2: 0;         
                for (let y = -1; y < 2 + netherOffset; y++) { for (let x = -1; x < 2; x++) { for (let z = -1; z < 2; z++) { if(!this.isVisited(p.offset(x, y, z), v) && this.LOGBLOCKS.includes(this.worldClient.getBlock(p.offset(x, y, z)).id)){ let currentBlock = this.worldClient.getBlock(p.offset(x, y, z)); let logState; currentBlock.permutation.getAllProperties().forEach( (prop)=> { switch(prop.name){ case "old_log_type": logState = currentBlock.permutation.getProperty(prop.name).value; break; case "new_log_type": logState = currentBlock.permutation.getProperty(prop.name).value; break; default: logState = currentBlock.id.slice(1).trim().split(/:+/)[1]; break; } }); if(this.FIRSTBLOCK.data === logState){ v.push(p.offset(x, y, z)); q.push(p.offset(x, y, z)); } } } } }    
            }
            return v.length;
        }
        catch (error) {
            this.worldClient.runCommand(`say ${error} ${error.stack}`);
        }    
    }
}

export {LumberJack, LumberCount};