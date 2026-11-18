import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CaretUpDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import useScrollActiveItemIntoView from "@/hooks/useScrollActiveItemIntoView";
import { getProviderMenuPlacement } from "./placement";

/**
 * Provider selection dropdown shared by every provider settings page.
 * Renders the trigger button for the selected provider and, once opened,
 * a searchable list of providers - the caller renders each row.
 * @param {object} props
 * @param {Array<{name: string, value: string}>} props.items - options to list, filtered by name
 * @param {{name: string, logo: string, description: string, value?: string}} props.selected - provider shown on the trigger button
 * @param {string} props.placeholder - search field placeholder
 * @param {(item: object, close: () => void) => React.ReactNode} props.renderItem - row renderer for a single item
 */
export default function ProviderSearchMenu({
  items,
  selected,
  placeholder,
  renderItem,
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const triggerRef = useRef(null);
  const wasOpen = useRef(false);

  // Return focus to the trigger on close so the keyboard is not stranded on document.body.
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <div ref={anchorRef} className="w-full max-w-[640px]">
      {open ? (
        // Keep the trigger's box in flow while the menu is portaled, so the
        // page does not collapse and the menu can be anchored to this spot.
        <div className="h-[64px]" aria-hidden="true" />
      ) : (
        <button
          ref={triggerRef}
          className="w-full h-[64px] bg-theme-settings-input-bg rounded-lg flex items-center p-[14px] justify-between cursor-pointer border-2 border-transparent hover:border-primary-button focus:border-primary-button focus:outline-none transition-all duration-300"
          type="button"
          onClick={() => setOpen(true)}
        >
          <div className="flex gap-x-4 items-center">
            <img
              src={selected.logo}
              alt={`${selected.name} logo`}
              className="w-10 h-10 rounded-md"
            />
            <div className="flex flex-col text-left">
              <div className="text-sm font-semibold text-white">
                {selected.name}
              </div>
              <div className="mt-1 text-xs text-description">
                {selected.description}
              </div>
            </div>
          </div>
          <CaretUpDown size={24} weight="bold" className="text-white" />
        </button>
      )}
      {open && (
        <SearchPanel
          anchorRef={anchorRef}
          items={items}
          selectedValue={selected?.value}
          placeholder={placeholder}
          renderItem={renderItem}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function readPlacement(anchor) {
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  return getProviderMenuPlacement(
    {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
    },
    { width: window.innerWidth, height: window.innerHeight }
  );
}

function placementsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.openUpward === b.openUpward &&
    a.top === b.top &&
    a.bottom === b.bottom &&
    a.left === b.left &&
    a.width === b.width &&
    a.maxHeight === b.maxHeight
  );
}

function SearchPanel({
  anchorRef,
  items,
  selectedValue,
  placeholder,
  renderItem,
  onClose,
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(() =>
    Math.max(
      items.findIndex((item) => item.value === selectedValue),
      0
    )
  );
  const [placement, setPlacement] = useState(null);
  const [listMaxHeight, setListMaxHeight] = useState(0);
  const listRef = useRef(null);
  const panelRef = useRef(null);
  const headerRef = useRef(null);
  const emptyRef = useRef(null);
  const revealedAnchor = useRef(false);
  const results = items.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  // Anchor the portaled menu to the trigger and keep it inside the viewport
  // as the window resizes or the settings pane scrolls.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return undefined;

    if (!revealedAnchor.current) {
      anchor.scrollIntoView({ block: "nearest", inline: "nearest" });
      revealedAnchor.current = true;
    }

    const update = () => {
      const next = readPlacement(anchor);
      const borderY = panelRef.current
        ? panelRef.current.offsetHeight - panelRef.current.clientHeight
        : 0;
      const chrome =
        (headerRef.current?.offsetHeight ?? 0) +
        (emptyRef.current?.offsetHeight ?? 0);
      const nextListMax = Math.max(
        0,
        (next?.maxHeight ?? 0) - borderY - chrome
      );
      setPlacement((prev) => (placementsEqual(prev, next) ? prev : next));
      setListMaxHeight((prev) => (prev === nextListMax ? prev : nextListMax));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    if (headerRef.current) observer.observe(headerRef.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, results.length, placement === null]);

  function search(value) {
    setQuery(value);
    setHighlightedIndex(0);
  }

  function handleXButton() {
    if (query.length > 0) return search("");
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") return onClose();
    if (e.key === "Enter") {
      e.preventDefault();
      // Rows own what selecting them does (some open a setup modal first),
      // so the highlighted row is clicked rather than selected from here.
      listRef.current?.children[highlightedIndex]?.firstElementChild?.click();
      return;
    }

    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    if (results.length === 0) return;
    setHighlightedIndex((prev) =>
      e.key === "ArrowDown"
        ? (prev + 1) % results.length
        : (prev - 1 + results.length) % results.length
    );
  }

  if (!placement) return null;

  const panelStyle = {
    left: placement.left,
    width: placement.width,
    maxHeight: placement.maxHeight,
  };
  if (placement.openUpward) panelStyle.bottom = placement.bottom;
  else panelStyle.top = placement.top;

  return createPortal(
    <>
      <div
        className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 backdrop-blur-sm z-10"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        style={panelStyle}
        className="fixed z-20 max-w-[640px] bg-theme-settings-input-bg rounded-lg flex flex-col cursor-pointer border-2 border-primary-button overflow-hidden"
      >
        <div
          ref={headerRef}
          className="flex items-center shrink-0 border-b border-[#9CA3AF] mx-4 bg-theme-settings-input-bg"
        >
          <MagnifyingGlass
            size={20}
            weight="bold"
            className="absolute left-4 z-30 text-theme-text-primary -ml-4 my-2"
          />
          <input
            type="search"
            autoFocus
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            placeholder={placeholder}
            value={query}
            onChange={(e) => search(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-none -ml-4 my-2 bg-transparent z-20 pl-12 h-[38px] w-full px-4 py-1 text-sm outline-none text-theme-text-primary placeholder:text-theme-text-primary placeholder:font-medium [&::-webkit-search-cancel-button]:appearance-none"
          />
          <X
            size={20}
            weight="bold"
            className="cursor-pointer text-theme-text-primary hover:text-x-button"
            onClick={handleXButton}
          />
        </div>
        {results.length === 0 && (
          <p
            ref={emptyRef}
            className="text-center text-sm text-theme-text-secondary py-6"
          >
            {t("common.noResults")}
          </p>
        )}
        <div
          ref={listRef}
          style={{ maxHeight: listMaxHeight }}
          className="pl-4 pr-2 flex flex-col gap-y-1 overflow-y-auto overscroll-contain white-scrollbar pb-4"
        >
          {results.map((item, index) => (
            <MenuItem key={item.name} highlighted={index === highlightedIndex}>
              {renderItem(item, onClose)}
            </MenuItem>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}

function MenuItem({ highlighted, children }) {
  const { ref } = useScrollActiveItemIntoView({
    isActive: highlighted,
    behavior: "instant",
    block: "nearest",
  });

  return (
    <div
      ref={ref}
      className={`rounded-md ${highlighted ? "bg-zinc-700/50 light:bg-white" : ""}`}
    >
      {children}
    </div>
  );
}
