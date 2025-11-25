'use client';

export function DatabaseInstructions() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-2">
        Instructions
      </h3>
      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
        <li>Ensure SQL Server is running</li>
        <li>Check .env file is configured correctly</li>
        <li>Verify database access permissions</li>
        <li>Both database_1 and database_2 databases should be accessible</li>
      </ul>
    </div>
  );
}

