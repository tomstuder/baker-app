import { useId, useRef, useState, type ReactNode } from 'react'
import { ImagePlus, Loader2, Plus, X } from 'lucide-react'
import { Markdown } from '@/components/markdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth-context'
import { assetUrl, rawUrlAt, relativePath, type Snapshot } from '@/lib/content'
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
  const input = useRef<HTMLInputElement>(null)
  const { upload, busy, error, urlFor } = usePhotoUpload(file, folder)
  const preview = (value && urlFor(value)) ?? (snap ? assetUrl(snap, file, value) : undefined)

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
          if (f) void upload(f).then((rel) => rel && onChange(rel))
          e.target.value = ''
        }}
      />
      {disabled && disabledHint && <p className="text-xs text-muted-foreground">{disabledHint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {value && <p className="truncate text-xs text-muted-foreground">{value}</p>}
    </div>
  )
}

/** Resize and upload a photo into `folder`; returns its path relative to `file`. */
function usePhotoUpload(file: string, folder: string) {
  const { token } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Freshly uploaded photos aren't in the loaded snapshot yet, so remember their commit URLs.
  const [urls, setUrls] = useState<Record<string, string>>({})

  async function upload(f: File): Promise<string | undefined> {
    if (!token) return
    setBusy(true)
    setError('')
    try {
      const bytes = await resizeImage(f)
      const date = new Date().toISOString().slice(0, 10)
      const name = `${date}-${slugify(f.name.replace(/\.[^.]+$/, '')) || 'photo'}-${Math.random().toString(36).slice(2, 6)}.jpg`
      const repoPath = `${folder}/${name}`
      const res = await putFile({ token, path: repoPath, content: bytes, message: `Add photo ${repoPath}` })
      const rel = relativePath(file, repoPath)
      setUrls((u) => ({ ...u, [rel]: rawUrlAt(res.commitSha, repoPath) }))
      return rel
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return { upload, busy, error, urlFor: (rel: string) => urls[rel] }
}

/** Several photos (e.g. for a bake): thumbnails, add and remove. */
export function PhotosField({
  label,
  value,
  onChange,
  file,
  folder,
  snap,
}: {
  label: string
  value: string[]
  onChange: (paths: string[]) => void
  file: string
  folder: string
  snap?: Snapshot
}) {
  const input = useRef<HTMLInputElement>(null)
  const { upload, busy, error, urlFor } = usePhotoUpload(file, folder)

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((p) => (
          <div key={p} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted/50">
            <img src={urlFor(p) ?? (snap ? assetUrl(snap, file, p) : undefined)} alt="" className="size-full object-cover" />
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              aria-label="Remove photo"
              onClick={() => onChange(value.filter((x) => x !== p))}
              className="absolute top-1 right-1 opacity-90"
            >
              <X />
            </Button>
          </div>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
          {busy ? 'Uploading…' : 'Add photos'}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          const added: string[] = []
          for (const f of files) {
            const rel = await upload(f)
            if (rel) added.push(rel)
          }
          if (added.length) onChange([...value, ...added])
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">Photos are resized and uploaded as soon as you pick them.</p>
    </div>
  )
}
