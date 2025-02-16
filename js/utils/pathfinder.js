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
    #grid;

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

    findPath(grid, startX, startY, endX, endY, gridScale = 2) {
        this.#grid = grid; // Store grid for use in isWalkable

        // Convert from world coordinates to grid coordinates
        startX = Math.floor(startX / gridScale);
        startY = Math.floor(startY / gridScale);
        endX = Math.floor(endX / gridScale);
        endY = Math.floor(endY / gridScale);

        // Validate coordinates
        if (!this.isWalkable(startX, startY) || !this.isWalkable(endX, endY)) {
            this.#logger.warn('Start or end position is not valid', { startX, startY, endX, endY });
            return null;
        }

        const openSet = new Set([`${startX},${startY}`]);
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        gScore.set(`${startX},${startY}`, 0);
        fScore.set(`${startX},${startY}`, this.#heuristic(startX, startY, endX, endY));

        while (openSet.size > 0) {
            let current = this.#getLowestFScore(openSet, fScore);
            
            // Ensure current is a string coordinate
            if (typeof current !== 'string') {
                // Handle both object {x,y} and string 'x,y' formats
                current = typeof current === 'object' ? `${current.x},${current.y}` : String(current);
            }

            const [currentX, currentY] = current.split(',').map(Number);

            if (currentX === endX && currentY === endY) {
                const path = this.#reconstructPath(cameFrom, current);
                // Convert path back to world coordinates
                const worldPath = path.map(pos => {
                    // Handle both object and string formats
                    if (typeof pos === 'object') {
                        return `${pos.x * gridScale},${pos.y * gridScale}`;
                    }
                    const [x, y] = pos.split(',').map(Number);
                    return `${x * gridScale},${y * gridScale}`;
                });
                this.#logger.debug('Path found', { worldPath });
                return worldPath;
            }

            openSet.delete(current);
            closedSet.add(current);

            // Check all neighbors (no diagonals)
            const neighbors = [
                [0, 1],  // up
                [1, 0],  // right
                [0, -1], // down
                [-1, 0]  // left
            ];

            for (const [dx, dy] of neighbors) {
                const newX = currentX + dx;
                const newY = currentY + dy;

                if (!this.isWalkable(newX, newY)) continue;

                const neighbor = `${newX},${newY}`;
                if (closedSet.has(neighbor)) continue;

                const tentativeGScore = gScore.get(current) + 1;

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

        this.#logger.warn('No path found');
        return null;
    }

    isWalkable(x, y) {
        // Check if position is walkable
        if (!this.#isValidPosition(x, y)) return false;
        return this.#grid[y][x] !== '1'; // Check for non-wall tiles
    }

    #calculateClearance(grid) {
        const height = grid.length;
        const width = grid[0].length;
        const clearance = Array(height).fill().map(() => Array(width).fill(0));

        // For each walkable cell, calculate its clearance value
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (grid[y][x] !== '1') { // If walkable
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
                            while (this.#isValidPosition(checkX, checkY) && grid[checkY][checkX] !== '1') {
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

    #isValidPosition(x, y) {
        return x >= 0 && x < this.#grid[0].length && y >= 0 && y < this.#grid.length;
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
