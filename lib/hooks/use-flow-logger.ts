import { useEffect, useRef, useState, useCallback, startTransition } from 'react';
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
  const metadataRef = useRef(metadata);
  const onEndRef = useRef(onEnd);
  const flowNameRef = useRef(flowName);
  const previousFlowNameRef = useRef<string | null>(null);
  const [flowLog, setFlowLog] = useState<FlowLogger | null>(null);
  const [flowId, setFlowId] = useState<string | null>(null);

  // Update refs when values change (but don't trigger effect)
  useEffect(() => {
    metadataRef.current = metadata;
    onEndRef.current = onEnd;
    flowNameRef.current = flowName;
  }, [flowName, metadata, onEnd]);

  useEffect(() => {
    if (!enabled) {
      // Clear flow immediately when disabled
      if (flowLogRef.current && flowIdRef.current) {
        flowLogRef.current.end(true, { reason: 'Flow disabled' });
        onEndRef.current?.(true, { reason: 'Flow disabled' });
      }
      flowLogRef.current = null;
      flowIdRef.current = null;
      previousFlowNameRef.current = null;
      startTransition(() => {
        setFlowLog(null);
        setFlowId(null);
      });
      return;
    }

    const currentFlowName = flowNameRef.current;
    const flowNameChanged = previousFlowNameRef.current !== null && previousFlowNameRef.current !== currentFlowName;

    // End previous flow if flowName changed
    if (flowNameChanged && flowLogRef.current && flowIdRef.current) {
      flowLogRef.current.end(true, {
        reason: 'Flow name changed',
        previousFlowName: previousFlowNameRef.current,
        newFlowName: currentFlowName,
      });
      onEndRef.current?.(true, {
        reason: 'Flow name changed',
        previousFlowName: previousFlowNameRef.current,
        newFlowName: currentFlowName,
      });
      flowLogRef.current = null;
      flowIdRef.current = null;
      startTransition(() => {
        setFlowLog(null);
        setFlowId(null);
      });
    }

    // Start new flow if we don't have one or flowName changed
    // Note: We check refs, not state, to avoid unnecessary re-runs
    if (!flowLogRef.current || flowIdRef.current === null || flowNameChanged) {
      const newFlowId = logger.startFlow(currentFlowName, metadataRef.current);
      const newFlowLog = logger.createFlowLogger(newFlowId);
      flowIdRef.current = newFlowId;
      flowLogRef.current = newFlowLog;
      previousFlowNameRef.current = currentFlowName;
      startTransition(() => {
        setFlowId(newFlowId);
        setFlowLog(newFlowLog);
      });
    }

    // Cleanup: end flow on unmount
    return () => {
      if (flowLogRef.current && flowIdRef.current) {
        const success = true;
        const summary = { reason: 'Component unmounted' };
        flowLogRef.current.end(success, summary);
        onEndRef.current?.(success, summary);
        flowLogRef.current = null;
        flowIdRef.current = null;
        startTransition(() => {
          setFlowLog(null);
          setFlowId(null);
        });
      }
    };
  }, [flowName, enabled]);

  const end = useCallback((success: boolean = true, summary?: Record<string, unknown>) => {
    if (flowLogRef.current) {
      flowLogRef.current.end(success, summary);
      onEndRef.current?.(success, summary);
      flowLogRef.current = null;
      flowIdRef.current = null;
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
  const previousKeyRef = useRef<T | null>(null);
  const previousEnabledRef = useRef<boolean>(enabled);
  const flowNameRef = useRef(flowName);
  const metadataRef = useRef(metadata);
  const [flowLog, setFlowLog] = useState<FlowLogger | null>(null);
  const [flowId, setFlowId] = useState<string | null>(null);

  // Update refs when functions change (but don't trigger effect)
  useEffect(() => {
    flowNameRef.current = flowName;
    metadataRef.current = metadata;
  }, [flowName, metadata]);

  useEffect(() => {
    const previousKey = previousKeyRef.current;
    const keyChanged = previousKey !== null && previousKey !== key;

    if (!enabled) {
      // Clear flow immediately when disabled
      if (flowLogRef.current && flowIdRef.current) {
        flowLogRef.current.end(true, { reason: 'Flow disabled' });
      }
      flowLogRef.current = null;
      flowIdRef.current = null;
      currentKeyRef.current = null;
      previousKeyRef.current = key;
      previousEnabledRef.current = enabled;
      startTransition(() => {
        setFlowLog(null);
        setFlowId(null);
      });
      return;
    }

    const currentKey = key;

    // End previous flow if key changed (but not if this is the first run)
    if (keyChanged && previousKey !== null && flowLogRef.current && flowIdRef.current) {
      flowLogRef.current.end(true, {
        reason: 'Key changed',
        previousKey: previousKey,
        newKey: currentKey,
      });
      flowLogRef.current = null;
      flowIdRef.current = null;
      startTransition(() => {
        setFlowLog(null);
        setFlowId(null);
      });
    }

    // Start new flow only if not exists or key actually changed
    // Check currentKeyRef to ensure we don't create duplicate flows
    if (!flowLogRef.current || flowIdRef.current === null || (keyChanged && currentKeyRef.current !== currentKey)) {
      const name = flowNameRef.current(currentKey);
      const meta = metadataRef.current ? metadataRef.current(currentKey) : undefined;
      const newFlowId = logger.startFlow(name, meta);
      const newFlowLog = logger.createFlowLogger(newFlowId);
      flowIdRef.current = newFlowId;
      flowLogRef.current = newFlowLog;
      currentKeyRef.current = currentKey;
      previousKeyRef.current = key;
      previousEnabledRef.current = enabled;
      startTransition(() => {
        setFlowId(newFlowId);
        setFlowLog(newFlowLog);
      });
    } else {
      // Update refs even if we didn't create a new flow
      // Only update if key actually changed (not just on every render)
      if (!keyChanged) {
        previousKeyRef.current = key;
        previousEnabledRef.current = enabled;
      }
    }

    // No cleanup function - let the effect body handle all flow lifecycle
    // When component unmounts, React will stop running effects, so flow will naturally end
    // If we need to explicitly end on unmount, we can add a separate useEffect with empty deps
  }, [key, enabled]);

  // Separate effect to handle unmount - only runs when component actually unmounts
  useEffect(() => {
    return () => {
      // This cleanup only runs on actual unmount (not on dependency changes)
      if (flowLogRef.current && flowIdRef.current) {
        flowLogRef.current.end(true, { reason: 'Component unmounted' });
        flowLogRef.current = null;
        flowIdRef.current = null;
        currentKeyRef.current = null;
        startTransition(() => {
          setFlowLog(null);
          setFlowId(null);
        });
      }
    };
  }, []); // Empty deps = only run on mount/unmount

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

