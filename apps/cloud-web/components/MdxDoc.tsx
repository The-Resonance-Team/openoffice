import { MDXRemote, type MDXRemoteProps } from 'next-mdx-remote/rsc';

function Heading({
  level,
  children,
  id,
}: {
  level: 2 | 3;
  children: React.ReactNode;
  id?: string;
}) {
  const Tag = `h${level}` as const;
  return (
    <Tag
      id={id}
      style={{
        fontSize: level === 2 ? 19 : 16,
        fontWeight: 600,
        letterSpacing: '-.01em',
        margin: level === 2 ? '0 0 9px' : '0 0 6px',
        scrollMarginTop: 84,
      }}
    >
      {children}
    </Tag>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: 'var(--dim)', fontSize: 14, lineHeight: 1.75, margin: '0 0 16px' }}>
      {children}
    </p>
  );
}

const components: MDXRemoteProps['components'] = {
  h2: ({ children, ...props }) => (
    <Heading level={2} {...props}>
      {children}
    </Heading>
  ),
  h3: ({ children, ...props }) => (
    <Heading level={3} {...props}>
      {children}
    </Heading>
  ),
  p: ({ children, ...props }) => <P {...props}>{children}</P>,
};

export function MdxDoc({ source }: { source: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <MDXRemote source={source} components={components} />
    </div>
  );
}
