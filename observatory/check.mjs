// Verifies the vendored Pulseboard SDK v3 artifact against observatory.lock.json.
// The artifact lives outside public/ on purpose: Vite copies public/ into every build, and only the
// synthetic showcase build may carry the SDK (vite.config.ts emits it for `--mode showcase` only).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

export const COLLECTOR = 'https://pulseboard-observatory.commit-atlas.workers.dev';
export const SHOWCASE_ORIGIN = 'https://chris0jeky.github.io';

const root = new URL('../', import.meta.url);
const lock = JSON.parse(readFileSync(new URL('observatory.lock.json', root), 'utf8'));
assert.equal(lock.sdk, '3.0.0', 'The lock must name SDK 3.0.0');
const entries = Object.entries(lock.installs ?? {});
assert.equal(entries.length, 1, 'The lock records exactly one installed artifact');
const [target, entry] = entries[0];
assert.equal(target, 'observatory/pulseboard.js', 'The artifact must stay outside public/');
assert.equal(entry.project, 'developer-lens');

const code = readFileSync(new URL(target, root), 'utf8');
assert.equal(createHash('sha256').update(code).digest('hex'), entry.sha256, `${target} does not match the lock`);
assert.ok(!code.includes('\r'), 'The artifact must stay LF-only');
assert.match(code, /^\/\* SPDX-License-Identifier: GPL-3\.0-only\n \* pulseboard-sdk 3\.0\.0 for developer-lens\. /, 'Header must name pulseboard-sdk 3.0.0 for developer-lens');
assert.ok(!/MAX_BYTES|MAX_BATCH/.test(code), 'Server-only constants must not be published');

const config = JSON.parse(/^const config = (\{.*\});$/m.exec(code)?.[1] ?? 'null');
assert.ok(config, 'The artifact embeds no client config');
assert.equal(config.id, 'developer-lens');
assert.equal(config.collector, COLLECTOR);
assert.equal(config.origin, SHOWCASE_ORIGIN);
for (const route of ['home', 'story', 'share']) assert.ok(config.project.routes.includes(route), `route ${route} is not registered`);
for (const event of ['story.opened', 'share.requested']) assert.ok(config.project.events.includes(event), `event ${event} is not registered`);
const origins = new Set(code.match(/https:\/\/[a-z0-9.-]+/g));
assert.deepEqual([...origins].sort(), [SHOWCASE_ORIGIN, COLLECTOR].sort(), 'The artifact names an unexpected origin');

/** A minimal fake window: enough for the SDK to construct, never enough to reach a network. */
function fakeWindow({ origin, readyState }) {
  const network = [];
  const listeners = [];
  const storage = () => { const map = new Map(); return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) }; };
  const document = {
    readyState, referrer: '', visibilityState: 'visible',
    addEventListener: (type) => listeners.push(`document:${type}`), removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => [],
  };
  const context = {
    document, location: { origin, protocol: new URL(origin).protocol, search: '' }, navigator: {},
    localStorage: storage(), sessionStorage: storage(),
    fetch: (...args) => { network.push(args[0]); return new Promise(() => {}); },
    XMLHttpRequest: function () { network.push('xhr'); }, sendBeacon: () => network.push('beacon'),
    setTimeout: () => 0, clearTimeout() {}, addEventListener: (type) => listeners.push(`window:${type}`), removeEventListener() {},
    performance: { now: () => 0 }, matchMedia: () => ({ matches: false }), innerWidth: 1280,
    URL, URLSearchParams, AbortController, Promise, JSON, Math, Date, Object, Array, Set, Map, String, Number, RegExp, Error, TypeError,
  };
  context.navigator.sendBeacon = context.sendBeacon;
  context.globalThis = context;
  context.window = context;
  return { context, network, listeners };
}

// On the registered origin, before DOMContentLoaded: the API exists and nothing has touched the network.
const live = fakeWindow({ origin: SHOWCASE_ORIGIN, readyState: 'loading' });
vm.createContext(live.context);
vm.runInContext(code, live.context);
const api = live.context.Pulseboard;
assert.ok(api && Object.isFrozen(api), 'window.Pulseboard must be defined and frozen');
assert.equal(api.version, '3.0.0');
assert.deepEqual(Object.keys(api), ['version', 'route', 'count', 'track', 'consent']);
assert.ok(live.listeners.includes('document:DOMContentLoaded'), 'The SDK must wait for the DOM before mounting');
assert.deepEqual(live.network, [], 'No network call may happen before mount');

// Off the registered origin (a local or private build served elsewhere): inert, no network, no throw.
const local = fakeWindow({ origin: 'http://127.0.0.1:5173', readyState: 'complete' });
vm.createContext(local.context);
vm.runInContext(code, local.context);
assert.equal(local.context.Pulseboard.route('story'), false);
assert.equal(local.context.Pulseboard.track('share.requested', { channel: 'copy' }), false);
assert.deepEqual(local.network, [], 'An off-origin page must make no network call');

console.log('Pulseboard SDK 3.0.0 artifact: lock hash, header, collector origin, registered vocabulary, pre-mount silence and off-origin inertness verified.');
