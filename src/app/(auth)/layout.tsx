export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#F5F6FA] to-[#E2E8F0]">
      {/* Subtle accent orb */}
      <div className="orb orb-blue" style={{ top: "20%", left: "25%" }} />
      <div className="orb orb-purple" style={{ bottom: "20%", right: "20%" }} />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4">{children}</div>
    </div>
  );
}
