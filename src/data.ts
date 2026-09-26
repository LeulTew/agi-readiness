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
    note: 'OpenAI reports 3.1 agent-workdays per human workday, but more than half of its successful 4–8 hour tasks still needed human intervention. That is why I count software as assisted, not independent.', refs: [23] },
  { id: 'architecture', shape: 'architecture', name: 'Architecture', group: 'STEM', state: 'notyet',
    note: 'My bar is a coherent building design, not a convincing render. I have not seen enough evidence to count the full professional role as covered.' },
  { id: 'schematics', shape: 'schematics', name: 'Engineering', group: 'STEM', state: 'notyet',
    note: 'Explaining a circuit is not the same as delivering a sound board or machine design. I am not yet convinced the full role is covered.' },
  { id: 'bio', shape: 'bio', name: 'Bioengineering', group: 'STEM', state: 'notyet',
    note: 'A result in one narrow task would not establish the whole profession. My bar includes planning, interpreting experiments and handling what goes wrong.' },
  { id: 'chemistry', shape: 'chemistry', name: 'Chemistry', group: 'STEM', state: 'human',
    note: 'I count the desk-based work—reasoning through mechanisms and proposed experiments—as assisted professional work. That is my assessment, not a claim of autonomous lab work.' },
  { id: 'math', shape: 'math', name: 'Mathematics', group: 'STEM', state: 'human',
    note: 'In July 2026 a mathematician used Claude Fable 5 to find a counterexample to the Jacobian conjecture in dimensions three and above. Humans chose the problem and checked the result.', refs: [17] },
  { id: 'philosophy', shape: 'philosophy', name: 'Philosophy', group: 'Beyond STEM', state: 'human',
    note: 'I count structured argument and criticism as assisted professional work. That is not a claim that the agent has original beliefs or that every argument is sound.' },
  { id: 'photography', shape: 'photography', name: 'Photography', group: 'Beyond STEM', state: 'notyet',
    note: 'For this field I mean choosing and taking photographs, not generating images. I have not seen enough evidence of that complete role.' },
  { id: 'writing', shape: 'writing', name: 'Writing', group: 'Beyond STEM', state: 'human',
    note: 'I count drafting and revision as assisted work. My independent-work bar is a coherent finished piece, including the editorial decisions, not just fluent paragraphs.' },
  { id: 'directing', shape: 'directing', name: 'Directing', group: 'Beyond STEM', state: 'notyet',
    note: 'My bar is one sustained vision across a complete film, not a good isolated shot. I do not count that role as demonstrated yet.' },
  { id: 'editing', shape: 'editing', name: 'Editing', group: 'Beyond STEM', state: 'notyet',
    note: 'I mean taking raw footage to a coherent professional edit. An isolated cleanup or cutting task is not enough evidence for that full role.' },
  { id: 'video', shape: 'video', name: 'Videography', group: 'Beyond STEM', state: 'notyet',
    note: 'As with photography, I mean planning and shooting real footage on location. Generating a clip is a different task.' },
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
