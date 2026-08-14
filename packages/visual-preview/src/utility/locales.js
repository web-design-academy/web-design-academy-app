const en = {
  ui: {
    preview: "Preview",
    inspect: "Inspect",
    mySolution: "My solution",
    pattern: "Target",
    overlay: "Overlay",
    diffView: "Diff",
    evaluation: "Evaluation",
    opacity: "Target opacity:",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    fitToScreen: "Fit to screen",
    dimensions: "dimensions",
    gap: "gap",
    canvasHint: "Ctrl + Scroll to zoom | Middle click to pan",
    diffViewText: "Black areas match; colored areas differ.",
  },
  linter: {
    syntaxError: "CSS contains a syntax error.",
    emptySelector: "Empty selector '{sel}'.",
    duplicateSelector: "Duplicate selector '{sel}'. Merge the rules.",
    deadCode: "Element '{sel}' is not present in the HTML.",
    duplicateProp: "Duplicate property '{prop}'. The last value wins.",
    deprecatedProp: "Property '{prop}' is deprecated.",
    shorthandOverride: "Shorthand '{short}' overrides '{long}'.",
    important: "Using !important is discouraged.",
    missingUnit: "Value '{val}' needs a unit.",
    unknownUnit: "Unknown unit '{unit}'.",
    ignoredProp: "Property '{prop}' is ignored. {reason}",
    importantKeyframes: "!important is invalid inside @keyframes.",
    avoidId: "Prefer a class over ID selector '{sel}'.",
    overlySpecific: "Selector '{sel}' is overly specific (depth {cnt}).",
  },
  checks: {
    forbiddenProp: "Property '{prop}' is forbidden{media}.",
    missingProp: "Define property '{prop}'{media}.",
    missingExact: "Property '{prop}' is missing{media}.",
    wrongValue: "Expected '{exp}'{media}, found '{act}'.",
    wrongFormat: "Value '{act}' has the wrong format{media}.",
    minCount: "Use '{prop}' at least {cnt} times{media}.",
    maxCount: "Use '{prop}' at most {cnt} times{media}.",
    forbiddenValue: "Value '{val}' is forbidden{media}.",
  },
  analyzer: {
    geometryError: "'{sel}' geometry matches {match}%.",
    visualMismatch: "'{sel}' has a different '{prop}' value.",
    tooWide: "'{sel}' is too wide.",
    tooNarrow: "'{sel}' is too narrow.",
    tooTall: "'{sel}' is too tall.",
    tooShort: "'{sel}' is too short.",
    movedRight: "'{sel}' is shifted right.",
    movedLeft: "'{sel}' is shifted left.",
    movedDown: "'{sel}' is shifted down.",
    movedUp: "'{sel}' is shifted up.",
  },
  rules: {
    inlineSize: "Inline elements ignore dimensions.",
    inlineFloat: "Inline elements ignore float.",
    blockAlign: "Block elements ignore vertical-align.",
    flexContainer: "This is a flex container.",
    gridContainer: "This is a grid container.",
    tableMargin: "Table elements ignore margin.",
    posStatic: "Offsets do not affect static positioning.",
    posAbsolute: "Positioned elements ignore float and vertical-align.",
    zIndexStatic: "z-index does not affect static positioning.",
    flexCheck: "This property requires a flex or grid container.",
    marginAuto: "Automatic centering needs a width or max-width.",
    absCenter: "Complete centering with transform: translate(-50%, -50%).",
    contrast: "Text and background colors have insufficient contrast.",
    fontFallback: "Add a generic font-family fallback.",
  },
};

const sk = {
  ...en,
  ui: {
    preview: "Náhľad",
    inspect: "Inšpekcia",
    mySolution: "Moje riešenie",
    pattern: "Vzor",
    overlay: "Prekrytie",
    diffView: "Rozdiely",
    evaluation: "Vyhodnotenie",
    opacity: "Priehľadnosť vzoru:",
    zoomIn: "Priblížiť",
    zoomOut: "Oddialiť",
    fitToScreen: "Prispôsobiť ploche",
    dimensions: "rozmery",
    gap: "medzery",
    canvasHint: "Ctrl + koliesko pre lupu | stredné tlačidlo pre posun",
    diffViewText: "Čierne oblasti sa zhodujú; farebné oblasti sa líšia.",
  },
};

export const translations = { en, sk };

export const t = (locale, category, key, params = {}) => {
  const dictionary = translations[locale]?.[category] || en[category];
  let text = dictionary?.[key] || key;
  Object.entries(params).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, String(value));
  });
  return text;
};
