import { FormBuilder } from "utils/form_builder";
import { cloneConfiguration } from "./configuration_handler";

export const serverConfiguration = {
  /**
   * Lumber Axe durability damage per log destroyed.
   */
  durabilityDamagePerBlock: new FormBuilder("LumberAxe.server.durability_damage_per_block").createTextField("0"),
  /**
   * Tree chop limitation for control purposes.
   */
  chopLimit: new FormBuilder("LumberAxe.server.chop_limit").createTextField("1000"),
  /**
   * Included blocks for custom logs, but any custom or vanilla logs also work as long as the block identifier ends with "*_log".
   * Check: https://github.com/mcbe-mods/Cut-tree-one-click by Lete114.
   */
  includedLog: new FormBuilder("LumberAxe.configuration.log_include_manager").createDropdown(['Empty'], "Empty"),
  /**
   * Excluded blocks for block logs you don't want to be included in being chopped.
   * 
   * Tip:
   * - excludedLog is prioritized over includedLog.
   * - It's unnecessary to include log blocks that have "*_log" in their block id.
   */
  excludedLog: new FormBuilder("LumberAxe.configuration.log_exclude_manager").createDropdown(['Empty'], "Empty"),
  /**
   * Enable/Disable Progressive Chopping, which makes you chop trees slightly longer, but nice to see.
   */
  immersiveMode: new FormBuilder("LumberAxe.server.immersive_chopping").createToggle(false),
  /**
   * Delay for immersive mode.
   */
  immersiveModeDelay: new FormBuilder("LumberAxe.server.immersive_delay").createTextField("5"),
  /**
   * Enables debug messages to content logs.
   */
  debug: new FormBuilder("Debug Mode").createToggle(true),
};

export let serverConfigurationCopy = cloneConfiguration(serverConfiguration);
export let setServerConfiguration = (newServerConfig) => serverConfigurationCopy = newServerConfig;
export let resetServerConfiguration = () => serverConfigurationCopy = cloneConfiguration(serverConfiguration);

// version (do not change)
export const VERSION = "1.0.11";