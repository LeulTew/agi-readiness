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
    note: 'Closest to working alone. OpenAI says its researchers use 3.1 days of agent work per human workday. Yet more than half of successful 4–8 hour tasks still needed a person to step in.', refs: [23] },
  { id: 'architecture', shape: 'architecture', name: 'Architecture', group: 'STEM', state: 'notyet',
    note: 'I haven’t seen an agent turn a real project brief into buildable drawings without an architect’s help. A convincing picture alone won’t do.' },
  { id: 'schematics', shape: 'schematics', name: 'Engineering', group: 'STEM', state: 'notyet',
    note: 'AI can now explain a circuit easily. I haven’t seen it deliver a working circuit board or machine without an engineer checking every step.' },
  { id: 'bio', shape: 'bio', name: 'Bioengineering', group: 'STEM', state: 'notyet',
    note: 'I want an agent that plans experiments, makes sense of messy results and handles failures. I haven’t seen one. Help with one narrow task isn’t enough.' },
  { id: 'chemistry', shape: 'chemistry', name: 'Chemistry', group: 'STEM', state: 'human',
    note: 'At the desk, it’s a strong colleague: explaining reactions and suggesting experiments. I count that as professional work with human guidance. People still do the lab work.' },
  { id: 'math', shape: 'math', name: 'Mathematics', group: 'STEM', state: 'human',
    note: 'In July 2026, a mathematician used Claude Fable 5 to find an example disproving the Jacobian conjecture in three or more dimensions. A human chose the problem and checked the result.', refs: [17] },
  { id: 'philosophy', shape: 'philosophy', name: 'Philosophy', group: 'Beyond STEM', state: 'human',
    note: 'Once I set the question, it can argue and critique at a solid professional level. Philosophers still debate whether it has views of its own.' },
  { id: 'photography', shape: 'photography', name: 'Photography', group: 'Beyond STEM', state: 'notyet',
    note: 'I mean photography: being on location, choosing the moment and taking the shot. No agent I know does that on its own. Generating an image doesn’t count.' },
  { id: 'writing', shape: 'writing', name: 'Writing', group: 'Beyond STEM', state: 'human',
    note: 'Clean, professional drafts on demand. A longer piece, like a screenplay, still needs a writer making the calls so it holds together.' },
  { id: 'directing', shape: 'directing', name: 'Directing', group: 'Beyond STEM', state: 'notyet',
    note: 'Video models make impressive shots. I haven’t seen an agent hold one creative vision across a whole film. That’s directing.' },
  { id: 'editing', shape: 'editing', name: 'Editing', group: 'Beyond STEM', state: 'notyet',
    note: 'It makes cutting and cleanup faster. I still can’t hand it raw footage and get back a finished professional edit.' },
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
