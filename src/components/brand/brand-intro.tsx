import { LogoMark } from "@/components/brand/logo";

/**
 * First-visit brand reveal, homepage only, once per browser session.
 *
 * The markup is always rendered but hidden; an inline script in the root layout adds
 * `intro` to <html> before first paint when this is the first homepage view of the
 * session and the visitor has not asked for reduced motion. Everything after that is
 * CSS: no JavaScript has to run to dismiss it, it never blocks input (pointer-events:
 * none), and it is gone after ~1.1 s.
 */
export function BrandIntro() {
  return (
    <div className="brand-intro" aria-hidden="true">
      <div className="flex items-center gap-4">
        <LogoMark className="brand-intro-mark size-9" draw />
        <span className="brand-intro-word font-display text-2xl font-semibold [font-stretch:125%]">
          NEXORA
        </span>
      </div>
      <span className="brand-intro-line" />
    </div>
  );
}

export const introScript = `try{if(location.pathname==="/"&&!sessionStorage.getItem("nx-intro")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){var d=document.documentElement;d.classList.add("intro");sessionStorage.setItem("nx-intro","1");setTimeout(function(){d.classList.remove("intro")},1600)}}catch(e){}`;
