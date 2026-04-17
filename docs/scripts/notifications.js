const NOTIFICATIONS = new (class PushNotifications {
  constructor() {
    this._localTokenKey = 'push_token';
    this._onMessageRegistered = false;
  }

  isSupported() {
    return (
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      window.self === window.top
    );
  }

  _isIOSSafari() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  _isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      navigator.standalone === true;
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

  _setLoading(loading) {
    const bellBtn = document.getElementById('push-bell-btn');
    if (!bellBtn) return;
    if (loading) {
      bellBtn.classList.add('push-bell-btn--loading');
      bellBtn.disabled = true;
    } else {
      bellBtn.classList.remove('push-bell-btn--loading');
      bellBtn.disabled = false;
    }
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

      if (!this._onMessageRegistered) {
        this._onMessageRegistered = true;
        messaging.onMessage((payload) => {
          const title = payload.data?.title || 'Bastoneres';
          const body = payload.data?.body || '';
          if (Notification.permission === 'granted') {
            new Notification(title, {
              body,
              icon: '/images/android/android-launchericon-192-192.png',
            });
          }
        });
      }
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
    this.updateBellState();

    if (!this.isSupported()) return;

    const bellBtn = document.getElementById('push-bell-btn');
    if (bellBtn) {
      bellBtn.addEventListener('click', async () => {
        if (this._isIOSSafari() && !this._isStandalone()) {
          alert('Per rebre notificacions a iOS:\n\n1. Toca la icona de compartir (⬆️) a la barra de Safari\n2. Selecciona "Afegir a la pantalla d\'inici"\n3. Obri l\'app des de la pantalla d\'inici\n4. Toca la campaneta per activar les notificacions');
          return;
        }
        if (Notification.permission === 'denied') {
          alert('Les notificacions estan bloquejades.\n\nPer activar-les, ves a la configuració del navegador:\n1. Toca la icona del cadenat (🔒) al costat de la barra d\'adreces\n2. Busca "Notificacions"\n3. Canvia el permís a "Permetre"\n4. Recarrega la pàgina');
        } else if (Notification.permission === 'granted') {
          if (confirm('Vols desactivar les notificacions push?')) {
            this._setLoading(true);
            await this.unsubscribe();
            this._setLoading(false);
          }
        } else {
          this._setLoading(true);
          await this.requestPermissionAndSubscribe();
          this._setLoading(false);
        }
      });
    }

    if (Notification.permission === 'granted' && !this.getStoredToken()) {
      this._setLoading(true);
      await this.subscribeToNotifications();
      this._setLoading(false);
    }
  }

  updateBellState() {
    const bellBtn = document.getElementById('push-bell-btn');
    if (!bellBtn) return;

    if (!this.isSupported() || !APP.isAuthenticated) {
      bellBtn.style.display = 'none';
      return;
    }

    const permission = Notification.permission;

    bellBtn.style.display = '';
    bellBtn.classList.remove('push-bell-btn--granted', 'push-bell-btn--denied', 'push-bell-btn--blocked', 'push-bell-btn--not-requested');

    if (permission === 'denied') {
      bellBtn.classList.add('push-bell-btn--blocked');
      bellBtn.setAttribute('aria-label', 'Notificacions bloquejades');
      bellBtn.title = 'Notificacions bloquejades al navegador';
    } else if (permission === 'granted' && this.getStoredToken()) {
      bellBtn.classList.add('push-bell-btn--granted');
      bellBtn.setAttribute('aria-label', 'Desactivar notificacions');
      bellBtn.title = 'Desactivar notificacions push';
    } else if (permission === 'granted') {
      bellBtn.classList.add('push-bell-btn--denied');
      bellBtn.setAttribute('aria-label', 'Activar notificacions');
      bellBtn.title = 'Activar notificacions push';
    } else {
      bellBtn.classList.add('push-bell-btn--not-requested');
      bellBtn.setAttribute('aria-label', 'Activar notificacions');
      bellBtn.title = 'Toca per activar les notificacions push';
    }
  }
})();
