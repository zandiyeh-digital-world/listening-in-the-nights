(() => {
  const byId = id => document.getElementById(id);
  const dataset = window.nightsWordData;
  const side = byId('word-side');
  const category = byId('word-category');
  const section = byId('word-section');
  const construction = byId('word-construction');
  const character = byId('word-character');
  const characterKey = row => row.character ? row.rosterSection + '|' + row.character : 'unlinked';
  const cloud = byId('word-map');
  const comparison = byId('word-comparison');
  const summary = byId('category-summary');
  const evidence = byId('word-evidence');
  const passages = byId('word-passages');
  const groups = ['Female labels', 'Male labels'];
  const source = 'https://www.gutenberg.org/files/128/128-h/128-h.htm';
  const categoryOrder = ['Appearance', 'Age', 'Intellect & resolve', 'Conduct', 'Condition & status', 'Address'];
  let selected = 'beautiful';

  for (const name of categoryOrder) category.add(new Option(name, name));
  for (const name of dataset.sections) section.add(new Option(name, name));
  const requestedSection = new URLSearchParams(location.search).get('section');
  if (dataset.sections.includes(requestedSection)) {
    section.value = requestedSection;
    side.value = 'all';
  }

  const identities = new Map(dataset.hits.filter(row => row.character).map(row => [characterKey(row), row.character]));
  for (const [key, name] of [...identities].sort((a,b) => a[1].localeCompare(b[1]))) character.add(new Option(name, key));

  function element(tag, content, className) {
    const node = document.createElement(tag);
    if (content) node.textContent = content;
    if (className) node.className = className;
    return node;
  }

  function selectWord(word, event) {
    selected = word;
    render();
    if (event) {
      const root = event.currentTarget.closest('table') ? comparison : cloud;
      const nextButton = [...root.querySelectorAll('button')].find(button => button.dataset.word === word);
      nextButton?.focus({preventScroll:true});
    }
  }

  function wordButton(word, label) {
    const button = element('button', label);
    button.type = 'button';
    button.dataset.word = word;
    button.setAttribute('aria-pressed', String(word === selected));
    button.addEventListener('click', event => selectWord(word, event));
    return button;
  }

  function measure(count, total) {
    const percent = total ? 100 * count / total : 0;
    return {percent, text: count + ' of ' + total + ' · ' + (total ? percent.toFixed(1) + '%' : '—')};
  }

  function metricCell(count, total) {
    const {percent, text} = measure(count, total);
    const cell = element('td', text);
    const track = element('span', '', 'word-track');
    track.setAttribute('aria-hidden', 'true');
    const bar = element('span', '', 'word-fill');
    bar.style.width = percent + '%';
    track.append(bar);
    cell.append(track);
    return cell;
  }

  function renderPassages(rows) {
    const matches = rows.filter(row => row.word === selected);
    passages.replaceChildren();
    evidence.textContent = selected
      ? selected + ' · ' + groups.map((name, index) => matches.filter(row => row.side === index).length + ' ' + name.toLowerCase()).join(' · ')
      : 'Choose an adjective to see its matches.';
    byId('word-context-link').textContent = selected ? 'Read passages for “' + selected + '” ↓' : 'Read in context ↓';
    matches.forEach((row, i) => {
      const detail = element('details', '', 'word-passage');
      const phrase = row.phrase || row.word + ' ' + row.label;
      const match = new RegExp('\\b' + row.word + '\\s+' + row.label + '\\b', 'i').exec(row.context);
      const type = {predicate:'After a linking verb', attributive:'Before a noun', named:'Named character'}[row.construction];
      detail.append(element('summary', phrase + ' · ' + row.section + ' · ' + groups[row.side] + ' · ' + type + (row.negated ? ' · Negated' : '')));
      const quote = element('blockquote');
      const link = element('a', 'Find passage in Gutenberg');
      if (row.highlight) {
        const [start, length] = row.highlight;
        quote.append('…' + row.context.slice(0, start), element('mark', row.context.slice(start, start + length)), row.context.slice(start + length) + '…');
        link.href = source + '#:~:text=' + encodeURIComponent(phrase.replace(/\s+/g, ' ')).replaceAll('-', '%2D');
      } else if (match) {
        quote.append('…' + row.context.slice(0, match.index),
          element('mark', match[0]), row.context.slice(match.index + match[0].length) + '…');
        const words = row.context.trim().split(/\s+/);
        const phraseIndex = row.context.slice(0, match.index).trim().split(/\s+/).filter(Boolean).length;
        const snippet = words.slice(Math.max(1, phraseIndex - 2), Math.max(phraseIndex + 2, Math.min(words.length - 1, phraseIndex + 4))).join(' ');
        const text = snippet.toLowerCase().includes(phrase) ? snippet : phrase;
        link.href = source + '#:~:text=' + encodeURIComponent(text).replaceAll('-', '%2D');
      } else {
        quote.textContent = row.context;
        link.href = source + '#:~:text=' + encodeURIComponent(phrase);
      }
      detail.open = i === 0;
      detail.append(quote, link);
      if (row.reading) detail.append(element('p', row.reading));
      if (row.character) {
        const roster = element('a', 'Cast roster · ' + row.character);
        roster.href = 'gender-cast.html#cast-section-' + row.rosterSection;
        const identity = element('p');
        identity.append(roster);
        detail.append(identity);
      }
      passages.append(detail);
    });
  }

  function packCloud() {
    const buttons = [...cloud.querySelectorAll('button')];
    if (!buttons.length || !cloud.clientWidth) {
      cloud.style.height = '';
      return;
    }
    const width = cloud.clientWidth;
    const height = Math.max(170, Math.min(420, width * .56));
    const placed = [];
    let bottom = height;
    for (const button of buttons) {
      button.style.fontSize = '';
      if (button.offsetWidth > width - 8) {
        const size = parseFloat(getComputedStyle(button).fontSize);
        button.style.fontSize = (size * (width - 16) / button.offsetWidth) + 'px';
      }
      const w = button.offsetWidth;
      const h = button.offsetHeight;
      let box;
      // Search outwards from the center along an elliptical spiral.
      for (let step = 0; step < 1600; step++) {
        const angle = step * .45;
        const radius = step * .48;
        const x = Math.round(width / 2 + Math.cos(angle) * radius - w / 2);
        const y = Math.round(height / 2 + Math.sin(angle) * radius * .57 - h / 2);
        if (x < 4 || x + w > width - 4 || y < 4 || y + h > height - 4) continue;
        if (placed.some(other => x < other.x + other.w + 3 && x + w + 3 > other.x &&
          y < other.y + other.h + 2 && y + h + 2 > other.y)) continue;
        box = {x, y, w, h};
        break;
      }
      if (!box) {
        box = {x: Math.max(4, (width - w) / 2), y: bottom + 3, w, h};
        bottom += h + 3;
      }
      placed.push(box);
      button.style.left = box.x + 'px';
      button.style.top = box.y + 'px';
    }
    cloud.style.height = bottom + 'px';
  }

  function render() {
    const scoped = dataset.hits.filter(row => (!section.value || row.section === section.value) &&
      (!construction.value || row.construction === construction.value) &&
      (!character.value || characterKey(row) === character.value));
    const totals = groups.map((_, index) => scoped.filter(row => row.side === index).length);
    const active = scoped.filter(row => !category.value || row.category === category.value);
    const records = new Map();
    for (const row of active) {
      if (!records.has(row.word)) records.set(row.word, {word:row.word, category:row.category, counts:[0,0]});
      records.get(row.word).counts[row.side]++;
    }
    const ranked = [...records.values()].sort((a,b) =>
      (b.counts[0] + b.counts[1]) - (a.counts[0] + a.counts[1]) || a.word.localeCompare(b.word));
    if (!records.has(selected)) selected = ranked[0]?.word;
    const cloudCount = row => side.value === 'all' ? row.counts[0] + row.counts[1] : row.counts[Number(side.value)];
    const max = Math.max(1, ...ranked.map(cloudCount));
    const characterLabel = character.value ? ' · ' + character.selectedOptions[0].textContent : '';
    byId('word-total').textContent = scoped.length + ' matches in ' + (section.value || 'the whole volume') +
      ' · ' + totals[0] + ' female labels · ' + totals[1] + ' male labels' + characterLabel;
    cloud.replaceChildren();
    const words = ranked.filter(row => cloudCount(row))
      .sort((a,b) => cloudCount(b)-cloudCount(a) || a.word.localeCompare(b.word));
    for (const row of words) {
      const n = cloudCount(row);
      const button = wordButton(row.word, row.word);
      button.style.setProperty('--weight', Math.sqrt(n / max));
      button.dataset.color = categoryOrder.indexOf(row.category);
      button.title = row.category + ' · ' + n + (n === 1 ? ' match' : ' matches');
      button.setAttribute('aria-label', row.word + ' · ' + n + (n === 1 ? ' match' : ' matches'));
      cloud.append(button);
    }
    if (!words.length) cloud.append(element('p', 'No matches in this cloud scope.'));
    packCloud();
    summary.replaceChildren();
    const categoryTable = element('table', '', 'study-table word-table');
    categoryTable.append(element('caption', 'Categories at a glance'));
    const headers = categoryTable.createTHead().insertRow();
    for (const title of ['Category', ...groups]) {
      const th = element('th', title);
      th.scope = 'col';
      headers.append(th);
    }
    const categoryBody = categoryTable.createTBody();
    for (const name of categoryOrder) {
      const row = categoryBody.insertRow();
      const title = element('th');
      title.scope = 'row';
      const button = element('button', name);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(category.value === name));
      button.addEventListener('click', () => {
        category.value = category.value === name ? '' : name;
        render();
        [...summary.querySelectorAll('button')].find(item => item.textContent === name)?.focus({preventScroll:true});
      });
      title.append(button);
      row.append(title, ...totals.map((total,index) => metricCell(
        scoped.filter(hit => hit.side === index && hit.category === name).length, total)));
    }
    summary.append(categoryTable);
    comparison.replaceChildren();
    for (const item of ranked) {
      const row = element('tr');
      const label = element('th');
      label.scope = 'row';
      label.append(wordButton(item.word,item.word));
      row.append(label, ...item.counts.map((count,index) => metricCell(count,totals[index])));
      comparison.append(row);
    }
    if (!ranked.length) {
      const row = element('tr');
      const cell = element('td','No adjective matches for these filters.');
      cell.colSpan = 3;
      row.append(cell);
      comparison.append(row);
    }
    renderPassages(active);
  }
  for (const filter of [side,category,section,construction]) filter.addEventListener('change',render);
  character.addEventListener('change', () => {
    if (identities.has(character.value)) side.value = 'all';
    render();
  });
  byId('word-context-link').addEventListener('click', () => { byId('word-reader-title').open = true; });
  render();
  let cloudWidth = cloud.clientWidth;
  new ResizeObserver(() => {
    if (cloud.clientWidth === cloudWidth) return;
    cloudWidth = cloud.clientWidth;
    packCloud();
  }).observe(cloud);
})();
