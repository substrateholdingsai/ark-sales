import { renderPublicLandingHtml } from "./landingPage";
export const renderPublicLandingHtmlAlias = renderPublicLandingHtml;
export function renderPublicLanding(): string { return renderPublicLandingHtml(); }
export function renderLanding(): string { return renderPublicLandingHtml(); }
export { renderPublicLandingHtml, renderLandingPageHtml, renderFeaturesHtml, renderFunctionsHtml, renderPublicLandingPageHtml, renderLandingHtml } from "./landingPage";
