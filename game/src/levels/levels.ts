// Level registry: every levels/data/*.json file is bundled and validated at load.
import { validateLevel, type LevelDef } from './schema';

const modules = import.meta.glob<{ default: unknown }>('./data/*.json', { eager: true });

export interface LevelLoadError {
  file: string;
  errors: string[];
}

function load(): { levels: LevelDef[]; errors: LevelLoadError[] } {
  const levels: LevelDef[] = [];
  const errors: LevelLoadError[] = [];
  for (const [file, mod] of Object.entries(modules)) {
    const res = validateLevel(mod.default);
    if (res.ok) levels.push(res.level);
    else errors.push({ file, errors: res.errors });
  }
  levels.sort((a, b) => a.id - b.id);
  for (let i = 1; i < levels.length; i++) {
    if (levels[i].id === levels[i - 1].id) errors.push({ file: `id ${levels[i].id}`, errors: ['duplicate level id'] });
  }
  return { levels, errors };
}

const loaded = load();
if (loaded.errors.length) console.error('[levels] invalid level files', loaded.errors);

/** All valid levels, sorted by id. */
export const LEVELS: readonly LevelDef[] = loaded.levels;
export const LEVEL_ERRORS: readonly LevelLoadError[] = loaded.errors;

export function getLevel(id: number): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function nextLevelId(id: number): number | undefined {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < LEVELS.length ? LEVELS[i + 1].id : undefined;
}
