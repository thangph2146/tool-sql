'use client';

import { FieldGroup, FieldTitle, FieldDescription } from '@/components/ui/field';

export function DatabaseInstructions() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <FieldGroup>
        <FieldTitle>Instructions</FieldTitle>
        <FieldDescription>
          <ul className="text-xs space-y-1 list-disc list-inside mt-2">
            <li>Ensure SQL Server is running</li>
            <li>Check .env file is configured correctly</li>
            <li>Verify database access permissions</li>
            <li>Both database_1 and database_2 databases should be accessible</li>
          </ul>
        </FieldDescription>
      </FieldGroup>
    </div>
  );
}

