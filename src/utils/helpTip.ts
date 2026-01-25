import type { MouseEvent } from 'react'

const getBoundaryElement = () => {
  const root = document.getElementById('root')
  return root || document.documentElement
}

export const adjustHelpTipWithinRoot = (event: MouseEvent<HTMLElement>) => {
  const tip = event.currentTarget
  const bubble = tip.querySelector<HTMLElement>('.help-bubble')
  if (!bubble) return

  bubble.style.setProperty('--help-shift-x', '0px')

  const boundary = getBoundaryElement()
  const boundaryRect = boundary.getBoundingClientRect()
  const bubbleRect = bubble.getBoundingClientRect()
  const safeLeft = boundaryRect.left + 8
  const safeRight = boundaryRect.right - 8

  let shift = 0
  if (bubbleRect.right > safeRight) {
    shift = safeRight - bubbleRect.right
  }
  if (bubbleRect.left + shift < safeLeft) {
    shift = safeLeft - bubbleRect.left
  }

  bubble.style.setProperty('--help-shift-x', `${shift}px`)
}
