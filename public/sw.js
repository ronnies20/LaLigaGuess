self.addEventListener('push', event => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'LaLiga Guess 🎰', {
      body: data.body || '',
      dir: 'rtl',
      lang: 'he',
      vibrate: [200, 100, 200],
      tag: data.tag || 'laliga-guess',
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus()
      return clients.openWindow('/')
    })
  )
})
