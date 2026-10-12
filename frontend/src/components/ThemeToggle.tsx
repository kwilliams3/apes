export function ThemeToggle({ theme, onToggle }: any) {
  const dark = theme === "dark",
    label = dark ? "Passer en mode clair" : "Passer en mode sombre";
  return (
    <button
      className="theme-toggle icon-button"
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      aria-pressed={dark}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" />
          </>
        ) : (
          <path d="M20.8 14.2A9 9 0 0 1 9.8 3.2 9 9 0 1 0 20.8 14.2Z" />
        )}
      </svg>
    </button>
  );
}
