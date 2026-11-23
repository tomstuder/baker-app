import { useState, type ReactNode } from 'react'
import { ArrowLeftRight, Scale, Thermometer, Wheat, Cookie } from 'lucide-react'
import { NumberInput } from '@/components/number-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatGrams } from '@/lib/bakers'
import { GRAMS_PER_OUNCE, VOLUME_UNITS, YEAST_FACTORS, cToF, convertYeast, fToC, volumeToGrams, type VolumeUnit, type VolumeWeight, type YeastType } from '@/lib/references'

const fmt = (n: number, digits = 1) => (Number.isFinite(n) ? String(Math.round(n * 10 ** digits) / 10 ** digits) : '–')
const OVEN_TEMPS_F = [325, 350, 375, 400, 425, 450, 475, 500]

function ConverterCard({ icon, title, description, children }: { icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function Result({ children }: { children: ReactNode }) {
  return <div className="rounded-lg bg-muted/60 px-3 py-2 text-lg font-semibold tabular-nums">{children}</div>
}

export function Converter({ volume }: { volume: VolumeWeight[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <VolumeConverter rows={volume} />
      <TemperatureConverter />
      <WeightConverter />
      <YeastConverter />
    </div>
  )
}

function VolumeConverter({ rows }: { rows: VolumeWeight[] }) {
  const [name, setName] = useState(rows[0]?.name ?? '')
  const [amount, setAmount] = useState(1)
  const [unit, setUnit] = useState<VolumeUnit>('cup')
  const row = rows.find((r) => r.name === name) ?? rows[0]
  return (
    <ConverterCard icon={<Wheat className="size-4 text-primary" />} title="Cups & spoons to grams" description="Approximate weights; edit the table to match how you measure.">
      {row ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="vc-ingredient">Ingredient</Label>
            <Select value={row.name} onValueChange={setName}>
              <SelectTrigger id="vc-ingredient" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rows.map((r) => (
                  <SelectItem key={r.name} value={r.name}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="vc-amount">Amount</Label>
              <NumberInput id="vc-amount" value={amount} onChange={setAmount} className="w-24" />
            </div>
            <Select value={unit} onValueChange={(u: VolumeUnit) => setUnit(u)}>
              <SelectTrigger className="w-24" aria-label="Unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(VOLUME_UNITS) as VolumeUnit[]).map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Result>
            = {formatGrams(volumeToGrams(row, Number.isFinite(amount) ? amount : 0, unit))} g
          </Result>
          <p className="text-xs text-muted-foreground">
            1 {row.unit} of {row.name.toLowerCase()} ≈ {row.grams} g
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No ingredients in the table yet.</p>
      )}
    </ConverterCard>
  )
}

function TemperatureConverter() {
  const [value, setValue] = useState(450)
  const [unit, setUnit] = useState<'F' | 'C'>('F')
  const other = unit === 'F' ? fToC(value) : cToF(value)
  return (
    <ConverterCard icon={<Thermometer className="size-4 text-primary" />} title="Temperature">
      <div className="flex items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="tc-value">Temperature</Label>
          <NumberInput id="tc-value" value={value} onChange={setValue} suffix={`°${unit}`} min={-100} className="w-28" />
        </div>
        <Button variant="outline" size="icon" aria-label="Swap °F and °C" onClick={() => setUnit(unit === 'F' ? 'C' : 'F')}>
          <ArrowLeftRight />
        </Button>
      </div>
      <Result>
        = {fmt(other, 0)}°{unit === 'F' ? 'C' : 'F'}
      </Result>
      <table className="w-full text-sm">
        <caption className="mb-1 text-left text-xs text-muted-foreground">Common oven temperatures</caption>
        <tbody className="tabular-nums">
          {OVEN_TEMPS_F.map((f) => (
            <tr key={f} className="border-b last:border-0">
              <td className="py-1">{f}°F</td>
              <td className="py-1 text-right text-muted-foreground">{Math.round(fToC(f))}°C</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ConverterCard>
  )
}

function WeightConverter() {
  const [grams, setGrams] = useState(500)
  const g = Number.isFinite(grams) ? grams : 0
  const oz = g / GRAMS_PER_OUNCE
  return (
    <ConverterCard icon={<Scale className="size-4 text-primary" />} title="Weight">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="wc-g">Grams</Label>
          <NumberInput id="wc-g" value={grams} onChange={setGrams} suffix="g" className="w-28" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wc-oz">Ounces</Label>
          <NumberInput id="wc-oz" value={Math.round(oz * 100) / 100} onChange={(v) => setGrams(Math.round(v * GRAMS_PER_OUNCE * 10) / 10)} suffix="oz" className="w-28" />
        </div>
      </div>
      <Result>
        = {fmt(oz, 2)} oz · {fmt(g / (GRAMS_PER_OUNCE * 16), 2)} lb · {fmt(g / 1000, 3)} kg
      </Result>
    </ConverterCard>
  )
}

function YeastConverter() {
  const [grams, setGrams] = useState(7)
  const [from, setFrom] = useState<YeastType>('instant')
  const g = Number.isFinite(grams) ? grams : 0
  return (
    <ConverterCard icon={<Cookie className="size-4 text-primary" />} title="Yeast" description="Approximate equivalents: instant 1 : active dry 1.25 : fresh 3.">
      <div className="flex items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="yc-g">Amount</Label>
          <NumberInput id="yc-g" value={grams} onChange={setGrams} suffix="g" className="w-24" />
        </div>
        <Select value={from} onValueChange={(v: YeastType) => setFrom(v)}>
          <SelectTrigger className="w-32" aria-label="Yeast type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(YEAST_FACTORS) as YeastType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {(Object.keys(YEAST_FACTORS) as YeastType[]).map((t) => (
          <div key={t} className={`rounded-lg px-2 py-2 ${t === from ? 'bg-primary/10' : 'bg-muted/60'}`}>
            <dt className="text-xs text-muted-foreground capitalize">{t}</dt>
            <dd className="text-lg font-semibold tabular-nums">{fmt(convertYeast(g, from, t), 1)} g</dd>
          </div>
        ))}
      </dl>
    </ConverterCard>
  )
}
