import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ComponentPropsWithoutRef } from 'react'

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="text-sm text-[var(--color-text)] leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ ...props }) => <h1 className="text-lg font-semibold mt-5 mb-2 first:mt-0" {...props} />,
          h2: ({ ...props }) => <h2 className="text-base font-semibold mt-4 mb-2 first:mt-0" {...props} />,
          h3: ({ ...props }) => <h3 className="text-sm font-semibold mt-3 mb-1.5 first:mt-0" {...props} />,
          p: ({ ...props }) => <p className="mb-3 last:mb-0" {...props} />,
          ul: ({ ...props }) => <ul className="list-disc list-outside pl-5 mb-3 space-y-1" {...props} />,
          ol: ({ ...props }) => <ol className="list-decimal list-outside pl-5 mb-3 space-y-1" {...props} />,
          li: ({ ...props }) => <li {...props} />,
          a: ({ ...props }) => (
            <a className="text-[var(--color-accent)] hover:underline" target="_blank" rel="noreferrer" {...props} />
          ),
          strong: ({ ...props }) => <strong className="font-semibold text-[var(--color-text)]" {...props} />,
          em: ({ ...props }) => <em className="italic" {...props} />,
          blockquote: ({ ...props }) => (
            <blockquote
              className="border-l-2 border-[var(--color-border-high)] pl-3 italic text-[var(--color-muted)] mb-3"
              {...props}
            />
          ),
          hr: ({ ...props }) => <hr className="border-[var(--color-border)] my-4" {...props} />,
          pre: ({ ...props }) => (
            <pre
              className="mb-3 p-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-high)] border border-[var(--color-border)] overflow-x-auto font-mono text-xs"
              {...props}
            />
          ),
          code: ({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) => {
            if (className) {
              // Fenced code block: language className comes from remark and this renders inside <pre>.
              return (
                <code className={`font-mono text-xs ${className}`} {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code
                className="px-1 py-0.5 rounded bg-[var(--color-surface-high)] text-[var(--color-accent)] font-mono text-xs"
                {...props}
              >
                {children}
              </code>
            )
          },
          table: ({ ...props }) => (
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-xs border-collapse" {...props} />
            </div>
          ),
          th: ({ ...props }) => (
            <th
              className="border border-[var(--color-border)] px-2 py-1 text-left font-medium text-[var(--color-sub)]"
              {...props}
            />
          ),
          td: ({ ...props }) => <td className="border border-[var(--color-border)] px-2 py-1" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
