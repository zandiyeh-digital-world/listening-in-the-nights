(() => {
  const $ = id => document.getElementById(id);
  const nouns = 'woman|man|girl|boy|queen|king|princess|prince|wife|husband|mother|father|daughter|son|sister|brother|merchant|fisherman|servant';
  const subject = '(?:(?:[Tt]he|[Aa]n?|[Mm]y|[Hh]er|[Hh]is|[Tt]heir)\\s+(?:' + nouns + ')\\b|\\b(?:[Ss]he|[Hh]e|[Tt]hey|[Ww]e|I)\\b|\\b[A-Z][a-z]+(?:[’\\x27-][A-Za-z]+)*)';
  const verbs = new Map(), adjectives = new Map();
  function addLexicon(map, category, entries) {
    for (const entry of entries.split(';')) {
      const forms = entry.trim().split(/\s+/);
      for (const form of forms) map.set(form,{word:forms[0],category});
    }
  }
  addLexicon(verbs,'Household and care','cook cooks cooked;wash washes washed;feed feeds fed;clean cleans cleaned;sew sews sewed;care cares cared;bathe bathes bathed;serve serves served');
  addLexicon(verbs,'Management and exchange','buy buys bought;sell sells sold;pay pays paid;hire hires hired;manage manages managed;plan plans planned;trade trades traded;share shares shared;give gives gave');
  addLexicon(verbs,'Speech and storytelling','ask asks asked;say says said;tell tells told;reply replies replied;answer answers answered;explain explains explained;narrate narrates narrated');
  addLexicon(verbs,'Judgment and inquiry','decide decides decided;learn learns learned;know knows knew;recognize recognizes recognized;discover discovers discovered;investigate investigates investigated');
  addLexicon(verbs,'Authority and coercion','order orders ordered;command commands commanded;forbid forbids forbade;threaten threatens threatened;kill kills killed;free frees freed;punish punishes punished');
  addLexicon(verbs,'Kinship and intimacy','marry marries married;love loves loved;embrace embraces embraced;kiss kisses kissed;mourn mourns mourned');
  for(const [category,words] of Object.entries({
    Appearance:'beautiful pretty handsome plain graceful ugly',
    'Intellect and judgment':'clever wise intelligent prudent sensible foolish',
    'Conduct and resolve':'kind generous cruel brave courageous wicked jealous faithful',
    'Age and condition':'young old ill healthy poor rich frightened unhappy'
  })) addLexicon(adjectives,category,words.replaceAll(' ',';'));
  const patterns = [
    ['verb',verbs,new RegExp('(?:^|\\b)('+subject+')\\s+('+[...verbs.keys()].join('|')+')\\b','g')],
    ['adjective',adjectives,new RegExp('(?:^|\\b)('+subject+')\\s+(?:is|are|was|were|seemed|became)\\s+(?:very\\s+)?('+[...adjectives.keys()].join('|')+')\\b','g')],
    ['adjective',adjectives,new RegExp('\\b(?:the|a|an|her|his|their)\\s+('+[...adjectives.keys()].join('|')+')\\s+('+nouns+')\\b','gi'),true]
  ];
  const pronoun = /^(she|he|they|we|i)$/i;
  const pageSize = 12;
  let records=[], selection=null, page=0, graphActor='', fileRequest=0;
  function scan(text) {
    const sentences = new Intl.Segmenter('en',{granularity:'sentence'}).segment(text);
    const results=[];
    for(const {segment,index} of sentences) {
      for(const [kind,lexicon,pattern,beforeNoun] of patterns) {
        for(const match of segment.matchAll(pattern)) {
          const rawActor = match[beforeNoun?2:1];
          const form=match[beforeNoun?1:2];
          const actor = pronoun.test(rawActor) ? '' : rawActor.replace(/^(the|a|an) /i,'');
          results.push({...lexicon.get(form.toLowerCase()),kind,form,actor,rawActor,target:'',
            status:'suggested',start:index+match.index,end:index+match.index+match[0].length,
            sentence:segment.trim()});
        }
      }
    }
    return results.sort((a,b)=>a.start-b.start);
  }
  function make(tag,text,parent) {
    const el=document.createElement(tag);
    if(text) el.textContent=text;
    if(parent) parent.append(el);
    return el;
  }
  function action(text,parent,onClick) {
    const button=make('button',text,parent);
    button.type='button';
    button.addEventListener('click',onClick);
    return button;
  }
  function baseRows() {
    return records.filter(r=>r.kind===$('measure').value&&r.status!=='excluded'&&
      ($('review-filter').value!=='reviewed'||r.status==='reviewed')&&
      (!$('actor-filter').value||(r.actor||'Unresolved')===$('actor-filter').value));
  }
  function activeRows() {
    const rows=baseRows();
    return selection ? rows.filter(r=>r[selection.key]===selection.value) : rows;
  }
  function tally(rows,key) {
    const map=new Map();
    for(const r of rows) map.set(r[key],(map.get(r[key])||0)+1);
    return [...map].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  }
  function reveal() {
    $('evidence-heading').focus({preventScroll:true});
    $('evidence-heading').scrollIntoView({block:'start'});
  }
  function choose(key,value) {
    selection={key,value}; page=0; renderRecords(); reveal();
  }
  function renderPlots() {
    const rows=baseRows();
    const bars=$('text-bars'), cloud=$('text-cloud');
    bars.replaceChildren();cloud.replaceChildren();
    const categories=tally(rows,'category'), words=tally(rows,'word');
    for(const [label,count] of categories) {
      const button=action(label+' · '+count,bars,()=>choose('category',label));
      button.className='text-bar';
      button.style.setProperty('--fill',100*count/categories[0][1]+'%');
    }
    for(const [index,[word,count]] of words.entries()) {
      const button=action(word+' · '+count,cloud,()=>choose('word',word));
      button.dataset.tone=index%6;
      button.style.setProperty('--size',(1+2.3*Math.sqrt(count/words[0][1]))+'rem');
    }
    if(!rows.length) {
      make('p','No matches in this view.',bars);
      make('p','No words in this view.',cloud);
    }
  }
  function actors() {
    const el=$('actor-filter'), current=el.value;
    const names=[...new Set(records.filter(r=>r.status!=='excluded').map(r=>r.actor||'Unresolved'))].sort();
    el.replaceChildren(new Option('All actors and subjects',''),...names.map(name=>new Option(name,name)));
    if(names.includes(current)) el.value=current;
  }
  function field(parent,label,value) {
    const wrap=make('label',label,parent), input=make('input','',wrap);
    input.value=value; input.maxLength=100;
    return input;
  }
  function renderRecords() {
    const rows=activeRows();
    page=Math.min(page,Math.max(0,Math.ceil(rows.length/pageSize)-1));
    const start=page*pageSize, container=$('records');
    container.replaceChildren();
    $('record-summary').textContent=(selection ? selection.value+' · ' : '')+rows.length+' records'+
      (rows.length ? ' · Showing '+(start+1)+'–'+Math.min(start+pageSize,rows.length) : '');
    $('prev').disabled=page===0;$('next').disabled=start+pageSize>=rows.length;
    for(const row of rows.slice(start,start+pageSize)) {
      const article=make('article','',container);
      make('h3',row.form+' · '+row.category,article);
      make('p',(row.status==='reviewed'?'Reviewed':'Suggested')+' · Text position '+(row.start+1)+' · Matched subject: '+row.rawActor,article);
      make('blockquote',row.sentence,article);
      const edit=make('div','',article);edit.className='lab-controls';
      const actor=field(edit,'Actor or subject',row.actor);
      const target=row.kind==='verb'?field(edit,'Affected character',row.target):null;
      action('Save as reviewed',edit,()=>{
        if(!actor.value.trim()) {actor.setCustomValidity('Name the actor or subject before marking the record reviewed.');actor.reportValidity();return;}
        row.actor=actor.value.trim();row.target=target?.value.trim()||'';row.status='reviewed';
        refresh();
      });
      actor.addEventListener('input',()=>actor.setCustomValidity(''));
      action('Exclude match',edit,()=>{row.status='excluded';refresh();});
    }
  }
  function renderGraph() {
    const graph=$('text-graph'), list=$('graph-evidence');
    graph.replaceChildren();list.replaceChildren();
    const links=records.filter(r=>r.kind==='verb'&&r.status==='reviewed'&&r.actor&&r.target&&r.actor!==r.target);
    const names=[...new Set(links.flatMap(r=>[r.actor,r.target]))];
    if (!names.includes(graphActor)) graphActor='';
    if (!links.length) {make('p','No reviewed connections yet.',graph);return;}
    const ordered=graphActor?[graphActor,...names.filter(n=>n!==graphActor)]:names;
    const shown=ordered.slice(0,24);
    const ns='http://www.w3.org/2000/svg';
    function svg(tag,attrs,parent){
      const el=document.createElementNS(ns,tag);
      for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);
      parent.append(el);return el;
    }
    const canvas=svg('svg',{viewBox:'0 0 700 430',role:'img','aria-label':'Reviewed character relationships'},graph);
    const points=new Map(shown.map((name,i)=>[name,[350+245*Math.sin(i*2*Math.PI/shown.length),215-155*Math.cos(i*2*Math.PI/shown.length)]]));
    const edges=new Set();
    for(const r of links) {
      if(!points.has(r.actor)||!points.has(r.target)||graphActor&&![r.actor,r.target].includes(graphActor))continue;
      const key=JSON.stringify([r.actor,r.target].sort());
      if(edges.has(key))continue;edges.add(key);
      const [x1,y1]=points.get(r.actor),[x2,y2]=points.get(r.target);
      svg('line',{x1,y1,x2,y2},canvas);
    }
    for(const [name,[x,y]] of points){
      svg('circle',{cx:x,cy:y,r:9},canvas);
      svg('text',{x,y:y+23,'text-anchor':'middle'},canvas).textContent=name.length>16?name.slice(0,15)+'…':name;
    }
    if(names.length>shown.length)make('p','The diagram displays 24 characters. The selector and evidence list include every reviewed connection.',graph);
    const label=make('label','Focus on a character',graph), picker=make('select','',label);
    picker.setAttribute('aria-label','Focus on a character');
    picker.append(new Option('All characters',''),...names.sort().map(n=>new Option(n,n)));
    picker.value=graphActor;
    picker.addEventListener('change',()=>{graphActor=picker.value;renderGraph();graph.querySelector('select').focus();});
    for(const r of links.filter(r=>!graphActor||[r.actor,r.target].includes(graphActor))){
      const li=make('li','',list);
      action(r.actor+' → '+r.target+' · '+r.word,li,()=>{
        $('measure').value='verb';$('actor-filter').value='';$('review-filter').value='reviewed';
        choose('start',r.start);renderPlots();
      });
    }
  }
  function refresh(){actors();renderPlots();renderRecords();renderGraph();}
  $('input-form').addEventListener('submit',event=>{
    event.preventDefault();
    const text=$('passage').value;
    if(!text.trim()||text.length>250000){$('status').textContent='Enter English text of up to 250,000 characters.';return;}
    records=scan(text);selection=null;page=0;graphActor='';
    $('actor-filter').value='';$('review-filter').value='all';
    if(records.length&&!records.some(r=>r.kind===$('measure').value))$('measure').value=records[0].kind;
    $('status').textContent=records.length+' suggested matches.';
    $('results').hidden=false;refresh();
  });
  $('sample').addEventListener('click',()=>{
    fileRequest++;
    $('passage').value='Mina was clever. The queen ordered the merchant to return. Mina bought bread. She shared it with the children. The merchant replied to Mina. The young prince was wise.';
    $('status').textContent='Sample loaded. Select Analyze text to begin.';
  });
  $('passage').addEventListener('input',()=>{fileRequest++;});
  $('text-file').addEventListener('change',async event=>{
    const request=++fileRequest, file=event.target.files[0];
    if(!file)return;
    if(!/\.txt$/i.test(file.name)||file.size>1000000){$('status').textContent='Choose a UTF-8 .txt file of up to 250,000 characters.';return;}
    try {
      const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
      if(request!==fileRequest)return;
      if(text.length>250000||text.includes('\0'))throw Error('Invalid text');
      $('passage').value=text;$('status').textContent='File loaded. Select Analyze text to begin.';
    } catch {if(request===fileRequest)$('status').textContent='Could not read a UTF-8 text file within the size limit.';}
  });
  for(const id of ['measure','review-filter','actor-filter'])$(id).addEventListener('change',()=>{selection=null;page=0;renderPlots();renderRecords();});
  $('clear-filter').addEventListener('click',()=>{selection=null;page=0;renderRecords();});
  $('prev').addEventListener('click',()=>{page--;renderRecords();reveal();});
  $('next').addEventListener('click',()=>{page++;renderRecords();reveal();});
  $('export').addEventListener('click',()=>{
    const keys=['kind','word','form','category','rawActor','actor','target','status','start','end','sentence'];
    const quote=value=>{
      let text=String(value??'');
      if(/^\s*[=+\-@]/.test(text)||/^[\r\n\t]/.test(text))text="'"+text;
      return '"'+text.replaceAll('"','""')+'"';
    };
    const csv=[keys.join(','),...activeRows().map(row=>keys.map(key=>quote(row[key])).join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));
    const a=make('a','',document.body);a.href=url;a.download='text-analysis.csv';a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
})();
