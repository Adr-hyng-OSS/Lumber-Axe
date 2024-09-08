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
    }
    getNode(location) {
        return this.nodes.get(this.serializeLocation(location));
    }
    addNode(param) {
        if (param instanceof GraphNode) {
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
    *traverseIterative(startLocation, traversalType = "DFS") {
        const startNode = this.getNode(startLocation);
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
        if (this.getSize() !== otherGraph.getSize()) {
            return false;
        }
        for (const [locationKey, node] of this.nodes) {
            const otherNode = otherGraph.nodes.get(locationKey);
            if (!otherNode) {
                return false;
            }
            if (node.neighbors.size !== otherNode.neighbors.size) {
                return false;
            }
            for (const neighbor of node.neighbors) {
                const otherNeighbor = otherGraph.getNode(neighbor.location);
                if (!otherNeighbor || !otherNode.neighbors.has(otherNeighbor)) {
                    return false;
                }
            }
        }
        return true;
    }
    toJSON() {
        const serializedNodes = {};
        const sortedNodeEntries = Array.from(this.nodes.entries()).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
        sortedNodeEntries.forEach(([key, node]) => {
            const sortedNeighbors = Array.from(node.neighbors)
                .map(neighbor => this.serializeLocation(neighbor.location))
                .sort((a, b) => a.localeCompare(b));
            serializedNodes[key] = {
                location: node.location,
                neighbors: sortedNeighbors
            };
        });
        return {
            nodes: serializedNodes
        };
    }
}
