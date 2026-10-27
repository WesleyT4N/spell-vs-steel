// Scene stack rules: BACK shows the screen underneath as it was left, a fight takes the stage select's place,
// and leaving a fight for the character select lands on the one it came from.
// Usage: npx tsx tests/scene-stack.ts
import { setScene, setHome, pushScene, popScene, replaceScene, popTo, goHome, getScene, sceneDepth, type Scene } from '../src/scenes/stack';

class Fake implements Scene {
  entered = 0;
  resumed = 0;
  constructor(public name: string) {}
  update(): void {}
  draw(): void {}
  enter(): void { this.entered++; }
  resume(): void { this.resumed++; }
}

let failures = 0;
const expect = (ok: boolean, msg: string): void => { if (!ok) { failures++; console.log(`FAIL ${msg}`); } };
const top = (): string => (getScene() as Fake).name;

setHome(() => new Fake('title'));
goHome();
const title = getScene() as Fake;
const select = new Fake('select');
pushScene(select);
pushScene(new Fake('deck builder'));
popScene();
expect(getScene() === select && select.resumed === 1 && select.entered === 1, 'BACK from the deck builder shows the same character select, resumed not reopened');
pushScene(new Fake('stage select'));
replaceScene(new Fake('battle'));
expect(top() === 'battle' && sceneDepth() === 3, `the fight takes the stage select's place (depth ${sceneDepth()})`);
pushScene(new Fake('options'));
popScene();
expect(top() === 'battle', 'BACK from pause options returns to the fight');
replaceScene(new Fake('battle round 2'));
popTo(s => s === select, () => new Fake('new select'));
expect(getScene() === select && sceneDepth() === 2, 'CHARACTER SELECT after a set lands on the select the match came from');
popScene();
expect(getScene() === title && title.resumed === 1, 'BACK from the first screen shows the title it came from');
popScene();
expect(top() === 'title' && getScene() !== title && sceneDepth() === 1, 'popping the title opens a fresh one');
setScene(new Fake('online lobby'));
popScene();
expect(top() === 'title' && sceneDepth() === 1, 'BACK from a screen opened straight from a link lands on the title');
popTo(s => s instanceof Fake && s.name === 'select', () => new Fake('fallback select'));
expect(top() === 'fallback select' && sceneDepth() === 2, 'popTo with nothing to pop to opens a new one over the title');

if (failures) { console.log(`${failures} scene stack failure(s)`); process.exit(1); }
console.log('scene stack ok');
