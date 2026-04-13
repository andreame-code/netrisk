export function byId(id, scope = document) {
    const element = scope.getElementById(id);
    if (!element) {
        throw new Error(`Missing required element: #${id}`);
    }
    return element;
}
export function query(selector, scope = document) {
    const element = scope.querySelector(selector);
    if (!element) {
        throw new Error(`Missing required element: ${selector}`);
    }
    return element;
}
export function maybeQuery(selector, scope = document) {
    return scope.querySelector(selector);
}
export function closest(target, selector) {
    return target instanceof Element ? target.closest(selector) : null;
}
export function setMarkup(element, markup) {
    element.innerHTML = markup;
}
export function clearMarkup(element) {
    setMarkup(element, "");
}
export function setHidden(element, hidden) {
    element.hidden = Boolean(hidden);
}
export function setDisabled(element, disabled) {
    element.disabled = Boolean(disabled);
}
