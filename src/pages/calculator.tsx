import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { BookmarkPlus, Check, Copy, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { IfEditing } from '@/components/auth-control'
import { SaveToRecipeDialog } from '@/components/save-to-recipe'
import { PageHeader } from '@/components/page-header'
import { NumberInput } from '@/components/number-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  INGREDIENT_PRESETS,
  PREFERMENT_DEFAULT_HYDRATION,
  batchToText,
  calculate,
  countrySourdough,
  formatGrams,
  formatPct,
  newId,
  type Formula,
  type PrefermentKind,
  type Scale,
} from '@/lib/bakers'

const STORAGE_KEY = 'calculator:v1'
const DEFAULT_SCALE: Scale = { mode: 'pieces', count: 2, weight: 900 }

type Saved = { formula: Formula; scale: Scale; /** Recipe slug the formula was opened from. */ source?: string }

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Saved
      if (saved?.formula?.flours && saved?.scale?.mode) return saved
    }
  } catch {
    /* storage unavailable or corrupt: fall back to the example */
  }
  return { formula: countrySourdough(), scale: DEFAULT_SCALE }
}

export function CalculatorPage() {
  // A recipe page can open its formula here by passing { formula, scale } as router state.
  const incoming = useLocation().state as Partial<Saved> | null
  const [{ formula, scale, source }, setState] = useState<Saved>(() =>
    incoming?.formula?.flours && incoming?.scale?.mode ? { formula: incoming.formula, scale: incoming.scale, source: incoming.source } : load(),
  )
  const [saveOpen, setSaveOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ formula, scale, source }))
    } catch {
      /* ignore */
    }
  }, [formula, scale, source])

  const batch = useMemo(() => calculate(formula, scale), [formula, scale])

  const setFormula = (fn: (f: Formula) => Formula) => setState((s) => ({ ...s, formula: fn(s.formula) }))
  const setScale = (next: Scale) => setState((s) => ({ ...s, scale: next }))

  function patch<K extends 'flours' | 'ingredients' | 'preferments'>(key: K, id: string, changes: Partial<Formula[K][number]>) {
    setFormula((f) => ({ ...f, [key]: f[key].map((x) => (x.id === id ? { ...x, ...changes } : x)) }))
  }
  function remove(key: 'flours' | 'ingredients' | 'preferments', id: string) {
    setFormula((f) => ({ ...f, [key]: (f[key] as { id: string }[]).filter((x) => x.id !== id) }))
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(batchToText(formula.name || 'Dough', batch))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  const flourOff = Math.abs(batch.overall.flourPctSum - 100) > 0.05

  return (
    <>
      <PageHeader title="Baker's percentage" description="Every ingredient as a percentage of the final-dough flour.">
        <div className="flex flex-wrap gap-2">
          <IfEditing>
            <Button onClick={() => setSaveOpen(true)}>
              <BookmarkPlus />
              Save to recipe
            </Button>
          </IfEditing>
          <Button variant="outline" onClick={copy}>
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setState({ formula: countrySourdough(), scale: DEFAULT_SCALE, source: undefined })}
            title="Reset to the country sourdough example"
          >
            <RotateCcw />
            Reset
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Formula editor */}
        <div className="order-2 min-w-0 space-y-6 lg:order-1">
          <div className="space-y-2">
            <Label htmlFor="formula-name">Formula name</Label>
            <Input
              id="formula-name"
              value={formula.name}
              onChange={(e) => setFormula((f) => ({ ...f, name: e.target.value }))}
              className="max-w-sm"
            />
            {source && (
              <p className="text-xs text-muted-foreground">
                Opened from{' '}
                <Link to={`/recipes/${source}`} className="font-medium text-primary hover:underline">
                  this recipe
                </Link>
                .
              </p>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Flours</CardTitle>
              <CardDescription>The blend should add up to 100%.</CardDescription>
              <CardAction>
                <Badge variant={flourOff ? 'destructive' : 'secondary'}>{formatPct(batch.overall.flourPctSum)}%</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              {formula.flours.map((x) => (
                <Row key={x.id} onRemove={() => remove('flours', x.id)} label={x.name || 'flour'}>
                  <Input aria-label="Flour name" value={x.name} onChange={(e) => patch('flours', x.id, { name: e.target.value })} />
                  <NumberInput aria-label={`${x.name} percent`} value={x.pct} onChange={(pct) => patch('flours', x.id, { pct })} suffix="%" className="w-20 shrink-0 sm:w-24" />
                </Row>
              ))}
              <AddButton
                onClick={() => setFormula((f) => ({ ...f, flours: [...f.flours, { id: newId(), name: '', pct: Math.max(0, 100 - batch.overall.flourPctSum) }] }))}
              >
                Add flour
              </AddButton>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ingredients</CardTitle>
              <CardDescription>
                Water content counts toward hydration (milk ≈ 87%, egg ≈ 75%, butter ≈ 16%). Pick a common ingredient to fill it in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="hidden gap-2 pr-10 text-xs text-muted-foreground sm:flex">
                <span className="flex-1">Ingredient</span>
                <span className="w-20 sm:w-24">Baker's %</span>
                <span className="w-20 sm:w-24">Water content</span>
              </div>
              <datalist id="ingredient-presets">
                {INGREDIENT_PRESETS.map((p) => (
                  <option key={p.name} value={p.name} />
                ))}
              </datalist>
              {formula.ingredients.map((x) => (
                <Row key={x.id} onRemove={() => remove('ingredients', x.id)} label={x.name || 'ingredient'}>
                  <Input
                    aria-label="Ingredient name"
                    list="ingredient-presets"
                    value={x.name}
                    onChange={(e) => {
                      const preset = INGREDIENT_PRESETS.find((p) => p.name.toLowerCase() === e.target.value.trim().toLowerCase())
                      patch('ingredients', x.id, { name: e.target.value, ...(preset && { waterPct: preset.waterPct }) })
                    }}
                  />
                  <NumberInput aria-label={`${x.name} percent`} value={x.pct} onChange={(pct) => patch('ingredients', x.id, { pct })} suffix="%" className="w-20 shrink-0 sm:w-24" />
                  <NumberInput
                    aria-label={`${x.name} water content`}
                    value={x.waterPct}
                    onChange={(waterPct) => patch('ingredients', x.id, { waterPct })}
                    suffix="H₂O"
                    className="w-20 shrink-0 sm:w-24"
                  />
                </Row>
              ))}
              <AddButton onClick={() => setFormula((f) => ({ ...f, ingredients: [...f.ingredients, { id: newId(), name: '', pct: 0, waterPct: 0 }] }))}>
                Add ingredient
              </AddButton>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferments</CardTitle>
              <CardDescription>Levain, poolish or biga, as a % of the final-dough flour, with its own hydration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {formula.preferments.map((p) => (
                <div key={p.id} className="space-y-2 rounded-lg border p-3">
                  <Row onRemove={() => remove('preferments', p.id)} label={p.name || 'preferment'}>
                    <Input aria-label="Preferment name" value={p.name} onChange={(e) => patch('preferments', p.id, { name: e.target.value })} />
                    <Select
                      value={p.kind}
                      onValueChange={(kind: PrefermentKind) =>
                        patch('preferments', p.id, { kind, hydration: PREFERMENT_DEFAULT_HYDRATION[kind] })
                      }
                    >
                      <SelectTrigger className="w-28 shrink-0" aria-label="Preferment type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="levain">Levain</SelectItem>
                        <SelectItem value="poolish">Poolish</SelectItem>
                        <SelectItem value="biga">Biga</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </Row>
                  <div className="flex flex-wrap gap-4 pr-10">
                    <LabeledNumber label="Amount" value={p.pct} onChange={(pct) => patch('preferments', p.id, { pct })} suffix="%" />
                    <LabeledNumber label="Hydration" value={p.hydration} onChange={(hydration) => patch('preferments', p.id, { hydration })} suffix="%" />
                  </div>
                </div>
              ))}
              <AddButton
                onClick={() =>
                  setFormula((f) => ({ ...f, preferments: [...f.preferments, { id: newId(), name: 'Poolish', kind: 'poolish', pct: 30, hydration: 100 }] }))
                }
              >
                Add preferment
              </AddButton>
            </CardContent>
          </Card>
        </div>

        {/* Batch / results */}
        <Card className="order-1 min-w-0 lg:sticky lg:top-20 lg:order-2">
          <CardHeader>
            <CardTitle>Batch</CardTitle>
            <CardDescription>Scale by dough, loaves or flour.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ScaleControls scale={scale} onChange={setScale} totalDough={batch.totalDough} baseFlour={batch.baseFlour} />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Final mix</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Grams</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...batch.flours, ...batch.ingredients, ...batch.preferments].map((x) => (
                  <TableRow key={x.id}>
                    <TableCell className="whitespace-normal">{x.name || <span className="text-muted-foreground">Unnamed</span>}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatPct(x.pct)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatGrams(x.grams)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total dough</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatPct(batch.overall.formulaPctSum)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatGrams(batch.totalDough)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>

            {batch.preferments.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Build preferments</h3>
                {batch.preferments.map((p) => (
                  <p key={p.id} className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{p.name}</span> ({formatGrams(p.grams)} g at {formatPct(p.hydration)}%):{' '}
                    <span className="tabular-nums">{formatGrams(p.flour)} g flour</span> +{' '}
                    <span className="tabular-nums">{formatGrams(p.water)} g water</span>
                  </p>
                ))}
              </div>
            )}

            <Separator />

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Overall hydration" value={`${formatPct(batch.overall.hydration)}%`} strong />
              <Stat label="Prefermented flour" value={`${formatPct(batch.overall.prefermentedFlour)}%`} />
              <Stat label="Total flour" value={`${formatGrams(batch.overall.flour)} g`} />
              <Stat label="Total water" value={`${formatGrams(batch.overall.water)} g`} />
            </dl>
          </CardContent>
        </Card>
      </div>
      <SaveToRecipeDialog key={String(saveOpen)} open={saveOpen} onOpenChange={setSaveOpen} formula={formula} scale={scale} source={source} />
    </>
  )
}

