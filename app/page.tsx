import { DbConnectionStatus } from '@/components/database/connection';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-sans">
      <main className="flex min-h-screen w-full flex-col items-center justify-center py-4 px-4">
        <div className="w-full space-y-8">
          {/* Connection Status Component */}
          <DbConnectionStatus />
        </div>
      </main>
    </div>
  );
}
