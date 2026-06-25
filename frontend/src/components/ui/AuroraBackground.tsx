/** Animated aurora blobs + subtle grid, fixed behind all content. */
export function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-40 -top-40 h-[40rem] w-[40rem] rounded-full bg-neon-violet/20 blur-3xl animate-aurora" />
      <div
        className="absolute -right-40 top-20 h-[36rem] w-[36rem] rounded-full bg-neon-cyan/15 blur-3xl animate-aurora"
        style={{ animationDelay: '-6s' }}
      />
      <div
        className="absolute bottom-[-12rem] left-1/3 h-[34rem] w-[34rem] rounded-full bg-neon-purple/15 blur-3xl animate-aurora"
        style={{ animationDelay: '-12s' }}
      />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  )
}
