'use client';

import { useState } from 'react';
import { Server, ChevronDown, ChevronRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Field, FieldGroup, FieldLabel, FieldContent, FieldTitle } from '@/components/ui/field';

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
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className="mt-4 pt-4">
      <Separator className="mb-4" />
      <FieldGroup>
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={toggleExpand}
            className="flex items-center justify-center w-5 h-5 rounded hover:bg-muted transition-colors"
            title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <Server className="h-4 w-4 text-muted-foreground" />
          <FieldTitle>Server Information</FieldTitle>
        </div>
        {isExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
            <Field orientation="vertical">
              <FieldLabel>Server</FieldLabel>
              <FieldContent>
                <p className="text-sm font-medium text-foreground">
                  {serverInfo.ServerName}
                </p>
              </FieldContent>
            </Field>
            <Field orientation="vertical">
              <FieldLabel>Database</FieldLabel>
              <FieldContent>
                <p className="text-sm font-medium text-foreground">
                  {serverInfo.CurrentDatabase}
                </p>
              </FieldContent>
            </Field>
            <Field orientation="vertical">
              <FieldLabel>User</FieldLabel>
              <FieldContent>
                <p className="text-sm font-medium text-foreground">
                  {serverInfo.CurrentUser}
                </p>
              </FieldContent>
            </Field>
            <Field orientation="vertical" className="sm:col-span-2">
              <FieldLabel>Version</FieldLabel>
              <FieldContent>
                <p className="text-sm font-medium text-foreground break-all">
                  {serverInfo.Version}
                </p>
              </FieldContent>
            </Field>
          </div>
        )}
      </FieldGroup>
    </div>
  );
}

