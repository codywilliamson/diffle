// insert one proof node immediately after its anchored code row instead of after the whole hunk.
export function withProof(items, unit, matches, renderItem, renderProof) {
  const output = [];
  items.forEach((item, index) => {
    output.push(renderItem(item, index));
    if (unit && matches(item, unit)) output.push(renderProof(unit));
  });
  return output;
}
