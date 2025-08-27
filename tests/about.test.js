const { filterSections } = require('../about.js');

describe('about page search', () => {
  test('filters sections based on query', () => {
    document.body.innerHTML = `
      <div id="helpContent">
        <section id="s1"><h2>Rules</h2><p>battle</p></section>
        <section id="s2"><h2>Tips</h2><p>strategy</p></section>
      </div>`;
    filterSections('battle', document);
    const sections = document.querySelectorAll('#helpContent section');
    expect(sections[0].style.display).toBe('');
    expect(sections[1].style.display).toBe('none');
  });
});
