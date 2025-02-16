const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const express = require('express');
const path = require('path');

async function runTest() {
    // Set up express server to serve the game files
    const app = express();
    const projectRoot = path.join(__dirname, '..');
    app.use(express.static(projectRoot));
    
    const server = app.listen(3000, () => {
        console.log('Test server running on http://localhost:3000');
    });

    // Set up Chrome with mobile emulation for iPhone SE
    const options = new chrome.Options();
    options.addArguments('--headless');
    options.addArguments('--enable-logging');
    options.addArguments('--v=1');
    
    // iPhone SE dimensions and user agent
    const deviceMetrics = {
        width: 375,
        height: 667,
        pixelRatio: 2,
        mobile: true,
        deviceScaleFactor: 2
    };
    
    options.setMobileEmulation({
        deviceMetrics: deviceMetrics,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15.0 Safari/604.1'
    });
    
    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

    try {
        // Navigate to the game
        await driver.get('http://localhost:3000');
        
        // Wait for game initialization
        await driver.wait(async () => {
            return await driver.executeScript(`
                return window.game && window.game.isInitialized();
            `);
        }, 5000, 'Game failed to initialize');
        
        // Initialize the level
        await driver.executeScript(`
            const game = window.game;
            if (!game) {
                throw new Error('Game not initialized');
            }
            
            const levelManager = game.getLevelManager();
            if (!levelManager) {
                throw new Error('Level manager not initialized');
            }
            
            // Load level 0 (tutorial)
            await levelManager.loadLevel(0);
            
            // Get current level and grid
            const currentLevel = levelManager.getCurrentLevel();
            if (!currentLevel || !currentLevel.grid) {
                throw new Error('Level or grid not loaded');
            }
            
            console.log('Level loaded:', {
                id: currentLevel.id,
                gridSize: {
                    width: currentLevel.grid[0].length,
                    height: currentLevel.grid.length
                }
            });
        `);
        
        // Wait for level to load
        await driver.sleep(1000);

        // Get canvas dimensions and calculate click position
        const canvas = await driver.executeScript(`
            const canvas = document.querySelector('canvas');
            const rect = canvas.getBoundingClientRect();
            return {
                width: rect.width,
                height: rect.height,
                rect: rect
            };
        `);
        console.log('Canvas dimensions:', canvas);

        // Click at 60% across and 40% down the screen to account for perspective camera
        const clickX = Math.floor(canvas.width * 0.6);
        const clickY = Math.floor(canvas.height * 0.4);
        console.log('Clicking at position:', `(${clickX}, ${clickY})`);

        // Dispatch both touch and mouse events for maximum compatibility
        await driver.executeScript(`
            const canvas = document.querySelector('canvas');
            const rect = canvas.getBoundingClientRect();
            const x = ${clickX};
            const y = ${clickY};
            
            // Create touch event
            const touch = new Touch({
                identifier: 1,
                target: canvas,
                clientX: x,
                clientY: y,
                pageX: x,
                pageY: y,
                radiusX: 2.5,
                radiusY: 2.5,
                rotationAngle: 0,
                force: 1
            });
            
            // Dispatch touch events
            canvas.dispatchEvent(new TouchEvent('touchstart', {
                cancelable: true,
                bubbles: true,
                touches: [touch],
                targetTouches: [touch],
                changedTouches: [touch]
            }));
            
            // Small delay to simulate a tap
            setTimeout(() => {
                canvas.dispatchEvent(new TouchEvent('touchend', {
                    cancelable: true,
                    bubbles: true,
                    touches: [],
                    targetTouches: [],
                    changedTouches: [touch]
                }));
                
                // Also dispatch mouse events as fallback
                const mouseEvent = new MouseEvent('click', {
                    clientX: x,
                    clientY: y,
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                canvas.dispatchEvent(mouseEvent);
            }, 50);
        `);

        // Wait for any animations or state updates
        await driver.sleep(1000);

        // Get console logs
        const logs = await driver.manage().logs().get('browser');
        
        console.log('\nConsole Output:');
        console.log('---------------');
        logs.forEach(log => {
            // Format timestamp
            const time = new Date(log.timestamp).toLocaleTimeString();
            console.log(`[${time}] [${log.level.name}] ${log.message}`);
        });

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        // Clean up
        await driver.quit();
        server.close();
    }
}

// Create package.json if it doesn't exist
const fs = require('fs');
const packageJsonPath = path.join(__dirname, '..', 'package.json');

if (!fs.existsSync(packageJsonPath)) {
    const packageJson = {
        "name": "avoid-the-dinner-lady",
        "version": "1.0.0",
        "description": "Game testing suite",
        "scripts": {
            "test": "node test/gameTest.js"
        },
        "dependencies": {
            "express": "^4.17.1",
            "selenium-webdriver": "^4.0.0-beta.4",
            "chromedriver": "^91.0.0"
        }
    };
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('Created package.json');
}

runTest().catch(console.error);
