const SECRET_PATTERN = /\$\{SECRET:([A-Z0-9_]+)\}/g;

export function resolveSecretPlaceholders(value: string, env: NodeJS.ProcessEnv): string {
  return value.replaceAll(SECRET_PATTERN, (_, name: string) => {
    const resolved = env[name];
    if (!resolved) {
      throw new Error(`Missing secret value for ${name}`);
    }
    return resolved;
  });
}

export function redactSecretPlaceholders(value: string): string {
  return value.replaceAll(SECRET_PATTERN, '${SECRET:***}');
}
