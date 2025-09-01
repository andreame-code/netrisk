import { navigateTo } from "./navigation.js";
import { info, error } from "./logger.js";
import { createAuthAdapter } from "./infra/supabase/auth.adapter.ts";
import {
  renderUserMenu as renderUserMenuUi,
  showFlashMessage,
} from "./features/auth/ui.js";
import { registerAuthListener } from "./init/supabase-client.js";

const authPort = createAuthAdapter();

export async function renderUserMenu() {
  await renderUserMenuUi({ authPort, navigateTo, info, error });
}

renderUserMenu();
registerAuthListener(async (event) => {
  if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
    info(`[AUTH] ${event}`);
    await renderUserMenu();
  }
});
showFlashMessage();
