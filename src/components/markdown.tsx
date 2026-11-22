import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { assetUrl, type Snapshot } from '@/lib/content'
import { cn } from '@/lib/utils'

/*
 * Safe by construction: react-markdown never renders raw HTML from the source (no rehype-raw), and
 * defaultUrlTransform strips javascript:/data: style URLs. Keep it that way: once an editing token
 * lives in this browser, a script injected through content could steal it.
 */

const components: Components = {
  h1: ({ children }) => <h2 className="mt-8 mb-3 text-2xl font-semibold">{children}</h2>,
  h2: ({ children }) => <h2 className="mt-8 mb-3 text-xl font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-6 mb-2 text-lg font-semibold">{children}</h3>,
  p: ({ children }) => <p className="my-3 leading-7">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-2 pl-6 marker:text-muted-foreground">{children}</ol>,
  li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
  a: ({ href, children }) => {
    const external = href?.startsWith('http')
    return (
      <a href={href} className="font-medium text-primary underline underline-offset-4" {...(external && { target: '_blank', rel: 'noopener noreferrer' })}>
        {children}
      </a>
    )
  },
  blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-primary/40 pl-4 text-muted-foreground italic">{children}</blockquote>,
  code: ({ children }) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{children}</code>,
  hr: () => <hr className="my-8 border-border" />,
  img: ({ src, alt }) => <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} loading="lazy" className="my-4 rounded-lg" />,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b px-3 py-2 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="border-b px-3 py-2 align-top">{children}</td>,
}

type Props = {
  children: string
  /** Content-repo path of the file this Markdown came from; relative image paths resolve against it. */
  file?: string
  snap?: Snapshot
  className?: string
}

export function Markdown({ children, file, snap, className }: Props) {
  return (
    <div className={cn('text-foreground [&>:first-child]:mt-0', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        urlTransform={(url, key) => {
          if (key === 'src' && snap && file && !/^[a-z]+:|^\/\//i.test(url)) return assetUrl(snap, file, url) ?? ''
          return defaultUrlTransform(url)
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
