const { startEditorTutorial } = require('../src/editor-tutorial.js');

describe('editor tutorial uat', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="editorCanvas"></div><div id="continentList"></div>';
  });

  test('completes tutorial through normal progression', () => {
    startEditorTutorial();
    let overlay = document.getElementById('editorTutorialOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toContain('Drag territories to position them.');
    overlay.querySelector('button').click();
    overlay = document.getElementById('editorTutorialOverlay');
    expect(overlay.textContent).toContain(
      'Assign territories to continents and set bonuses.'
    );
    overlay.querySelector('button').click();
    expect(document.getElementById('editorTutorialOverlay')).toBeNull();
  });

  test('early termination leaves tutorial incomplete until finished', () => {
    startEditorTutorial();
    let overlay = document.getElementById('editorTutorialOverlay');
    expect(overlay).not.toBeNull();
    overlay.querySelector('button').click();
    overlay = document.getElementById('editorTutorialOverlay');
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toContain(
      'Assign territories to continents and set bonuses.'
    );
    // user stops here; overlay should remain
    overlay = document.getElementById('editorTutorialOverlay');
    expect(overlay).not.toBeNull();
    // now complete to verify finish logic still works
    overlay.querySelector('button').click();
    expect(document.getElementById('editorTutorialOverlay')).toBeNull();
  });
});
