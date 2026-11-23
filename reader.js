(() => {
  'use strict';

  const stages = [...document.querySelectorAll('.stage')];
  const navigation = document.querySelector('.stages');
  const stageButtons = [...navigation.querySelectorAll('button')];
  const controls = document.querySelector('.controls');
  const progress = document.getElementById('progress');
  const back = document.getElementById('back');
  const next = document.getElementById('next');
  let current = 0;

  function showStage(index, focusHeading = true) {
    current = index;
    stages.forEach((stage, position) => {
      stage.hidden = position !== current;
      const button = stageButtons[position];
      if (position === current) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    progress.textContent = `Stage ${current + 1} of ${stages.length}`;
    back.disabled = current === 0;
    next.textContent = current === stages.length - 1
      ? 'Read again'
      : stages[current].dataset.next || 'Continue';
    if (focusHeading) stages[current].querySelector('h3').focus();
  }

  stageButtons.forEach((button, index) => {
    button.addEventListener('click', () => showStage(index));
  });
  back.addEventListener('click', () => {
    if (current > 0) showStage(current - 1);
  });
  next.addEventListener('click', () => {
    if (current === stages.length - 1) {
      stages.forEach(stage => {
        stage.querySelectorAll('details').forEach(note => { note.open = false; });
      });
      showStage(0);
      return;
    }
    showStage(current + 1);
  });

  showStage(0, false);
  // A fragment can point inside a reading stage. Revisit it after revealing that stage.
  function revealLinkedStage() {
    const id = location.hash.slice(1);
    const target = id && document.getElementById(id);
    const index = target ? stages.indexOf(target.closest('.stage')) : -1;
    if (index < 0) return;
    showStage(index, false);
    target.scrollIntoView();
  }
  window.addEventListener('hashchange', revealLinkedStage);
  window.addEventListener('load', revealLinkedStage, { once: true });
  navigation.hidden = false;
  controls.hidden = false;
  progress.hidden = false;
})();
