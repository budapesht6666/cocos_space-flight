// Spawn offsets for enemy formations, relative to the formation anchor. Engine-free.
// Offsets are in world units on the XZ plane; negative dz means "further up the screen".

export type FormationKind = 'single' | 'line' | 'v' | 'column';

export interface FormationSpec {
  kind: FormationKind;
  count: number;
  /** Distance between neighbours, world units. */
  spacing: number;
}

export interface Offset {
  dx: number;
  dz: number;
  /** Order in the formation, used to stagger behaviour (e.g. sine phase). */
  index: number;
}

export function formationOffsets(spec: FormationSpec): Offset[] {
  const out: Offset[] = [];
  const n = spec.kind === 'single' ? 1 : Math.max(1, spec.count);
  for (let i = 0; i < n; i++) {
    switch (spec.kind) {
      case 'single':
        out.push({ dx: 0, dz: 0, index: 0 });
        break;
      case 'line':
        out.push({ dx: (i - (n - 1) / 2) * spec.spacing, dz: 0, index: i });
        break;
      case 'column':
        out.push({ dx: 0, dz: i === 0 ? 0 : -i * spec.spacing, index: i });
        break;
      case 'v': {
        // Leader at the tip (lowest on screen), wings trail upwards on both sides.
        if (i === 0) {
          out.push({ dx: 0, dz: 0, index: 0 });
          break;
        }
        const rank = Math.ceil(i / 2);
        const side = i % 2 === 1 ? -1 : 1;
        out.push({ dx: side * rank * spec.spacing, dz: -rank * spec.spacing * 0.8, index: i });
        break;
      }
    }
  }
  return out;
}
