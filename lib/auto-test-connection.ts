import { testAllConnections } from './db-manager';
import { logger } from './logger';

let isTesting = false;
let testInterval: NodeJS.Timeout | null = null;

/**
 * Automatically test connections when server starts
 */
export async function autoTestOnStartup(): Promise<void> {
  if (typeof window !== 'undefined') {
    return; // Only run on server
  }

  // Wait a bit to ensure server is ready
  setTimeout(async () => {
    logger.info('Starting automatic database connection test on startup...', undefined, 'AUTO_TEST');
    try {
      const results = await testAllConnections();
      const allConnected = Object.values(results).every(connected => connected);
      
      if (allConnected) {
        logger.success('Automatic connection test successful on startup', results, 'AUTO_TEST');
      } else {
        logger.warn('Automatic connection test failed on startup', results, 'AUTO_TEST');
      }
    } catch (error) {
      logger.error('Error in automatic connection test on startup', error, 'AUTO_TEST');
    }
  }, 2000); // Wait 2 seconds after server starts
}

/**
 * Start periodic connection testing
 * @param intervalSeconds - Time interval between tests (seconds), default 60 seconds
 */
export function startPeriodicTest(intervalSeconds: number = 60): void {
  if (typeof window !== 'undefined') {
    return; // Only run on server
  }

  if (testInterval) {
    logger.warn('Periodic test is already running, stopping old test before starting new one', undefined, 'AUTO_TEST');
    stopPeriodicTest();
  }

  logger.info(`Starting periodic connection test every ${intervalSeconds} seconds`, undefined, 'AUTO_TEST');

  testInterval = setInterval(async () => {
    if (isTesting) {
      logger.debug('Skipping periodic test because another test is running', undefined, 'AUTO_TEST');
      return;
    }

    isTesting = true;
    try {
      await testAllConnections();
    } catch (error) {
      logger.error('Error in periodic connection test', error, 'AUTO_TEST');
    } finally {
      isTesting = false;
    }
  }, intervalSeconds * 1000);
}

/**
 * Stop periodic connection testing
 */
export function stopPeriodicTest(): void {
  if (testInterval) {
    clearInterval(testInterval);
    testInterval = null;
    logger.info('Stopped periodic connection test', undefined, 'AUTO_TEST');
  }
}

// Automatically run test when module is loaded (server only)
if (typeof window === 'undefined') {
  // Test on startup
  autoTestOnStartup();

  // Start periodic test (every 60 seconds)
  // Can be disabled by setting DB_AUTO_TEST_INTERVAL=0 in .env
  const interval = parseInt(process.env.DB_AUTO_TEST_INTERVAL || '60');
  if (interval > 0) {
    startPeriodicTest(interval);
  }

  // Cleanup when application shuts down
  process.on('SIGINT', () => {
    stopPeriodicTest();
  });

  process.on('SIGTERM', () => {
    stopPeriodicTest();
  });
}

