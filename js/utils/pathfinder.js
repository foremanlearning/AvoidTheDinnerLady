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
    #config;

    constructor() {
        if (Pathfinder.#instance) {
            return Pathfinder.#instance;
        }
        this.#logger = new Logger();
        this.#loadConfig();
        Pathfinder.#instance = this;
    }

    static getInstance() {
        if (!Pathfinder.#instance) {
            Pathfinder.#instance = new Pathfinder();
        }
        return Pathfinder.#instance;
    }

    async #loadConfig() {
        try {
            const response = await fetch('config/player.ai');
            if (!response.ok) {
                throw new Error('Failed to load player config');
            }
            this.#config = await response.json();
            this.#logger.info('Loaded pathfinding config', this.#config.pathfinding);
        } catch (error) {
            this.#logger.error('Error loading pathfinding config:', error);
            // Use default values if config fails to load
            this.#config = {
                pathfinding: {
                    wallAvoidance: {
                        enabled: true,
                        baseCost: 2.0,
                        maxCost: 5.0,
                        checkRadius: 1
                    },
                    cornerAvoidance: {
                        enabled: true,
                        extraCost: 3.0
                    }
                }
            };
        }
    }

    findPath(grid, startX, startY, endX, endY, gridScale = 1) {
        this.#grid = grid;

        // Convert world coordinates to grid coordinates
        startX = Math.round(startX / gridScale);
        startY = Math.round(startY / gridScale);
        endX = Math.round(endX / gridScale);
        endY = Math.round(endY / gridScale);

        // Validate start position
        if (!this.#isValidPosition(startX, startY)) {
            const validStart = this.#findNearestValidPosition(startX, startY);
            if (!validStart) {
                this.#logger.warn('Start position is not valid', { x: startX * gridScale, y: startY * gridScale });
                return null;
            }
            startX = validStart.x;
            startY = validStart.y;
        }

        // Validate end position
        if (!this.#isValidPosition(endX, endY)) {
            const validEnd = this.#findNearestValidPosition(endX, endY);
            if (!validEnd) {
                this.#logger.warn('End position is not valid', { x: endX * gridScale, y: endY * gridScale });
                return null;
            }
            endX = validEnd.x;
            endY = validEnd.y;
            this.#logger.info('Using nearest valid end position', { x: endX * gridScale, y: endY * gridScale });
        }

        // Validate coordinates
        if (!this.isWalkable(startX, startY)) {
            this.#logger.warn('Start position is not valid', { x: startX * gridScale, y: startY * gridScale });
            return null;
        }
        
        if (!this.isWalkable(endX, endY)) {
            this.#logger.warn('End position is not valid', { x: endX * gridScale, y: endY * gridScale });
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
            
            if (typeof current !== 'string') {
                current = `${current.x},${current.y}`;
            }

            const [currentX, currentY] = current.split(',').map(Number);

            if (currentX === endX && currentY === endY) {
                return this.#reconstructPath(cameFrom, current, gridScale);
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

                // Add wall proximity cost to movement cost
                const wallProximityCost = this.#calculateWallProximityCost(newX, newY);
                const tentativeGScore = gScore.get(current) + 1 + wallProximityCost;

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
        if (!this.#isValidPosition(x, y)) {
            this.#logger.debug('Position out of bounds', { x, y });
            return false;
        }
        
        const cell = this.#grid[y][x];
        const isWalkable = cell !== '1';
        
        this.#logger.debug('Checking walkable', { x, y, cell, isWalkable });
        return isWalkable;
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

    #calculateWallProximityCost(x, y) {
        if (!this.#config?.pathfinding?.wallAvoidance?.enabled) {
            return 0;
        }

        const config = this.#config.pathfinding.wallAvoidance;
        const radius = config.checkRadius || 1;
        let wallCount = 0;
        let cornerCount = 0;

        // Check surrounding cells in the specified radius
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx === 0 && dy === 0) continue;
                
                const checkX = x + dx;
                const checkY = y + dy;
                
                if (this.#isValidPosition(checkX, checkY) && this.#grid[checkY][checkX] === '1') {
                    // Calculate distance-based weight
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const weight = 1 / distance;
                    wallCount += weight;

                    // Check for corners (cells with two adjacent walls)
                    if (this.#config.pathfinding.cornerAvoidance.enabled &&
                        this.#isCorner(checkX, checkY)) {
                        cornerCount++;
                    }
                }
            }
        }

        // Calculate total cost
        let cost = wallCount * config.baseCost;
        
        // Add corner avoidance cost
        if (this.#config.pathfinding.cornerAvoidance.enabled) {
            cost += cornerCount * this.#config.pathfinding.cornerAvoidance.extraCost;
        }

        this.#logger.debug('Wall proximity cost', {
            position: { x, y },
            wallCount,
            cornerCount,
            totalCost: Math.min(cost, config.maxCost)
        });

        return Math.min(cost, config.maxCost);
    }

    #isCorner(x, y) {
        const neighbors = [
            [-1, 0], [1, 0],  // horizontal
            [0, -1], [0, 1]   // vertical
        ];

        let wallCount = 0;
        for (const [dx, dy] of neighbors) {
            const checkX = x + dx;
            const checkY = y + dy;
            if (this.#isValidPosition(checkX, checkY) && this.#grid[checkY][checkX] === '1') {
                wallCount++;
            }
        }

        return wallCount >= 2;
    }

    #isValidPosition(x, y) {
        // Check if position is within grid bounds
        if (x < 0 || x >= this.#grid[0].length || y < 0 || y >= this.#grid.length) {
            return false;
        }

        // Check if position is walkable (not a wall)
        return this.#grid[y][x] === '0';
    }

    #findNearestValidPosition(x, y) {
        const maxRadius = 5; // Maximum search radius
        
        // Check positions in expanding circles
        for (let radius = 1; radius <= maxRadius; radius++) {
            // Check all positions at current radius
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // Only check positions exactly at current radius
                    if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                        const checkX = Math.round(x + dx);
                        const checkY = Math.round(y + dy);
                        
                        if (this.#isValidPosition(checkX, checkY)) {
                            return { x: checkX, y: checkY };
                        }
                    }
                }
            }
        }
        
        return null; // No valid position found within radius
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

    #reconstructPath(cameFrom, current, gridScale) {
        const path = [current];
        while (cameFrom.has(current)) {
            current = cameFrom.get(current);
            path.unshift(current);
        }
        return path.map(pos => {
            const [x, y] = pos.split(',').map(Number);
            return { x: x * gridScale, z: y * gridScale };
        });
    }
}
