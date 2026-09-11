function defaultDocument() {
  return typeof document === 'undefined' ? null : document
}

export function createScrollLockManager({ getDocument = defaultDocument } = {}) {
  let baseline = null
  let sequence = 0
  const locks = new Map()

  function capture(doc) {
    return {
      htmlOverflow: doc.documentElement.style.overflow,
      htmlHeight: doc.documentElement.style.height,
      bodyOverflow: doc.body.style.overflow,
      bodyHeight: doc.body.style.height,
    }
  }

  function restore(doc) {
    if (!baseline) return
    doc.documentElement.style.overflow = baseline.htmlOverflow
    doc.documentElement.style.height = baseline.htmlHeight
    doc.body.style.overflow = baseline.bodyOverflow
    doc.body.style.height = baseline.bodyHeight
    baseline = null
  }

  function sync(doc) {
    if (!locks.size) {
      restore(doc)
      return
    }

    doc.documentElement.style.overflow = 'hidden'
    doc.body.style.overflow = 'hidden'

    const viewportLocked = [...locks.values()].some((lock) => lock.viewport === true)
    if (viewportLocked) {
      doc.documentElement.style.height = '100svh'
      doc.body.style.height = '100svh'
    } else if (baseline) {
      doc.documentElement.style.height = baseline.htmlHeight
      doc.body.style.height = baseline.bodyHeight
    }
  }

  function acquire({ viewport = false } = {}) {
    const doc = getDocument()
    if (!doc?.documentElement?.style || !doc?.body?.style) return () => {}

    if (!locks.size) baseline = capture(doc)
    const id = ++sequence
    locks.set(id, { viewport: viewport === true })
    sync(doc)

    let released = false
    return () => {
      if (released) return
      released = true
      locks.delete(id)
      sync(doc)
    }
  }

  return {
    acquire,
    activeCount: () => locks.size,
  }
}

const pageScrollLockManager = createScrollLockManager()

export function acquirePageScrollLock(options = {}) {
  return pageScrollLockManager.acquire(options)
}
