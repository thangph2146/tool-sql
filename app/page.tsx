import { DbConnectionStatus } from '@/components/db-connection-status';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-sans">
      <main className="flex min-h-screen w-full flex-col items-center justify-center py-8 px-4 sm:py-16 sm:px-8">
        <div className="w-full max-w-4xl space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              SQL Server Connection Monitor
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto">
              Monitor and check connection status to PSC_HRM and HRM_HUB databases
            </p>
          </div>

          {/* Connection Status Component */}
          <DbConnectionStatus />
        </div>
      </main>
    </div>
  );
}
