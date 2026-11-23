(() => {
  const {stories, source, verbAudit} = window.storyEvidence;
  const id = name => document.getElementById('lab-' + name);
  const controls = ['story','character','measure','breakdown','group','layout','font','palette'];
  const groups = {F:'Female',M:'Male',N:'Nonhuman',U:'Unspecified'};
  const ns = 'http://www.w3.org/2000/svg';
  function make(tag,text,parent) {
    const el = document.createElement(tag);
    el.textContent = text;
    if (parent) parent.append(el);
    return el;
  }
  function svg(tag,attrs,parent) {
    const el = document.createElementNS(ns,tag);
    for (const [key,value] of Object.entries(attrs)) el.setAttribute(key,value);
    parent.append(el);
    return el;
  }
  function cite(parent,page) {
    make('a','PDF p. '+page,parent).href = source+'#page='+page;
  }
  function evidence(parent,rows,kind) {
    parent.replaceChildren();
    for (const r of rows) {
      const line = make('li',kind === 'verb' ? r.actor+(r.target?' → '+r.target:' · '+r.word)+' · '+r.note+' ' : r.word+' · '+groups[r.group]+' reference · '+r.category+' ',parent);
      cite(line,r.page);
    }
  }
  function revealEvidence(target) {
    target.focus({preventScroll:true});
    target.scrollIntoView({block:'start'});
  }
  function graph(story) {
    const active = id('character').value;
    const names = [...new Set(story.verbs.flatMap(r=>[r.actor,r.target]))];
    const degree = name => story.verbs.filter(r=>r.actor===name||r.target===name).length;
    names.sort((a,b)=>degree(b)-degree(a));
    const pairs = new Map(names.map((name,i)=>{
      const theta = (i-1)*2*Math.PI/(names.length-1)-Math.PI/2;
      return [name,i===0?[410,250]:[410+305*Math.cos(theta),250+180*Math.sin(theta)]];
    }));
    const parent=id('graph');
    parent.replaceChildren();
    const canvas=svg('svg',{viewBox:'0 0 820 500',role:'group','aria-label':'Character relationships. An evidence list follows the graph.'},parent);
    const defs=svg('defs',{},canvas);
    const arrow=svg('marker',{id:'lab-arrow',markerWidth:8,markerHeight:8,refX:7,refY:3,orient:'auto'},defs);
    svg('path',{d:'M0,0 L7,3 L0,6 Z',fill:'#b89a68'},arrow);
    const edges=new Set();
    for (const r of story.verbs) {
      const edge=r.actor+'|'+r.target;
      if(edges.has(edge))continue;
      edges.add(edge);
      const [x,y]=pairs.get(r.actor),[a,b]=pairs.get(r.target);
      const angle=Math.atan2(b-y,a-x),dx=Math.cos(angle),dy=Math.sin(angle);
      const reverse=story.verbs.some(item=>item.actor===r.target&&item.target===r.actor);
      const bend=reverse?14:0;
      svg('path',{d:'M '+(x+dx*15)+' '+(y+dy*15)+' Q '+((x+a)/2-dy*bend)+' '+((y+b)/2+dx*bend)+' '+(a-dx*17)+' '+(b-dy*17),class:active&&active!==r.actor&&active!==r.target?'lab-dim':'','marker-end':'url(#lab-arrow)'},canvas);
    }
    for(const [name,[x,y]] of pairs) {
      const near=!active||name===active||story.verbs.some(r=>(r.actor===name&&r.target===active)||(r.target===name&&r.actor===active));
      const group=svg('g',{class:near?'':'lab-dim',role:'button',tabindex:0,'aria-label':name,'aria-pressed':String(active===name)},canvas);
      svg('circle',{cx:x,cy:y,r:13,fill:active===name?'#e6b575':'#27344b'},group);
      const short=name.length>24?name.slice(0,22)+'…':name;
      svg('text',{x,y:y+29,'text-anchor':'middle'},group).textContent=short;
      const pick=()=>{id('character').value=active===name?'':name;graph(story);revealRelationships();};
      group.addEventListener('click',pick);
      group.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();pick();}});
    }
    evidence(id('relations'),story.verbs.filter(r=>!active||r.actor===active||r.target===active),'verb');
  }
  function revealRelationships() {
    document.getElementById('relationship-evidence').open = true;
    revealEvidence(id('relationship-heading'));
  }
  function counts(rows,key) {
    const totals=new Map();
    for(const item of rows){
      if(!totals.has(item[key]))totals.set(item[key],{F:0,M:0,N:0,U:0});
      totals.get(item[key])[item.group]++;
    }
    return [...totals].sort((a,b)=>Object.values(b[1]).reduce((n,v)=>n+v,0)-Object.values(a[1]).reduce((n,v)=>n+v,0)||a[0].localeCompare(b[0]));
  }
  function renderMeasure(story) {
    const kind=id('measure').value;
    const actor=id('actor').value;
    id('actor-label').hidden=kind!=='verb';
    const rows=kind==='verb'?story.verbEvidence.filter(r=>!actor||r.actor===actor):story.adjectives;
    const key=id('breakdown').value;
    id('units').textContent=kind==='verb'?rows.length+' verified verb records in this view. PDF pp. '+story.scanRange.join('–')+'. '+verbAudit[id('story').value].length+' scan candidates reviewed.':'Counts of fixed-list adjective matches by gendered reference.';
    const second = stories[id('compare').value];
    const otherRows = second ? (kind === 'verb' ? second.verbEvidence.filter(r=>!actor||r.actor===actor) : second.adjectives) : [];
    const sides = [{story,rows,prefix:''}, ...(second ? [{story:second,rows:otherRows,prefix:'second-'}] : [])];
    const ranked = counts([...rows,...otherRows],key);
    const max = Math.max(1,...sides.flatMap(side=>counts(side.rows,key).flatMap(([,t])=>Object.values(t))));
    id('secondary').hidden = !second;
    id('comparison').classList.toggle('is-paired',Boolean(second));
    id('comparison').style.setProperty('--bar-rows',Math.max(1,ranked.length));
    id('primary-title').textContent = story.title;
    id('secondary-title').textContent = second?.title || '';
    if (second) id('units').textContent = 'Same scale for both bar charts. Each doughnut shows shares within its story.';

    const select=(label,subset)=>{
      show(subset,label);
      revealEvidence(document.getElementById('evidence-title'));
    };
    function show(subset,label){
      const panel=id('evidence');panel.replaceChildren();
      make('p',label+' · '+subset.length+' records',panel);
      const list=make('ul','',panel);evidence(list,subset,kind);
    }
    for (const side of sides) {
    const rows = side.rows;
    const chart = id(side.prefix+'bars');
    chart.replaceChildren();
    const choose = (label,subset) => select(side.story.title+' · '+label,subset);
    const pie = id(side.prefix+'pie');
    pie.replaceChildren();
    if (!rows.length) make('p','No records in this view.',pie);
    else {
      const ring = make('div','',pie);
      ring.className = 'lab-donut';
      ring.setAttribute('aria-hidden','true');
      const legend = make('ul','',pie);
      legend.className = 'lab-pie-legend';
      const stops = [];
      let angle = 0;
      for (const [group,title] of Object.entries(groups)) {
        const subset = rows.filter(row=>row.group===group);
        if (!subset.length) continue;
        const next = angle + 360 * subset.length / rows.length;
        stops.push('var(--chart-'+group+') '+angle+'deg '+next+'deg');
        angle = next;
        const item = make('li','',legend);
        const button = make('button',title+' · '+subset.length+' ('+(100*subset.length/rows.length).toFixed(1)+'%)',item);
        button.type='button';
        button.dataset.group=group;
        button.onclick=()=>choose(title,subset);
      }
      ring.style.background='conic-gradient('+stops.join(',')+')';
      const total = make('span',String(rows.length),ring);
      total.className='lab-donut-total';
    }
    const storyCounts = new Map(counts(rows,key));
    for(const [label] of ranked){
      const t = storyCounts.get(label) || {F:0,M:0,N:0,U:0};
      const line=make('div','',chart);line.className='lab-bar-row';
      const button=make('button',label,line);button.type='button';
      button.onclick=()=>choose(label,rows.filter(r=>r[key]===label));
      line.classList.toggle('lab-adjective-row',kind==='adjective');
      for(const [group,title] of Object.entries(groups)){
        if(kind==='adjective'&&(group==='N'||group==='U'))continue;
        const bar=make('button',title+' '+t[group],line);
        bar.type='button';
        bar.onclick=()=>choose(label+' · '+title,rows.filter(r=>r[key]===label&&r.group===group));
        bar.className='lab-bar';bar.dataset.group=group;
        bar.style.setProperty('--fill',(100*t[group]/max)+'%');
      }
    }
    if(!ranked.length)make('p','No matches in this measure.',chart);
    }
    const wordSets = sides.map(side => {
      const filtered = side.rows.filter(row => !id('group').value || row.group === id('group').value);
      return counts(filtered,'word').map(([word,t])=>({word,n:t.F+t.M+t.N+t.U,records:filtered.filter(row=>row.word===word)}));
    });
    const wordMax = Math.max(1,...wordSets.flat().map(item=>item.n));
    id('cloud-comparison').classList.toggle('is-paired',Boolean(second));
    id('cloud-secondary').hidden = !second;
    for (const [index,side] of sides.entries()) {
      const map = id(side.prefix+'cloud');
      id(side.prefix+'cloud-title').textContent = side.story.title;
      map.replaceChildren();
      map.dataset.layout=id('layout').value;
      map.dataset.font=id('font').value;
      map.dataset.palette=id('palette').value;
      for (const {word,n,records} of wordSets[index]) {
        const button=make('button',word,map);
        button.type='button';
        const hue = [...word].reduce((total,letter)=>(total*31+letter.codePointAt(0))%6,0);
        button.dataset.tone=hue;
        make('small',' '+n,button);
        button.style.setProperty('--size',(1+2.75*Math.sqrt(n/wordMax))+'rem');
        button.onclick=()=>select(side.story.title+' · '+word,records);
      }
      if(!wordSets[index].length) make('p','No records for this group in the selected measure.',map);
    }
    show([], 'Select a word or category');
  }
  function loadStory(){
    const story=stories[id('story').value];
    id('chapter').href=story.chapter;
    id('reading').textContent=story.reading;
    id('character').replaceChildren(new Option('All characters',''),...[...new Set(story.verbs.flatMap(r=>[r.actor,r.target]))].sort().map(name=>new Option(name,name)));
    populateCompare();
    populateActors();
    graph(story);renderMeasure(story);
    history.replaceState(null,'','?story='+encodeURIComponent(id('story').value)+location.hash);
  }
  function populateCompare() {
    const previous = id('compare').value;
    id('compare').replaceChildren(new Option('Single story',''),...Object.entries(stories)
      .filter(([key])=>key!==id('story').value).map(([key,entry])=>new Option(entry.title,key)));
    if ([...id('compare').options].some(option=>option.value===previous)) id('compare').value=previous;
  }
  function populateActors() {
    const actor=id('actor'), previous=actor.value;
    const selectedStories=[stories[id('story').value],stories[id('compare').value]].filter(Boolean);
    const names=[...new Set(selectedStories.flatMap(entry=>entry.verbEvidence.map(row=>row.actor)))].sort();
    actor.replaceChildren(new Option('All recorded actors',''),...names.map(name=>new Option(name,name)));
    if (names.includes(previous)) actor.value=previous;
  }
  id('compare').addEventListener('change',()=>{
    populateActors();
    renderMeasure(stories[id('story').value]);
  });
  id('source').href=source;
  for(const [key,story] of Object.entries(stories))id('story').add(new Option(story.title,key));
  const initial=new URLSearchParams(location.search).get('story');
  if(Object.hasOwn(stories,initial))id('story').value=initial;
  id('story').addEventListener('change',loadStory);
  id('character').addEventListener('change',()=>{
    graph(stories[id('story').value]);
    revealRelationships();
  });
  for(const control of [...controls.slice(2),'actor'])id(control).addEventListener('change',()=>renderMeasure(stories[id('story').value]));
  loadStory();
})();
