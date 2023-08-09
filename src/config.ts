export default {
  /**
   * Enables debug messages to content logs.
   */
  debug: true,
  /**
   * Lumber Axe durability damage per log destroyed.
   */
  durabilityDamagePerBlock: 3,
  /**
   * 1500 above is not recommended. It Does work but it's not recommended.
   */
  chopLimit: 300,
  /**
   * Included blocks for custom logs, but any custom or vanilla logs also work as long as the block identifier ends with "*_log".
   * Check: https://github.com/mcbe-mods/Cut-tree-one-click by Lete114.
   */
  includedLog: [],
  /**
   * Excluded blocks for block logs you don't want to be included in being chopped.
   * 
   * Tip:
   * - excludedLog is prioritized over includedLog.
   * - It's unnecessary to include log blocks that have "*_log" in their block id.
   */
  excludedLog: [],
  /**
   * Disables the watchDogTerminate Log message. If true, it will only show a warning message when you enable content-ui log in the Minecraft settings.
   */
  disableWatchDogTerminateLog: true,
};

// version (do not change)
export const VERSION = "1.0.5";