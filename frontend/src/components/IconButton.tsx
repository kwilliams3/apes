import { actionIcons } from "./actionIcons";

export function IconButton({ icon, label, className = "", ...props }: any) {
  return (
    <button
      {...props}
      className={"icon-button " + className}
      title={label}
      aria-label={label}
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
        {actionIcons[icon]}
      </svg>
    </button>
  );
}
