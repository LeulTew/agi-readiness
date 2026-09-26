export type FieldState = 'human' | 'notyet' | 'solo';

export interface FieldDef {
  id: string;
  shape: string; // mesh name in public/models/fields.glb
  name: string;
  group: 'STEM' | 'Beyond STEM';
  state: FieldState;
  note: string;
}

export const STATE_LABEL: Record<FieldState, string> = {
  human: 'With a human steering',
  notyet: 'Not there yet',
  solo: 'On its own',
};

// Our read as of 26 Sep 2026. Nothing is "solo" yet.
export const FIELDS: FieldDef[] = [
  { id: 'software', shape: 'software', name: 'Software', group: 'STEM', state: 'human',
    note: 'Closest to on-its-own. OpenAI says its researchers now run 3.1 agent-workdays for every human workday, but more than half of its successful 4–8 hour agent tasks still needed a human to step in.' },
  { id: 'architecture', shape: 'architecture', name: 'Architecture', group: 'STEM', state: 'notyet',
    note: 'Great at concepts, renders and code lookups. Nowhere near taking a building from brief to stamped drawings, permits and site visits on its own.' },
  { id: 'schematics', shape: 'schematics', name: 'Engineering', group: 'STEM', state: 'notyet',
    note: 'Can explain and draft circuits and parts. Still can’t own a real board or machine design end to end without an engineer checking every step.' },
  { id: 'bio', shape: 'bio', name: 'Bioengineering', group: 'STEM', state: 'notyet',
    note: 'Protein and sequence design tools are genuinely strong, but narrow. The actual job needs a wet lab, and a human running it.' },
  { id: 'chemistry', shape: 'chemistry', name: 'Chemistry', group: 'STEM', state: 'human',
    note: 'Expert-level on paper: planning syntheses, explaining mechanisms, answering PhD-level questions. The bench work is still human.' },
  { id: 'math', shape: 'math', name: 'Mathematics', group: 'STEM', state: 'human',
    note: 'Olympiad gold in 2025. In July 2026 a mathematician used Claude Fable 5 to disprove the Jacobian conjecture, open since 1939. A human still picked the problem and checked the proof.' },
  { id: 'philosophy', shape: 'philosophy', name: 'Philosophy', group: 'Beyond STEM', state: 'human',
    note: 'Argues and writes at a solid professional level. Whether it has original views of its own is exactly what people argue about.' },
  { id: 'photography', shape: 'photography', name: 'Photography', group: 'Beyond STEM', state: 'notyet',
    note: 'Generating an image isn’t photography. No agent goes out, finds the light and takes the shot.' },
  { id: 'writing', shape: 'writing', name: 'Writing', group: 'Beyond STEM', state: 'human',
    note: 'Clean professional prose on demand. Long, original work that holds up, like a screenplay, still needs a writer in charge.' },
  { id: 'directing', shape: 'directing', name: 'Directing', group: 'Beyond STEM', state: 'notyet',
    note: 'Video models make impressive shots. Holding one vision across a whole film is not something any agent does yet.' },
  { id: 'editing', shape: 'editing', name: 'Editing', group: 'Beyond STEM', state: 'notyet',
    note: 'AI speeds up cutting, color and cleanup. Handing an agent raw footage and getting back a finished professional edit isn’t there yet.' },
  { id: 'video', shape: 'video', name: 'Videography', group: 'Beyond STEM', state: 'notyet',
    note: 'Same problem as photography: the job happens in the physical world, with a camera, on location.' },
];

// AI 2027 milestones, as months after the story starts (1 April 2025); +0.5 = middle of the month
export const STORY_START = { y: 2025, m: 3 };
export const NOW_MONTHS = 17.83; // 26 Sep 2026
export const AXIS_MONTHS = 45; // to Jan 2029
export const MILESTONES = [
  { label: 'Stumbling agents', m: 3.5 },
  { label: 'Coding automation', m: 10.5 },
  { label: 'China wakes up', m: 15.5 },
  { label: 'AI takes some jobs', m: 19.5 },
  { label: 'Research 3× faster', m: 21.5 },
  { label: 'Superhuman coder', m: 23.5 },
  { label: 'Cheap remote worker', m: 27.5 },
  { label: 'Superhuman AI researcher', m: 29.5 },
  { label: 'The split: race or slowdown', m: 30.5 },
];
