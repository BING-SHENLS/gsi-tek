/* Swap blurred previews for full images as they scroll near. */
(function(){
  var imgs=document.querySelectorAll('img.lq[data-src]');if(!imgs.length)return;
  function load(img){
    if(img.dataset.loading)return;img.dataset.loading='1';
    var full=new Image();full.decoding='async';
    full.onload=function(){img.src=full.src;img.classList.add('is-loaded');img.removeAttribute('data-src');};
    full.onerror=function(){img.classList.add('is-loaded');};
    full.src=img.dataset.src;
  }
  if(!('IntersectionObserver' in window)){imgs.forEach(load);return;}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){load(e.target);io.unobserve(e.target);}});},{rootMargin:'600px 0px'});
  imgs.forEach(function(i){io.observe(i);});
})();
