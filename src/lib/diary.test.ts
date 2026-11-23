import { describe, expect, it } from 'vitest'
import { newDiaryPath, toDiaryPost, type Snapshot } from './content'
import { serializeDiary } from './serialize'

const POST = `---
title: First rye loaf
date: 2026-11-21
category: Experiment
tags: [rye, sourdough]
image: images/2026-11-21-rye.jpg
related:
  - sourdough-base
  - sourdough-base/2026-11-20-higher-hydration
---

It was **dense** but tasty.

![Crumb](images/2026-11-21-crumb.jpg)
`
const PATH = 'diary/2026-11-21-first-rye-loaf.md'

describe('diary posts', () => {
  it('parses a post', () => {
    const p = toDiaryPost(PATH, POST)
    expect(p).toMatchObject({
      slug: '2026-11-21-first-rye-loaf',
      title: 'First rye loaf',
      date: '2026-11-21',
      category: 'Experiment',
      tags: ['rye', 'sourdough'],
      image: 'images/2026-11-21-rye.jpg',
      related: ['sourdough-base', 'sourdough-base/2026-11-20-higher-hydration'],
      excerpt: 'It was dense but tasty.',
    })
  })

  it('writes the same file back', () => {
    expect(serializeDiary(toDiaryPost(PATH, POST))).toBe(POST)
  })

  it('names new posts by date and title without clobbering', () => {
    const snap: Snapshot = { commit: 'c', files: new Map([['diary/2026-11-21-first-rye-loaf.md', 's']]) }
    expect(newDiaryPath(snap, '2026-11-21', 'First Rye Loaf!')).toBe('diary/2026-11-21-first-rye-loaf-2.md')
    expect(newDiaryPath(snap, '2026-11-22', 'Crème fraîche & bread')).toBe('diary/2026-11-22-creme-fraiche-bread.md')
  })
})
