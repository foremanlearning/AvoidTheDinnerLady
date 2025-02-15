class PathNode {
    constructor(x, y, walkable = true) {
        this.x = x;
        this.y = y;
        this.walkable = walkable;
        this.g = 0; // Cost from start to current node
        this.h = 0; // Heuristic cost to goal
        this.f = 0; // Total cost (g + h)
        this.parent = null;
    }
}

class Pathfinder {
    static #instance = null;
    #logger;

    constructor() {
        if (Pathfinder.#instance) {
            return Pathfinder.#instance;
        }
        this.#logger = new Logger();
        Pathfinder.#instance = this;
    }

    static getInstance() {
        if (!Pathfinder.#instance) {
            Pathfinder.#instance = new Pathfinder();
        }
        return Pathfinder.#instance;
    }

    findPath(grid, startX, startY, endX, endY) {
        // Validate input coordinates
        if (!this.#isValidPosition(grid, startX, startY) || !this.#isValidPosition(grid, endX, endY)) {
            this.#logger.warn('Start or end position is not valid');
            return null;
        }

        // Calculate clearance values for all walkable cells
        const clearance = this.#calculateClearance(grid);

        // Check if position is walkable
        const isWalkable = (x, y) => {
            if (!this.#isValidPosition(grid, x, y)) return false;
            return grid[y][x] === 1;
        };

        // Check if start and end positions are walkable
        if (!isWalkable(startX, startY) || !isWalkable(endX, endY)) {
            this.#logger.warn('Start or end position is not walkable');
            return null;
        }

        const openSet = new Set();
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startNode = `${startX},${startY}`;
        openSet.add(startNode);
        gScore.set(startNode, 0);
        fScore.set(startNode, this.#heuristic(startX, startY, endX, endY));

        while (openSet.size > 0) {
            let current = this.#getLowestFScore(openSet, fScore);
            const [currentX, currentY] = current.split(',').map(Number);

            if (currentX === endX && currentY === endY) {
                const path = this.#reconstructPath(cameFrom, current);
                this.#logger.debug('Path found', { path });
                return path;
            }

            openSet.delete(current);
            closedSet.add(current);

            // Check all neighbors (no diagonals)
            const neighbors = [
                [0, 1],  // up
                [0, -1], // down
                [1, 0],  // right
                [-1, 0]  // left
            ];

            for (const [dx, dy] of neighbors) {
                const newX = currentX + dx;
                const newY = currentY + dy;

                if (!isWalkable(newX, newY)) continue;

                const neighbor = `${newX},${newY}`;
                if (closedSet.has(neighbor)) continue;

                // Base movement cost
                let movementCost = 1;
                
                // Add cost for being close to walls (inverse of clearance)
                const clearanceValue = clearance[newY][newX];
                const clearanceCost = 1 / (clearanceValue + 1); // Add 1 to avoid division by zero
                movementCost += clearanceCost;

                const tentativeGScore = gScore.get(current) + movementCost;

                if (!openSet.has(neighbor)) {
                    openSet.add(neighbor);
                } else if (tentativeGScore >= gScore.get(neighbor)) {
                    continue;
                }

                cameFrom.set(neighbor, current);
                gScore.set(neighbor, tentativeGScore);
                fScore.set(neighbor, tentativeGScore + this.#heuristic(newX, newY, endX, endY));
            }
        }

        this.#logger.warn('No valid path found');
        return null;
    }

    #calculateClearance(grid) {
        const height = grid.length;
        const width = grid[0].length;
        const clearance = Array(height).fill().map(() => Array(width).fill(0));

        // For each walkable cell, calculate its clearance value
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (grid[y][x] === 1) { // If walkable
                    // Count empty spaces in all directions
                    let minClearance = Number.MAX_VALUE;
                    
                    // Check in all directions
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            
                            let distance = 0;
                            let checkX = x + dx;
                            let checkY = y + dy;
                            
                            // Keep going until we hit a wall or boundary
                            while (this.#isValidPosition(grid, checkX, checkY) && grid[checkY][checkX] === 1) {
                                distance++;
                                checkX += dx;
                                checkY += dy;
                            }
                            
                            minClearance = Math.min(minClearance, distance);
                        }
                    }
                    
                    clearance[y][x] = minClearance;
                }
            }
        }

        return clearance;
    }

    #isValidPosition(grid, x, y) {
        return x >= 0 && x < grid[0].length && y >= 0 && y < grid.length;
    }

    #heuristic(x1, y1, x2, y2) {
        // Manhattan distance
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    #getLowestFScore(openSet, fScore) {
        return Array.from(openSet).reduce((a, b) => 
            (fScore.get(a) || Infinity) < (fScore.get(b) || Infinity) ? a : b
        );
    }

    #reconstructPath(cameFrom, current) {
        const path = [current];
        while (cameFrom.has(current)) {
            current = cameFrom.get(current);
            path.unshift(current);
        }
        return path.map(pos => {
            const [x, y] = pos.split(',').map(Number);
            return { x, y };
        });
    }
}
