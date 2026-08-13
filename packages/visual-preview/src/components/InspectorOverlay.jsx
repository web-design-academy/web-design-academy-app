import React from "react";
import { t } from "../utility/locales.js";

function InspectorOverlay({ data, locale = "en" }) {
  if (!data) return null;

  const { rect, style, tagName, className, layout } = data;
  const getVal = (val) => parseFloat(val) || 0;

  const mt = getVal(style.marginTop);
  const mr = getVal(style.marginRight);
  const mb = getVal(style.marginBottom);
  const ml = getVal(style.marginLeft);

  const pt = getVal(style.paddingTop);
  const pr = getVal(style.paddingRight);
  const pb = getVal(style.paddingBottom);
  const pl = getVal(style.paddingLeft);

  const bt = getVal(style.borderTopWidth);
  const br = getVal(style.borderRightWidth);
  const bb = getVal(style.borderBottomWidth);
  const bl = getVal(style.borderLeftWidth);

  const colors = {
    margin: { bg: "rgba(246, 178, 107, 0.6)", solid: "#f6b26b" },
    border: { bg: "rgba(255, 229, 153, 0.6)", solid: "#ffe599" },
    padding: { bg: "rgb(148, 196, 125)", solid: "#93c47d" },
    content: { bg: "rgba(111, 168, 220, 0.6)", solid: "#6fa8dc" },
    gridGap: { bg: "rgba(220, 38, 38, 0.3)", solid: "#ef4444" },
    gridCell: { border: "1px dashed rgba(255, 255, 255, 0.7)" },
  };

  const marginStyle = {
    top: `${rect.top - mt}px`,
    left: `${rect.left - ml}px`,
    width: `${rect.width + ml + mr}px`,
    height: `${rect.height + mt + mb}px`,
    borderColor: colors.margin.bg,
    borderStyle: "solid",
    borderTopWidth: `${mt}px`,
    borderRightWidth: `${mr}px`,
    borderBottomWidth: `${mb}px`,
    borderLeftWidth: `${ml}px`,
  };

  const borderStyle = {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderColor: colors.border.bg,
    borderStyle: "solid",
    borderTopWidth: `${bt}px`,
    borderRightWidth: `${br}px`,
    borderBottomWidth: `${bb}px`,
    borderLeftWidth: `${bl}px`,
  };

  const paddingStyle = {
    top: `${rect.top + bt}px`,
    left: `${rect.left + bl}px`,
    width: `${rect.width - bl - br}px`,
    height: `${rect.height - bt - bb}px`,
    borderColor: colors.padding.bg,
    borderStyle: "solid",
    borderTopWidth: `${pt}px`,
    borderRightWidth: `${pr}px`,
    borderBottomWidth: `${pb}px`,
    borderLeftWidth: `${pl}px`,
  };

  const contentStyle = {
    top: `${rect.top + bt + pt}px`,
    left: `${rect.left + bl + pl}px`,
    width: `${rect.width - bl - br - pl - pr}px`,
    height: `${rect.height - bt - bb - pt - pb}px`,
    display:
      layout?.type === "grid"
        ? "grid"
        : layout?.type === "flex"
          ? "flex"
          : "block",
    gridTemplateColumns: layout?.gridCols || "none",
    gridTemplateRows: layout?.gridRows || "none",
    rowGap: layout ? `${layout.rowGap}px` : "0",
    columnGap: layout ? `${layout.columnGap}px` : "0",
    flexDirection: layout?.direction || "row",
    flexWrap: layout?.wrap || "nowrap",
    backgroundColor:
      layout && (layout.rowGap > 0 || layout.columnGap > 0)
        ? colors.gridGap.bg
        : colors.content.bg,
  };

  const formatVal = (t, r, b, l) => {
    if (t === 0 && r === 0 && b === 0 && l === 0) return null;
    if (t === r && t === b && t === l) return `${t}px`;
    if (t === b && r === l) return `${t}px ${r}px`;
    return `${t} ${r} ${b} ${l}`;
  };

  const marginLabel = formatVal(mt, mr, mb, ml);
  const borderLabel = formatVal(bt, br, bb, bl);
  const paddingLabel = formatVal(pt, pr, pb, pl);

  const contentW = Math.round(rect.width - bl - br - pl - pr);
  const contentH = Math.round(rect.height - bt - bb - pt - pb);

  let gridCells = [];
  if (layout?.type === "grid" && layout.gridCols && layout.gridRows) {
    const colsCount = layout.gridCols.split(" ").length;
    const rowsCount = layout.gridRows.split(" ").length;
    const totalCells = colsCount * rowsCount;
    if (totalCells < 500) {
      for (let i = 0; i < totalCells; i++) {
        gridCells.push(
          <div
            key={i}
            style={{
              backgroundColor: colors.content.bg,
              border: colors.gridCell.border,
              boxSizing: "border-box",
            }}
          />,
        );
      }
    }
  }

  return (
    <div className="inspector-overlay-container">
      <div className="inspector-box" style={marginStyle} />
      <div className="inspector-box" style={borderStyle} />
      <div className="inspector-box" style={paddingStyle} />

      <div className="inspector-box" style={contentStyle}>
        {gridCells}
      </div>

      <div className="inspector-hud">
        <div className="tooltip-header">
          <div>
            <span className="tag-name">{tagName.toLowerCase()}</span>
            {className && (
              <span className="class-name">
                .{className.split(" ").join(".")}
              </span>
            )}
          </div>

          {layout && (
            <span className="layout-badge">{layout.type.toUpperCase()}</span>
          )}
        </div>

        <div className="tooltip-body">
          {marginLabel && (
            <div className="legend-row">
              <div className="legend-label">
                <span
                  className="color-swatch"
                  style={{ backgroundColor: colors.margin.solid }}
                ></span>{" "}
                margin
              </div>
              <span className="legend-val">{marginLabel}</span>
            </div>
          )}
          {borderLabel && (
            <div className="legend-row">
              <div className="legend-label">
                <span
                  className="color-swatch"
                  style={{ backgroundColor: colors.border.solid }}
                ></span>{" "}
                border
              </div>
              <span className="legend-val">{borderLabel}</span>
            </div>
          )}
          {paddingLabel && (
            <div className="legend-row">
              <div className="legend-label">
                <span
                  className="color-swatch"
                  style={{ backgroundColor: colors.padding.solid }}
                ></span>{" "}
                padding
              </div>
              <span className="legend-val">{paddingLabel}</span>
            </div>
          )}
          {layout && (layout.rowGap > 0 || layout.columnGap > 0) && (
            <div className="legend-row">
              <div className="legend-label">
                <span
                  className="color-swatch"
                  style={{ backgroundColor: colors.gridGap.solid }}
                ></span>{" "}
                {t(locale, "ui", "gap")}
              </div>
              <span className="legend-val is-gap">
                {layout.rowGap === layout.columnGap
                  ? `${layout.rowGap}px`
                  : `${layout.rowGap}px ${layout.columnGap}px`}
              </span>
            </div>
          )}
          <div className="legend-row">
            <div className="legend-label">
              <span
                className="color-swatch"
                style={{ backgroundColor: colors.content.solid }}
              ></span>{" "}
              {t(locale, "ui", "dimensions")}
            </div>
            <span className="legend-val content-val">
              {contentW} <span className="dim-x">×</span> {contentH}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InspectorOverlay;
