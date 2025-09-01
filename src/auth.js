import createAuthAdapter from './infra/supabase/auth.adapter.ts';
import createAuthModel from './features/auth/model/user-menu.js';
import { renderUserMenu as renderUserMenuUI, showFlashMessage } from './features/auth/ui/user-menu.js';
import navigation from './navigation.js';

const authPort = createAuthAdapter();
const model = createAuthModel(authPort, navigation);

export function renderUserMenu() {
  model.renderUserMenu({ renderUserMenu: renderUserMenuUI });
}

renderUserMenu();
showFlashMessage();
