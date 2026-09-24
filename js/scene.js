/* GSI TEK living canvas. GSAP owns motion timing; no framework or build required. */
(() => {
  'use strict';
  const root = document.documentElement;
  const canvas = document.querySelector('#earth-scene');
  const hero = document.querySelector('.hero');
  const growth = document.querySelector('#growth-scene');
  const ctx = canvas.getContext('2d');
  const growthCtx = growth.getContext('2d');
  const points = window.GSI_GLOBE_POINTS;
  if (!ctx || !points) return; // The editorial content remains usable without canvas.
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const state = { time: 0, yaw: -2.1, pitch: .16, morph: 0, burst: 0, mouseX: -9999, mouseY: -9999, near: 0, tintR:47,tintG:125,tintB:63 };
  const palettes=[[47,125,63],[117,88,156],[32,123,137]];
  let rotationCY=1,rotationSY=0,rotationCP=1,rotationSP=0,lastProgress=0;
  const wavePhase=points.map((_,i)=>{const a=(i%180)/179*8+Math.floor(i/180)*.16;return [Math.sin(a),Math.cos(a),(i%180)/179,Math.floor(i/180)-16,9+((i*13)%29)];});
  const pointer = { x: 0, y: 0, down: false, moved: false, lastX: 0 };
  let width = 0, height = 0, gw = 0, gh = 0, small = false;
  let visible = true, growthVisible = false, paused = root.classList.contains('motion-off');
  let clockAttached = false, nativeFrame = 0, last = 0;
  let sceneTimeline = null, motionContext = null, focusTween = null;
  let cycleTime = 0;
  const buckets = Array.from({length:48}, () => []);
  const pulseTweens = new Set();
  const toggle = document.querySelector('.scene-toggle');
  const topicButtons = [...document.querySelectorAll('.esg-topic')];
  const topicNames = ['01 — ENVIRONMENT', '02 — SOCIAL', '03 — GOVERNANCE'];
  const topicCopy = ['讓每一步減碳，連結共同的未來。', '讓每一份行動，創造共享的價值。', '讓每一個決策，建立長遠的信任。'];
  let topic = 0, topicElapsed = 0, topicDuration = 8;
  // Geographic anchors are illustrative, not company offices or client locations.
  const cities = [
    ['TAIWAN',23.7,121],['TOKYO',35.7,139.7],['SINGAPORE',1.3,103.8],
    ['BERLIN',52.5,13.4],['NEW YORK',40.7,-74],['SYDNEY',-33.9,151.2],
    ['NAIROBI',-1.3,36.8],['SÃO PAULO',-23.6,-46.6]
  ].map(([name,lat,lon])=>{const a=lat*Math.PI/180,b=lon*Math.PI/180;return {name,p:[Math.cos(a)*Math.sin(b),Math.sin(a),Math.cos(a)*Math.cos(b)]};});
  const routes = [[0,1],[0,2],[0,3],[0,4],[0,5],[2,6],[3,4],[4,7],[5,7],[3,6]];
  const routePoints = routes.map(([a,b])=>Array.from({length:57},(_,i)=>{
    const t=i/56,A=cities[a].p,B=cities[b].p;
    const omega=Math.acos(clamp(A.reduce((sum,v,j)=>sum+v*B[j],0),-1,1));
    const s=Math.sin(omega)||1;
    const lift=1+Math.sin(t*Math.PI)*(.16+omega*.1);
    return A.map((v,j)=>(v*Math.sin((1-t)*omega)+B[j]*Math.sin(t*omega))/s*lift);
  }));
  const projectedRoutes=routePoints.map(route=>new Float32Array(route.length*3));
  function setTopic(index,manual=false){
    topic=index;topicElapsed=0;topicDuration=manual?16:8;
    topicButtons.forEach((button,i)=>{button.classList.toggle('is-active',i===topic);button.setAttribute('aria-pressed',String(i===topic));});
    document.querySelector('.globe-caption-index').textContent=topicNames[topic];
    document.querySelector('.globe-caption-text').textContent=topicCopy[topic];
    hero.dataset.topic=String(topic);
    if(paused){[state.tintR,state.tintG,state.tintB]=palettes[topic];}
    if(manual){
      // Bring the geographic connections back into view when exploring a topic.
      if(!paused && gsap && state.morph>.02){
        if(focusTween)focusTween.kill();
        focusTween=gsap.to(state,{morph:0,duration:1.3,ease:'sine.inOut',onComplete:()=>{
          focusTween=null;cycleTime=0;if(sceneTimeline)sceneTimeline.restart();syncClock();
        }});
        syncClock();
      }else if(!paused && !gsap){cycleTime=0;state.morph=0;}
      pulse();drawEarth();
    }
  }
  topicButtons.forEach((button,i)=>button.addEventListener('click',()=>setTopic(i,true)));

  root.classList.add('scene-ready');
  function fit() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height; small = width < 901;
    // Keep large displays from rasterizing millions of unnecessary extra pixels.
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75, Math.sqrt(2600000/Math.max(1,width*height)));
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = growth.getBoundingClientRect();
    gw = g.width; gh = g.height;
    if (growthCtx) { growth.width = Math.round(gw*dpr); growth.height = Math.round(gh*dpr); growthCtx.setTransform(dpr,0,0,dpr,0,0); }
    drawEarth(); drawGrowth();
  }
  function project(x,y,z, yaw, pitch) {
    const xx = x*rotationCY+z*rotationSY, zz = -x*rotationSY+z*rotationCY;
    return [xx, y*rotationCP-zz*rotationSP, y*rotationSP+zz*rotationCP];
  }
  function strokeOrbit(cx,cy,r, angle, phase, purple, opacity) {
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(angle);
    ctx.strokeStyle = purple ? `rgba(121,96,161,${opacity})` : `rgba(47,125,63,${opacity})`;
    ctx.lineWidth = .85; ctx.beginPath(); ctx.ellipse(0,0,r*1.24,r*.32,0,0,Math.PI*2); ctx.stroke();
    const x = Math.cos(phase)*r*1.24, y = Math.sin(phase)*r*.32;
    ctx.fillStyle = purple ? '#7960a1' : '#2f7d3f'; ctx.globalAlpha = Math.min(1,opacity*4);
    ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.globalAlpha *= .12;ctx.fill();ctx.restore();
  }
  function drawConnections(cx,cy,r,yaw,pitch,m){
    const opacity=1-m*.93;
    ctx.save();
    const color=`${Math.round(state.tintR)},${Math.round(state.tintG)},${Math.round(state.tintB)}`;
    // Light travels along elevated great-circle routes, with back-facing segments hidden.
    routePoints.forEach((route,index)=>{
      const selected=topic===0?index<6:topic===1?index%2===0:index>=2;
      ctx.beginPath();let started=false;
      const projected=projectedRoutes[index];
      for(let j=0;j<route.length;j++){
        const p=route[j],xx=p[0]*rotationCY+p[2]*rotationSY,zz=-p[0]*rotationSY+p[2]*rotationCY,k=j*3;
        projected[k]=xx;projected[k+1]=p[1]*rotationCP-zz*rotationSP;projected[k+2]=p[1]*rotationSP+zz*rotationCP;
        if(projected[k+2]<.03){started=false;continue;}const x=cx+xx*r,y=cy-projected[k+1]*r;if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);
      }
      ctx.strokeStyle=`rgba(${color},${(selected?.44:.12)*opacity})`;ctx.lineWidth=selected?1.15:.65;ctx.stroke();
      if(!selected)return;
      const t=(state.time*.115+index*.173)%1;
      for(let tail=0;tail<7;tail++){
        const position=((t-tail*.007+1)%1)*56,segment=Math.floor(position),f=position-segment,k=segment*3;
        const z=projected[k+2]+(projected[k+5]-projected[k+2])*f;if(z<.03)continue;
        const x=projected[k]+(projected[k+3]-projected[k])*f,y=projected[k+1]+(projected[k+4]-projected[k+1])*f;
        ctx.fillStyle=tail===0?`rgba(193,143,59,${opacity})`:`rgba(${color},${(1-tail/8)*opacity})`;ctx.beginPath();ctx.arc(cx+x*r,cy-y*r,tail===0?2.7:1.2,0,Math.PI*2);ctx.fill();
      }
    });
    cities.forEach((city,i)=>{
      const q=project(...city.p,yaw,pitch);if(q[2]<.12)return;
      const x=cx+q[0]*r,y=cy-q[1]*r;
      const phase=(state.time*.38+i*.21)%1;
      ctx.strokeStyle=`rgba(${color},${(1-phase)*.5*opacity})`;ctx.lineWidth=.8;ctx.beginPath();ctx.arc(x,y,4+phase*13,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle=i===0?'#7960a1':`rgba(${color},.95)`;ctx.globalAlpha=opacity;ctx.beginPath();ctx.arc(x,y,i===0?4:2.5,0,Math.PI*2);ctx.fill();
      if((i===0||i===3||i===5)&&q[2]>.3){
        ctx.font=`${small?7:9}px Arial`;ctx.letterSpacing='1px';ctx.fillStyle='#4f684a';ctx.globalAlpha=opacity*.85;ctx.fillText(city.name,x+10,y-9);
      }
      ctx.globalAlpha=1;
    });
    ctx.restore();
  }
  function drawEarth() {
    if (!width || !height) return;
    ctx.clearRect(0,0,width,height);
    const m = state.morph;
    const r = Math.min(width*(small?.31:.235),height*(small?.34:.37));
    const cx = width*(small?.54:.755), cy = height*(small?.43:.5);
    const yaw = state.yaw + pointer.x*.13, pitch = state.pitch + pointer.y*.06;
    rotationCY=Math.cos(yaw);rotationSY=Math.sin(yaw);rotationCP=Math.cos(pitch);rotationSP=Math.sin(pitch);
    const glow = ctx.createRadialGradient(cx,cy,r*.14,cx,cy,r*1.42);
    const haze=`${Math.round(195+state.tintR*.2)},${Math.round(195+state.tintG*.2)},${Math.round(195+state.tintB*.2)}`;
    glow.addColorStop(0,`rgba(${haze},.3)`);glow.addColorStop(.64,`rgba(${haze},.14)`);glow.addColorStop(1,`rgba(${haze},0)`);
    ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    const surface=ctx.createRadialGradient(cx-r*.28,cy-r*.3,r*.1,cx,cy,r);
    surface.addColorStop(0,'rgba(255,253,247,.5)');surface.addColorStop(.82,`rgba(${haze},.13)`);surface.addColorStop(1,`rgba(${state.tintR|0},${state.tintG|0},${state.tintB|0},.1)`);
    ctx.globalAlpha=1-m;ctx.fillStyle=surface;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(104,143,83,.2)';ctx.lineWidth=.7;ctx.stroke();ctx.globalAlpha=1;

    // A quiet field of currents ties the globe to the whole page surface.
    for(let row=0;row<13;row++){
      ctx.beginPath();
      for(let x=0;x<=width+8;x+=10){const y=height*.83+row*7+Math.sin(x/width*7+state.time*.28+row*.19)*19+Math.cos(x/width*4-row*.1)*13;
        if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
      ctx.strokeStyle=`rgba(47,125,63,${.026+row*.002})`;ctx.lineWidth=.7;ctx.stroke();
    }
    ctx.globalAlpha=1-m*.8;
    strokeOrbit(cx,cy,r,-.38,state.time*.2,true,.19);
    strokeOrbit(cx,cy,r,1.04,-state.time*.14+2,false,.1);

    // Latitude lines make the rotating land points read as a connected globe.
    ctx.lineWidth=.6;ctx.strokeStyle='rgba(47,125,63,.12)';
    for(let latitude=-60;latitude<=60;latitude+=30){
      const a=latitude*Math.PI/180;ctx.beginPath();let started=false;
      for(let l=0;l<=128;l++){const t=l/128*Math.PI*2,p=project(Math.cos(a)*Math.sin(t),Math.sin(a),Math.cos(a)*Math.cos(t),yaw,pitch);
        if(p[2]<-.04){started=false;continue;}const xx=cx+p[0]*r,yy=cy-p[1]*r;if(!started){ctx.moveTo(xx,yy);started=true;}else ctx.lineTo(xx,yy);}
      ctx.stroke();
    }
    for(let longitude=0;longitude<180;longitude+=30){
      ctx.beginPath();let started=false;
      for(let j=0;j<=100;j++){const a=j/100*Math.PI*2,b=longitude*Math.PI/180,q=project(Math.cos(a)*Math.sin(b),Math.sin(a),Math.cos(a)*Math.cos(b),yaw,pitch);if(q[2]<0){started=false;continue;}const x=cx+q[0]*r,y=cy-q[1]*r;if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);}ctx.stroke();
    }
    ctx.globalAlpha=1;
    buckets.forEach(b=>b.length=0);
    const waveSin=Math.sin(state.time*.5),waveCos=Math.cos(state.time*.5);
    const ink=`rgb(${Math.round(state.tintR)},${Math.round(state.tintG)},${Math.round(state.tintB)})`;
    for(let i=0;i<points.length;i+=(small?2:1)){
      const p=points[i],wave=wavePhase[i],qx=p[0]*rotationCY+p[2]*rotationSY,zz=-p[0]*rotationSY+p[2]*rotationCY;
      const qy=p[1]*rotationCP-zz*rotationSP,qz=p[1]*rotationSP+zz*rotationCP;
      const depth=(qz+1)*.5;
      let x=cx+qx*r,y=cy-qy*r;
      const waveX=small?wave[2]*width:width*.42+wave[2]*width*.62;
      const waveY=height*.44+(wave[0]*waveCos+wave[1]*waveSin)*height*.16+wave[3]*2;
      x=x*(1-m)+waveX*m;y=y*(1-m)+waveY*m;
      if(state.near>.001){const dx=x-state.mouseX,dy=y-state.mouseY,d2=dx*dx+dy*dy;if(d2<10000){const d=Math.sqrt(d2)||1,force=(1-d/100)*state.near*18;x+=dx/d*force;y+=dy/d*force;}}
      const pulse=state.burst*wave[4];x+=qx*pulse;y-=qy*pulse;
      const textClearance=small?1:clamp((x/width-.39)/.17,.08,1);
      const alpha=(p[3] ? .09+depth*depth*.78 : .04+depth*.12)*textClearance;
      const size=(p[3] ? .75+depth*.8 : .55+depth*.2)*Math.max(.75,r/265);
      const bucket=Math.min(15,Math.floor(alpha*16))+(i%17===0?32:i%7===0?16:0);
      buckets[bucket].push(x,y,size);
    }
    buckets.forEach((bucket,index)=>{
      if(!bucket.length)return;
      ctx.fillStyle=index>=32?'#b89145':index>=16?'#8c6ab1':ink;ctx.globalAlpha=((index%16)+1)/16;ctx.beginPath();
      for(let j=0;j<bucket.length;j+=3){ctx.moveTo(bucket[j]+bucket[j+2],bucket[j+1]);ctx.arc(bucket[j],bucket[j+1],bucket[j+2],0,Math.PI*2);}ctx.fill();
    });
    ctx.globalAlpha=1;
    drawConnections(cx,cy,r,yaw,pitch,m);
  }
  function drawGrowth(){
    if(!growthCtx||!gw||!gh)return;
    growthCtx.clearRect(0,0,gw,gh);
    for(let row=0;row<25;row++){
      growthCtx.beginPath();
      for(let x=0;x<=gw+8;x+=12){const y=gh*.75+Math.sin(x/gw*7+state.time*.3+row*.105)*gh*.12+row*5;
        if(x===0)growthCtx.moveTo(x,y);else growthCtx.lineTo(x,y);}
      growthCtx.strokeStyle=row%7===0?'rgba(121,96,161,.12)':'rgba(47,125,63,.095)';growthCtx.lineWidth=.8;growthCtx.stroke();
    }
  }
  function tick(){
    const now=performance.now();
    const dt=Math.min((now-last)/1000,.06);last=now;
    state.time+=dt;state.yaw+=dt*.043;
    const ease=1-Math.exp(-dt*4);
    state.tintR+=(palettes[topic][0]-state.tintR)*ease;state.tintG+=(palettes[topic][1]-state.tintG)*ease;state.tintB+=(palettes[topic][2]-state.tintB)*ease;
    if(visible&&!pointer.down){topicElapsed+=dt;if(topicElapsed>=topicDuration)setTopic((topic+1)%3);if(now-lastProgress>90){hero.style.setProperty('--topic-progress',String(clamp(topicElapsed/topicDuration,0,1)));lastProgress=now;}}
    // The same automatic cycle is available even if the bundled library fails.
    if(!gsap && visible && !pointer.down){
      cycleTime=(cycleTime+dt)%24;
      const smooth=t=>(1-Math.cos(Math.PI*t))*.5;
      state.morph=cycleTime<12?0:cycleTime<15.5?smooth((cycleTime-12)/3.5):cycleTime<20.5?1:1-smooth((cycleTime-20.5)/3.5);
    }
    const follow=1-Math.exp(-dt*4);
    pointer.x+=((pointer.targetX||0)-pointer.x)*follow;
    pointer.y+=((pointer.targetY||0)-pointer.y)*follow;
    state.near+=((pointer.inside?1:0)-state.near)*(1-Math.exp(-dt*5.5));
    if(visible)drawEarth();if(growthVisible)drawGrowth();
  }
  function nativeTick(){tick();nativeFrame=requestAnimationFrame(nativeTick);}
  function syncClock(){
    const run=!paused&&!document.hidden&&(visible||growthVisible);
    if(sceneTimeline)sceneTimeline.paused(!run||!visible||pointer.down||Boolean(focusTween));
    if(focusTween)focusTween.paused(!run||!visible||pointer.down);
    if(run&&!clockAttached){clockAttached=true;last=performance.now();if(gsap)gsap.ticker.add(tick);else nativeFrame=requestAnimationFrame(nativeTick);}
    else if(!run&&clockAttached){clockAttached=false;if(gsap)gsap.ticker.remove(tick);else cancelAnimationFrame(nativeFrame);}
  }
  function pulse(){
    if(paused)return;
    if(gsap){pulseTweens.forEach(t=>t.kill());pulseTweens.clear();const tween=gsap.fromTo(state,{burst:.6},{burst:0,duration:1.5,ease:'power3.out',onComplete:()=>pulseTweens.delete(tween)});pulseTweens.add(tween);}
  }
  canvas.addEventListener('pointerdown',event=>{
    if(paused)return;
    pointer.down=true;pointer.moved=false;pointer.lastX=event.clientX;
    canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');
    syncClock();
  });
  canvas.addEventListener('pointermove',event=>{
    if(paused)return;
    const rect=canvas.getBoundingClientRect();
    state.mouseX=event.clientX-rect.left;state.mouseY=event.clientY-rect.top;
    pointer.inside=true;pointer.targetX=(state.mouseX/width-.5)*2;pointer.targetY=(state.mouseY/height-.5)*2;
    if(pointer.down){const dx=event.clientX-pointer.lastX;state.yaw+=dx*.006;pointer.lastX=event.clientX;if(Math.abs(dx)>1)pointer.moved=true;}
  },{passive:true});
  function release(event){if(pointer.down&&!pointer.moved&&event.type==='pointerup')pulse();pointer.down=false;canvas.classList.remove('dragging');if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);syncClock();}
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  canvas.addEventListener('pointerleave',()=>{pointer.inside=false;pointer.targetX=0;pointer.targetY=0;});
  canvas.addEventListener('keydown',event=>{
    if(event.code==='Space'){event.preventDefault();document.querySelector('.motion-toggle').click();return;}
    if(paused)return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();state.yaw+=(event.key==='ArrowLeft'?-.18:.18);drawEarth();}
    if(event.key==='Enter'){event.preventDefault();pulse();}
  });
  toggle.addEventListener('click',()=>document.querySelector('.motion-toggle').click());
  // Hold each form long enough to see it; morph on time, independent of scroll.
  if(gsap){
    sceneTimeline=gsap.timeline({repeat:-1,paused:true})
      .to(state,{morph:0,duration:12,ease:'none'})
      .to(state,{morph:1,duration:3.5,ease:'sine.inOut'})
      .to(state,{morph:1,duration:5,ease:'none'})
      .to(state,{morph:0,duration:3.5,ease:'sine.inOut'});
  }
  function setupScroll(){
    if(motionContext){motionContext.revert();motionContext=null;}
    if(paused||!gsap||!ScrollTrigger)return;
    gsap.registerPlugin(ScrollTrigger);
    motionContext=gsap.context(()=>{
      document.querySelectorAll('.about h2,.services-heading h2,.approach-title h2,.news-heading h2,.contact h2').forEach(heading=>{
        gsap.fromTo(heading,{backgroundSize:'0% 100%'},{backgroundSize:'100% 100%',ease:'none',scrollTrigger:{trigger:heading,start:'top 88%',end:'top 40%',scrub:.65}});
      });
      gsap.to('.scene-word',{xPercent:-8,ease:'none',scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:1}});
    });
  }
  function updateMotion(){
    paused=root.classList.contains('motion-off');
    toggle.setAttribute('aria-pressed',String(paused));toggle.innerHTML=paused?'播放場景 <span aria-hidden="true">▷</span>':'暫停場景 <span aria-hidden="true">Ⅱ</span>';
    toggle.disabled=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(paused){pulseTweens.forEach(t=>t.kill());pulseTweens.clear();state.burst=0;state.near=0;pointer.inside=false;pointer.down=false;canvas.classList.remove('dragging');}
    setupScroll();syncClock();drawEarth();drawGrowth();
  }
  document.addEventListener('gsi:motionchange',updateMotion);
  let layoutFrame=0;
  document.addEventListener('gsi:layoutchange',()=>{
    if(layoutFrame)return;
    layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;if(ScrollTrigger&&!paused)ScrollTrigger.refresh();fit();});
  });
  document.addEventListener('visibilitychange',syncClock);
  window.addEventListener('blur',()=>{pointer.down=false;pointer.inside=false;canvas.classList.remove('dragging');syncClock();});
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{if(entry.target===hero)visible=entry.isIntersecting;else growthVisible=entry.isIntersecting;});syncClock();
  },{rootMargin:'60px'});observer.observe(hero);observer.observe(growth.parentElement);}
  if('ResizeObserver' in window)new ResizeObserver(fit).observe(hero);
  window.addEventListener('resize',fit,{passive:true});
  fit();updateMotion();
})();
