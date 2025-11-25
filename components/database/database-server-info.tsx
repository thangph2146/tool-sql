'use client';

import { Server } from 'lucide-react';

interface ServerInfo {
  ServerName: string;
  Version: string;
  CurrentDatabase: string;
  CurrentUser: string;
}

interface DatabaseServerInfoProps {
  serverInfo: ServerInfo;
}

export function DatabaseServerInfo({ serverInfo }: DatabaseServerInfoProps) {
  return (
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
            {serverInfo.ServerName}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Database:</span>
          <p className="font-medium text-foreground">
            {serverInfo.CurrentDatabase}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">User:</span>
          <p className="font-medium text-foreground">
            {serverInfo.CurrentUser}
          </p>
        </div>
        <div className="sm:col-span-2">
          <span className="text-muted-foreground">Version:</span>
          <p className="font-medium text-foreground text-xs break-all">
            {serverInfo.Version}
          </p>
        </div>
      </div>
    </div>
  );
}

