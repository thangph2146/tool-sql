import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

type FlowLogger = ReturnType<typeof logger.createFlowLogger>;

interface UseFlowLoggerOptions {
  flowName: string;
  metadata?: Record<string, unknown>;
  enabled?: boolean;
  onEnd?: (success: boolean, summary?: Record<string, unknown>) => void;
}

/**
 * Hook to manage flow logging lifecycle
 * Automatically starts flow on mount and ends on unmount
 */
export function useFlowLogger({
  flowName,
  metadata,
  enabled = true,
  onEnd,
}: UseFlowLoggerOptions) {
  const flowLogRef = useRef<FlowLogger | null>(null);
  const flowIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Start flow
    const flowId = logger.startFlow(flowName, metadata);
    flowIdRef.current = flowId;
    flowLogRef.current = logger.createFlowLogger(flowId);

    // Cleanup: end flow on unmount
    return () => {
      if (flowLogRef.current && flowIdRef.current) {
        const success = true;
        const summary = { reason: 'Component unmounted' };
        flowLogRef.current.end(success, summary);
        onEnd?.(success, summary);
        flowLogRef.current = null;
        flowIdRef.current = null;
      }
    };
  }, [flowName, enabled]); // Only recreate if flowName or enabled changes

  return {
    flowLog: flowLogRef.current,
    flowId: flowIdRef.current,
    end: (success: boolean = true, summary?: Record<string, unknown>) => {
      if (flowLogRef.current) {
        flowLogRef.current.end(success, summary);
        onEnd?.(success, summary);
        flowLogRef.current = null;
        flowIdRef.current = null;
      }
    },
  };
}

/**
 * Hook for flow logging with key-based lifecycle management
 * Useful when flow should restart when key changes
 */
export function useFlowLoggerWithKey<T extends string | number>(
  key: T,
  flowName: (key: T) => string,
  metadata?: (key: T) => Record<string, unknown>,
  enabled: boolean = true
) {
  const flowLogRef = useRef<FlowLogger | null>(null);
  const flowIdRef = useRef<string | null>(null);
  const currentKeyRef = useRef<T | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const currentKey = key;

    // End previous flow if key changed
    if (currentKeyRef.current !== null && currentKeyRef.current !== currentKey && flowLogRef.current) {
      flowLogRef.current.end(true, {
        reason: 'Key changed',
        previousKey: currentKeyRef.current,
        newKey: currentKey,
      });
      flowLogRef.current = null;
      flowIdRef.current = null;
    }

    // Start new flow if not exists or key changed
    if (!flowLogRef.current || currentKeyRef.current !== currentKey) {
      const name = flowName(currentKey);
      const meta = metadata ? metadata(currentKey) : undefined;
      const flowId = logger.startFlow(name, meta);
      flowIdRef.current = flowId;
      flowLogRef.current = logger.createFlowLogger(flowId);
      currentKeyRef.current = currentKey;
    }

    // Cleanup: end flow on unmount
    return () => {
      if (flowLogRef.current && flowIdRef.current) {
        flowLogRef.current.end(true, { reason: 'Component unmounted' });
        flowLogRef.current = null;
        flowIdRef.current = null;
        currentKeyRef.current = null;
      }
    };
  }, [key, enabled, flowName, metadata]);

  return {
    flowLog: flowLogRef.current,
    flowId: flowIdRef.current,
    end: (success: boolean = true, summary?: Record<string, unknown>) => {
      if (flowLogRef.current) {
        flowLogRef.current.end(success, summary);
        flowLogRef.current = null;
        flowIdRef.current = null;
        currentKeyRef.current = null;
      }
    },
  };
}