function ScaleControls({ scale, onChange, totalDough, baseFlour }: { scale: Scale; onChange: (s: Scale) => void; totalDough: number; baseFlour: number }) {
  // When switching modes, carry the current batch size over so the numbers don't jump.
  function switchMode(mode: string) {
    if (mode === 'pieces') onChange({ mode, count: 1, weight: Math.round(totalDough) })
    if (mode === 'dough') onChange({ mode, weight: Math.round(totalDough) })
    if (mode === 'flour') onChange({ mode, weight: Math.round(baseFlour) })
  }

  return (
    <div className="space-y-3">
      <Tabs value={scale.mode} onValueChange={switchMode}>
        <TabsList className="w-full">
          <TabsTrigger value="pieces">Loaves</TabsTrigger>
          <TabsTrigger value="dough">Dough weight</TabsTrigger>
          <TabsTrigger value="flour">Flour weight</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-end gap-3">
        {scale.mode === 'pieces' && (
          <>
            <LabeledNumber label="Count" value={scale.count} onChange={(count) => onChange({ ...scale, count })} />
            <span className="pb-2 text-muted-foreground">×</span>
            <LabeledNumber label="Each" value={scale.weight} onChange={(weight) => onChange({ ...scale, weight })} suffix="g" />
          </>
        )}
        {scale.mode === 'dough' && (
          <LabeledNumber label="Total dough" value={scale.weight} onChange={(weight) => onChange({ ...scale, weight })} suffix="g" />
        )}
        {scale.mode === 'flour' && (
          <LabeledNumber label="Final-dough flour (100%)" value={scale.weight} onChange={(weight) => onChange({ ...scale, weight })} suffix="g" />
        )}
      </div>
    </div>
  )
}

function Row({ children, onRemove, label }: { children: ReactNode; onRemove: () => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {children}
      <Button variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove ${label}`} className="shrink-0 text-muted-foreground">
        <Trash2 />
      </Button>
    </div>
  )
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} className="text-primary">
      <Plus />
      {children}
    </Button>
  )
}

function LabeledNumber({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix?: string }) {
  const id = useId()
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <NumberInput id={id} value={value} onChange={onChange} suffix={suffix} className="w-28" />
    </div>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={strong ? 'text-lg font-semibold tabular-nums text-primary' : 'font-medium tabular-nums'}>{value}</dd>
    </div>
  )
}
