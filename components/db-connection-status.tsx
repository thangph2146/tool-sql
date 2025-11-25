'use client';

import { useState, useEffect } from 'react';
import { Database, CheckCircle2, XCircle, Loader2, RefreshCw, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

type DatabaseName = 'PSC_HRM' | 'HRM_HUB';

interface ServerInfo {
  ServerName: string;
  Version: string;
  CurrentDatabase: string;
  CurrentUser: string;
}

interface DatabaseStatus {
  status: 'idle' | 'connecting' | 'connected' | 'error';
  serverInfo?: ServerInfo;
  error?: string;
  lastChecked?: Date;
}

interface AllConnectionsStatus {
  PSC_HRM: DatabaseStatus;
  HRM_HUB: DatabaseStatus;
}

export function DbConnectionStatus() {
  const [connections, setConnections] = useState<AllConnectionsStatus>({
    PSC_HRM: { status: 'idle' },
    HRM_HUB: { status: 'idle' },
  });
  const [isLoading, setIsLoading] = useState(false);

  const testConnection = async (databaseName?: DatabaseName) => {
    setIsLoading(true);
    
    if (databaseName) {
      // Test single database
      setConnections(prev => ({
        ...prev,
        [databaseName]: { ...prev[databaseName], status: 'connecting' },
      }));

      try {
        const response = await fetch(`/api/db/test?database=${databaseName}`);
        const data = await response.json();

        if (data.success && data.data?.connected) {
          setConnections(prev => ({
            ...prev,
            [databaseName]: {
              status: 'connected',
              serverInfo: data.data.serverInfo,
              lastChecked: new Date(),
            },
          }));
        } else {
          setConnections(prev => ({
            ...prev,
            [databaseName]: {
              status: 'error',
              error: data.error || data.message || 'Unable to connect to database',
              lastChecked: new Date(),
            },
          }));
        }
      } catch (error) {
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
          // Handle common error types
          if (error.message.includes('ETIMEOUT') || error.message.includes('timeout')) {
            errorMessage = 'Timeout: Unable to connect to server within allowed time. Please check:\n- SQL Server is running\n- Server name and port are correct\n- Firewall is not blocking connection';
          } else if (error.message.includes('ECONNREFUSED')) {
            errorMessage = 'Connection refused. Check if SQL Server is running.';
          } else if (error.message.includes('ENOTFOUND')) {
            errorMessage = 'Server not found. Check server name in .env file.';
          }
        }
        setConnections(prev => ({
          ...prev,
          [databaseName]: {
            status: 'error',
            error: errorMessage,
            lastChecked: new Date(),
          },
        }));
      }
    } else {
      // Test all databases
      setConnections({
        PSC_HRM: { status: 'connecting' },
        HRM_HUB: { status: 'connecting' },
      });

      try {
        const response = await fetch('/api/db/test');
        const data = await response.json();

        if (data.success && data.data?.connections) {
          const results = data.data.connections;
          const serverInfos = data.data.serverInfos || {};

          setConnections({
            PSC_HRM: {
              status: results.PSC_HRM ? 'connected' : 'error',
              serverInfo: serverInfos.PSC_HRM,
              error: results.PSC_HRM ? undefined : 'Connection failed',
              lastChecked: new Date(),
            },
            HRM_HUB: {
              status: results.HRM_HUB ? 'connected' : 'error',
              serverInfo: serverInfos.HRM_HUB,
              error: results.HRM_HUB ? undefined : 'Connection failed',
              lastChecked: new Date(),
            },
          });
        } else {
          setConnections({
            PSC_HRM: {
              status: 'error',
              error: data.error || data.message || 'Unable to connect to databases',
              lastChecked: new Date(),
            },
            HRM_HUB: {
              status: 'error',
              error: data.error || data.message || 'Unable to connect to databases',
              lastChecked: new Date(),
            },
          });
        }
      } catch (error) {
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        setConnections({
          PSC_HRM: {
            status: 'error',
            error: errorMessage,
            lastChecked: new Date(),
          },
          HRM_HUB: {
            status: 'error',
            error: errorMessage,
            lastChecked: new Date(),
          },
        });
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    // Auto test connections when component mounts (deferred to avoid cascading renders)
    const timeoutId = setTimeout(() => {
      testConnection();
    }, 0);

    // Auto test periodically every 30 seconds
    const autoTestInterval = setInterval(() => {
      testConnection();
    }, 30000); // 30 seconds

    // Cleanup interval and timeout when component unmounts
    return () => {
      clearTimeout(timeoutId);
      clearInterval(autoTestInterval);
    };
  }, []); // Run only once when mount

  const getStatusIcon = (status: DatabaseStatus['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'connecting':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Database className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: DatabaseStatus['status']) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Connection Error';
      case 'connecting':
        return 'Connecting...';
      default:
        return 'Not Checked';
    }
  };

  const getStatusColor = (status: DatabaseStatus['status']) => {
    switch (status) {
      case 'connected':
        return 'border-green-500 bg-green-50 dark:bg-green-950/20';
      case 'error':
        return 'border-red-500 bg-red-50 dark:bg-red-950/20';
      case 'connecting':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-950/20';
      default:
        return 'border-gray-300 bg-gray-50 dark:bg-gray-900';
    }
  };

  const renderDatabaseCard = (databaseName: DatabaseName, dbStatus: DatabaseStatus) => {
    return (
      <div
        key={databaseName}
        className={cn(
          'rounded-lg border-2 p-6 transition-all duration-300',
          getStatusColor(dbStatus.status)
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getStatusIcon(dbStatus.status)}
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {databaseName} Database
              </h2>
              <p className="text-sm text-muted-foreground">{getStatusText(dbStatus.status)}</p>
            </div>
          </div>
          <button
            onClick={() => testConnection(databaseName)}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Testing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Test Again</span>
              </>
            )}
          </button>
        </div>

        {dbStatus.lastChecked && (
          <p className="text-xs text-muted-foreground mb-4">
            Last checked:{' '}
            {dbStatus.lastChecked.toLocaleString('en-US')}
          </p>
        )}

        {/* Server Information */}
        {dbStatus.status === 'connected' && dbStatus.serverInfo && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Server className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Server Information
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Server:</span>
                <p className="font-medium text-foreground">
                  {dbStatus.serverInfo.ServerName}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Database:</span>
                <p className="font-medium text-foreground">
                  {dbStatus.serverInfo.CurrentDatabase}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">User:</span>
                <p className="font-medium text-foreground">
                  {dbStatus.serverInfo.CurrentUser}
                </p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Version:</span>
                <p className="font-medium text-foreground text-xs break-all">
                  {dbStatus.serverInfo.Version}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {dbStatus.status === 'error' && dbStatus.error && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                  Connection Error
                </p>
                <div className="text-xs text-muted-foreground space-y-1">
                  {dbStatus.error.split('\n').map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Header with Test All Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">
          Database Connection Status
        </h2>
        <button
          onClick={() => testConnection()}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Testing All...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Test All Databases</span>
            </>
          )}
        </button>
      </div>

      {/* Database Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderDatabaseCard('PSC_HRM', connections.PSC_HRM)}
        {renderDatabaseCard('HRM_HUB', connections.HRM_HUB)}
      </div>

      {/* Instructions */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">
          Instructions
        </h3>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>Ensure SQL Server is running</li>
          <li>Check .env file is configured correctly</li>
          <li>Verify database access permissions</li>
          <li>Both PSC_HRM and HRM_HUB databases should be accessible</li>
        </ul>
      </div>
    </div>
  );
}
