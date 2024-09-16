import { FormBuilder } from "utils/form_builder";
import { cloneConfiguration } from "./configuration_handler";

export const serverConfiguration = {
  /**
   * Lumber Axe durability damage per log destroyed.
   */
  durabilityDamagePerBlock: new FormBuilder("LumberAxe.server.durability_damage_per_block").createTextField("3"),
  /**
   * 1500 above is not recommended. It Does work but it's not recommended.
   */
  chopLimit: new FormBuilder("LumberAxe.server.chop_limit").createTextField("300"),
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
  progressiveChopping: new FormBuilder("LumberAxe.server.progressive_chopping").createToggle(true),
  /**
   * Shows the script initialization message log upon player joining, default is true.
   */
  ShowMessageUponJoin: new FormBuilder("LumberAxe.server.show_message_on_join").createToggle(true),
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