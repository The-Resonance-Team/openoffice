"use client";

import { useEffect, useRef, useState } from "react";
import { mockGreeting, mockSessionId, pickMockReply } from "./mock-chat";

export interface ChatMessage {
  role: string;
  content: string;
}

const TOKEN_DELAY_MS = 18;
const THINKING_DELAY_MS = 500;

export function useSession() {
  const [sessionId] = useState(() => mockSessionId());
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { role: "assistant", content: mockGreeting },
  ]);
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
    };
  }, []);

  function streamReply(reply: string) {
    const words = reply.split(" ");
    let i = 0;
    function step() {
      i += 1;
      setStreaming(words.slice(0, i).join(" "));
      if (i < words.length) {
        timers.current.push(setTimeout(step, TOKEN_DELAY_MS));
      } else {
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        setStreaming("");
        setBusy(false);
      }
    }
    step();
  }

  async function send(message: string) {
    if (!sessionId || !message.trim()) return;
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    setError(null);
    const reply = pickMockReply(message);
    timers.current.push(
      setTimeout(() => streamReply(reply), THINKING_DELAY_MS)
    );
  }

  return { sessionId, messages, streaming, busy, error, send };
}
