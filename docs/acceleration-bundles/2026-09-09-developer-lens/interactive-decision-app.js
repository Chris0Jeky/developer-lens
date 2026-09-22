(window.DEVELOPER_LENS_DECK_DATA_READY || Promise.reject(new Error('Decision data loader is unavailable.')))
  .then(() => {
    const app = document.createElement('script')
    app.src = 'interactive-decision-app-core.js'
    app.onerror = () => {
      throw new Error('The decision-deck application script could not be loaded.')
    }
    document.body.append(app)
  })
  .catch(error => {
    const main = document.querySelector('main') || document.body
    const message = document.createElement('div')
    message.className = 'callout'
    message.textContent = `Decision deck failed to initialise: ${error instanceof Error ? error.message : String(error)}`
    main.prepend(message)
  })
