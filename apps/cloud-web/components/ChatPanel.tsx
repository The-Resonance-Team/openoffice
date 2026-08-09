'use client';

import { useState } from 'react';
import { useAIChat } from '@/lib';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useAIChat();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: message.role === 'user' ? 'var(--accent)' : 'var(--text)',
                minWidth: '50px',
              }}
            >
              {message.role === 'user' ? 'You' : 'AI'}
            </div>
            <div style={{ flex: 1, fontSize: '14px', lineHeight: '1.5', color: 'var(--text)' }}>
              {message.parts.map((part, i) => {
                if (part.type === 'text') {
                  return <div key={`${message.id}-${i}`}>{part.text}</div>;
                }
                return null;
              })}
            </div>
          </div>
        ))}
        {status === 'streaming' && (
          <div style={{ color: 'var(--faint)', fontSize: '13px' }}>Thinking...</div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          sendMessage({ text: input });
          setInput('');
        }}
        style={{
          padding: '16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--panel)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '8px',
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            placeholder="Ask about your documents..."
            disabled={status === 'streaming'}
            style={{
              flex: 1,
              background: 'var(--bg)',
              border: '1px solid var(--border-2)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '14px',
              color: 'var(--text)',
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || status === 'streaming'}
            className="hover-btn"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: !input.trim() || status === 'streaming' ? 0.5 : 1,
            }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
