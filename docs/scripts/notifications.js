const NOTIFICATIONS = new (class PushNotifications {
  constructor() {
    this._localTokenKey = 'push_token';
  }

  isSupported() {
    return (
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      window.self === window.top
    );
  }

  getStoredToken() {
    return localStorage.getItem(this._localTokenKey);
  }

  saveStoredToken(token) {
    localStorage.setItem(this._localTokenKey, token);
  }

  clearStoredToken() {
    localStorage.removeItem(this._localTokenKey);
  }

  async subscribeToNotifications() {
    if (!this.isSupported()) return;

    try {
      const registration = await navigator.serviceWorker.ready;

      const firebaseConfig = {
        apiKey: FIREBASE_API_KEY,
        authDomain: FIREBASE_AUTH_DOMAIN,
        projectId: FIREBASE_PROJECT_ID,
        messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
        appId: FIREBASE_APP_ID,
      };

      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      const messaging = firebase.messaging();

      const token = await messaging.getToken({
        vapidKey: FCM_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (!token) return;

      await API.registerPushToken({ pushToken: token });
      this.saveStoredToken(token);
      this.updateBellState();

      messaging.onMessage((payload) => {
        const title = payload.notification?.title || 'Bastoneres';
        const body = payload.notification?.body || '';
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/images/android/android-launchericon-192-192.png',
          });
        }
      });
    } catch (e) {
      console.error('Error subscribing to push notifications:', e);
    }
  }

  async requestPermissionAndSubscribe() {
    if (!this.isSupported()) return;

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await this.subscribeToNotifications();
    }
    this.updateBellState();
  }

  async unsubscribe() {
    const token = this.getStoredToken();
    if (token) {
      try {
        await API.unregisterPushToken({ pushToken: token });
      } catch (e) {
        console.error('Error unregistering push token:', e);
      }
      this.clearStoredToken();
    }
    this.updateBellState();
  }

  async initialize() {
    if (!this.isSupported()) return;

    this.updateBellState();

    const bellBtn = document.getElementById('push-bell-btn');
    if (bellBtn) {
      bellBtn.addEventListener('click', async () => {
        if (Notification.permission === 'granted') {
          await this.unsubscribe();
        } else {
          await this.requestPermissionAndSubscribe();
        }
      });
    }

    if (Notification.permission === 'granted' && !this.getStoredToken()) {
      await this.subscribeToNotifications();
    }
  }

  updateBellState() {
    const bellBtn = document.getElementById('push-bell-btn');
    if (!bellBtn) return;

    if (!this.isSupported()) {
      bellBtn.style.display = 'none';
      return;
    }

    const permission = Notification.permission;

    if (permission === 'denied') {
      bellBtn.style.display = 'none';
      return;
    }

    bellBtn.style.display = '';

    if (permission === 'granted' && this.getStoredToken()) {
      bellBtn.classList.add('push-bell--active');
      bellBtn.setAttribute('aria-label', 'Desactivar notificacions');
      bellBtn.title = 'Desactivar notificacions push';
    } else {
      bellBtn.classList.remove('push-bell--active');
      bellBtn.setAttribute('aria-label', 'Activar notificacions');
      bellBtn.title = 'Activar notificacions push';
    }
  }
})();
