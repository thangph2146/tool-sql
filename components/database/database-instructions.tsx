'use client';

import { FieldGroup, FieldTitle } from '@/components/ui/field';

export function DatabaseInstructions() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <FieldGroup>
        <FieldTitle>Instructions</FieldTitle>
        <div className="text-muted-foreground text-sm leading-normal font-normal mt-2">
          <ul className="text-xs space-y-1 list-disc list-inside">
            <li>Ensure SQL Server is running</li>
            <li>Check .env file is configured correctly</li>
            <li>Verify database access permissions</li>
            <li>Both database_1 and database_2 databases should be accessible</li>
          </ul>
        </div>
      </FieldGroup>
    </div>
  );
}

