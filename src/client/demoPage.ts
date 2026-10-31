import { renderPublicLandingHtml } from "./landingPage";

export function renderLandingHtml(_requestOrUrl?: unknown): string {
  return renderPublicLandingHtml();
}

export {
  renderPublicLandingHtml,
  renderLandingPageHtml,
  renderFeaturesHtml,
  renderFunctionsHtml,
  renderPublicLandingPageHtml,
} from "./landingPage";
