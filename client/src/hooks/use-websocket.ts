import { useEffect, useRef, useState, useCallback } from "react";
import type { ProgressUpdate } from "@shared/schema";

export function useWebSocket(sessionId: string | null) {
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: "subscribe", sessionId }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "progress") {
          setProgress(data.payload as ProgressUpdate);
        }
      } catch (e) {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };
  }, [sessionId]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { progress, isConnected };
}
