import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
G={'ui_move':.3,'ui_select':.45,'ui_back':.45,'ui_open':.5,'ui_confirm':.5,'ui_deny':.45,'pip':.4,'charged':.5,'win':.7,'step':.25,
   'hit_steel':.8,'hit_fire':.8,'hit_frost':.8,'hit_arcane':.8,'hit_holy':.8,'hit_shadow':.8,'hit_poison':.8,'hit_nature':.8,'heavyImpact':.9,'ko':1,
   'block':.7,'guard':.6,'shieldHit':.7,'spark':.55,'counter':.7,'reflect':.7,'break':.8,'freeze':.8,'thaw':.75,'heal':.65,
   'shot_beast':.6,'bite':.7,'claw':.7,'hawkDive':.6,'laser':.6,'step':.25}
slots=[l.split('\t')[0] for l in open(os.path.join(HERE,'prompts.tsv'))]+['explode','shard','arcaneHit','holyPillar','heal','hit_steel','ui_confirm']
slots=sorted(set(slots))
S={s:{'gain':G.get(s,.75)} for s in slots}
snd={
 'move':'ui_move','select':'ui_select','back':'ui_back','open':'ui_open','confirm':'ui_confirm','deny':'ui_deny','pip':'pip','charged':'charged','win':'win','step':'step',
 'hit':['hit_{element}'],'hitBig':['heavyImpact','hit_{element}'],'heavyImpact':['heavyImpact','hit_{element}'],
 'block':'block','break':'break','freeze':'freeze','thaw':'thaw','heal':'heal','reflect':'reflect','ko':'ko',
 'cast':'cast_arcane','fire':'cast_fire','frost':'cast_frost','arcane':'cast_arcane',
 'missile':'bolt','explode':'explode','slash':'cleave','slashHeavy':'cleaveHeavy','bolt':'bolt','boltHeavy':'boltHeavy',
 'shot_arrow':'arrow','shot_knife':'knife','shot_hawk':'hawkDive',
}
for el in ['fire','frost','arcane','holy','shadow','poison','nature','steel']: snd['cast_'+el]='cast_'+el
for k in ['fireball','spin','magic','chain','net','wind','beast']: snd['shot_'+k]='shot_'+k
fx={k:k for k in ['cleave','cleaveHeavy','dagger','knife','bolt','boltHeavy','arrow','aimed','holySpark','holyPillar','holyNova','thrust','smash','quake','shockwave','wide','explode','pillar','meteorFall','shard','arcaneHit','blink','novaZone','guard','shieldHit','spark','shout','transform','counter','banner','stab','smoke','toxicPuff','lob','trapPop','hawkDive','bite','claw','flare','arrowRain','laser']}
fx['nova']='cast_frost'
alias={
 'cleaveHeavy':'stepSlash rampage','smash':'leapSmash execute shieldSlam mortal wallRise kick','shockwave':'hammer groundSlam shatter lastStandBlast',
 'quake':'seismic titanFall','shout':'battleShout roar berserk rally killCommand',
 'transform':'avatar lastStand ascendance arcanePower powerInfusion sanctum shadowform deadeye','guard':'guardUp ironSkin unbreakable reflectUp riposte',
 'explode':'fireballBlast scorch meteorBlast comet dragonsBreath inferno explosiveShot','arcaneHit':'arcaneSurge','shard':'deepFreeze iceWall iceBlock',
 'novaZone':'glacialFortress','pillar':'ignite','smoke':'shadowBlink vanish evasion smokescreen shadowDance shadowClone nightsEmbrace disengage',
 'stab':'shadowstep ambush flurry spree eviscerate fanKnife riposteHit','dagger':'shiv pickpocket kidneyShot','lob':'vialLob',
 'toxicPuff':'vialBurst deadlyPoison envenom blind pandemic','holyPillar':'smite holyFire penanceBolt haloBolt wrath',
 'cast_shadow':'psychicScream','trapPop':'trapMine trapWire','aimed':'killShot','arrowRain':'barrage'}
for slot,ks in alias.items():
    for k in ks.split(): fx[k]=slot
fx['trapFreeze']=['trapPop','freeze']; fx['trapExplode']=['trapPop','explode']; fx['trapBlast']=['trapPop','explode']
for k in 'healBurst flashHeal hymnTick blessPower blessHeal blessMana blessShield blessSacred sanctumBless'.split(): fx[k]=[]
for k,v in fx.items(): snd['fx:'+k]=v
out={'_about':'Sound effect samples. slots: one file per slot (<slot>.mp3 beside this file) and its mix gain. sounds: game sound name (fx:<kind> for spell effects) -> slot or list of slots played together; {element} is the hit element (steel when none); [] plays nothing. Names not listed fall back to the synthesized sound.',
     'slots':S,'sounds':dict(sorted(snd.items()))}
json.dump(out,open(os.path.join(HERE,'../../assets/audio/sfx/sfx.json'),'w'),indent=1)
print(len(S),len(snd))
