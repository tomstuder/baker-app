/**
 * Writes to the content repo through the GitHub REST API (one commit per call).
 * The token is only ever sent to api.github.com.
 */
import { CONTENT_BRANCH, CONTENT_REPO } from '@/lib/content'
import { toBase64 } from '@/lib/token-vault'

export type WriteErrorKind = 'auth' | 'no-access' | 'conflict' | 'exists' | 'rate-limit' | 'network' | 'other'

export class GitHubWriteError extends Error {
  readonly kind: WriteErrorKind
  constructor(message: string, kind: WriteErrorKind) {
    super(message)
    this.kind = kind
  }
}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
  } catch {
    throw new GitHubWriteError("Couldn't reach GitHub. Check your connection and try again.", 'network')
  }
  if (res.ok) return res.status === 204 ? (undefined as T) : ((await res.json()) as T)

  let detail = ''
  try {
    detail = ((await res.json()) as { message?: string }).message ?? ''
  } catch {
    /* no body */
  }
  if (res.status === 401) throw new GitHubWriteError('GitHub rejected the token. It may have expired or been revoked.', 'auth')
  if (res.status === 403 && /rate limit/i.test(detail)) throw new GitHubWriteError('GitHub rate limit reached. Try again in a few minutes.', 'rate-limit')
  if (res.status === 403 || res.status === 404) {
    throw new GitHubWriteError(`The token doesn't have write access to ${CONTENT_REPO}. Check its repository access and that Contents is set to "Read and write".`, 'no-access')
  }
  if (res.status === 409) throw new GitHubWriteError('This file changed on GitHub after you opened it. Reload to get the latest version, then make your edit again.', 'conflict')
  if (res.status === 422 && /sha/i.test(detail)) throw new GitHubWriteError('A file with that name already exists. Choose a different title.', 'exists')
  throw new GitHubWriteError(`GitHub returned ${res.status}${detail ? `: ${detail}` : ''}.`, 'other')
}

/** Check that a token can see the content repo and has push rights. */
export async function verifyToken(token: string): Promise<void> {
  if (!/^github_pat_/.test(token)) {
    throw new GitHubWriteError(
      'Use a fine-grained personal access token (it starts with "github_pat_"). Classic tokens can reach every repo you own.',
      'auth',
    )
  }
  const repo = await call<{ permissions?: { push?: boolean } }>(token, `/repos/${CONTENT_REPO}`)
  if (repo.permissions && repo.permissions.push === false) {
    throw new GitHubWriteError(`This token can read ${CONTENT_REPO} but not write to it.`, 'no-access')
  }
}

export type WriteResult = { commitSha: string; blobSha: string; path: string }

const utf8 = new TextEncoder()

/**
 * Create or update one file. Pass `sha` (the file's current blob sha) when updating; GitHub refuses
 * the write if the file changed since, which protects against overwriting newer edits.
 */
export async function putFile(opts: {
  token: string
  path: string
  content: string | Uint8Array
  message: string
  sha?: string
}): Promise<WriteResult> {
  const bytes = typeof opts.content === 'string' ? utf8.encode(opts.content) : opts.content
  const res = await call<{ content: { sha: string; path: string }; commit: { sha: string } }>(
    opts.token,
    `/repos/${CONTENT_REPO}/contents/${opts.path.split('/').map(encodeURIComponent).join('/')}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message: opts.message,
        content: toBase64(bytes),
        branch: CONTENT_BRANCH,
        ...(opts.sha ? { sha: opts.sha } : {}),
      }),
    },
  )
  return { commitSha: res.commit.sha, blobSha: res.content.sha, path: res.content.path }
}

/** Delete one file (one commit). `sha` must be the file's current blob sha. */
export async function deleteFile(opts: { token: string; path: string; message: string; sha: string }): Promise<{ commitSha: string }> {
  const res = await call<{ commit: { sha: string } }>(
    opts.token,
    `/repos/${CONTENT_REPO}/contents/${opts.path.split('/').map(encodeURIComponent).join('/')}`,
    { method: 'DELETE', body: JSON.stringify({ message: opts.message, sha: opts.sha, branch: CONTENT_BRANCH }) },
  )
  return { commitSha: res.commit.sha }
}

/** One change in a multi-file commit: new text for the file, or `null` to delete it. */
export type FileChange = { path: string; content: string | null }

/**
 * Write and/or delete several files in ONE commit, using the Git Data API (ref → commit → tree →
 * new commit → move the branch). Moving the branch is not forced, so if anything was committed in
 * between, GitHub refuses and nothing changes. Pass `expectedHead` (the commit the new content was
 * based on) to also refuse when the repo moved on before we started.
 */
export async function commitFiles(opts: { token: string; changes: FileChange[]; message: string; expectedHead?: string }): Promise<{ commitSha: string }> {
  if (!opts.changes.length) throw new GitHubWriteError('Nothing to save.', 'other')
  const moved = () => new GitHubWriteError('The Recipes repo changed while saving. Nothing was changed. Reload and try again.', 'conflict')
  const repo = `/repos/${CONTENT_REPO}/git`
  const ref = await call<{ object: { sha: string } }>(opts.token, `${repo}/ref/heads/${CONTENT_BRANCH}`)
  if (opts.expectedHead && ref.object.sha !== opts.expectedHead) throw moved()
  const head = await call<{ tree: { sha: string } }>(opts.token, `${repo}/commits/${ref.object.sha}`)
  const tree = await call<{ sha: string }>(opts.token, `${repo}/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: head.tree.sha,
      tree: opts.changes.map(({ path, content }) =>
        content === null ? { path, mode: '100644', type: 'blob', sha: null } : { path, mode: '100644', type: 'blob', content },
      ),
    }),
  })
  const commit = await call<{ sha: string }>(opts.token, `${repo}/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: opts.message, tree: tree.sha, parents: [ref.object.sha] }),
  })
  try {
    await call(opts.token, `${repo}/refs/heads/${CONTENT_BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) })
  } catch (e) {
    if (e instanceof GitHubWriteError && e.kind === 'other' && /422/.test(e.message)) throw moved()
    throw e
  }
  return { commitSha: commit.sha }
}

/** Delete several files in ONE commit (see commitFiles). */
export async function deletePaths(opts: { token: string; paths: string[]; message: string }): Promise<{ commitSha: string }> {
  if (!opts.paths.length) throw new GitHubWriteError('Nothing to delete.', 'other')
  try {
    return await commitFiles({ token: opts.token, message: opts.message, changes: opts.paths.map((path) => ({ path, content: null })) })
  } catch (e) {
    if (e instanceof GitHubWriteError && e.kind === 'conflict') {
      throw new GitHubWriteError('The Recipes repo changed while deleting. Nothing was deleted. Reload and try again.', 'conflict')
    }
    throw e
  }
}
