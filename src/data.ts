export type FieldState = 'human' | 'notyet' | 'solo';

export interface FieldDef {
  id: string;
  shape: string; // mesh name in public/models/fields.glb
  name: string;
  group: 'STEM' | 'Beyond STEM';
  state: FieldState;
  note: string;
  refs?: number[];
}

export const STATE_LABEL: Record<FieldState, string> = {
  human: 'With a human steering',
  notyet: 'Not there yet',
  solo: 'On its own',
};

// Our read as of 26 Sep 2026. Nothing is "solo" yet.
export const FIELDS: FieldDef[] = [
  { id: 'software', shape: 'software', name: 'Software', group: 'STEM', state: 'human',
    note: 'The closest call. OpenAI says its researchers now run 3.1 agent-workdays for every human workday, yet more than half of the successful 4–8 hour tasks still needed a person to step in.', refs: [23] },
  { id: 'architecture', shape: 'architecture', name: 'Architecture', group: 'STEM', state: 'notyet',
    note: 'A convincing render isn’t a building. I haven’t seen an agent take a real project from brief to buildable drawings without an architect steering it.' },
  { id: 'schematics', shape: 'schematics', name: 'Engineering', group: 'STEM', state: 'notyet',
    note: 'Explaining a circuit is the easy part now. Delivering a board or a machine that actually works, without an engineer checking each step, is the part I haven’t seen.' },
  { id: 'bio', shape: 'bio', name: 'Bioengineering', group: 'STEM', state: 'notyet',
    note: 'Helping with one narrow task isn’t the job. The job is planning experiments, reading messy results and handling what goes wrong, and I haven’t seen an agent own that.' },
  { id: 'chemistry', shape: 'chemistry', name: 'Chemistry', group: 'STEM', state: 'human',
    note: 'At the desk it’s a strong colleague: reasoning through mechanisms, proposing experiments. I count that as professional work with a person steering. The bench is still human.' },
  { id: 'math', shape: 'math', name: 'Mathematics', group: 'STEM', state: 'human',
    note: 'In July 2026 a mathematician used Claude Fable 5 to find a counterexample to the Jacobian conjecture in dimensions three and up. A human still picked the problem and checked the result.', refs: [17] },
  { id: 'philosophy', shape: 'philosophy', name: 'Philosophy', group: 'Beyond STEM', state: 'human',
    note: 'It argues and critiques at a solid professional level once someone sets the question. Whether it has views of its own is exactly what philosophers argue about.' },
  { id: 'photography', shape: 'photography', name: 'Photography', group: 'Beyond STEM', state: 'notyet',
    note: 'Generating an image isn’t photography. The job is being there, choosing the moment and taking the shot, and no agent I know of does that on its own.' },
  { id: 'writing', shape: 'writing', name: 'Writing', group: 'Beyond STEM', state: 'human',
    note: 'Clean professional drafts on demand. A long piece that holds together, like a screenplay, still needs a writer making the calls.' },
  { id: 'directing', shape: 'directing', name: 'Directing', group: 'Beyond STEM', state: 'notyet',
    note: 'Video models make impressive shots. Holding one vision across a whole film is a different job, and I haven’t seen an agent do it.' },
  { id: 'editing', shape: 'editing', name: 'Editing', group: 'Beyond STEM', state: 'notyet',
    note: 'It speeds up cutting and cleanup. Handing an agent raw footage and getting back a finished professional edit is the bar, and it isn’t there yet.' },
  { id: 'video', shape: 'video', name: 'Videography', group: 'Beyond STEM', state: 'notyet',
    note: 'Same problem as photography: the job happens on location, with a real camera, in the physical world.' },
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
