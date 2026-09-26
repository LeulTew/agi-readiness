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
  human: 'With human guidance',
  notyet: 'Not there yet',
  solo: 'On its own',
};

// Our read as of 26 Sep 2026. Nothing is "solo" yet.
export const FIELDS: FieldDef[] = [
  { id: 'software', shape: 'software', name: 'Software', group: 'STEM', state: 'human',
    note: 'This comes closest. OpenAI says its researchers use 3.1 days of agent work per human workday. More than half of successful 4–8 hour tasks still needed a person to step in.', refs: [23] },
  { id: 'architecture', shape: 'architecture', name: 'Architecture', group: 'STEM', state: 'notyet',
    note: 'I haven’t seen an agent turn a real project brief into buildable drawings without an architect’s guidance. A convincing image alone doesn’t meet that standard.' },
  { id: 'schematics', shape: 'schematics', name: 'Engineering', group: 'STEM', state: 'notyet',
    note: 'AI can now explain a circuit easily. I haven’t seen it deliver a working circuit board or machine without an engineer checking every step.' },
  { id: 'bio', shape: 'bio', name: 'Bioengineering', group: 'STEM', state: 'notyet',
    note: 'The job includes planning experiments, understanding messy results and handling failures. I haven’t seen an agent take responsibility for all of it. Help with one narrow task falls short.' },
  { id: 'chemistry', shape: 'chemistry', name: 'Chemistry', group: 'STEM', state: 'human',
    note: 'I see a strong colleague for desk work: explaining how reactions work and proposing experiments. I count that as professional work with human guidance. People still do the lab work.' },
  { id: 'math', shape: 'math', name: 'Mathematics', group: 'STEM', state: 'human',
    note: 'In July 2026, a mathematician used Claude Fable 5 to find an example disproving the Jacobian conjecture in three or more dimensions. A human chose the problem and checked the result.', refs: [17] },
  { id: 'philosophy', shape: 'philosophy', name: 'Philosophy', group: 'Beyond STEM', state: 'human',
    note: 'I find its arguments and critiques reach a solid professional level once someone sets the question. Philosophers debate whether it has views of its own.' },
  { id: 'photography', shape: 'photography', name: 'Photography', group: 'Beyond STEM', state: 'notyet',
    note: 'Photography means being on location, choosing the moment and taking the shot. Generating an image is a different task. No agent I know does the photography job on its own.' },
  { id: 'writing', shape: 'writing', name: 'Writing', group: 'Beyond STEM', state: 'human',
    note: 'It produces clean, professional drafts on demand. A longer work, such as a screenplay, still needs a writer’s decisions to hold together.' },
  { id: 'directing', shape: 'directing', name: 'Directing', group: 'Beyond STEM', state: 'notyet',
    note: 'Video models produce impressive shots. I haven’t seen an agent maintain one creative vision across a whole film. That is the directing job.' },
  { id: 'editing', shape: 'editing', name: 'Editing', group: 'Beyond STEM', state: 'notyet',
    note: 'It makes cutting and cleanup faster. My standard is a finished, professional edit made from raw footage. It hasn’t reached that standard.' },
  { id: 'video', shape: 'video', name: 'Videography', group: 'Beyond STEM', state: 'notyet',
    note: 'Like photography, this is a job in the physical world, on location with a real camera.' },
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
  { label: 'Two paths: race or slowdown', m: 30.5 },
];
