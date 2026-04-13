export function byId<T extends HTMLElement = HTMLElement>(id: string, scope: Document | DocumentFragment = document): T {
  const element = scope.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }

  return element as T;
}

export function query<T extends Element>(selector: string, scope: ParentNode = document): T {
  const element = scope.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element as T;
}

export function maybeQuery<T extends Element>(selector: string, scope: ParentNode = document): T | null {
  return scope.querySelector(selector) as T | null;
}

export function closest<T extends Element>(target: EventTarget | null, selector: string): T | null {
  return target instanceof Element ? (target.closest(selector) as T | null) : null;
}

export function setMarkup(element: Element, markup: string): void {
  element.innerHTML = markup;
}

export function clearMarkup(element: Element): void {
  setMarkup(element, "");
}

export function setHidden(element: HTMLElement, hidden: boolean): void {
  element.hidden = Boolean(hidden);
}

export function setDisabled(element: HTMLButtonElement | HTMLInputElement | HTMLSelectElement, disabled: boolean): void {
  element.disabled = Boolean(disabled);
}
