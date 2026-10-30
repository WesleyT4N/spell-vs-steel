// Built-in classes, registered in roster order (never reorder: it is part of the game's behavior).
import { registerClass } from './registry';
import warrior from './warrior/rules';
import mage from './mage/rules';
import rogue from './rogue/rules';
import ranger from './ranger/rules';
import priest from './priest/rules';

for (const r of [warrior, mage, rogue, ranger, priest]) registerClass(r);

export { classRules, registerClass, CLASS_RULES, type ClassRules } from './registry';
