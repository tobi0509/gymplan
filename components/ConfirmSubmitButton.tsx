"use client";

// Submit-Button mit nativer Rückfrage — für destruktive Server-Action-Forms,
// auch aus Server Components heraus nutzbar.
export default function ConfirmSubmitButton({
  message,
  className,
  children,
  ...rest
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick">) {
  return (
    <button
      {...rest}
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
