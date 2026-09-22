// Registers every chapter's contracts. Imported once, for its side effect, from
// App.tsx. Modules that CONSULT the registry (storyState, storyInputPolicy,
// storyObjectiveGuidance, storyDirector) must never import this file — the
// contracts import them, and that would be a cycle.
import './prologue/index.ts';
import './ch1/index.ts';
import './ch2/index.ts';
import './ch3/index.ts';
import './ch4/index.ts';
import './ch5/index.ts';
import './ch6/index.ts';
import './ch7/index.ts';
import './ch8/index.ts';
import './ch9/index.ts';
import './ch10/index.ts';
import './ch13/index.ts';
import './ch14/index.ts';
