import { describe, expect, it } from "vitest";
import { escapeHtml, formatDistance } from "../format";

describe("formatDistance", () => {
  it("renders sub-kilometer distances in meters", () => {
    expect(formatDistance(350)).toBe("350 m");
    expect(formatDistance(0)).toBe("0 m");
  });

  it("renders distances of 1km or more in kilometers with one decimal", () => {
    expect(formatDistance(1200)).toBe("1.2 km");
    expect(formatDistance(1000)).toBe("1.0 km");
  });
});

describe("escapeHtml", () => {
  it("escapes characters that could break out of an HTML attribute or tag", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("escapes a quote-based attribute-breakout attempt", () => {
    expect(escapeHtml(`" onmouseover="alert(1)`)).toBe("&quot; onmouseover=&quot;alert(1)");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Yliopiston Apteekki")).toBe("Yliopiston Apteekki");
  });
});
