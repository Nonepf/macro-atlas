'use strict';
const el=id=>document.getElementById(id);
let en=false, timer=null, long=false, history=[], marker=null, changes=[], config, pending=false;
const t=(zh,eng)=>en?eng:zh;
const fields={
 G:['政府支出','Public spending',15,25,1,20],T:['净税收','Net taxes',15,25,1,20],
 r:['实际政策利率','Real policy rate',0,6,.25,2],x:['风险溢价','Risk premium',0,5,.25,2],
 c:['边际消费倾向','Propensity to consume',.45,.63,.01,.6],b:['投资利率敏感度','Investment sensitivity',.5,2,.1,1],
 m:['价格加成率','Price markup',2,8,.5,5],s:['国民储蓄率','Saving rate',0,100,.1,20],
 d:['折旧率','Depreciation',1,10,.5,5],a:['技术进步率','Productivity growth',0,5,.25,1],n:['劳动增长率','Labour growth',0,3,.25,1]};
let ranges={}, editing=false;
let fraction=0, segmentEnd=null, lastFrame=0;
const metrics=()=>long?['Y','I','k','worker']:['Y','I','u','pi'];
const percent=k=>'rxmsdan'.includes(k);
const names={Y:['实际产出','Output'],I:['投资','Investment'],u:['失业率','Unemployment'],pi:['通胀率','Inflation'],k:['资本存量','Capital stock'],worker:['人均劳动产出','Output per worker']};
let regime;
function medium(prev,p){
 const potential=regime.scale*(105-p.m),Y=(regime.consumption+regime.investment+p.G-p.c*p.T-p.b*(p.r+p.x))/(1-p.c-.1);
 return {Y,k:prev.k===undefined?3*Y:prev.k*(1-p.d/100)+prev.I,I:regime.investment+.1*Y-p.b*(p.r+p.x),u:100*(1-Y/(110*regime.scale)),pi:prev.pi+.05*(Y-potential)/regime.scale,potential};
}
function next(prev){
 if(!long)return medium(prev,config);
 const k=prev.k*(1-config.d/100)+prev.I,N=prev.N*(1+config.n/100),A=prev.A*(1+config.a/100);
 const potential=k**.33*(A*N)**.67,gap=prev.gap*.75,Y=potential*(1+gap);
 return {Y,k,N,A,potential,gap,I:Y*config.s/100,worker:Y/N};
}
function reset(){
 stop();fraction=0;segmentEnd=null;ranges={};editing=false;long=false;pending=false;marker=null;changes=[];config=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v[5]]));
 regime={scale:1,consumption:10,investment:16};
 history=[];for(const G of [17,17,18,19,20,20])history.push(medium(history.at(-1)||{pi:3.5},{...config,G}));
 el('speed').selectedIndex=0;setup();
}
function stop(){
 cancelAnimationFrame(timer);
 timer=null;
}
function advance(elapsed){
 fraction+=elapsed*parseFloat(el('speed').value)/1000;
 while(fraction>=1){
  history.push(segmentEnd??next(history.at(-1)));
  fraction-=1;
  segmentEnd=null;
 }
 if(fraction>0 && !segmentEnd){
  segmentEnd=next(history.at(-1));
  pending=false;
 }
}
function frame(timestamp){
 const elapsed=Math.max(0,timestamp-lastFrame);
 lastFrame=timestamp;
 advance(elapsed);
 render();
 timer=requestAnimationFrame(frame);
}
function start(){
 lastFrame=performance.now();
 timer=requestAnimationFrame(frame);
}
function enter(){
 if(long&&!el('initialPi').reportValidity())return;
 if(segmentEnd)history.push(segmentEnd);
 segmentEnd=null;
 fraction=0;
 if(pending){history.push(next(history.at(-1)));pending=false}
 const prev=history.at(-1),s=prev.I/prev.Y;

 stop();
 marker=history.length-1;
 if(long){
  const scale=prev.potential/(105-config.m);
  regime={
   scale,
   investment:prev.I-.1*prev.Y+config.b*(config.r+config.x),
   consumption:prev.Y-prev.I-config.G-config.c*(prev.Y-config.T)
  };
  prev.pi=Number(el('initialPi').value);
  prev.u=100*(1-prev.Y/(110*scale));
  prev.returned=true;
 }else{
  config.s=s*100;
  const N=prev.potential;
  Object.assign(prev,{N,gap:prev.Y/prev.potential-1,A:(prev.potential/prev.k**.33)**(1/.67)/N,worker:prev.Y/N});
  el('initialPi').value=prev.pi;
 }
 long=!long;
 el('defaults').open=false;
 setup();
}
function setup(){
 document.documentElement.lang=en?'en':'zh-CN';
 el('info').textContent=t('ⓘ 切换时的默认数据','ⓘ Transition assumptions');
 el('piLabel').hidden=!long;
 el('piText').textContent=t('返回中期的初始通胀率（%）','Starting inflation on return (%)');
 el('assumptions').textContent=t('切换按整期交接，保留实际产出、潜在产出、投资和资本。进入长期时，储蓄率取当期投资率。返回中期时，沿用上次的政府支出、净税收、利率和风险溢价，以当前消费和投资重新校准需求方程。长期没有通胀读数，返回时默认沿用上次中期末值，可在长期阶段修改。','Transitions settle at period boundaries and carry over output, potential output, investment and capital. Saving starts at the investment share. Returning restores fiscal settings, interest rate and risk premium and calibrates demand to current consumption and investment. Inflation starts at its last medium-run reading; you can edit it during the long run.');
 el('title').textContent=t('宏观经济图谱','An atlas of macroeconomics');el('panel').textContent=t('参数设定','Parameters');
 el('lang').textContent=en?'中文':'English';el('reset').textContent=t('重新开始','Restart');
 el('phase').textContent=long?t('长期增长  ·  Solow','Long-run growth  ·  Solow'):t('中期经济  ·  IS–LM–PC','Medium-run economy  ·  IS–LM–PC');
 const metrics=long?['Y','I','k','worker']:['Y','I','u','pi'],old=el('metric').value;
 el('metric').replaceChildren(...metrics.map(k=>new Option(names[k][+en],k)));el('metric').value=metrics.includes(old)?old:'Y';
 el('metric').ariaLabel=t('指标','Measure');el('speed').ariaLabel=t('播放速度','Playback speed');
 const groups=long?[[t('社会储蓄','Saving'),['s']],[t('增长参数','Growth parameters'),['d','a','n']]]:[[t('政府','Government'),['G','T']],[t('中央银行','Central bank'),['r']],[t('金融市场','Financial markets'),['x']],[t('结构参数','Economic structure'),['c','b','m']]];
 el('params').replaceChildren();
 groups.forEach(([name,keys],i)=>{const group=document.createElement('details');group.open=i===0;const head=document.createElement('summary');head.textContent=name;group.append(head);
 for(const key of keys){const f=fields[key],wrap=document.createElement('div'),label=document.createElement('label'),num=document.createElement('input'),input=document.createElement('input');
 wrap.className='param';label.append(f[+en]+' · '+key+(percent(key)?' (%)':''),num);wrap.append(label,input);
 num.type='number';input.type='range';for(const control of [input,num]){control.min=f[2];control.max=f[3];control.step=key==='c'?.001:.01;control.value=Number(config[key].toFixed(key==='c'?3:2));control.ariaLabel=f[+en]}
 function update(control,other){const v=control.valueAsNumber;if(!Number.isFinite(v)||!control.validity.valid)return;config[key]=v;other.value=v;pending=true;changes=changes.filter(e=>e.time!==history.length+(segmentEnd?1:0)||e.key!==key);changes.push({time:history.length+(segmentEnd?1:0),key,value:v});render()}
 input.onpointerdown=()=>{editing=true};input.oninput=()=>update(input,num);num.oninput=()=>{editing=true;update(num,input)};num.onblur=()=>{num.value=input.value;editing=false;render()};
 group.append(wrap)}el('params').append(group)});
 el('minis').replaceChildren(...Array.from({length:3},()=>{const btn=document.createElement('button');btn.append(document.createElement('span'),document.createElement('canvas'));btn.onclick=()=>{el('metric').value=btn.dataset.key;render()};return btn}));
 render();
}
function visibleState(){
 const prev=history.at(-1);
 if(!segmentEnd)return prev;
 const state={...prev};
 for(const key of Object.keys(segmentEnd))state[key]=prev[key]+fraction*(segmentEnd[key]-prev[key]);
 return state;
}
function render(){
 const prev=visibleState(),time=(history.length-1+fraction).toFixed(2),key=el('metric').value;
 el('figure').textContent=t('经济轨迹','Economic trajectory');el('legend').textContent=t('━━ 历史　┄┄ 条件预测','━━ History　┄┄ Conditional forecast');
 el('context').hidden=key!=='Y';el('potential').textContent=t('潜在产出 ','Potential output ')+prev.potential.toFixed(1)+t(' · 当前缺口 ',' · Current gap ')+((prev.Y/prev.potential-1)*100).toFixed(1)+'% ⓘ';
 el('explain').textContent=t('潜在产出是正常就业水平下可持续生产的产量。例如潜在产出为 100、实际产出为 95，缺口就是 −5%。','Potential output is sustainable production at normal employment. Output of 95 against potential of 100 means a −5% gap.');
 el('fit').textContent=t('适配视图','Fit view');
 el('play').textContent=timer?t('Ⅱ 暂停','Ⅱ Pause'):t('▶ 播放','▶ Play');el('clock').textContent=t('第 '+time+' 期','Period '+time)+'　·　'+names[key][+en]+' '+prev[key].toFixed(2)+(['pi','u'].includes(key)?'%':'');
 el('event').textContent=pending?t('参数已调整，将从下一期生效。','Parameter changes take effect next period.'):long?t('第 '+marker+' 期进入长期。','Entered the long run at period '+marker+'.'):marker!==null?t('第 '+marker+' 期返回中期。','Returned to the medium run at period '+marker+'.'):t('初始示例：第 2 至 4 期，政府支出由 17 逐步恢复至 20。','Opening scenario: public spending recovers from 17 to 20 over periods 2–4.');
 el('transition').textContent=long?t('从当前年份进入中期 →','Enter medium run from this year →'):t('进入长期 →','Enter long run →');
 const boundary=segmentEnd??history.at(-1);
 const base=pending?next(boundary):boundary;
 el('hint').textContent=long?t('每期一年，继承的产出缺口每年收窄四分之一。','Annual periods; the inherited gap shrinks by one quarter each year.'):
 (pending?t('切换时先结算一期 · ','Switch applies one pending period · '):'')+t('初始储蓄率 ','Initial saving rate ')+(100*base.I/base.Y).toFixed(2)+'%';
 draw(key,el('plot'),false);
 metrics().filter(k=>k!==key).forEach((k,i)=>{const btn=el('minis').children[i];btn.dataset.key=k;btn.firstChild.textContent=names[k][+en]+' · '+prev[k].toFixed(2)+(['u','pi'].includes(k)?'%':'');draw(k,btn.lastChild,true)});
}
function draw(key,canvas,small){
 const w=canvas.clientWidth,h=canvas.clientHeight,ratio=devicePixelRatio;
 if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio)}
 const c=canvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,w,h);
 const start=Math.max(0,history.length-24),data=history.slice(start),now=data.length-1;
 data.push(segmentEnd??next(data.at(-1)));
 for(let i=1;i<=12;i++)data.push(next(data.at(-1)));
 const values=data.map(v=>v[key]).filter(Number.isFinite),min=Math.min(...values),max=Math.max(...values);
 if(!ranges[key]||(!editing&&(min<ranges[key][0]||max>ranges[key][1]))){
 const pad=Math.max((max-min)*.12,Math.abs(max)*.02,.1),unit=10**Math.floor(Math.log10(Math.max(max-min,2*pad)/4));
 ranges[key]=[Math.min(ranges[key]?.[0]??Infinity,Math.floor((min-pad)/unit)*unit),Math.max(ranges[key]?.[1]??-Infinity,Math.ceil((max+pad)/unit)*unit)];
 }
 const [lo,hi]=ranges[key];
 const offset=start>0||now===23?fraction:0;
 const X=i=>48+(i-offset)*(w-62)/(now+fraction+12-offset),Y=v=>28+(hi-v)*(h-56)/(hi-lo);
 c.font='12px Georgia,serif';for(let i=0;i<5;i+=small?4:1){const v=lo+(hi-lo)*i/4,y=Y(v);c.fillStyle='#655c4c';c.fillText(v.toFixed(1),2,y+4);c.strokeStyle='#cfc5af';c.beginPath();c.moveTo(46,y);c.lineTo(w-10,y);c.stroke()}
 function line(field,a,b,color,dash){c.strokeStyle=color;c.lineWidth=2;c.setLineDash(dash);c.beginPath();let started=false;for(let i=a;i<=b;i++){if(!Number.isFinite(data[i][field])){started=false;continue}if(data[i].returned&&['pi','u'].includes(field))started=false;c[started?'lineTo':'moveTo'](X(i),Y(data[i][field]));started=true}c.stroke();c.setLineDash([])}
 c.save();c.beginPath();c.rect(46,28,w-48,h-56);c.clip();
 const cursor=X(now+fraction);
 c.save();c.beginPath();c.rect(46,0,cursor-46,h);c.clip();
 line(key,0,now+1,'#284b46',[]);c.restore();
 c.save();c.beginPath();c.rect(cursor,0,w-14-cursor,h);c.clip();
 line(key,now,data.length-1,'#284b46',[6,5]);c.restore();
 c.restore();c.fillStyle='#85412d';c.textAlign='right';
 if(max>hi)c.fillText('↑ '+max.toFixed(2),w-8,14);if(min<lo)c.fillText('↓ '+min.toFixed(2),w-8,h-10);c.textAlign='left';
 c.lineWidth=1;c.strokeStyle='#954b36';c.beginPath();c.moveTo(cursor,20);c.lineTo(cursor,h-23);c.stroke();c.fillStyle='#85412d';c.fillText(t('现在','Now'),cursor-8,14);
 const events=changes.filter(e=>e.time>=start&&e.time<=start+now);
 for(const e of events){const x=X(e.time-start);c.fillRect(x-1,h-26,2,5)}
 const latest=events.at(-1);if(latest&&!pending)el('event').textContent=t('政策记录 · 第 ','Policy record · Period ')+latest.time+'　'+latest.key+' = '+latest.value;
 for(let i=0;i<data.length;i++)if(X(i)>=46&&X(i)<=w-12&&(start+i)%(small?10:5)===0)c.fillText(start+i,X(i)-4,h-5);
 canvas.ariaLabel=names[key][+en]+' '+data[now][key].toFixed(2)+' · '+el('legend').textContent;
}
window.addEventListener('pointerup',()=>{if(editing&&document.activeElement?.type!=='number'){editing=false;render()}});
window.addEventListener('pointercancel',()=>{editing=false;render()});
el('fit').onclick=()=>{delete ranges[el('metric').value];render()};
el('lang').onclick=()=>{en=!en;setup()};el('transition').onclick=enter;el('reset').onclick=reset;
el('play').onclick=()=>{timer?stop():start();render()};document.addEventListener('visibilitychange',()=>{lastFrame=performance.now()});el('metric').onchange=render;window.onresize=render;reset();
