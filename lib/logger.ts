type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  context?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(entry: LogEntry): string {
    const { timestamp, level, message, context } = entry;
    const contextStr = context ? `[${context}]` : '';
    const levelEmoji = this.getLevelEmoji(level);
    return `${timestamp} ${levelEmoji} ${level.toUpperCase()} ${contextStr} ${message}`;
  }

  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warn':
        return '⚠️';
      case 'debug':
        return '🔍';
      default:
        return 'ℹ️';
    }
  }

  private log(level: LogLevel, message: string, data?: unknown, context?: string): void {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      data,
      context,
    };

    const formattedMessage = this.formatMessage(entry);

    // Log to console with appropriate colors
    switch (level) {
      case 'success':
        console.log(`\x1b[32m${formattedMessage}\x1b[0m`); // Green
        break;
      case 'error':
        console.error(`\x1b[31m${formattedMessage}\x1b[0m`); // Red
        if (data) {
          console.error('Data:', data);
        }
        break;
      case 'warn':
        console.warn(`\x1b[33m${formattedMessage}\x1b[0m`); // Yellow
        if (data) {
          console.warn('Data:', data);
        }
        break;
      case 'debug':
        if (this.isDevelopment) {
          console.log(`\x1b[36m${formattedMessage}\x1b[0m`); // Cyan
          if (data) {
            console.log('Data:', data);
          }
        }
        break;
      default:
        console.log(formattedMessage);
        if (data) {
          console.log('Data:', data);
        }
    }
  }

  info(message: string, data?: unknown, context?: string): void {
    this.log('info', message, data, context);
  }

  success(message: string, data?: unknown, context?: string): void {
    this.log('success', message, data, context);
  }

  warn(message: string, data?: unknown, context?: string): void {
    this.log('warn', message, data, context);
  }

  error(message: string, data?: unknown, context?: string): void {
    this.log('error', message, data, context);
  }

  debug(message: string, data?: unknown, context?: string): void {
    this.log('debug', message, data, context);
  }

  // Log database connection state
  logConnectionState(
    state: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting',
    details?: {
      server?: string;
      database?: string;
      error?: unknown;
      duration?: number;
    }
  ): void {
    const context = 'DB_CONNECTION';
    const { server, database, error, duration } = details || {};

    switch (state) {
      case 'connecting':
        this.info(
          `Connecting to SQL Server${server ? `: ${server}` : ''}${database ? ` | Database: ${database}` : ''}`,
          undefined,
          context
        );
        break;
      case 'connected':
        const connectedMsg = `Successfully connected to SQL Server${server ? `: ${server}` : ''}${database ? ` | Database: ${database}` : ''}${duration ? ` (${duration}ms)` : ''}`;
        this.success(connectedMsg, { server, database, duration }, context);
        break;
      case 'disconnected':
        this.info(
          `Closed SQL Server connection${server ? `: ${server}` : ''}`,
          { server },
          context
        );
        break;
      case 'error':
        const errorMsg = `Connection error to SQL Server${server ? `: ${server}` : ''}${database ? ` | Database: ${database}` : ''}`;
        // Log error with detailed information
        if (error && typeof error === 'object' && 'code' in error) {
          const errorCode = (error as { code?: string }).code;
          let errorMessage = '';
          
          if (errorCode === 'ETIMEOUT') {
            errorMessage = 'Timeout - Unable to connect within the allowed time. Check SQL Server Browser service and TCP/IP protocol.';
          } else if (errorCode === 'EINSTLOOKUP') {
            errorMessage = 'Instance port not found. Solution:\n1. Check SQL Browser is running\n2. Enable TCP/IP in SQL Server Configuration Manager\n3. Restart SQL Browser service\n4. Or specify port directly in .env: DB_PORT=<port_number>';
          } else {
            errorMessage = `Error code: ${errorCode}`;
          }
          
          this.error(`${errorMsg} | ${errorMessage}`, error, context);
        } else {
          this.error(errorMsg, error, context);
        }
        break;
      case 'reconnecting':
        this.warn(
          `Reconnecting to SQL Server${server ? `: ${server}` : ''}`,
          { server, database },
          context
        );
        break;
    }
  }

  // Log query execution
  logQuery(query: string, params?: Record<string, unknown>, duration?: number, database?: string): void {
    if (this.isDevelopment) {
      this.debug(
        `Executing query${duration ? ` (${duration}ms)` : ''}${database ? ` on ${database}` : ''}`,
        { query, params, duration, database },
        'DB_QUERY'
      );
    }
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger;

