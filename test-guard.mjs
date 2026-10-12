// Human-owned test guard (the software factory's quality.test_guard). Agents must not edit it.
// vitest runs it before any test (globalSetup in vitest.config.ts and vitest.acceptance.config.ts).
const CHECKED = ['DATABASE_URL', 'DATABASE_URL_DIRECT', 'JIRA_BASE_URL'];

// Tests create and wipe data, so they may only reach throwaway local services: localhost, a loopback address or
// a compose service name (no dots), and Postgres databases whose name ends in _test.
const isLocal = (host) => ['127.0.0.1', '[::1]'].includes(host) || /^[a-z0-9_-]+$/i.test(host);

function problems(env) {
  const found = [];
  for (const name of CHECKED) {
    const value = env[name];
    if (!value) continue;
    let url;
    try {
      url = new URL(value);
    } catch {
      found.push(`${name} is not a URL`);
      continue;
    }
    if (!isLocal(url.hostname)) found.push(`${name} points to ${url.hostname}, not a local service`);
    const database = url.pathname.replace(/^\//, '');
    if (/^postgres(ql)?:$/.test(url.protocol) && !database.endsWith('_test')) {
      found.push(`${name} uses database "${database}"; test databases must end in _test`);
    }
  }
  return found;
}

function check(env = process.env) {
  const found = problems(env);
  if (found.length) {
    throw new Error(
      'Refusing to run tests: they may only use throwaway local services (e.g. compose.test.yml).\n- ' +
        found.join('\n- '),
    );
  }
}

export default function setup() {
  check();
}

export { problems };
