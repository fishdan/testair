import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { SiteProfile } from './types.js';

function profilePath(root: string, domain: string): string {
  return path.join(root, `${domain}.json`);
}

export async function loadSiteProfile(root: string, domain: string): Promise<SiteProfile> {
  const filePath = profilePath(root, domain);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as SiteProfile;
  } catch {
    return {
      domain,
      selectors: {},
      updatedAt: new Date(0).toISOString()
    };
  }
}

export async function saveSiteProfile(root: string, profile: SiteProfile): Promise<void> {
  await fs.mkdir(root, { recursive: true });
  const filePath = profilePath(root, profile.domain);
  await fs.writeFile(filePath, JSON.stringify(profile, null, 2), 'utf8');
}
