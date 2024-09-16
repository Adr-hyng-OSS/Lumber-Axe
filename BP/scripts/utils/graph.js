function hashBlock(block) {
    const prime = 31;
    let hash = 1;
    hash = prime * hash + Math.imul(block.x | 0, prime);
    hash = prime * hash + Math.imul(block.y | 0, prime);
    hash = prime * hash + Math.imul(block.z | 0, prime);
    hash ^= (hash << 13);
    hash ^= (hash >> 7);
    hash ^= (hash << 17);
    return hash >>> 0;
}
export class GraphNode {
    constructor(block) {
        this.index = 0;
        this.block = block;
        this.neighbors = new Set();
    }
    addNeighbor(node) {
        this.neighbors.add(node);
    }
    removeNeighbor(node) {
        this.neighbors.delete(node);
    }
}
export class Graph {
    constructor() {
        this.nodes = new Map();
        this.hashes = [];
    }
    getNode(block) {
        return this.nodes.get(this.serializeLocation(block.location));
    }
    addNode(param) {
        if (param instanceof GraphNode) {
            this.hashes.push(hashBlock(param.block));
            const key = this.serializeLocation(param.block.location);
            param.index = this.nodes.size;
            this.nodes.set(key, param);
            return;
        }
        else {
            const key = this.serializeLocation(param.location);
            let node = this.nodes.get(key);
            if (!node) {
                node = new GraphNode(param);
                this.nodes.set(key, node);
            }
            this.hashes.push(hashBlock(node.block));
            node.index = this.nodes.size - 1;
            return node;
        }
    }
    removeNode(block) {
        const key = this.serializeLocation(block.location);
        const node = this.nodes.get(key);
        if (!node)
            return;
        node.neighbors.forEach(neighbor => {
            neighbor.removeNeighbor(node);
            node.removeNeighbor(neighbor);
        });
        this.hashes.splice(this.hashes.lastIndexOf(hashBlock(block)), 1);
        this.nodes.delete(key);
    }
    serializeLocation(location) {
        return JSON.stringify(location);
    }
    getSize() {
        return this.nodes.size;
    }
    traverse(startBlock, traversalType = "DFS", visit) {
        const startNode = this.getNode(startBlock);
        if (!startNode) {
            return;
        }
        const visited = new Set();
        const toVisit = [startNode];
        while (toVisit.length > 0) {
            const node = traversalType === "DFS" ? toVisit.pop() : toVisit.shift();
            if (!visited.has(node)) {
                visit(node);
                visited.add(node);
                node.neighbors.forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        toVisit.push(neighbor);
                    }
                });
            }
        }
    }
    hash() {
        return this.hashes.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
    }
    *traverseIterative(startBlock, traversalType = "DFS") {
        const startNode = this.getNode(startBlock);
        if (!startNode) {
            return;
        }
        const visited = new Set();
        const toVisit = [startNode];
        while (toVisit.length > 0) {
            const node = traversalType === "DFS" ? toVisit.pop() : toVisit.shift();
            if (!visited.has(node)) {
                yield node;
                visited.add(node);
                node.neighbors.forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        toVisit.push(neighbor);
                    }
                });
            }
        }
    }
    isEqual(otherGraph) {
        return this.hash() === otherGraph.hash();
    }
}
