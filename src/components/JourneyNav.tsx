import { useEffect, useRef, useState, type CSSProperties } from 'react'

const JOURNEY = [
  { id: 'rhythm', number: '01', label: 'Rhythm' },
  { id: 'projects', number: '02', label: 'Projects' },
  { id: 'signals', number: '03', label: 'Signal lab' },
  { id: 'delivery', number: '04', label: 'DNA' },
  { id: 'insights', number: '05', label: 'Connections' },
  { id: 'sources', number: '06', label: 'Sources' },
] as const

function initialSection() {
  const hash = window.location.hash.slice(1)
  return JOURNEY.some((item) => item.id === hash) ? hash : JOURNEY[0].id
}

export function JourneyNav() {
  const [active, setActive] = useState(initialSection)
  const linksRef = useRef(new Map<string, HTMLAnchorElement>())
  const activeIndex = Math.max(
    0,
    JOURNEY.findIndex((item) => item.id === active),
  )

  useEffect(() => {
    const sections = JOURNEY.map((item) => document.getElementById(item.id)).filter(
      (section): section is HTMLElement => Boolean(section),
    )
    const followHash = () => {
      const hash = window.location.hash.slice(1)
      if (JOURNEY.some((item) => item.id === hash)) setActive(hash)
    }
    let frame = 0
    const followScroll = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const marker = window.innerHeight * 0.32
        const current = sections.filter((section) => section.getBoundingClientRect().top <= marker).at(-1)
        if (current) setActive(current.id)
      })
    }

    window.addEventListener('hashchange', followHash)
    window.addEventListener('scroll', followScroll, { passive: true })
    followScroll()

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('hashchange', followHash)
      window.removeEventListener('scroll', followScroll)
    }
  }, [])

  useEffect(() => {
    if (!window.matchMedia('(max-width: 1100px)').matches) return
    linksRef.current.get(active)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [active])

  return (
    <nav
      aria-label="Dashboard journey"
      className="journey-nav"
      style={
        { '--journey-progress': `${((activeIndex + 1) / JOURNEY.length) * 100}%` } as CSSProperties
      }
    >
      {JOURNEY.map((item) => (
        <a
          aria-current={active === item.id ? 'location' : undefined}
          href={`#${item.id}`}
          key={item.id}
          onClick={() => setActive(item.id)}
          ref={(node) => {
            if (node) linksRef.current.set(item.id, node)
            else linksRef.current.delete(item.id)
          }}
        >
          <span>{item.number}</span>
          <strong>{item.label}</strong>
        </a>
      ))}
    </nav>
  )
}
