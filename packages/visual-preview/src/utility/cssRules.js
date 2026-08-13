export const IGNORED_PROPERTIES = [
  {
    property: "display",
    value: "inline",
    reasonCode: "inlineSize",
    ignored: [
      "width",
      "min-width",
      "max-width",
      "height",
      "min-height",
      "max-height",
      "margin-top",
      "margin-bottom",
      "overflow",
      "resize",
    ],
  },
  {
    property: "display",
    value: "inline",
    reasonCode: "inlineFloat",
    ignored: ["float", "clear"],
  },
  {
    property: "display",
    value: "block",
    reasonCode: "blockAlign",
    ignored: ["vertical-align"],
  },
  {
    property: "display",
    value: /^inline-flex$|^flex$/,
    reasonCode: "flexContainer",
    ignored: [
      "vertical-align",
      "float",
      "clear",
      "column-count",
      "column-gap",
      "::first-letter",
      "::first-line",
    ],
  },
  {
    property: "display",
    value: /^inline-grid$|^grid$/,
    reasonCode: "gridContainer",
    ignored: [
      "vertical-align",
      "float",
      "clear",
      "column-count",
      "::first-letter",
      "::first-line",
    ],
  },
  {
    property: "display",
    value: /table-.*$/,
    reasonCode: "tableMargin",
    ignored: [
      "margin",
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
    ],
  },
  {
    property: "position",
    value: "static",
    isDefault: true,
    reasonCode: "posStatic",
    ignored: ["top", "left", "right", "bottom"],
  },
  {
    property: "position",
    value: /^absolute$|^fixed$/,
    reasonCode: "posAbsolute",
    ignored: ["float", "clear", "vertical-align"],
  },
];

export const SHORTHAND_MAP = {
  background: [
    "background-color",
    "background-image",
    "background-position",
    "background-size",
    "background-repeat",
    "background-attachment",
    "background-origin",
    "background-clip",
  ],
  font: [
    "font-style",
    "font-variant",
    "font-weight",
    "font-stretch",
    "font-size",
    "line-height",
    "font-family",
  ],
  border: [
    "border-width",
    "border-style",
    "border-color",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
  ],
  "border-top": ["border-top-width", "border-top-style", "border-top-color"],
  "border-right": [
    "border-right-width",
    "border-right-style",
    "border-right-color",
  ],
  "border-bottom": [
    "border-bottom-width",
    "border-bottom-style",
    "border-bottom-color",
  ],
  "border-left": [
    "border-left-width",
    "border-left-style",
    "border-left-color",
  ],
  "border-width": [
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
  ],
  "border-style": [
    "border-top-style",
    "border-right-style",
    "border-bottom-style",
    "border-left-style",
  ],
  "border-color": [
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
  ],
  margin: ["margin-top", "margin-right", "margin-bottom", "margin-left"],
  padding: ["padding-top", "padding-right", "padding-bottom", "padding-left"],
  "list-style": ["list-style-type", "list-style-position", "list-style-image"],
  transition: [
    "transition-property",
    "transition-duration",
    "transition-timing-function",
    "transition-delay",
  ],
  animation: [
    "animation-name",
    "animation-duration",
    "animation-timing-function",
    "animation-delay",
    "animation-iteration-count",
    "animation-direction",
    "animation-fill-mode",
    "animation-play-state",
  ],
  flex: ["flex-grow", "flex-shrink", "flex-basis"],
  "grid-template": [
    "grid-template-rows",
    "grid-template-columns",
    "grid-template-areas",
  ],
  "grid-gap": ["grid-row-gap", "grid-column-gap"],
};

export const DEPRECATED_PROPERTIES = [
  "clip",
  "box-align",
  "box-flex",
  "box-orient",
  "box-pack",
  "implements",
  "text-blink",
  "-webkit-text-blink",
  "-moz-text-blink",
  "user-select",
  "-moz-opacity",
  "-webkit-opacity",
  "image-rendering",
];

export const VALID_UNITS = new Set([
  "px",
  "em",
  "rem",
  "%",
  "vw",
  "vh",
  "vmin",
  "vmax",
  "cm",
  "mm",
  "in",
  "pt",
  "pc",
  "ch",
  "ex",
  "deg",
  "rad",
  "grad",
  "turn",
  "s",
  "ms",
  "Hz",
  "kHz",
  "dpi",
  "dpcm",
  "dppx",
  "fr",
]);

export const SPECIAL_RULES = [
  {
    id: "z-index-static",
    check: (props) => {
      const pos = props.get("position")?.value || "static";
      if (pos === "static" && props.has("z-index"))
        return { prop: "z-index", code: "zIndexStatic" };
      return null;
    },
  },
  {
    id: "flex-check",
    check: (props) => {
      const display = props.get("display")?.value;
      const isFlexOrGrid =
        display === "flex" ||
        display === "inline-flex" ||
        display === "grid" ||
        display === "inline-grid";

      if (!isFlexOrGrid) {
        if (props.has("justify-content"))
          return { prop: "justify-content", code: "flexCheck" };
        if (props.has("align-items"))
          return { prop: "align-items", code: "flexCheck" };
        if (props.has("flex-direction"))
          return { prop: "flex-direction", code: "flexCheck" };
      }
      return null;
    },
  },
  {
    id: "margin-auto-no-width",
    check: (props) => {
      const margin = props.get("margin")?.value || "";
      const ml = props.get("margin-left")?.value;
      const mr = props.get("margin-right")?.value;
      const hasAuto =
        margin.includes("auto") || (ml === "auto" && mr === "auto");
      const hasWidth = props.has("width") || props.has("max-width");
      const isInline = props.get("display")?.value === "inline";
      if (hasAuto && !hasWidth && !isInline)
        return {
          prop: props.has("margin") ? "margin" : "margin-left",
          code: "marginAuto",
        };
      return null;
    },
  },
  {
    id: "absolute-center-trap",
    check: (props) => {
      const pos = props.get("position")?.value;
      if (pos === "absolute" || pos === "fixed") {
        const top = props.get("top")?.value;
        const left = props.get("left")?.value;
        if (top === "50%" && left === "50%" && !props.has("transform"))
          return { prop: "top", code: "absCenter" };
      }
      return null;
    },
  },
  {
    id: "contrast-check",
    check: (props) => {
      const color = props.get("color")?.value;
      const bg =
        props.get("background-color")?.value || props.get("background")?.value;
      if (color && bg) {
        const cVal = color.toLowerCase();
        const bVal = bg.toLowerCase();
        if (cVal === bVal || (props.has("background") && bVal.includes(cVal)))
          return { prop: "color", code: "contrast" };
      }
      return null;
    },
  },
  {
    id: "font-fallback",
    check: (props) => {
      const fontFam = props.get("font-family");
      if (fontFam) {
        const val = fontFam.value.toLowerCase();
        const generics = [
          "sans-serif",
          "serif",
          "monospace",
          "cursive",
          "fantasy",
          "system-ui",
        ];
        const hasGeneric = generics.some((g) => val.includes(g));
        if (!hasGeneric) return { prop: "font-family", code: "fontFallback" };
      }
      return null;
    },
  },
];
