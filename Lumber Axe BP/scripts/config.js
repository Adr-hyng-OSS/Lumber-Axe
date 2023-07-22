export const config = {
    /**
     * Lumber Axe durability damage per log destroyed.
     */
    durabilityDamagePerBlock: 3,
    /**
     * 1500 above is not recommended. It Does work but it's not recommended.
     */
    chopLimit: 300,
    /**
     * included blocks for custom logs, but any custom or vanilla
     * logs also works as long as the block identifier ends with "*_log"
     * i.g oak_log, cherry_log, etc.
     * Check: https://github.com/mcbe-mods/Cut-tree-one-click by Lete114.
     */
    includedLog: [],
    /**
     * excluded blocks for block logs you don't want to be included being chopped.
     */
    /**
     * Tip:
     * - excludedLog is prioritized over includedLog.
     * - It's unnecessary to include log blocks that has "*_log" in its block id.
     */
    excludedLog: [],
    /**
     * Disables the watchDogTerminate Log message. If true, it will only show a warning message
     * when you enable content-ui log in the Minecraft settings.
     */
    disableWatchDogTerminateLog: true
};
