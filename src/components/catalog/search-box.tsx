"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { suggestAction } from "@/server/actions/products";
import { inputClasses } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type Suggestion = { slug: string; name: string; category: string };

/**
 * ARIA combobox: typing shows product suggestions, arrow keys move through
 * them, Enter opens the highlighted product or runs a full search.
 * Without JavaScript it is a plain GET form to /search.
 */
export function SearchBox({
  initialQuery = "",
  autoFocus = false,
}: {
  initialQuery?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const id = ++requestId.current;
    const t = setTimeout(async () => {
      const result = await suggestAction(term);
      // Ignore responses that arrive after a newer keystroke.
      if (id === requestId.current) {
        setSuggestions(result);
        setActive(-1);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  const showList = open && query.trim().length >= 2 && suggestions.length > 0;

  return (
    <form
      role="search"
      action="/search"
      method="get"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        const pick = suggestions[active];
        setOpen(false);
        if (pick) router.push(`/products/${pick.slug}`);
        else router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }}
    >
      <label htmlFor="search-input" className="sr-only">
        Search products
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-fog"
        aria-hidden="true"
      />
      <input
        id="search-input"
        name="q"
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        maxLength={80}
        value={query}
        placeholder="Search headphones, phones, chargers…"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
          } else if (e.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
        }}
        className={cn(inputClasses, "h-14 pl-12 text-lg")}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        hidden={!showList}
        className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-card border border-line-strong bg-graphite"
      >
        {suggestions.map((s, i) => (
          <li
            key={s.slug}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => {
              e.preventDefault();
              router.push(`/products/${s.slug}`);
            }}
            onMouseEnter={() => setActive(i)}
            className={cn(
              "flex cursor-pointer justify-between gap-4 px-4 py-3 text-[15px]",
              i === active && "bg-graphite-2 text-signal",
            )}
          >
            <span>{s.name}</span>
            <span className="label-mono text-fog">{s.category}</span>
          </li>
        ))}
      </ul>
    </form>
  );
}
