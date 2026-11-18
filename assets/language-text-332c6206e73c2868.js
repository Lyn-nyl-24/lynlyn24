export const protectedSelector = 'math,svg,code,pre,script,style,template,kbd,samp,textarea,[translate="no"]';
export const keyOf = value => value.trim().replace(/\s+/gu, ' ');
const block = new Set(['p','li','h1','h2','h3','h4','figcaption','td','dd','label']);
const inline = new Set(['span','a','em','strong','b','i','math','svg','code','sub','sup','time','abbr']);
export function sentence(node) {
  if (!block.has(node.tagName?.toLowerCase())) return;
  const elements = [];
  let text = '';
  for (const child of node.childNodes) {
    if (child.nodeType === 3) text += child.data;
    else if (inline.has(child.tagName?.toLowerCase())) {
      text += 'Q' + elements.length + 'Q';
      elements.push(child);
    } else return;
  }
  if (elements.length && /[a-zA-Z]{2}/.test(text.replace(/Q\d+Q/g,''))) return { key:keyOf(text), elements };
}

export function completeTemplate(source, value) {
  const slots = text => (text.match(/Q\d+Q/g) ?? []).sort().join(',');
  return typeof value === 'string' && slots(source) === slots(value);
}
