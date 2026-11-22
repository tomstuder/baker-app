import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ComingSoon({ items }: { items: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coming soon</CardTitle>
        <CardDescription>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
