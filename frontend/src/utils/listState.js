/**
 * Return a new array with one object patched. Never mutates the previous item:
 * nested form objects may still be referenced by undo/back-step state.
 */
export function updateAt(list, index, patch) {
  return list.map((item, current) => (current === index ? { ...item, ...patch } : item));
}
