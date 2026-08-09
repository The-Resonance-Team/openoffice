import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent2 underline underline-offset-2 hover:text-accent"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  h1: ({ children }) => (
    <h1 className="mb-2 mt-4 text-[19px] font-bold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-[17px] font-bold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-3 text-[15.5px] font-bold first:mt-0">{children}</h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-line2 pl-3 text-muted last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-line" />,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="rounded-[4px] bg-panel2 px-[5px] py-[1px] font-mono text-[0.9em]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="oo-scroll mb-3 overflow-x-auto rounded-[10px] bg-panel2 p-3 font-mono text-[13px] leading-[1.55] last:mb-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="oo-scroll mb-3 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-[14px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-line2 text-left">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-[6px] font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-t border-line px-3 py-[6px]">{children}</td>
  ),
};

export function Markdown({ text }: { text: string }) {
  return (
    <div className="oo-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
