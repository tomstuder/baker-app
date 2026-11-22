import type { SVGProps } from 'react'
import type { Home } from '@/lib/content'
import { cn } from '@/lib/utils'

// Simple line marks in the same style as the lucide icons used elsewhere (lucide has no brand logos).
const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  )
}

function LinkedinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <path d="M7.5 10.5V17" />
      <circle cx="7.5" cy="7" r="0.6" fill="currentColor" />
      <path d="M11.5 17v-6.5" />
      <path d="M11.5 13.5a2.75 2.75 0 0 1 5.5 0V17" />
    </svg>
  )
}

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}

const NETWORKS = [
  { key: 'instagram', label: 'Instagram', Icon: InstagramIcon },
  { key: 'linkedin', label: 'LinkedIn', Icon: LinkedinIcon },
  { key: 'facebook', label: 'Facebook', Icon: FacebookIcon },
] as const

export function SocialLinks({ social, className, size = 'md' }: { social: Home['social']; className?: string; size?: 'sm' | 'md' }) {
  const links = NETWORKS.filter((n) => social[n.key]?.startsWith('https://'))
  if (!links.length) return null
  return (
    <ul className={cn('flex flex-wrap items-center gap-2', className)}>
      {links.map(({ key, label, Icon }) => (
        <li key={key}>
          <a
            href={social[key]}
            target="_blank"
            rel="me noopener noreferrer"
            aria-label={label}
            title={label}
            className={cn(
              'inline-flex items-center justify-center rounded-full border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              size === 'md' ? 'size-10' : 'size-8',
            )}
          >
            <Icon className={size === 'md' ? 'size-[18px]' : 'size-4'} />
          </a>
        </li>
      ))}
    </ul>
  )
}
