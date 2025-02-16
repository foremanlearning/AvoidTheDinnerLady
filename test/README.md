# Game Test Suite

This test suite helps identify JavaScript console errors and logs when running the game.

## Setup

1. Install Node.js if you haven't already
2. Install Chrome browser
3. Run `npm install` in the project root directory

## Running Tests

Run the test with:
```bash
npm test
```

This will:
1. Start a local server to host the game
2. Launch Chrome in headless mode
3. Load the game
4. Capture and display all console output
5. Automatically clean up when done

## What's Being Tested

- JavaScript errors and exceptions
- Game initialization
- Resource loading
- Console logging output

## Troubleshooting

If you get ChromeDriver version mismatch errors:
1. Check your Chrome version
2. Update the chromedriver version in package.json to match
3. Run `npm install` again
