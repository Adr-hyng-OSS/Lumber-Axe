function hashVector3(vec) {
    const prime = 31;
    let hash = 1;
    hash = prime * hash + Math.imul(vec.x | 0, prime);
    hash = prime * hash + Math.imul(vec.y | 0, prime);
    hash = prime * hash + Math.imul(vec.z | 0, prime);
    hash ^= (hash << 13);
    hash ^= (hash >> 7);
    hash ^= (hash << 17);
    return hash >>> 0;
}
export class GraphNode {
    constructor(location) {
        this.index = 0;
        this.location = location;
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
    getNode(location) {
        return this.nodes.get(this.serializeLocation(location));
    }
    addNode(param) {
        if (param instanceof GraphNode) {
            this.hashes.push(hashVector3(param.location));
            const key = this.serializeLocation(param.location);
            param.index = this.nodes.size;
            this.nodes.set(key, param);
            return;
        }
        else {
            const key = this.serializeLocation(param);
            let node = this.nodes.get(key);
            if (!node) {
                node = new GraphNode(param);
                this.nodes.set(key, node);
            }
            this.hashes.push(hashVector3(node.location));
            node.index = this.nodes.size - 1;
            return node;
        }
    }
    removeNode(location) {
        const key = this.serializeLocation(location);
        const node = this.nodes.get(key);
        if (!node)
            return;
        node.neighbors.forEach(neighbor => {
            neighbor.removeNeighbor(node);
            node.removeNeighbor(neighbor);
        });
        this.hashes.splice(this.hashes.lastIndexOf(hashVector3(location)));
        this.nodes.delete(key);
    }
    serializeLocation(location) {
        return JSON.stringify(location);
    }
    getSize() {
        return this.nodes.size;
    }
    traverse(startLocation, traversalType = "DFS", visit) {
        const startNode = this.getNode(startLocation);
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
        return this.hashes.reduce((accumulator, currentValue) => { return accumulator + currentValue; }, 0);
    }
    isEqual(otherGraph) {
        return this.hash() === otherGraph.hash();
    }
}
