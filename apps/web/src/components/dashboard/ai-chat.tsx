'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, CardContent } from '@hostdaddy/ui';
import { sitesApi, ApiHttpError, type AiBuildResult, type SitePage } from '@/lib/api';

interface ChatTurn {
  id: string;
  role: 'user' | 'agent';
  text: string;
  toolCalls?: AiBuildResult['tool_calls'];
  note?: string;
  model?: string;
  pending?: boolean;
  error?: boolean;
}

const QUICK_PROMPTS = [
  'Rewrite my home page hero to be more confident.',
  'Add a "Trusted by" logo strip above the CTA.',
  'Draft 3 blog posts about Agentic AI in halal F&B.',
  'Audit my SEO and fix the top 5 issues.',
  'Create a Vibe Coder training landing page from scratch.',
];

export function AiChat({ siteId, pages }: { siteId: string; pages: SitePage[] }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [prompt, setPrompt] = useState('');
  const [pageId, setPageId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  async function send(text: string) {
    const userTurnId = crypto.randomUUID();
    const agentTurnId = crypto.randomUUID();
    setTurns((t) => [
      ...t,
      { id: userTurnId, role: 'user', text },
      { id: agentTurnId, role: 'agent', text: '', pending: true },
    ]);
    setPrompt('');
    setSending(true);
    try {
      const res = await sitesApi.aiBuild(siteId, {
        prompt: text,
        page_id: pageId || undefined,
      });
      setTurns((t) =>
        t.map((tu) =>
          tu.id === agentTurnId
            ? {
                ...tu,
                text: res.summary || '(no summary)',
                toolCalls: res.tool_calls,
                note: res.note,
                model: res.model,
                pending: false,
              }
            : tu,
        ),
      );
    } catch (err) {
      const msg = err instanceof ApiHttpError ? err.message : 'Agent request failed.';
      setTurns((t) =>
        t.map((tu) =>
          tu.id === agentTurnId ? { ...tu, text: msg, pending: false, error: true } : tu,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || sending) return;
    send(text);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* ── Side panel ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <Card>
          <CardContent className="space-y-3 p-4">
            <label className="block text-xs font-medium uppercase tracking-wide text-navy-500">
              Focus page (optional)
            </label>
            <select
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              className="block w-full rounded-md border border-navy-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500"
            >
              <option value="">— Any page —</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.is_home ? '★ ' : ''}
                  {p.title} ({p.slug})
                </option>
              ))}
            </select>
            <p className="text-xs text-navy-400">
              Limit the agent's edits to one page if you want a tight scope.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-navy-500">
              Try a prompt
            </div>
            <ul className="space-y-1">
              {QUICK_PROMPTS.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => setPrompt(q)}
                    disabled={sending}
                    className="block w-full rounded-md border border-navy-200 px-3 py-2 text-left text-xs text-navy-700 hover:border-electric-300 hover:bg-electric-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* ── Conversation ────────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex h-[640px] flex-col p-0">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {turns.length === 0 ? (
              <div className="rounded-md border border-dashed border-navy-200 p-8 text-center text-sm text-navy-500">
                <p className="font-medium text-navy-700">Talk to your site.</p>
                <p className="mt-1">
                  Ask the agent to rewrite copy, add sections, fix SEO, draft blog
                  posts, or anything else. Pick a quick prompt on the left to get
                  started.
                </p>
              </div>
            ) : (
              turns.map((turn) => <Turn key={turn.id} turn={turn} />)
            )}
            <div ref={endRef} />
          </div>
          <form
            onSubmit={onSubmit}
            className="flex gap-2 border-t border-navy-100 bg-navy-50/40 p-3"
          >
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask the agent to change something on your site…"
              rows={2}
              disabled={sending}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (prompt.trim()) send(prompt.trim());
                }
              }}
              className="flex-1 resize-none rounded-md border border-navy-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500 disabled:opacity-50"
            />
            <Button type="submit" disabled={sending || !prompt.trim()}>
              {sending ? '…' : 'Send'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Turn({ turn }: { turn: ChatTurn }) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-electric-600 px-3 py-2 text-sm text-white">
          {turn.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2 rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-navy-900 shadow-card">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-navy-500">
          <span>Fadzil-AI</span>
          {turn.model ? <Badge variant="neutral">{turn.model}</Badge> : null}
          {turn.pending ? <span className="text-electric-600">thinking…</span> : null}
        </div>
        <p className={turn.error ? 'text-red-700' : ''}>{turn.text || (turn.pending ? '…' : '')}</p>
        {turn.toolCalls?.length ? (
          <details className="rounded-md bg-navy-50 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-navy-600">
              {turn.toolCalls.length} tool call{turn.toolCalls.length === 1 ? '' : 's'}
            </summary>
            <ul className="mt-2 space-y-2 text-xs">
              {turn.toolCalls.map((tc, i) => (
                <li key={i} className="font-mono">
                  <div className="font-semibold text-electric-700">{tc.name}</div>
                  <div className="overflow-x-auto whitespace-pre-wrap break-all text-navy-600">
                    {JSON.stringify(tc.input, null, 2)}
                  </div>
                  {tc.result ? (
                    <div
                      className={
                        'mt-0.5 ' + (tc.result.ok ? 'text-green-700' : 'text-red-700')
                      }
                    >
                      → {tc.result.message}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {turn.note ? (
          <div className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
            {turn.note}
          </div>
        ) : null}
      </div>
    </div>
  );
}
