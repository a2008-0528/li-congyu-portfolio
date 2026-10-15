/* NEBULA STRIKE — original, dependency-free simulation. No DOM dependencies. */
(function (root) {
  'use strict';
  const W = 540, H = 960;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const SHIPS = [
    { id: 'falcon', name: '隼式 X-01', role: '均衡型截击机', hp: 100, speed: 420, damage: 10, rate: 5, color: '#80edda', unlock: 0 },
    { id: 'lance', name: '雷矛 L-02', role: '高能突击战机', hp: 80, speed: 420, damage: 13, rate: 5, color: '#b19aff', unlock: 1 },
    { id: 'bastion', name: '磐石 A-03', role: '重装护卫战机', hp: 140, speed: 360, damage: 9, rate: 5, color: '#e8bc74', unlock: 3 }
  ];
  const UPGRADES = [
    { id:'damage', name:'高能弹头', icon:'⌁', max:5, tag:'主炮 / 输出', desc:'主炮伤害 +15% 基础值', route:'雷霆矩阵：高能 II + 电弧 III' },
    { id:'rate', name:'高频供能', icon:'ϟ', max:5, tag:'主炮 / 速射', desc:'主炮射速 +12% 基础值', route:'光子风暴：高频 III + 分裂 II' },
    { id:'split', name:'分裂弹道', icon:'⋔', max:2, tag:'主炮 / 范围', desc:'增加 1 条弹道；每条伤害为 70%', route:'光子风暴：分裂 II + 高频 III' },
    { id:'pierce', name:'贯穿弹芯', icon:'↟', max:2, tag:'主炮 / 穿透', desc:'每枚主炮弹额外穿透 1 个目标' },
    { id:'missile', name:'追踪导弹', icon:'↗', max:3, tag:'副武器 / 追踪', desc:'每 2 秒发射导弹；每级增加 1 枚', route:'蜂群审判：导弹 III + 磁吸 I' },
    { id:'drone', name:'环绕僚机', icon:'◇', max:2, tag:'副武器 / 支援', desc:'增加 1 架自动射击僚机，20 DPS' },
    { id:'arc', name:'电弧链路', icon:'⌇', max:3, tag:'副武器 / 连锁', desc:'每 2 秒电弧打击 2/3/4 个敌人', route:'雷霆矩阵：电弧 III + 高能 II' },
    { id:'armor', name:'装甲扩容', icon:'⬡', max:3, tag:'生存 / 装甲', desc:'最大生命 +20% 基础值，恢复 20 生命' },
    { id:'capacitor', name:'护盾电容', icon:'◉', max:3, tag:'生存 / 护盾', desc:'护盾上限 +15，并恢复 15 护盾' },
    { id:'repair', name:'修复模块', icon:'✚', max:3, tag:'生存 / 恢复', desc:'每 10 秒回复 2/4/6 生命' },
    { id:'magnet', name:'磁吸核心', icon:'⊙', max:2, tag:'辅助 / 成长', desc:'经验吸附范围 +50%，经验收益 +10%', route:'蜂群审判：磁吸 I + 导弹 III' },
    { id:'overload', name:'超载协议', icon:'✦', max:2, tag:'风险 / 爆发', desc:'所有武器伤害 +20% 基础值，受伤 +10%' }
  ];
  const EVOLUTIONS = [
    {id:'photon',name:'光子风暴',icon:'⋔',max:1,tag:'终极进化 / 主炮',desc:'进化为 5 条光子弹道，每条 55% 伤害',needs:{split:2,rate:3}},
    {id:'swarm',name:'蜂群审判',icon:'✧',max:1,tag:'终极进化 / 导弹',desc:'每轮释放 6 枚追踪导弹，单枚基础伤害 28',needs:{missile:3,magnet:1}},
    {id:'thunder',name:'雷霆矩阵',icon:'ϟ',max:1,tag:'终极进化 / 电弧',desc:'电弧间隔缩短为 1.2 秒，连锁目标增加至 6',needs:{arc:3,damage:2}}
  ];
  const ENEMIES = [
    {name:'侦察蜂',hp:20,speed:125,score:100,xp:10,r:18},
    {name:'游猎机',hp:45,speed:95,score:180,xp:15,r:21},
    {name:'盾卫机',hp:120,speed:65,score:300,xp:25,r:29},
    {name:'自爆机',hp:30,speed:90,score:160,xp:12,r:17},
    {name:'布雷机',hp:60,speed:80,score:220,xp:18,r:23},
    {name:'精英巡航舰',hp:1800,speed:20,score:2000,xp:100,r:64}
  ];
  class Pool {
    constructor(capacity){this.items = Array.from({length:capacity},()=>({active:false}));this.next=0;}
    take(values){for(let n=0;n<this.items.length;n++){const i=(this.next+n)%this.items.length;const o=this.items[i];if(!o.active){for(const k of Object.keys(o))delete o[k];Object.assign(o,values,{active:true});this.next=(i+1)%this.items.length;return o;}}return null;}
    clear(){for(const o of this.items)o.active=false;}
    get count(){let n=0;for(const o of this.items)if(o.active)n++;return n;}
  }
  function sweptHit(ax,ay,bx,by,x,y,r){const dx=bx-ax,dy=by-ay;const q=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1),0,1);return (ax+q*dx-x)**2+(ay+q*dy-y)**2<=r*r;}
  class Game {
    constructor(onEvent=()=>{}){this.onEvent=onEvent;this.bullets=new Pool(220);this.enemyBullets=new Pool(480);this.enemies=new Pool(30);this.drops=new Pool(120);this.reset();}
    reset(){this.status='idle';this.time=0;this.visualTime=0;this.boss=null;this.events=[];this.level=0;this.score=0;this.kills=0;this.hits=0;this.spawned=0;this.upgrades={};this.evolved={};this.options=[];this.lines=[];this.lasers=[];this.effects=[];this.player={x:270,y:770,hp:100,maxHp:100,shield:30,maxShield:30,invuln:0,skillInvuln:0,lastHit:-100};}
    emit(type,data={}){this.onEvent(type,data);}
    random(){let t=this.seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}
    start({ship='falcon',mode='campaign',research={},seed=Date.now()}={}){
      this.reset();for(const p of [this.bullets,this.enemyBullets,this.enemies,this.drops])p.clear();
      this.seed=seed>>>0;this.mode=mode;this.ship=SHIPS.find(s=>s.id===ship)||SHIPS[0];this.research=mode==='bossRush'?{}:research;
      if(mode==='bossRush')this.ship=SHIPS[0];
      this.player={x:270,y:770,maxHp:this.ship.hp*(1+.05*(this.research.armor||0)),maxShield:30*(1+.1*(this.research.shield||0)),invuln:0,skillInvuln:0,lastHit:-100};
      Object.assign(this.player,{hp:this.player.maxHp,shield:this.player.maxShield});
      this.status='active';this.rawScore=0;this.xp=0;this.nextXp=20;this.combo=0;this.comboAt=-10;this.wave=0;this.shotTimer=0;this.missileTimer=0;this.arcTimer=0;this.droneTimer=0;this.repairTimer=0;this.spawnTimer=.4;this.empCd=0;this.shieldCd=0;this.refreshes=1;this.cycle=0;this.stageTime=0;this.eliteSpawned=false;this.pendingBoss=false;this.introTimer=0;this.bossKills=0;this.idCounter=0;this.bossTime=0;this.runId=String(Date.now())+'-'+this.random().toString(36).slice(2);this.result=null;
      if(mode==='bossRush'){this.upgrades={damage:3,rate:3,split:2,missile:3,capacitor:1};this.evolved={photon:1};this.player.maxShield+=15;this.player.shield=this.player.maxShield;this.level=12;this.beginBoss();}
      this.emit('start');
    }
    value(id){return this.upgrades[id]||0;}
    weaponMult(){return 1+.2*this.value('overload');}
    damageMult(){return 1+.15*this.value('damage')+.2*this.value('overload')+.04*(this.research.firepower||0);}
    addXp(value){if(this.level>=12)return;this.xp+=value*(1+.1*this.value('magnet'));if(this.xp>=this.nextXp&&this.status==='active')this.openUpgrade();}
    eligible(){const base=UPGRADES.filter(u=>this.value(u.id)<u.max);return base;}
    getOptions(){const pool=[...this.eligible()];const out=[];const ev=EVOLUTIONS.filter(e=>!this.evolved[e.id]&&Object.entries(e.needs).every(([k,n])=>this.value(k)>=n));if(ev.length)out.push(ev[Math.floor(this.random()*ev.length)]);while(out.length<3&&pool.length){const index=Math.floor(this.random()*pool.length);out.push(pool.splice(index,1)[0]);}const fillers=[...(this.player.hp<this.player.maxHp?[{id:'heal',name:'应急修复',icon:'✚',desc:'立即恢复 20 生命',tag:'一次性补给'}]:[]),...(this.player.shield<this.player.maxShield?[{id:'shieldFill',name:'护盾补给',icon:'⬡',desc:'立即恢复 20 护盾',tag:'一次性补给'}]:[]),{id:'scoreGift',name:'战术数据',icon:'✧',desc:'立即获得 500 积分',tag:'一次性奖励'}];while(out.length<3)out.push({...fillers[(out.length)%fillers.length],optionKey:out.length});return out;}
    openUpgrade(){if(this.level>=12||this.xp<this.nextXp)return;this.status='upgrade';this.options=this.getOptions();this.emit('upgrade',{options:this.options});}
    refresh(){if(this.status!=='upgrade'||!this.refreshes)return false;this.refreshes--;this.options=this.getOptions();this.emit('upgrade',{options:this.options});return true;}
    choose(index){if(this.status!=='upgrade'||!this.options[index])return false;const u=this.options[index];const p=this.player;
      if(EVOLUTIONS.some(e=>e.id===u.id)){this.evolved[u.id]=1;this.emit('evolution',{name:u.name});}
      else if(u.id==='heal')p.hp=Math.min(p.maxHp,p.hp+20);
      else if(u.id==='shieldFill')p.shield=Math.min(p.maxShield,p.shield+20);
      else if(u.id==='scoreGift')this.score+=500;
      else{this.upgrades[u.id]=this.value(u.id)+1;if(u.id==='armor'){p.maxHp+=this.ship.hp*.2;p.hp=Math.min(p.maxHp,p.hp+20);}if(u.id==='capacitor'){p.maxShield+=15;p.shield=Math.min(p.maxShield,p.shield+15);}}
      this.xp-=this.nextXp;this.level++;this.nextXp=20+10*this.level;this.options=[];this.status='active';this.emit('chosen',{upgrade:u});if(this.level<12&&this.xp>=this.nextXp)this.openUpgrade();return true;
    }
    useSkill(id){if(this.status!=='active'||this.introTimer>0)return false;
      if(id==='emp'&&this.empCd<=0){this.empCd=25;this.enemyBullets.clear();for(const e of this.enemies.items)if(e.active)this.hitEnemy(e,120);if(this.boss&&this.boss.state==='active'){this.hitBoss('core',200);if(this.status==='active')for(let i=0;i<2;i++)this.hitBoss(i,200);}this.emit('emp',{x:this.player.x,y:this.player.y});return true;}
      if(id==='shield'&&this.shieldCd<=0){this.shieldCd=20;this.player.skillInvuln=2;this.emit('shield');return true;}return false;
    }
    hurt(amount){const p=this.player;if(this.status!=='active'||this.introTimer>0||p.invuln>0||p.skillInvuln>0)return false;amount*=1+.1*this.value('overload');const absorb=Math.min(p.shield,amount);p.shield-=absorb;p.hp=Math.max(0,p.hp-(amount-absorb));p.lastHit=this.time;p.invuln=.8;this.hits++;this.combo=0;this.emit('hurt',{x:p.x,y:p.y});if(p.hp<=0)this.finish(false);return true;}
    finish(won){if(this.status==='finished')return;this.status='finished';this.enemyBullets.clear();this.lasers=[];const tech=Math.floor(this.rawScore/100)+(won?100:0);this.result={runId:this.runId,mode:this.mode,shipId:this.ship.id,score:Math.floor(this.score),rawScore:this.rawScore,won,kills:this.kills,hits:this.hits,time:this.time,bossTime:this.bossTime,tech,bossKills:this.bossKills,stars:won?1+(this.kills/Math.max(1,this.spawned)>=.9?1:0)+(this.hits<=3?1:0):0,upgrades:{...this.upgrades},evolved:{...this.evolved},finishedAt:new Date().toISOString()};this.emit('finish',this.result);}
    spawnEnemy(type,x,y=-50){const d=ENEMIES[type];if(this.enemies.count>=(type===5?29:24))return null;const scale=1+.15*this.cycle;const e=this.enemies.take({id:++this.idCounter,type,x,y,originX:x,hp:d.hp*scale,maxHp:d.hp*scale,r:d.r,age:0,shoot:1+this.random()*1.5,locked:false,targetX:0,targetY:0,hit:0});if(e)this.spawned++;return e;}
    spawnWave(){this.wave++;const t=this.stageTime;const type=t<30?0:t<60?(this.random()<.6?0:1):Math.floor(this.random()*5);const count=type===0?4:type===2?2:3;const origin=70+this.random()*150;for(let i=0;i<count;i++)this.spawnEnemy(type,clamp(origin+i*85,40,500),-55-i*50);}
    enemyShot(x,y,angle,speed=180,r=5){if(this.enemyBullets.count>=400)return;this.enemyBullets.take({x,y,px:x,py:y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r,age:0,life:10});}
    aim(x,y){return Math.atan2(this.player.y-y,this.player.x-x);}
    fan(x,y,n=5,spread=.85,speed=180,center=Math.PI/2){if(this.enemyBullets.count+n>400)return;for(let i=0;i<n;i++)this.enemyShot(x,y,center+spread*(i/(n-1||1)-.5),speed);}
    hitEnemy(e,damage){if(!e.active)return;e.hp-=damage;e.hit=.06;if(e.hp<=0){e.active=false;this.kills++;this.combo=this.time-this.comboAt<3?this.combo+1:1;this.comboAt=this.time;const d=ENEMIES[e.type];this.rawScore+=d.score;this.score+=Math.round(d.score*Math.min(3,1+.1*Math.floor(this.combo/10)));this.drops.take({x:e.x,y:e.y,value:d.xp,age:0});this.emit('explode',{x:e.x,y:e.y,size:e.type===5?65:e.r,color:e.type===5?'#ffb17a':'#68d5d8'});}}
    hitBoss(target,damage){const b=this.boss;if(!b||b.state!=='active')return;if(target==='core'){b.hp=Math.max(0,b.hp-damage);b.hit=.05;if(b.hp<=0){b.state='dying';b.death=2.5;this.score+=10000;this.rawScore+=10000;this.bossKills++;this.enemyBullets.clear();this.lasers=[];this.emit('bossDeath');}}else if(b.parts[target]>0){b.parts[target]=Math.max(0,b.parts[target]-damage);b.partHits[target]=.07;if(!b.parts[target]){this.score+=1500;this.rawScore+=1500;this.emit('explode',{x:b.x+(target===0?-133:133),y:b.y+38,size:65,color:'#ffad8c'});}}}
    beginBoss(){this.pendingBoss=false;for(const e of this.enemies.items)e.active=false;this.enemyBullets.clear();this.lasers=[];for(const d of this.drops.items)if(d.active){d.active=false;this.addXp(d.value);}const hp=12000*(1+.15*this.cycle);this.boss={x:270,y:-160,hp,maxHp:hp,parts:[1200*(1+.15*this.cycle),1200*(1+.15*this.cycle)],partHits:[0,0],phase:1,state:'entering',age:0,fan:1,ring:2,aim:3,laser:6,column:8,hit:0};this.introTimer=2.5;this.emit('bossIntro');}
    laser(x,width,duration,warning=1){this.lasers.push({x,width,duration,warning,age:0,active:false});}
    updateBoss(dt){const b=this.boss;if(!b)return;b.age+=dt;b.hit=Math.max(0,b.hit-dt);b.partHits=b.partHits.map(n=>Math.max(0,n-dt));
      if(b.state==='entering'){b.y+=Math.min(155-b.y,dt*170);if(this.introTimer<=0){b.state='active';b.y=155;this.emit('bossActive');}return;}
      if(b.state==='dying'){b.death-=dt;if(this.random()<dt*12)this.emit('explode',{x:b.x+(this.random()-.5)*300,y:b.y+(this.random()-.5)*120,size:25+this.random()*35,color:'#ffb698'});if(b.death<=0){if(this.mode==='endless'){this.cycle++;this.stageTime=0;this.eliteSpawned=false;this.boss=null;this.emit('nextCycle',{cycle:this.cycle});}else this.finish(true);}return;}
      this.bossTime+=dt;b.x=270+Math.sin(b.age*.5)*50;const phase=b.hp/b.maxHp>.65?1:b.hp/b.maxHp>.3?2:3;if(phase!==b.phase){b.phase=phase;this.enemyBullets.clear();this.lasers=[];this.player.invuln=Math.max(this.player.invuln,1);b.rest=1;b.ring=2;b.laser=4;b.column=8;this.emit('phase',{phase});}
      b.rest=Math.max(0,(b.rest||0)-dt);if(b.rest>0)return;
      b.fan-=dt;b.aim-=dt;b.ring-=dt;b.laser-=dt;b.column-=dt;
      if(b.phase===3&&b.column<=0){b.column=8;b.rest=6.4;for(let i=0;i<3;i++)this.lasers.push({x:[100,270,440][i],width:60,duration:.8,warning:1,age:-i*1.8,active:false});return;}
      if(b.fan<=0){b.fan=b.phase===1?1.8:2.4;const index=b.alternate?1:0;b.alternate=!b.alternate;if(b.parts[index]>0)this.fan(b.x+(index===0?-133:133),b.y+63,5,1.1,180);}
      if(b.phase===1&&b.aim<=0){b.aim=4;this.fan(b.x,b.y+60,3,.2,230,this.aim(b.x,b.y+60));}
      if(b.phase>=2&&b.ring<=0){b.ring=b.phase===2?2.5:2;b.rotation=(b.rotation||0)+Math.PI/20;for(let i=0;i<20;i++)this.enemyShot(b.x,b.y+30,b.rotation+i*Math.PI*2/20,b.phase===2?150:180);}
      if(b.phase>=2&&b.laser<=0){b.laser=b.phase===2?6:5;this.laser(clamp(this.player.x,45,495),54,1.2);}
    }
    nearest(x,y){let target=null,dist=Infinity;for(const e of this.enemies.items)if(e.active&&e.y>0){const d=(e.x-x)**2+(e.y-y)**2;if(d<dist){target=e;dist=d;}}if(this.boss?.state==='active'){const b=this.boss;const d=(b.x-x)**2+(b.y-y)**2;if(d<dist)target=b;}return target;}
    shoot(){const p=this.player;const n=this.evolved.photon?5:1+this.value('split');const coeff=this.evolved.photon?.55:this.value('split')?.7:1;for(let i=0;i<n;i++){const a=-Math.PI/2+(i-(n-1)/2)*.1;this.bullets.take({x:p.x+(i-(n-1)/2)*9,y:p.y-28,px:p.x,py:p.y-28,vx:Math.cos(a)*760,vy:Math.sin(a)*760,damage:this.ship.damage*this.damageMult()*coeff,r:3,kind:'main',pierce:this.value('pierce'),hitIds:new Set(),age:0});}this.emit('shoot');}
    updateWeapons(dt){this.shotTimer-=dt;this.missileTimer-=dt;this.arcTimer-=dt;this.droneTimer-=dt;this.repairTimer+=dt;
      if(this.shotTimer<=0){this.shotTimer+=1/(this.ship.rate*(1+.12*this.value('rate')));this.shoot();}
      const p=this.player;if(this.value('missile')&&this.missileTimer<=0){this.missileTimer=2;const n=this.evolved.swarm?6:this.value('missile');for(let i=0;i<n;i++)this.bullets.take({x:p.x+(i-(n-1)/2)*16,y:p.y-10,px:p.x,py:p.y,vx:(i-(n-1)/2)*80,vy:-310,damage:(this.evolved.swarm?28:35)*this.weaponMult(),r:6,kind:'missile',pierce:0,hitIds:new Set(),age:0});}
      if(this.value('drone')&&this.droneTimer<=0){this.droneTimer=.5;for(let i=0;i<this.value('drone');i++)this.bullets.take({x:p.x+(i===0?-43:43),y:p.y+5,px:p.x,py:p.y,vx:0,vy:-700,damage:10*this.weaponMult(),r:3,kind:'drone',pierce:0,hitIds:new Set(),age:0});}
      if(this.value('arc')&&this.arcTimer<=0){this.arcTimer=this.evolved.thunder?1.2:2;const targets=this.enemies.items.filter(e=>e.active&&e.y>0).sort((a,b)=>((a.x-p.x)**2+(a.y-p.y)**2)-((b.x-p.x)**2+(b.y-p.y)**2)).slice(0,this.evolved.thunder?6:1+this.value('arc'));let x=p.x,y=p.y;for(const t of targets){this.lines.push({x,y,x2:t.x,y2:t.y,life:.2});this.hitEnemy(t,30*this.weaponMult());x=t.x;y=t.y;}if(!targets.length&&this.boss?.state==='active'){const b=this.boss;this.lines.push({x,y,x2:b.x,y2:b.y,life:.2});this.hitBoss('core',30*this.weaponMult());}}
      if(this.repairTimer>=10){this.repairTimer-=10;p.hp=Math.min(p.maxHp,p.hp+2*this.value('repair'));}
    }
    update(dt,input={x:0,y:0}){if(this.status!=='active')return;dt=Math.min(dt,.05);this.time+=dt;this.visualTime+=dt;const p=this.player;p.invuln=Math.max(0,p.invuln-dt);p.skillInvuln=Math.max(0,p.skillInvuln-dt);this.empCd=Math.max(0,this.empCd-dt);this.shieldCd=Math.max(0,this.shieldCd-dt);this.introTimer=Math.max(0,this.introTimer-dt);
      if(this.time-p.lastHit>=6)p.shield=Math.min(p.maxShield,p.shield+6*dt);
      const len=Math.hypot(input.x||0,input.y||0)||1;p.x=clamp(p.x+(input.x||0)/Math.max(1,len)*this.ship.speed*dt,24,516);p.y=clamp(p.y+(input.y||0)/Math.max(1,len)*this.ship.speed*dt,160,840);
      if(input.target){const dx=input.target.x-p.x,dy=input.target.y-p.y,d=Math.hypot(dx,dy);const move=Math.min(d,this.ship.speed*dt);if(d){p.x=clamp(p.x+dx/d*move,24,516);p.y=clamp(p.y+dy/d*move,160,840);}}
      if(this.boss){this.updateBoss(dt);if(this.status==='finished')return;}
      else{this.stageTime+=dt;const eliteAlive=this.enemies.items.some(e=>e.active&&e.type===5);if(this.stageTime>=90&&!this.eliteSpawned){this.eliteSpawned=true;this.spawnEnemy(5,270,-80);this.emit('elite');}else if(this.stageTime>=180&&!eliteAlive){this.beginBoss();if(this.status!=='active')return;}else if(!eliteAlive&&this.stageTime<180){this.spawnTimer-=dt;if(this.spawnTimer<=0){this.spawnTimer=this.stageTime<30?5:4;this.spawnWave();}}}
      if(this.introTimer<=0&&this.boss?.state!=='dying')this.updateWeapons(dt);
      for(const e of this.enemies.items){if(!e.active)continue;e.age+=dt;e.hit=Math.max(0,e.hit-dt);e.shoot-=dt;const d=ENEMIES[e.type];
        if(e.type===5){e.y=Math.min(210,e.y+75*dt);e.x=270+Math.sin(e.age)*130;if(e.shoot<=0){e.shoot=1.5;this.fan(e.x,e.y+35,7,1.2,180,this.aim(e.x,e.y));}}
        else{e.y+=d.speed*dt;if(e.type===1)e.x=clamp(e.originX+Math.sin(e.age*2)*55,25,515);if(e.type===3&&e.age>1.5){if(!e.locked){e.locked=true;const a=this.aim(e.x,e.y);e.vx=Math.cos(a)*330;e.vy=Math.sin(a)*330;}if(e.age>2.2){e.x+=e.vx*dt;e.y+=(e.vy-d.speed)*dt;}}if(e.type===4)e.x=clamp(e.originX+Math.sin(e.age)*90,30,510);if(e.shoot<=0&&e.y>0&&e.y<650){e.shoot=e.type===2?2.8:2.4;if(e.type===1)this.enemyShot(e.x,e.y+15,this.aim(e.x,e.y),220);if(e.type===2)this.fan(e.x,e.y+25,3,.7,180);if(e.type===4)this.enemyBullets.take({x:e.x,y:e.y,px:e.x,py:e.y,vx:0,vy:45,r:13,age:0,life:6,mine:true});}}
        if(e.y>1010||e.x< -80||e.x>620){e.active=false;continue;}
      }
      for(const b of this.bullets.items){if(!b.active)continue;b.age+=dt;b.px=b.x;b.py=b.y;if(b.kind==='missile'){const t=this.nearest(b.x,b.y);if(t){const dx=t.x-b.x,dy=t.y-b.y,len=Math.hypot(dx,dy)||1;const turn=Math.min(1,dt*5);b.vx+=(dx/len*500-b.vx)*turn;b.vy+=(dy/len*500-b.vy)*turn;}}b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.y< -200||b.y>1040||b.x< -100||b.x>640||b.age>5){b.active=false;continue;}
        for(const e of this.enemies.items){if(!e.active||b.hitIds.has(e.id))continue;if(sweptHit(b.px,b.py,b.x,b.y,e.x,e.y,e.r+b.r)){b.hitIds.add(e.id);this.hitEnemy(e,b.damage);if(b.pierce--<=0){b.active=false;break;}}}
        const boss=this.boss;if(b.active&&boss?.state==='active'){for(const target of [0,1,'core']){const id='boss-'+target;if(b.hitIds.has(id))continue;const x=target==='core'?boss.x:boss.x+(target===0?-133:133);const y=target==='core'?boss.y:boss.y+36;const r=target==='core'?56:34;if(target!=='core'&&boss.parts[target]<=0)continue;if(sweptHit(b.px,b.py,b.x,b.y,x,y,r+b.r)){b.hitIds.add(id);this.hitBoss(target,b.damage);if(b.pierce--<=0){b.active=false;break;}}}}
      }
      if(this.status!=='active')return;
      if(this.boss?.state!=='dying'&&this.introTimer<=0){
        for(const b of this.enemyBullets.items){if(!b.active)continue;b.age+=dt;b.px=b.x;b.py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.age>b.life||b.y>1010||b.y< -80||b.x< -80||b.x>620){b.active=false;continue;}if((!b.mine||b.age>1)&&sweptHit(b.px,b.py,b.x,b.y,p.x,p.y,8+b.r)){b.active=false;this.hurt(15*(1+.05*this.cycle));if(this.status!=='active')return;}}
        for(const e of this.enemies.items)if(e.active&&Math.hypot(e.x-p.x,e.y-p.y)<e.r+8){this.hurt(25);if(this.status!=='active')return;}
        if(this.boss?.state==='active'&&Math.hypot(this.boss.x-p.x,this.boss.y-p.y)<70){this.hurt(25);if(this.status!=='active')return;}
      }
      for(const l of this.lasers){l.age+=dt;l.active=l.age>=l.warning&&l.age<l.warning+l.duration;if(l.active&&Math.abs(p.x-l.x)<l.width/2+8){this.hurt(30);if(this.status!=='active')return;}}this.lasers=this.lasers.filter(l=>l.age<l.warning+l.duration);
      for(const d of this.drops.items){if(!d.active)continue;d.age+=dt;const dx=p.x-d.x,dy=p.y-d.y,dist=Math.hypot(dx,dy);if(dist<100*(1+.5*this.value('magnet'))||this.boss?.state==='entering'||d.age>8){const v=Math.min(dist,500*dt);d.x+=dx/(dist||1)*v;d.y+=dy/(dist||1)*v;}else d.y+=35*dt;if(dist<17){d.active=false;this.addXp(d.value);this.emit('pickup');}if(d.age>12||d.y>1000)d.active=false;}
      for(const l of this.lines)l.life-=dt;this.lines=this.lines.filter(l=>l.life>0);
    }
  }
  function defaultSave(){return{version:1,tech:0,research:{firepower:0,armor:0,shield:0},wins:0,best:0,runs:[],settled:[],selectedShip:'falcon',settings:{volume:.35,music:true,sfx:true,quality:'high',shake:true,reducedMotion:false}};}
  function validateSave(raw){const s=defaultSave();if(!raw||typeof raw!=='object')return s;for(const k of ['tech','wins','best'])if(Number.isFinite(raw[k]))s[k]=clamp(Math.floor(raw[k]),0,1e9);for(const k of Object.keys(s.research))if(Number.isFinite(raw.research?.[k]))s.research[k]=clamp(Math.floor(raw.research[k]),0,5);if(SHIPS.some(x=>x.id===raw.selectedShip))s.selectedShip=raw.selectedShip;if(Array.isArray(raw.runs))s.runs=raw.runs.filter(r=>r&&typeof r.runId==='string'&&Number.isFinite(r.score)&&typeof r.won==='boolean'&&['campaign','endless','bossRush'].includes(r.mode)&&typeof r.finishedAt==='string'&&Number.isFinite(Date.parse(r.finishedAt))).slice(0,10);if(Array.isArray(raw.settled))s.settled=raw.settled.filter(v=>typeof v==='string').slice(-100);if(raw.settings){for(const k of ['music','sfx','shake','reducedMotion'])if(typeof raw.settings[k]==='boolean')s.settings[k]=raw.settings[k];if(Number.isFinite(raw.settings.volume))s.settings.volume=clamp(raw.settings.volume,0,1);if(['high','low'].includes(raw.settings.quality))s.settings.quality=raw.settings.quality;}return s;}
  function settle(save,result){if(save.settled.includes(result.runId))return false;save.settled.push(result.runId);save.settled=save.settled.slice(-100);save.tech+=result.tech;save.best=Math.max(save.best,result.score);if(result.won&&result.mode==='campaign')save.wins++;save.runs.unshift(result);save.runs=save.runs.slice(0,10);return true;}
  const api={Game,Pool,SHIPS,UPGRADES,EVOLUTIONS,ENEMIES,defaultSave,validateSave,settle,sweptHit,clamp,W,H};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Nebula=api;
})(globalThis);
