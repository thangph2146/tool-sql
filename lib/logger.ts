type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  context?: string;
  flowId?: string;
  step?: number;
}

interface FlowContext {
  flowId: string;
  flowName: string;
  startTime: number;
  step: number;
  metadata?: Record<string, unknown>;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private flows = new Map<string, FlowContext>();
  
  /**
   * Generate a unique flow ID
   */
  private generateFlowId(): string {
    return `flow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  /**
   * Start a new flow for tracking
   */
  startFlow(flowName: string, metadata?: Record<string, unknown>): string {
    const flowId = this.generateFlowId();
    const flowContext: FlowContext = {
      flowId,
      flowName,
      startTime: Date.now(),
      step: 0,
      metadata,
    };
    this.flows.set(flowId, flowContext);
    
    this.log('info', `🚀 Flow started: ${flowName}`, { flowId, metadata }, 'FLOW');
    return flowId;
  }
  
  /**
   * End a flow and log summary
   */
  endFlow(flowId: string, success: boolean = true, summary?: Record<string, unknown>): void {
    const flow = this.flows.get(flowId);
    if (!flow) {
      this.warn(`Flow ${flowId} not found`, undefined, 'FLOW');
      return;
    }
    
    const duration = Date.now() - flow.startTime;
    const level: LogLevel = success ? 'success' : 'error';
    const emoji = success ? '✅' : '❌';
    
    this.log(level, `${emoji} Flow ended: ${flow.flowName} (${duration}ms)`, {
      flowId,
      duration,
      totalSteps: flow.step,
      summary,
      metadata: flow.metadata,
    }, 'FLOW');
    
    this.flows.delete(flowId);
  }
  
  /**
   * Log a step within a flow
   */
  logFlowStep(flowId: string, message: string, data?: unknown, level: LogLevel = 'info'): void {
    const flow = this.flows.get(flowId);
    if (!flow) {
      this.warn(`Flow ${flowId} not found, logging without flow context`, undefined, 'FLOW');
      this.log(level, message, data);
      return;
    }
    
    flow.step += 1;
    this.log(level, `  ↳ Step ${flow.step}: ${message}`, data, undefined, flowId, flow.step);
  }
  
  /**
   * Get current flow ID (for use in async contexts)
   */
  getCurrentFlowId(): string | undefined {
    // This can be extended to use AsyncLocalStorage for automatic flow tracking
    return undefined;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(entry: LogEntry): string {
    const { timestamp, level, message, context, flowId, step } = entry;
    const contextStr = context ? `[${context}]` : '';
    const levelEmoji = this.getLevelEmoji(level);
    const flowStr = flowId ? `[Flow:${flowId.substring(0, 8)}${step ? `:S${step}` : ''}]` : '';
    return `${timestamp} ${levelEmoji} ${level.toUpperCase()} ${contextStr}${flowStr} ${message}`;
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

  private log(
    level: LogLevel, 
    message: string, 
    data?: unknown, 
    context?: string, 
    flowId?: string, 
    step?: number
  ): void {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      data,
      context,
      flowId,
      step,
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

  info(message: string, data?: unknown, context?: string, flowId?: string): void {
    this.log('info', message, data, context, flowId);
  }

  success(message: string, data?: unknown, context?: string, flowId?: string): void {
    this.log('success', message, data, context, flowId);
  }

  warn(message: string, data?: unknown, context?: string, flowId?: string): void {
    this.log('warn', message, data, context, flowId);
  }

  error(message: string, data?: unknown, context?: string, flowId?: string): void {
    this.log('error', message, data, context, flowId);
  }

  debug(message: string, data?: unknown, context?: string, flowId?: string): void {
    this.log('debug', message, data, context, flowId);
  }
  
  /**
   * Create a flow-scoped logger that automatically includes flow ID
   */
  createFlowLogger(flowId: string) {
    return {
      info: (message: string, data?: unknown) => 
        this.logFlowStep(flowId, message, data, 'info'),
      success: (message: string, data?: unknown) => 
        this.logFlowStep(flowId, message, data, 'success'),
      warn: (message: string, data?: unknown) => 
        this.logFlowStep(flowId, message, data, 'warn'),
      error: (message: string, data?: unknown) => 
        this.logFlowStep(flowId, message, data, 'error'),
      debug: (message: string, data?: unknown) => 
        this.logFlowStep(flowId, message, data, 'debug'),
      end: (success: boolean = true, summary?: Record<string, unknown>) => 
        this.endFlow(flowId, success, summary),
    };
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

