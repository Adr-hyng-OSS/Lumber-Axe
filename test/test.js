function extractLogFamily(blockTypeId){
  // Remove the namespace by splitting on the colon (':') and taking the second part
  const [, cleanedBlockTypeId] = blockTypeId.split(':');

  // Split the remaining string by underscores
  const parts = cleanedBlockTypeId.split('_');

  // Remove the last part (e.g., 'log', 'wood', 'stem')
  return parts.slice(0, -1).join('_');
}

x = extractLogFamily('minecraft:oak_log')
x