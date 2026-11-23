import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { NumberInput } from '@/components/number-input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { INGREDIENT_PRESETS, formatPct } from '@/lib/bakers'
import type { IngredientGroup, IngredientItem } from '@/lib/content'
import { recipeStats } from '@/lib/recipe-math'

type Kind = 'ingredient' | 'flour' | 'preferment'
const kindOf = (i: IngredientItem): Kind => (i.flour ? 'flour' : i.hydration !== undefined ? 'preferment' : 'ingredient')
const opt = (n: number) => (Number.isFinite(n) ? n : undefined)
const NAN = Number.NaN

export function IngredientEditor({ groups, onChange }: { groups: IngredientGroup[]; onChange: (g: IngredientGroup[]) => void }) {
  const stats = recipeStats({ ingredients: groups })

  const setGroup = (gi: number, patch: Partial<IngredientGroup>) => onChange(groups.map((g, i) => (i === gi ? { ...g, ...patch } : g)))
  const setItem = (gi: number, ii: number, patch: Partial<IngredientItem>) =>
    setGroup(gi, { items: groups[gi].items.map((it, i) => (i === ii ? { ...it, ...patch } : it)) })
  const moveItem = (gi: number, ii: number, dir: -1 | 1) => {
    const items = [...groups[gi].items]
    const j = ii + dir
    if (j < 0 || j >= items.length) return
    ;[items[ii], items[j]] = [items[j], items[ii]]
    setGroup(gi, { items })
  }

  return (
    <div className="space-y-6">
      <datalist id="editor-ingredient-presets">
        {INGREDIENT_PRESETS.map((p) => (
          <option key={p.name} value={p.name} />
        ))}
      </datalist>

      {groups.map((g, gi) => (
        <div key={gi} className="space-y-3 rounded-xl border p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="Group name" placeholder="Group (optional), e.g. Dough" value={g.group ?? ''} onChange={(e) => setGroup(gi, { group: e.target.value })} className="min-w-40 flex-1 font-medium" />
            <Input aria-label="Group note" placeholder="Note (optional)" value={g.note ?? ''} onChange={(e) => setGroup(gi, { note: e.target.value })} className="min-w-40 flex-[2]" />
            {groups.length > 1 && (
              <Button variant="ghost" size="icon" aria-label="Remove group" onClick={() => onChange(groups.filter((_, i) => i !== gi))} className="text-muted-foreground">
                <Trash2 />
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {g.items.map((it, ii) => {
              const kind = kindOf(it)
              const pct = stats.base > 0 && it.grams !== undefined ? (it.grams / stats.base) * 100 : undefined
              return (
                <div key={ii} className="space-y-2 rounded-lg bg-muted/40 p-2.5">
                  <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                    <Input
                      aria-label="Ingredient"
                      placeholder="Ingredient"
                      list="editor-ingredient-presets"
                      value={it.name}
                      onChange={(e) => {
                        const preset = INGREDIENT_PRESETS.find((p) => p.name.toLowerCase() === e.target.value.trim().toLowerCase())
                        setItem(gi, ii, { name: e.target.value, ...(preset && it.water === undefined && preset.waterPct > 0 && { water: preset.waterPct }) })
                      }}
                      className="min-w-0 basis-full sm:basis-0 sm:flex-1"
                    />
                    <NumberInput aria-label="Grams" value={it.grams ?? NAN} onChange={(v) => setItem(gi, ii, { grams: opt(v) })} suffix="g" className="w-24 shrink-0" />
                    <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums" title="Baker's %">
                      {pct !== undefined ? `${formatPct(pct)}%` : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input aria-label="Amount as written" placeholder="Amount, e.g. 1 cup" value={it.amount ?? ''} onChange={(e) => setItem(gi, ii, { amount: e.target.value })} className="h-8 w-36" />
                    <Select
                      value={kind}
                      onValueChange={(k: Kind) =>
                        setItem(gi, ii, {
                          flour: k === 'flour',
                          hydration: k === 'preferment' ? (it.hydration ?? 100) : undefined,
                        })
                      }
                    >
                      <SelectTrigger size="sm" className="w-32" aria-label="Type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ingredient">Ingredient</SelectItem>
                        <SelectItem value="flour">Flour (100%)</SelectItem>
                        <SelectItem value="preferment">Preferment</SelectItem>
                      </SelectContent>
                    </Select>
                    {kind === 'preferment' && (
                      <NumberInput aria-label="Preferment hydration" value={it.hydration ?? NAN} onChange={(v) => setItem(gi, ii, { hydration: opt(v) ?? 100 })} suffix="% hyd" className="w-28 [&_input]:h-8" />
                    )}
                    {kind === 'ingredient' && (
                      <NumberInput aria-label="Water content" value={it.water ?? NAN} onChange={(v) => setItem(gi, ii, { water: opt(v) })} suffix="% H₂O" className="w-28 [&_input]:h-8" />
                    )}
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Checkbox checked={!!it.estimated} onCheckedChange={(c) => setItem(gi, ii, { estimated: c === true })} />
                      Estimated
                    </label>
                    <Input aria-label="Note" placeholder="Note" value={it.note ?? ''} onChange={(e) => setItem(gi, ii, { note: e.target.value })} className="h-8 min-w-28 flex-1" />
                    <div className="ml-auto flex">
                      <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={ii === 0} onClick={() => moveItem(gi, ii, -1)}>
                        <ArrowUp />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={ii === g.items.length - 1} onClick={() => moveItem(gi, ii, 1)}>
                        <ArrowDown />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${it.name || 'ingredient'}`} onClick={() => setGroup(gi, { items: g.items.filter((_, i) => i !== ii) })} className="text-muted-foreground">
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <Button variant="ghost" size="sm" className="text-primary" onClick={() => setGroup(gi, { items: [...g.items, { name: '' }] })}>
            <Plus /> Add ingredient
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={() => onChange([...groups, { group: '', items: [{ name: '' }] }])}>
          <Plus /> Add group
        </Button>
        {stats.base > 0 && (
          <p className="text-sm text-muted-foreground">
            Flour {Math.round(stats.base)} g = 100% · hydration <span className="font-medium text-foreground">{formatPct(stats.hydration)}%</span>
          </p>
        )}
      </div>
    </div>
  )
}
