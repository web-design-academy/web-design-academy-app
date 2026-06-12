import fs from "node:fs";
import htmlTags from "html-tags";
import { htmlElementAttributes } from "html-element-attributes";
import { isValidHTMLNesting } from "validate-html-nesting";

// 🟪 nainstaluj html-enumerated-attributes
import { enumeratedAttributes } from "html-enumerated-attributes";

const ALL_HTML_TAGS = ["text", ...htmlTags];
const VOID_TAGS = [
  "area", "base", "br", "col", "embed", "hr", "img",
  "input", "link", "meta", "param", "source", "text", "track", "wbr"
];

const TAGS_WITH_CHILDREN_AND_ATTRS = ALL_HTML_TAGS.map(parentTag => {
  const children = [];

  if (!VOID_TAGS.includes(parentTag)) {
    for (const childTag of ALL_HTML_TAGS) {
      if (isValidHTMLNesting(parentTag, childTag)) {
        children.push(childTag);
      }
    }
  }

  // načti atributy ze seznamu + jejich enumerované hodnoty
  const rawAttrs = htmlElementAttributes[parentTag] ?? [];

  const enrichedAttrs = rawAttrs.map(attrName => {
  const enumInfo = enumeratedAttributes[attrName]; // bez 'as any'

    return {
      name: attrName,
      values: enumInfo?.states ?? []
    };
  });

  return {
    name: parentTag,
    children,
    attributes: enrichedAttrs
  };
});

fs.writeFileSync(
  "./tags.json",
  JSON.stringify(TAGS_WITH_CHILDREN_AND_ATTRS, null, 2),
  "utf-8"
);

console.log("Soubor tags.json byl vygenerován s hodnotami atributů.");
