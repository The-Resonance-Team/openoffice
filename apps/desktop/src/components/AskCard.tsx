import { useState } from "react";

interface Props {
  question: string;
  onSubmit: (answer: string) => void;
}

export function AskCard({ question, onSubmit }: Props) {
  const [answer, setAnswer] = useState("");
  const isDraftQuestion = /accept or discard/i.test(question);

  const submit = (value: string) => {
    if (!value.trim()) return;
    onSubmit(value.trim());
  };

  return (
    <div className="max-w-[80%] rounded-lg border border-amber-800 bg-amber-950/30 px-3 py-2">
      <p className="text-sm text-amber-200">{question}</p>
      <div className="mt-2 flex gap-2">
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(answer)}
          autoFocus
          placeholder="Answer…"
          className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-700"
        />
        <button
          onClick={() => submit(answer)}
          className="rounded-md bg-amber-700 px-3 py-1 text-sm font-medium text-white hover:bg-amber-600"
        >
          Send
        </button>
      </div>
      {isDraftQuestion && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => submit("accept")}
            className="rounded border border-emerald-700 px-2 py-0.5 text-xs text-emerald-400 hover:bg-emerald-950"
          >
            Accept
          </button>
          <button
            onClick={() => submit("discard")}
            className="rounded border border-red-800 px-2 py-0.5 text-xs text-red-400 hover:bg-red-950"
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
}
