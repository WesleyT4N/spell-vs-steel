# Usage: python3 scripts/sfx/process.py <raw dir> <out dir>
# Trims silence, caps each slot's length, fades and loudness-normalizes (-14 LUFS) raw ElevenLabs takes named <slot>-<n>.mp3.
import subprocess,glob,os,json,sys,tempfile
RAW,OUT=sys.argv[1],sys.argv[2]
MAX={'ui_move':.4,'ui_select':.6,'ui_back':.6,'ui_open':.8,'ui_confirm':.8,'ui_deny':.5,'pip':.6,'charged':1.0,'win':2.5,'step':.35,
 'cleave':.8,'dagger':.8,'stab':.8,'knife':.9,'thrust':.8,'arrow':.9,'aimed':1.0,'bolt':.9,'holySpark':.9,'shot_fireball':1.2,'shot_chain':1.0,
 'shot_spin':1.0,'shot_magic':1.0,'shot_net':1.0,'shot_wind':1.2,'shot_beast':1.2,
 'hit_steel':.9,'hit_fire':.9,'hit_frost':.9,'hit_arcane':.9,'hit_holy':.9,'hit_shadow':.9,'hit_poison':.9,'hit_nature':.9,'heavyImpact':1.0,'ko':1.6,
 'block':.8,'guard':.9,'shieldHit':.8,'reflect':.9,'counter':.9,'spark':.8,'break':1.2,'freeze':1.4,'thaw':1.2,'heal':1.6,
 'meteorFall':2.0,'shout':1.5,'banner':1.2,'smoke':1.2,'toxicPuff':1.2,'lob':.9,'trapPop':.9,'hawkDive':1.2,'bite':1.0,'claw':.9,'flare':1.2,
 'arrowRain':1.5,'laser':1.8,'boltHeavy':1.2,'wide':1.0,'smash':1.0,'cleaveHeavy':1.0}
os.makedirs(OUT,exist_ok=True)
info={}
tmp=os.path.join(tempfile.mkdtemp(),'t.wav')
for f in sorted(glob.glob(os.path.join(RAW,'*.mp3'))):
    name=os.path.basename(f)[:-4]; slot=name.rsplit('-',1)[0]
    mx=MAX.get(slot, 1.2 if slot.startswith('cast_') else 1.6)
    subprocess.run(['ffmpeg','-v','error','-y','-i',f,'-af',f'silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:{mx},areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse','-ac','1','-ar','44100',tmp],check=True)
    d=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',tmp],capture_output=True,text=True).stdout or 0)
    if d<0.05: print('EMPTY',name); continue
    fd=max(0.05,min(0.3,d*0.3))
    subprocess.run(['ffmpeg','-v','error','-y','-i',tmp,'-af',f'afade=t=in:d=0.004,afade=t=out:st={d-fd:.3f}:d={fd:.3f},loudnorm=I=-14:TP=-1.5:LRA=11','-ar','44100','-ac','1','-b:a','80k',os.path.join(OUT,f'{name}.mp3')],check=True)
    info[name]=round(d,2)
print(len(info))
