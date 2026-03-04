export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-0">
      {/* Animated gradient orbs */}
      <div className="orb orb-purple" style={{ top: "10%", left: "15%" }} />
      <div className="orb orb-blue" style={{ top: "60%", right: "10%" }} />
      <div className="orb orb-cyan" style={{ bottom: "20%", left: "40%" }} />
      <div className="orb orb-pink" style={{ top: "30%", right: "30%" }} />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4">{children}</div>
    </div>
  );
}
