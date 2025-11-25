'use client';

import { XCircle } from 'lucide-react';

interface DatabaseErrorDisplayProps {
  error: string;
}

export function DatabaseErrorDisplay({ error }: DatabaseErrorDisplayProps) {
  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-start gap-2">
        <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
            Connection Error
          </p>
          <div className="text-xs text-muted-foreground space-y-1">
            {error.split('\n').map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

