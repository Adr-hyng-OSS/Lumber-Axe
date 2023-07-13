export const config = {
    /**
     * Lumber Axe durability damage per log destroyed.
     */
    durabilityDamagePerBlock: 3, 

    /**
     * 1500 above is not recommended.
     */
    chopLimit: 1500,

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
     * - If you include and exclude the same log block it will not be excluded.
     * - It's unnecessary to include log blocks that has "*_log" in its block id.
     */
    excludedLog: []
};
  