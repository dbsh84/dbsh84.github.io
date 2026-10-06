(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let prefersReducedMotion = reduced.matches;
  let manuallyPaused = false;
  try { manuallyPaused = sessionStorage.getItem('portfolio-motion') === 'paused'; } catch {}
  const motionButtons = [...document.querySelectorAll('[data-motion-control]')];
  const paused = () => manuallyPaused || prefersReducedMotion;
  let syncKnowledgeMotion = () => {};
  let syncArtMotion = () => {};
  function updateMotion() {
    document.documentElement.classList.toggle('motion-paused', paused());
    motionButtons.forEach(motionButton => {
      motionButton.setAttribute('aria-label', paused() ? '배경 애니메이션 재생' : '배경 애니메이션 정지');
      motionButton.setAttribute('aria-pressed', String(paused()));
      motionButton.disabled = prefersReducedMotion;
      motionButton.title = prefersReducedMotion ? '기기의 움직임 감소 설정을 적용했습니다.' : paused() ? '클릭하여 애니메이션 재생' : '클릭하여 애니메이션 정지';
    });
    const status = document.querySelector('#motion-status');
    if (status) status.textContent = paused() ? '애니메이션이 정지되어 있습니다.' : '애니메이션이 재생 중입니다.';
    syncKnowledgeMotion();
    syncArtMotion();
  }
  motionButtons.forEach(button => button.addEventListener('click', () => {
    manuallyPaused = !manuallyPaused;
    try { sessionStorage.setItem('portfolio-motion', manuallyPaused ? 'paused' : 'playing'); } catch {}
    updateMotion();
  }));
  reduced.addEventListener('change', event => {
    prefersReducedMotion = event.matches;
    updateMotion();
  });
  updateMotion();
  const reflectVisibility = () => {
    document.documentElement.classList.toggle('page-hidden', document.hidden);
    syncKnowledgeMotion();
    syncArtMotion();
  };
  document.addEventListener('visibilitychange', reflectVisibility);
  reflectVisibility();

  const filters = document.querySelector('.filters');
  const cards = [...document.querySelectorAll('.project')];
  let activeFilter = 'all';
  function renderProjects() {
    let count = 0;
    cards.forEach(c => {
      const matches = activeFilter === 'all' || c.dataset.category === activeFilter;
      c.hidden = !matches;
      if (matches) count++;
    });
    document.querySelector('#filter-result').textContent = `${count}개 프로젝트`;
  }
  if (filters) {
    filters.hidden = false;
    filters.addEventListener('click', event => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      activeFilter = button.dataset.filter;
      filters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      renderProjects();
    });
    renderProjects();
  }
  function revealAnchor() {
    const target = document.getElementById(location.hash.slice(1));
    if (target?.classList.contains('project') && target.hidden) {
      filters?.querySelector('[data-filter="all"]').click();
      target.scrollIntoView();
    }
  }
  addEventListener('hashchange', revealAnchor); revealAnchor();
  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.remove('is-waiting'); observer.unobserve(entry.target); }
    }), { threshold: .05, rootMargin: '0px 0px 70px 0px' });
    document.querySelectorAll('.reveal, .section-heading, .about-copy, .story-section').forEach(el => { el.classList.add('reveal','is-waiting'); observer.observe(el); });
  }
  // Keep motion local to visible sections and let all controls pause it together.
  const lightSections = new Set();
  const stages = [...document.querySelectorAll('.section, .detail-main')];
  const artwork = [...document.querySelectorAll('.project-visual')];
  const artRuns = new WeakMap();
  function stopArt(art) {
    artRuns.set(art, (artRuns.get(art) || 0) + 1);
    art.classList.remove('is-playing');
  }
  function playArt(art) {
    if (paused() || document.hidden || !art.classList.contains('is-in-view')) return;
    stopArt(art);
    // Flush the previous CSS run before restarting, including its pseudo-elements.
    art.getAnimations({subtree:true});
    const run = artRuns.get(art);
    art.classList.add('is-playing');
    const animations = art.getAnimations({subtree:true}).filter(a => a instanceof CSSAnimation);
    Promise.allSettled(animations.map(a => a.finished)).then(() => {
      if (artRuns.get(art) === run) art.classList.remove('is-playing');
    });
  }
  artwork.forEach(art => {
    const replay = art.querySelector('[data-art-replay]');
    if (!replay) return;
    replay.hidden = false;
    replay.addEventListener('click', () => playArt(art));
  });
  syncArtMotion = () => {
    artwork.forEach(art => {
      const replay = art.querySelector('[data-art-replay]');
      if (replay) replay.disabled = paused();
      if (!art.classList.contains('is-playing')) playArt(art);
    });
  };
  syncArtMotion();
  if ('IntersectionObserver' in window) {
    const stageObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      entry.target.classList.toggle('is-in-view', entry.isIntersecting);
      if (entry.target.matches('.section, .detail-main')) {
        if (entry.isIntersecting) lightSections.add(entry.target); else lightSections.delete(entry.target);
      }
    }), { rootMargin: '80px 0px' });
    stages.forEach(el => stageObserver.observe(el));
    // One slow run per viewport entry. Small scrolls inside the card don't restart it.
    const artObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      const art = entry.target, visible = entry.isIntersecting && entry.intersectionRatio >= .12;
      if (visible === art.classList.contains('is-in-view')) return;
      art.classList.toggle('is-in-view', visible);
      if (visible) playArt(art); else stopArt(art);
    }), {threshold:[0,.12]});
    artwork.forEach(el => artObserver.observe(el));
  } else {
    stages.forEach(el => { el.classList.add('is-in-view'); lightSections.add(el); });
    artwork.forEach(el => { el.classList.add('is-in-view'); playArt(el); });
  }
  let hoverPending = false, hoverTarget, hoverX, hoverY;
  cards.forEach(card => card.addEventListener('pointermove', event => {
    if (paused() || event.pointerType !== 'mouse') return;
    hoverTarget = card; hoverX = event.clientX; hoverY = event.clientY;
    if (hoverPending) return;
    hoverPending = true;
    requestAnimationFrame(() => {
      const bounds = hoverTarget.getBoundingClientRect();
      hoverTarget.style.setProperty('--card-x', `${hoverX - bounds.left}px`);
      hoverTarget.style.setProperty('--card-y', `${hoverY - bounds.top}px`);
      hoverPending = false;
    });
  }, {passive:true}));
  const progress = document.querySelector('.reading-progress');
  let scrollPending = false;
  function showProgress() {
    const height = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = `${height > 0 ? Math.min(100,scrollY / height * 100) : 0}%`;
    if (!paused()) lightSections.forEach(section => {
      const bounds = section.getBoundingClientRect();
      const shift = Math.max(-85, Math.min(85, (innerHeight / 2 - bounds.top) * .10));
      section.style.setProperty('--light-shift', `${shift.toFixed(1)}px`);
    });
    scrollPending = false;
  }
  addEventListener('scroll', () => { if (!scrollPending) { scrollPending = true; requestAnimationFrame(showProgress); } }, {passive:true});
  const toc = [...document.querySelectorAll('.toc a')];
  if (toc.length && 'IntersectionObserver' in window) {
    const tracker = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) toc.forEach(a => a.hash === '#' + entry.target.id ? a.setAttribute('aria-current','location') : a.removeAttribute('aria-current'));
    }),{rootMargin:'-5% 0px -65% 0px'});
    document.querySelectorAll('.story-section[id]').forEach(el=>tracker.observe(el));
  }

  // The binary helix and title lighting share pause and visibility controls.
  const hero = document.querySelector('.hero');
  if (!hero) return;
  // Project a panoramic 3D helix onto one capped-resolution 2D canvas.
  // No textures, blur, filters, layout animation, or per-character DOM elements.
  function createKnowledgeField(canvas) {
    const ctx = canvas?.getContext('2d', {alpha:true});
    if (!ctx) return {setActive() {}};
    let width = 0, height = 0, ratio = 1, clock = .7;
    let active = false, frame = 0, lastDraw = 0, firstFrame = true;
    let count = 96, nodes = [], inputNodes = [], edges = [], stream = [], inlet;
    let small = false, axisStart, axisEnd, radius = 0, viewSin = 0, viewCos = 1;
    const tau = Math.PI * 2;
    const rotationSpeed = .64 * .8;
    const streamSpan = .10, entrySpan = .13;
    const sprites = ['0','1'].map(digit => {
      const tile = document.createElement('canvas');
      tile.width = 32; tile.height = 40;
      const brush = tile.getContext('2d');
      brush.font = '24px ui-monospace, SFMono-Regular, Consolas, monospace';
      brush.textAlign = 'center'; brush.textBaseline = 'middle';
      brush.fillStyle = '#e1c9fa'; brush.fillText(digit,16,21);
      return tile;
    });
    const smooth = (a,b,x) => {const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
    function helix(t, strand, time, radial = 1) {
      // The radius closes smoothly to one fixed endpoint: no detached strands.
      const r = radius * (1 - smooth(.70,1,t));
      const angle = t * Math.PI * (small ? 2.3 : 4.2) - time * rotationSpeed + strand * Math.PI;
      // Project the entire base pair through one camera. A slight axial view
      // keeps the end-on rod visible as its near and far endpoints exchange.
      const side = Math.sin(angle) * r * radial;
      const z = side * viewCos;
      const cross = Math.cos(angle) * r * radial;
      const along = side * viewSin;
      const dx = axisEnd.x-axisStart.x, dy = axisEnd.y-axisStart.y;
      const length = Math.hypot(dx,dy);
      return {
        x:axisStart.x+dx*t+(dx*along+dy*cross)/length,
        y:axisStart.y+dy*t+(dy*along-dx*cross)/length,
        z, depth:(Math.sin(angle)*radial+1)*.5, scale:1,
        t, strand
      };
    }
    function routePoint(route,t) {
      const q=1-t;
      return {x:q*q*q*route[0].x+3*q*q*t*route[1].x+3*q*t*t*route[2].x+t*t*t*route[3].x,y:q*q*q*route[0].y+3*q*q*t*route[1].y+3*q*t*t*route[2].y+t*t*t*route[3].y};
    }
    // One continuous route per digit: rotating helix -> curve -> input neuron.
    // Axial travel is independent of rotation, so digits move along both rails.
    function dataPoint(progress,strand,index,time) {
      if(progress<1){
        const p=helix(progress,strand,time),merge=smooth(.80,1,progress);
        return {...p,alpha:(.28+p.depth*.46)*(1-merge)+.6*merge};
      }
      if(progress<1+streamSpan){
        return {...routePoint(stream,(progress-1)/streamSpan),z:0,scale:1,alpha:.6};
      }
      const t=(progress-1-streamSpan)/entrySpan;
      const node=inputNodes[(index+strand)%inputNodes.length];
      return {x:inlet.x+(node.x-inlet.x)*t,y:inlet.y+(node.y-inlet.y)*t,z:0,scale:1,alpha:.6*(1-smooth(.72,1,t))};
    }
    function basePair(index,time) {
      const routeSpan=1+streamSpan+entrySpan,pairs=small?22:44;
      const progress=(index*routeSpan/pairs+time*(small?.12:.066))%routeSpan;
      const a=dataPoint(progress,0,index,time);
      a.digit=index%2;
      // After convergence, emit one packet per pair rather than two
      // overlapping digits travelling down the same curve.
      if(progress>=1)return {progress,digits:[a],rod:[]};
      const b=dataPoint(progress,1,index,time);
      b.digit=1-a.digit;
      const merge=smooth(.90,1,progress);
      b.alpha*=1-merge;
      const rod=[a,helix(progress,0,time,.5),helix(progress,0,time,0),helix(progress,0,time,-.5),b];
      return {progress,digits:[a,b],rod};
    }
    function buildNetwork() {
      nodes=[];edges=[];
      small=width<700;
      const viewAngle=(small?6:8)*Math.PI/180;
      viewSin=Math.sin(viewAngle);viewCos=Math.cos(viewAngle);
      // Tilt the wide helix gently down-right, then bend upward into the network.
      // The curve leaves the merged rails at the same angle, without a corner.
      axisEnd={x:width*(small?.42:.51),y:height*(small?.62:.66)};
      axisStart={x:width*(small?-.28:-.23),y:0};
      axisStart.y=axisEnd.y-(axisEnd.x-axisStart.x)*.18;
      const pitch=Math.hypot(axisEnd.x-axisStart.x,axisEnd.y-axisStart.y)/(small?1.15:2.1);
      radius=Math.min(height*.24,pitch*.29);
      inlet={x:width*(small?.47:.58),y:height*.50};
      const gap=inlet.x-axisEnd.x;
      stream=[axisEnd,
        {x:axisEnd.x+gap*.65,y:axisEnd.y+gap*.65*.18},
        {x:inlet.x-gap*.5,y:inlet.y},inlet];
      const tiers=[4,5,5,2], xs=small?[.54,.685,.83,.975]:[.625,.74,.855,.97];
      const networkWidth=(xs[3]-xs[0])*width;
      const center=height*.50, spread=Math.min(height*(small?.36:.48),networkWidth*(small?.78:.72));
      tiers.forEach((size,col)=>{
        const extent=spread*(size-1)/4;
        for(let row=0;row<size;row++)nodes.push({x:width*xs[col],y:center+(row/(size-1)-.5)*extent,col,row});
      });
      nodes.forEach((node,i)=>nodes.forEach((other,j)=>{
        if(other.col===node.col+1)edges.push({a:node,b:other,stage:node.col,index:i+j});
      }));
      inputNodes=nodes.filter(node=>node.col===0);
      inputNodes.forEach(node=>edges.push({a:inlet,b:node,stage:-1,index:node.row}));
    }
    function signal(a,b,t,alpha) {
      if(t<0||t>1)return;
      const tail=Math.max(0,t-.20);
      ctx.strokeStyle=`rgba(216,192,251,${alpha*.65})`;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(a.x+(b.x-a.x)*tail,a.y+(b.y-a.y)*tail);
      const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
      ctx.lineTo(x,y);ctx.stroke();
      ctx.fillStyle=`rgba(238,217,255,${alpha})`;
      ctx.beginPath();ctx.arc(x,y,small?1.25:1.7,0,tau);ctx.fill();
    }
    function render() {
      ctx.clearRect(0,0,width,height);
      ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=.85;
      // Four explicit layers: input, two hidden layers, and output.
      // A packet fans out, then activates each layer from left to right.
      const cycle=(clock*.19)%1;
      ctx.strokeStyle='rgba(173,145,211,.46)';ctx.beginPath();
      edges.forEach(({a,b})=>{ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)});
      ctx.stroke();
      edges.forEach(({a,b,stage,index})=>signal(a,b,(cycle-(.26+(stage+1)*.14))/.15,.45+(index%3)*.14));
      nodes.forEach(node=>{
        const pulse=Math.max(0,1-Math.abs(cycle-(.40+node.col*.14))/.105);
        const r=small?2.7:4.5;
        ctx.fillStyle='#12101d';ctx.strokeStyle=`rgba(208,181,242,${.7+pulse*.25})`;ctx.lineWidth=.9;
        ctx.beginPath();ctx.arc(node.x,node.y,r,0,tau);ctx.fill();ctx.stroke();
        ctx.fillStyle=`rgba(224,199,251,${.5+pulse*.5})`;
        ctx.beginPath();ctx.arc(node.x,node.y,r*.45,0,tau);ctx.fill();
        if(pulse>.02){ctx.strokeStyle=`rgba(205,166,246,${pulse*.3})`;ctx.beginPath();ctx.arc(node.x,node.y,r+5*(1-pulse),0,tau);ctx.stroke()}
      });
      // Both helix rails meet this one stream, which feeds the input layer.
      ctx.strokeStyle='rgba(201,175,237,.45)';ctx.lineWidth=.85;ctx.beginPath();
      ctx.moveTo(stream[0].x,stream[0].y);
      ctx.bezierCurveTo(stream[1].x,stream[1].y,stream[2].x,stream[2].y,stream[3].x,stream[3].y);ctx.stroke();
      const strands=[[],[]];
      const layers=Array.from({length:8},()=>({rails:[],rungs:[],digits:[]}));
      const layerFor=z=>Math.max(0,Math.min(layers.length-1,Math.floor((z/radius+1)*.5*layers.length)));
      for(let i=0;i<count;i++)for(let strand=0;strand<2;strand++){
        strands[strand].push(helix(i/(count-1),strand,clock));
      }
      // Batch thin segments by depth: far wires, rods, and digits are painted
      // before near ones. No per-frame gradients, shadows, or DOM animation.
      strands.forEach(points=>{
        for(let i=1;i<points.length;i++){
          const a=points[i-1],b=points[i];
          layers[layerFor((a.z+b.z)*.5)].rails.push([a,b]);
        }
      });
      // A moving base pair owns BOTH digits and its connecting rod. They
      // cannot drift apart: rod endpoints are the actual digit positions.
      for(let i=0;i<(small?22:44);i++){
        const pair=basePair(i,clock);
        for(let j=1;j<pair.rod.length;j++){
          const a=pair.rod[j-1],b=pair.rod[j];
          layers[layerFor((a.z+b.z)*.5)].rungs.push([a,b]);
        }
        pair.digits.forEach(p=>{
          if(p.alpha>.01&&p.x>-20&&p.x<width+20&&p.y>-20&&p.y<height+20)layers[layerFor(p.z)].digits.push(p);
        });
      }
      layers.forEach((layer,index)=>{
        const depth=index/(layers.length-1);
        ctx.globalAlpha=1;
        ctx.strokeStyle=`rgba(200,172,237,${.18+depth*.35})`;ctx.lineWidth=.6+depth*.3;ctx.beginPath();
        layer.rails.forEach(([a,b])=>{ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)});ctx.stroke();
        ctx.strokeStyle=`rgba(202,175,239,${.16+depth*.40})`;ctx.lineWidth=.55+depth*.65;ctx.beginPath();
        layer.rungs.forEach(([a,b])=>{ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)});ctx.stroke();
        layer.digits.sort((a,b)=>a.z-b.z).forEach(p=>{
          const size=(small?10:13)*p.scale;
          ctx.globalAlpha=p.alpha;
          ctx.drawImage(sprites[p.digit],p.x-size*.5,p.y-size*.625,size,size*1.25);
        });
      });
      ctx.globalAlpha=1;
      if(firstFrame){firstFrame=false;canvas.dataset.ready='true';performance.mark('knowledge-first-frame')}
    }
    function resize() {
      const box=canvas.getBoundingClientRect();
      const nextWidth=Math.round(box.width),nextHeight=Math.round(box.height);
      if(!nextWidth||!nextHeight||(width===nextWidth&&height===nextHeight))return;
      width=nextWidth;height=nextHeight;
      ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1000000/(width*height)));
      canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
      ctx.setTransform(ratio,0,0,ratio,0,0);
      count=width<700?48:Math.min(112,Math.max(64,Math.round(width*.072)));
      buildNetwork();render();
    }
    function tick(now) {
      frame=0;if(!active)return;
      // 30 fps is ample for a slow turn and avoids drawing on every display refresh.
      if(!lastDraw)lastDraw=now;
      if(now-lastDraw>=32){clock+=Math.min((now-lastDraw)/1000,.1)*.5;lastDraw=now;render()}
      frame=requestAnimationFrame(tick);
    }
    function setActive(value) {
      if(active===value)return;
      active=value;lastDraw=0;
      if(active){frame=requestAnimationFrame(tick)}
      else{cancelAnimationFrame(frame);frame=0}
    }
    resize();new ResizeObserver(resize).observe(canvas);
    return {setActive};
  }
  const knowledge = createKnowledgeField(hero.querySelector('.knowledge-canvas'));
  syncKnowledgeMotion = () => knowledge.setActive(!paused() && !document.hidden && hero.classList.contains('is-in-view'));
  // Fit the long first line while the webfont loads, including fallback fonts.
  const title = hero.querySelector('.hero-title');
  const firstLine = title.querySelector('.title-bio');
  function fitTitle() {
    const size = parseFloat(getComputedStyle(title).fontSize);
    firstLine.style.fontSize = `${size}px`;
    const range = document.createRange();
    range.selectNodeContents(firstLine);
    const naturalWidth = range.getBoundingClientRect().width;
    if (naturalWidth > title.clientWidth) {
      firstLine.style.fontSize = `${size * title.clientWidth / naturalWidth}px`;
    }
  }
  let titleWidth = 0;
  new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    if (width !== titleWidth) { titleWidth = width; fitTitle(); }
  }).observe(title);
  document.fonts.ready.then(fitTitle);
  fitTitle();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      hero.classList.toggle('is-in-view', entries[0].isIntersecting);
      syncKnowledgeMotion();
    }).observe(hero);
  } else hero.classList.add('is-in-view');
  reflectVisibility();
  let pointerFrame = 0;
  hero.addEventListener('pointermove', event => {
    if (paused() || event.pointerType !== 'mouse') return;
    cancelAnimationFrame(pointerFrame);
    pointerFrame = requestAnimationFrame(() => {
      const bounds = hero.getBoundingClientRect();
      hero.style.setProperty('--field-x', `${((event.clientX - bounds.left) / bounds.width - .5) * 12}px`);
      hero.style.setProperty('--field-y', `${((event.clientY - bounds.top) / bounds.height - .5) * 8}px`);
    });
  }, {passive:true});
  hero.addEventListener('pointerleave', () => {
    cancelAnimationFrame(pointerFrame);
    hero.style.setProperty('--field-x', '0px');
    hero.style.setProperty('--field-y', '0px');
  });
})();
