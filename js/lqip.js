/* Progressive images: 24px blur preview -> 800px mid -> full size.
   Each stage is optional: a missing mid file is skipped, and on screens up to 900px wide the mid file is the final image. */
(function(){
  var imgs=document.querySelectorAll('img.lq[data-src]');if(!imgs.length)return;
  var small=Math.min(screen.width,window.innerWidth)*(window.devicePixelRatio||1)<=1200;
  function fetchImg(src,ok,fail){var i=new Image();i.decoding='async';i.onload=function(){ok(src)};i.onerror=fail;i.src=src;}
  function show(img,src,done){img.src=src;img.classList.add('is-loaded');if(done)img.removeAttribute('data-src');}
  function load(img){
    if(img.dataset.loading)return;img.dataset.loading='1';
    var full=img.dataset.src,mid=full.replace(/images\/([^/]+)\.jpg$/,'images/md/$1.jpg');
    fetchImg(mid,function(s){
      show(img,s,small);
      if(!small)fetchImg(full,function(f){show(img,f,true)},function(){});
    },function(){
      fetchImg(full,function(f){show(img,f,true)},function(){img.classList.add('is-loaded')});
    });
  }
  function frame(img){var p=img.parentElement;while(p&&p!==document.body){var cs=getComputedStyle(p);if(cs.overflow!=='visible'||cs.overflowX!=='visible')return p;p=p.parentElement;}return img;}
  /* Safety nets: a rect check on scroll, and an idle sweep after load so no image is left blurred. */
  function near(){imgs.forEach(function(i){if(i.dataset.loading)return;var r=frame(i).getBoundingClientRect();if(r.bottom>-700&&r.top<innerHeight+700)load(i);});}
  var t;window.addEventListener('scroll',function(){clearTimeout(t);t=setTimeout(near,120)},{passive:true});
  window.addEventListener('load',function(){near();setTimeout(function(){var idle=window.requestIdleCallback||function(f){setTimeout(f,1)};idle(function(){imgs.forEach(load)})},2500)});
  if(!('IntersectionObserver' in window)){imgs.forEach(load);return;}
  var map=new Map();
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;(map.get(e.target)||[]).forEach(load);io.unobserve(e.target);});},{rootMargin:'700px 0px'});
  imgs.forEach(function(i){var f=frame(i);if(!map.has(f))map.set(f,[]);map.get(f).push(i);io.observe(f);});
})();
