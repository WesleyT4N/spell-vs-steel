// Built-in classes, registered in roster order (never reorder: it is part of the game's behavior).
import { registerClass } from './registry';
import warrior from './warrior';
import mage from './mage';
import rogue from './rogue';
import ranger from './ranger';
import priest from './priest';

for (const m of [warrior, mage, rogue, ranger, priest]) registerClass(m);

export { classModule, classRules, registerClass, CLASSES, type ClassModule, type ClassInfo, type ClassRules, type ClassDecks, type ClassCpu, type ClassLessons, type LessonPage, type ClassLab, type LabSpell, type LabLook } from './registry';
