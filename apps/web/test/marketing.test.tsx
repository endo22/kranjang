import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PlanCards } from "../components/marketing/plan-cards";

describe("marketing plan cards", () => {
  it("renders paid shared plans with register CTAs and IDR pricing", () => {
    const html = renderToStaticMarkup(<PlanCards />);

    assert.match(html, /Basic/);
    assert.match(html, /Business/);
    assert.match(html, /Pro/);
    assert.doesNotMatch(html, /Free Trial/);
    assert.match(html, /Rp 49\.000/);
    assert.equal((html.match(/href="\/register"/g) ?? []).length, 3);
  });
});
