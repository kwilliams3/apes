import { useEffect, useState, useRef } from "react";

export function ProfileMenu({ user, onAccount, onLogout }: any) {
  const [open, setOpen] = useState<any>(false),
    container = useRef<any>(null),
    trigger = useRef<any>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e) => {
      if (!container.current?.contains(e.target)) setOpen(false);
    };
    const escape = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      className="profile"
      ref={container}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="profile-trigger"
        aria-expanded={open}
        aria-controls="profile-options"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar">
          {user.first_name?.[0] || user.username[0]}
        </span>
        <span className="profile-identity">
          <strong>{user.first_name || user.username}</strong>
          <small>{user.roles.join(", ")}</small>
        </span>
        <span className="profile-chevron" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="profile-options" id="profile-options">
          <button
            onClick={() => {
              setOpen(false);
              onAccount();
            }}
          >
            Changer de mot de passe
          </button>
          <button
            className="profile-logout"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}
