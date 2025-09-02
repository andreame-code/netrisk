import { navigateTo, goHome, exitGame } from '../src/navigation.js';

describe('navigation UAT', () => {
  test('navigateTo redirects and updates history', () => {
    const win = {
      location: { assign: jest.fn(), pathname: '/base/path/current.html' },
      history: { pushState: jest.fn() },
    };
    navigateTo('next.html', win);
    expect(win.history.pushState).toHaveBeenCalled();
    expect(win.location.assign).toHaveBeenCalledWith('/base/path/next.html');
  });

  test('goHome navigates to index.html', () => {
    const win = {
      location: { assign: jest.fn(), pathname: '/app/game.html' },
      history: { pushState: jest.fn() },
    };
    goHome(win);
    expect(win.location.assign).toHaveBeenCalledWith('/app/index.html');
  });

  test('exitGame confirms before navigating home', () => {
    const win = {
      confirm: jest.fn(() => true),
      location: { assign: jest.fn(), pathname: '/game/play.html' },
      history: { pushState: jest.fn() },
    };
    exitGame(win, 'Are you sure?');
    expect(win.confirm).toHaveBeenCalledWith('Are you sure?');
    expect(win.location.assign).toHaveBeenCalledWith('/game/index.html');
  });

  test('exitGame aborts navigation when cancelled', () => {
    const win = {
      confirm: jest.fn(() => false),
      location: { assign: jest.fn(), pathname: '/game/play.html' },
      history: { pushState: jest.fn() },
    };
    exitGame(win);
    expect(win.location.assign).not.toHaveBeenCalled();
  });
});
