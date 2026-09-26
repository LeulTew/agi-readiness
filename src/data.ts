export type LampState = 'go' | 'amber' | 'off' | 'test';

export interface FieldDef {
  id: string;
  label: string;
  group: 'stem' | 'arts';
  state: LampState;
  order: number;
  note: string;
}

// Our read as of 26 Sep 2026. amber = professional-grade output, but only with a human steering.
// off = not at professional level yet. go = professional level with no babysitter (none yet).
export const FIELDS: FieldDef[] = [
  { id: 'software', label: 'SOFTWARE', group: 'stem', state: 'amber', order: 0,
    note: 'Closest to green. OpenAI says its researchers now run 3.1 agent-workdays for every human workday, but more than half of its successful 4–8 hour agent tasks still needed a human to step in.' },
  { id: 'architecture', label: 'ARCHITECTURE', group: 'stem', state: 'off', order: 3,
    note: 'Great at concepts, renders and code lookups. Nowhere near taking a building from brief to stamped drawings, permits and site visits on its own.' },
  { id: 'schematics', label: 'SCHEMATICS', group: 'stem', state: 'off', order: 5,
    note: 'Can explain and draft circuits and mechanical parts. Still can’t own a real board or machine design end to end without an engineer checking every step.' },
  { id: 'bio', label: 'BIOENGINEERING', group: 'stem', state: 'off', order: 7,
    note: 'Protein and sequence design tools are genuinely strong, but they are narrow tools. The actual job needs a wet lab, and a human running it.' },
  { id: 'chemistry', label: 'CHEMISTRY', group: 'stem', state: 'amber', order: 2,
    note: 'Expert-level on paper: planning syntheses, explaining mechanisms, answering PhD-level questions. The bench work is still human.' },
  { id: 'math', label: 'MATHEMATICS', group: 'stem', state: 'amber', order: 1,
    note: 'Olympiad gold in 2025. In July 2026 a mathematician used Claude Fable 5 to disprove the Jacobian conjecture, open since 1939. A human still picked the problem and checked the proof.' },
  { id: 'philosophy', label: 'PHILOSOPHY', group: 'arts', state: 'amber', order: 4,
    note: 'Argues and writes at a solid professional level. Whether it has original views of its own is exactly the thing people argue about.' },
  { id: 'photography', label: 'PHOTOGRAPHY', group: 'arts', state: 'off', order: 9,
    note: 'Generating an image isn’t photography. Nobody has an agent that goes out, finds the light and takes the shot.' },
  { id: 'writing', label: 'WRITING', group: 'arts', state: 'amber', order: 6,
    note: 'Clean professional prose on demand. Long, coherent, original work, like a screenplay that holds up, still needs a writer in charge.' },
  { id: 'directing', label: 'DIRECTING', group: 'arts', state: 'off', order: 11,
    note: 'Video models make impressive shots. Directing, meaning one vision held across a whole film, is not something any agent does yet.' },
  { id: 'editing', label: 'EDITING', group: 'arts', state: 'off', order: 8,
    note: 'AI tools speed up cutting, color and cleanup. Handing an agent raw footage and getting back a finished professional edit isn’t there yet.' },
  { id: 'video', label: 'VIDEOGRAPHY', group: 'arts', state: 'off', order: 10,
    note: 'Same problem as photography: the job happens in the physical world, with a camera, on location.' },
];

export const GUARDS = ['CURE CANCER', 'END WORLD HUNGER', 'TOP 0.1% AT EVERYTHING'];

// AI 2027 milestones, as months after the story starts (1 April 2025); +0.5 = middle of the month
export const STORY_START = { y: 2025, m: 3 };
export const NOW_MONTHS = 17.83; // 26 Sep 2026
export const AXIS_MONTHS = 45; // to Jan 2029
export const MILESTONES = [
  { label: 'Stumbling agents', m: 3.5 },
  { label: 'Coding automation: research 1.5× faster', m: 10.5 },
  { label: 'China wakes up', m: 15.5 },
  { label: 'AI takes some jobs', m: 19.5 },
  { label: 'Agent-2: research 3× faster', m: 21.5 },
  { label: 'Superhuman coder', m: 23.5 },
  { label: 'Cheap remote worker, “AGI” declared', m: 27.5 },
  { label: 'Superhuman AI researcher', m: 29.5 },
  { label: 'The split: race or slowdown', m: 30.5 },
];
