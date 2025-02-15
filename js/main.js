document.addEventListener('DOMContentLoaded', async () => {
    const logger = new Logger();
    logger.setLogLevel(GameConfig.logLevel);
    logger.info('Starting Cube-A-Lot...');

    try {
        // Initialize game
        const game = Game.getInstance();
        await game.initialize();
        
        logger.info('Cube-A-Lot started successfully');
    } catch (error) {
        logger.error(`Failed to start game: ${error}`);
    }
});
