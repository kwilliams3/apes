export function LoadingScreen({ message, inline = false }: any) {
  return (
    <main
      className={"loading-screen" + (inline ? " loading-inline" : "")}
      aria-live="polite"
    >
      <img src="/apes-logo.svg" alt="Logo APES" />
      <span>{message}</span>
    </main>
  );
}
