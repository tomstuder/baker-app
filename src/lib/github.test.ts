import { afterEach, describe, expect, it, vi } from 'vitest'
import { commitFiles, deletePaths, putFile } from './github'

type Call = { method: string; url: string; body?: unknown; auth?: string }

function mockFetch(responses: Record<string, { status?: number; json: unknown }>) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    const path = url.replace('https://api.github.com', '')
    calls.push({ method, url: path, body: init.body ? JSON.parse(String(init.body)) : undefined, auth: (init.headers as Record<string, string>)?.Authorization })
    const r = responses[`${method} ${path}`]
    if (!r) return new Response('{"message":"unexpected"}', { status: 500 })
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 })
  })
  return calls
}

afterEach(() => vi.unstubAllGlobals())

const G = '/repos/tomstuder/Recipes/git'

describe('deletePaths', () => {
  const ok = {
    [`GET ${G}/ref/heads/main`]: { json: { object: { sha: 'head1' } } },
    [`GET ${G}/commits/head1`]: { json: { tree: { sha: 'tree1' } } },
    [`POST ${G}/trees`]: { status: 201, json: { sha: 'tree2' } },
    [`POST ${G}/commits`]: { status: 201, json: { sha: 'commit2' } },
    [`PATCH ${G}/refs/heads/main`]: { json: {} },
  }

  it('removes all paths in one commit on top of the current head', async () => {
    const calls = mockFetch(ok)
    const res = await deletePaths({ token: 'github_pat_x', paths: ['recipes/a/recipe.md', 'recipes/a/bakes/2026-01-01.md'], message: 'Delete recipe A' })
    expect(res.commitSha).toBe('commit2')
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(Object.keys(ok))
    expect(calls.every((c) => c.auth === 'Bearer github_pat_x')).toBe(true)
    expect(calls[2].body).toEqual({
      base_tree: 'tree1',
      tree: [
        { path: 'recipes/a/recipe.md', mode: '100644', type: 'blob', sha: null },
        { path: 'recipes/a/bakes/2026-01-01.md', mode: '100644', type: 'blob', sha: null },
      ],
    })
    expect(calls[3].body).toEqual({ message: 'Delete recipe A', tree: 'tree2', parents: ['head1'] })
    expect(calls[4].body).toEqual({ sha: 'commit2', force: false })
  })

  it('reports a conflict if the branch moved (and never forces)', async () => {
    mockFetch({ ...ok, [`PATCH ${G}/refs/heads/main`]: { status: 422, json: { message: 'Update is not a fast forward' } } })
    await expect(deletePaths({ token: 't', paths: ['x'], message: 'm' })).rejects.toMatchObject({ kind: 'conflict' })
  })

  it('refuses an empty delete', async () => {
    await expect(deletePaths({ token: 't', paths: [], message: 'm' })).rejects.toThrow('Nothing to delete')
  })
})

describe('commitFiles', () => {
  const ok = {
    [`GET ${G}/ref/heads/main`]: { json: { object: { sha: 'head1' } } },
    [`GET ${G}/commits/head1`]: { json: { tree: { sha: 'tree1' } } },
    [`POST ${G}/trees`]: { status: 201, json: { sha: 'tree2' } },
    [`POST ${G}/commits`]: { status: 201, json: { sha: 'commit2' } },
    [`PATCH ${G}/refs/heads/main`]: { json: {} },
  }

  it('writes and deletes files in one commit', async () => {
    const calls = mockFetch(ok)
    const res = await commitFiles({
      token: 't',
      message: 'Rename category',
      expectedHead: 'head1',
      changes: [
        { path: 'config.yml', content: 'categories: {}\n' },
        { path: 'old.md', content: null },
      ],
    })
    expect(res.commitSha).toBe('commit2')
    expect(calls[2].body).toEqual({
      base_tree: 'tree1',
      tree: [
        { path: 'config.yml', mode: '100644', type: 'blob', content: 'categories: {}\n' },
        { path: 'old.md', mode: '100644', type: 'blob', sha: null },
      ],
    })
    expect(calls[4].body).toEqual({ sha: 'commit2', force: false })
  })

  it('refuses before writing anything if the repo moved past the expected commit', async () => {
    const calls = mockFetch(ok)
    await expect(commitFiles({ token: 't', message: 'm', expectedHead: 'older', changes: [{ path: 'x', content: 'y' }] })).rejects.toMatchObject({ kind: 'conflict' })
    expect(calls.map((c) => c.method)).toEqual(['GET'])
  })
})

describe('putFile', () => {
  it('sends base64 content, branch and sha', async () => {
    const calls = mockFetch({ 'PUT /repos/tomstuder/Recipes/contents/recipes/a/recipe.md': { json: { content: { sha: 'b', path: 'recipes/a/recipe.md' }, commit: { sha: 'c' } } } })
    await putFile({ token: 't', path: 'recipes/a/recipe.md', content: 'héllo', message: 'm', sha: 'old' })
    expect(calls[0].body).toEqual({ message: 'm', content: 'aMOpbGxv' /* UTF-8 "héllo" */, branch: 'main', sha: 'old' })
  })

  it('maps a 409 to a conflict', async () => {
    mockFetch({ 'PUT /repos/tomstuder/Recipes/contents/x.md': { status: 409, json: { message: 'sha mismatch' } } })
    await expect(putFile({ token: 't', path: 'x.md', content: 'x', message: 'm', sha: 's' })).rejects.toMatchObject({ kind: 'conflict' })
  })
})
