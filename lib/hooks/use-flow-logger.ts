import { useEffect, useRef, useState, useCallback } from 'react';
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
  const [flowLog, setFlowLog] = useState<FlowLogger | null>(null);
  const [flowId, setFlowId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Use setTimeout to defer state update and avoid cascading renders
      setTimeout(() => {
        setFlowLog(null);
        setFlowId(null);
      }, 0);
      return;
    }

    // Start flow
    const newFlowId = logger.startFlow(flowName, metadata);
    const newFlowLog = logger.createFlowLogger(newFlowId);
    flowIdRef.current = newFlowId;
    flowLogRef.current = newFlowLog;
    // Use setTimeout to defer state update and avoid cascading renders
    setTimeout(() => {
      setFlowId(newFlowId);
      setFlowLog(newFlowLog);
    }, 0);

    // Cleanup: end flow on unmount
    return () => {
      if (flowLogRef.current && flowIdRef.current) {
        const success = true;
        const summary = { reason: 'Component unmounted' };
        flowLogRef.current.end(success, summary);
        onEnd?.(success, summary);
        flowLogRef.current = null;
        flowIdRef.current = null;
        // Use setTimeout to defer state update and avoid cascading renders
        setTimeout(() => {
          setFlowLog(null);
          setFlowId(null);
        }, 0);
      }
    };
  }, [flowName, enabled, metadata, onEnd]);

  const end = useCallback((success: boolean = true, summary?: Record<string, unknown>) => {
    if (flowLogRef.current) {
      flowLogRef.current.end(success, summary);
      onEnd?.(success, summary);
      flowLogRef.current = null;
      flowIdRef.current = null;
      setFlowLog(null);
      setFlowId(null);
    }
  }, [onEnd]);

  return {
    flowLog,
    flowId,
    end,
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
  const [flowLog, setFlowLog] = useState<FlowLogger | null>(null);
  const [flowId, setFlowId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Use setTimeout to defer state update and avoid cascading renders
      setTimeout(() => {
        setFlowLog(null);
        setFlowId(null);
      }, 0);
      return;
    }

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
      // Use setTimeout to defer state update and avoid cascading renders
      setTimeout(() => {
        setFlowLog(null);
        setFlowId(null);
      }, 0);
    }

    // Start new flow if not exists or key changed
    if (!flowLogRef.current || currentKeyRef.current !== currentKey) {
      const name = flowName(currentKey);
      const meta = metadata ? metadata(currentKey) : undefined;
      const newFlowId = logger.startFlow(name, meta);
      const newFlowLog = logger.createFlowLogger(newFlowId);
      flowIdRef.current = newFlowId;
      flowLogRef.current = newFlowLog;
      currentKeyRef.current = currentKey;
      // Use setTimeout to defer state update and avoid cascading renders
      setTimeout(() => {
        setFlowId(newFlowId);
        setFlowLog(newFlowLog);
      }, 0);
    }

    // Cleanup: end flow on unmount
    return () => {
      if (flowLogRef.current && flowIdRef.current) {
        flowLogRef.current.end(true, { reason: 'Component unmounted' });
        flowLogRef.current = null;
        flowIdRef.current = null;
        currentKeyRef.current = null;
        // Use setTimeout to defer state update and avoid cascading renders
        setTimeout(() => {
          setFlowLog(null);
          setFlowId(null);
        }, 0);
      }
    };
  }, [key, enabled, flowName, metadata]);

  const end = useCallback((success: boolean = true, summary?: Record<string, unknown>) => {
    if (flowLogRef.current) {
      flowLogRef.current.end(success, summary);
      flowLogRef.current = null;
      flowIdRef.current = null;
      currentKeyRef.current = null;
      setFlowLog(null);
      setFlowId(null);
    }
  }, []);

  return {
    flowLog,
    flowId,
    end,
  };
}

