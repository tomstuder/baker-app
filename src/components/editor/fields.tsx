import { useId, useRef, useState, type ReactNode } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { Markdown } from '@/components/markdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth-context'
import { assetUrl, rawUrlAt, resolvePath, type Snapshot } from '@/lib/content'
import { putFile } from '@/lib/github'
import { resizeImage } from '@/lib/image'
import { slugify } from '@/lib/serialize'
import { cn } from '@/lib/utils'

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode; className?: string }) {
  const id = useId()
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  className,
  ...rest
}: { label: string; value: string | undefined; onChange: (v: string) => void; hint?: ReactNode; className?: string } & Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange'
>) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => <Input id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />}
    </Field>
  )
}

export function MarkdownField({
  value,
  onChange,
  file,
  snap,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  file: string
  snap?: Snapshot
  placeholder?: string
}) {
  return (
    <Tabs defaultValue="write">
      <TabsList>
        <TabsTrigger value="write">Write</TabsTrigger>
        <TabsTrigger value="preview">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="write">
        <Textarea
          aria-label="Text (Markdown)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-80 font-mono text-sm leading-6"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Markdown: <code>## Heading</code>, <code>1.</code> numbered steps, <code>-</code> bullets, <code>**bold**</code>.
        </p>
      </TabsContent>
      <TabsContent value="preview">
        <div className="min-h-80 rounded-lg border p-4">
          {value.trim() ? <Markdown file={file} snap={snap}>{value}</Markdown> : <p className="text-muted-foreground">Nothing to preview yet.</p>}
        </div>
      </TabsContent>
    </Tabs>
  )
}

/**
 * Photo picker: resizes in the browser, uploads straight to the content repo (its own commit),
 * and stores the path relative to `file`.
 */
export function ImageField({
  label,
  value,
  onChange,
  file,
  folder,
  snap,
  aspect = 'aspect-[4/3]',
  disabled,
  disabledHint,
}: {
  label: string
  value: string | undefined
  onChange: (path: string | undefined) => void
  /** Content file the path is stored in, e.g. recipes/x/recipe.md. */
  file: string
  /** Repo folder to upload into, e.g. recipes/x/images. */
  folder: string
  snap?: Snapshot
  aspect?: string
  disabled?: boolean
  disabledHint?: string
}) {
  const { token } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uploaded, setUploaded] = useState<{ path: string; url: string } | null>(null)

  const preview = uploaded && uploaded.path === value ? uploaded.url : snap ? assetUrl(snap, file, value) : undefined

  async function upload(f: File) {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const bytes = await resizeImage(f)
      const date = new Date().toISOString().slice(0, 10)
      const name = `${date}-${slugify(f.name.replace(/\.[^.]+$/, '')) || 'photo'}.jpg`
      const repoPath = `${folder}/${name}`
      const res = await putFile({ token, path: repoPath, content: bytes, message: `Add photo ${repoPath}` })
      // Store the path relative to the content file (e.g. images/x.jpg for a recipe).
      const fileDir = file.split('/').slice(0, -1).join('/')
      const rel = fileDir && repoPath.startsWith(fileDir + '/') ? repoPath.slice(fileDir.length + 1) : repoPath
      setUploaded({ path: rel, url: rawUrlAt(res.commitSha, resolvePath(file, rel)) })
      onChange(rel)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className={cn('relative overflow-hidden rounded-xl border bg-muted/50', aspect)}>
        {preview ? (
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">No photo</div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy || disabled} onClick={() => input.current?.click()}>
          <ImagePlus />
          {value ? 'Replace photo' : 'Upload photo'}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange(undefined)}>
            <X />
            Remove
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void upload(f)
        }}
      />
      {disabled && disabledHint && <p className="text-xs text-muted-foreground">{disabledHint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {value && <p className="truncate text-xs text-muted-foreground">{value}</p>}
    </div>
  )
}
