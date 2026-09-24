// Orbit mark: a hub with three satellites at different weights, connected by
// thin spokes — people and knowledge orbiting a shared center. Uses
// currentColor so callers control the color (accent-on-dark, black-on-badge).
export default function Logo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.5" />
      <circle cx="12" cy="12" r="6.2" stroke="currentColor" strokeOpacity="0.5" />
      <line x1="12" y1="12" x2="19.7" y2="8.3" stroke="currentColor" strokeOpacity="0.55" />
      <line x1="12" y1="12" x2="6.4" y2="16.6" stroke="currentColor" strokeOpacity="0.55" />
      <line x1="12" y1="12" x2="9.9" y2="5.9" stroke="currentColor" strokeOpacity="0.55" />
      <circle cx="19.7" cy="8.3" r="1.5" fill="currentColor" />
      <circle cx="6.4" cy="16.6" r="1.9" fill="currentColor" />
      <circle cx="9.9" cy="5.9" r="1.1" fill="currentColor" opacity="0.75" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    </svg>
  )
}
