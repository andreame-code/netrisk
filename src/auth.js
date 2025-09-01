import { navigateTo } from "./navigation.js";
import { info, error } from "./logger.js";
import { createAuthAdapter } from "./infra/supabase/auth.adapter.ts";
import { createAuthModel } from "./features/auth/model.js";
import {
  renderUserMenu as renderUserMenuUi,
  showFlashMessage,
} from "./features/auth/ui.js";

const authPort = createAuthAdapter();
const model = createAuthModel(authPort);

export async function renderUserMenu() {
  await renderUserMenuUi({ model, navigateTo, info, error });
}

renderUserMenu();
showFlashMessage();
