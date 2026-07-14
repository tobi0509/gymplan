import Link from "next/link";
import { logout } from "@/app/login/actions";

export default function TrainerNav() {
  return (
    <header className="sticky top-0 z-20 border-b bg-base/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-black font-black">
            G
          </span>
          <span className="text-lg font-bold tracking-tight">GymPlan</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface hover:text-foreground"
          >
            Pläne
          </Link>
          <Link
            href="/programs"
            className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface hover:text-foreground"
          >
            Programme
          </Link>
          <Link
            href="/exercises"
            className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface hover:text-foreground"
          >
            Übungen
          </Link>
          <Link
            href="/clients"
            className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface hover:text-foreground"
          >
            Kunden
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface hover:text-foreground"
            >
              Abmelden
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
