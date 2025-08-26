const { startEditorTutorial } = require('./editor-tutorial.js');

describe('editor tutorial', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="editorCanvas"></div><div id="continentList"></div>';
  });

  test('overlay is created and removed after steps', () => {
    startEditorTutorial();
    let overlay = document.getElementById('editorTutorialOverlay');
    expect(overlay).not.toBeNull();
    let next = overlay.querySelector('button');
    next.click();
    overlay = document.getElementById('editorTutorialOverlay');
    next = overlay.querySelector('button');
    next.click();
    expect(document.getElementById('editorTutorialOverlay')).toBeNull();
  });
});
