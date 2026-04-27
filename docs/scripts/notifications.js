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

  getUnsupportedReason() {
    if (!('Notification' in window)) return 'Notification API';
    if (!('serviceWorker' in navigator)) return 'Service Worker';
    if (!('PushManager' in window)) return 'PushManager';
    if (window.self !== window.top) return 'iframe';
    return null;
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

  async subscribeToNotifications({ silent = false } = {}) {
    if (!this.isSupported() || !API.isAuthenticated()) return false;

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

      if (!token) {
        if (!silent) {
          alert('No s\'ha pogut obtindre el token de notificacions.\n\nAi\u00f2 sol passar en mode inc\u00f2gnit o quan el navegador bloqueja l\'emmagatzematge. Prova en una finestra normal.');
        }
        return false;
      }

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
              icon: new URL('images/android/android-launchericon-192-192.png', location.origin + '/').href,
              badge: new URL('images/android/android-launchericon-96-96.png', location.origin + '/').href,
              tag: 'bastoneres-notification',
            });
          }
        });
      }
      return true;
    } catch (e) {
      console.error('Error subscribing to push notifications:', e);
      if (!silent) {
        const msg = (e && e.code) ? e.code : (e && e.message) ? e.message : String(e);
        alert('No s\'han pogut activar les notificacions.\n\n' + msg + '\n\nSi est\u00e0s en mode inc\u00f2gnit/privat, prova en una finestra normal.');
      }
      return false;
    }
  }

  async _registerOnMessageHandler() {
    if (this._onMessageRegistered) return;
    try {
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
      this._onMessageRegistered = true;
      messaging.onMessage((payload) => {
        const title = payload.data?.title || 'Bastoneres';
        const body = payload.data?.body || '';
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: new URL('images/android/android-launchericon-192-192.png', location.origin + '/').href,
            badge: new URL('images/android/android-launchericon-96-96.png', location.origin + '/').href,
            tag: 'bastoneres-notification',
          });
        }
      });
    } catch (e) {
      console.error('Error registering onMessage handler:', e);
    }
  }

  async requestPermissionAndSubscribe() {
    if (!this.isSupported()) return;

    let permission;
    try {
      permission = await Notification.requestPermission();
    } catch (e) {
      console.error('Error requesting notification permission:', e);
      alert('No s\'ha pogut sol\u00b7licitar el perm\u00eds de notificacions.\n\nAi\u00f2 pot ocorrer en mode inc\u00f2gnit/privat. Prova en una finestra normal.');
      this.updateBellState();
      return;
    }

    if (permission === 'granted') {
      await this.subscribeToNotifications();
    } else if (permission === 'denied') {
      alert('El navegador ha denegat el perm\u00eds de notificacions.\n\nEn mode inc\u00f2gnit/privat sol denegar-se autom\u00e0ticament. Prova en una finestra normal o canvia el perm\u00eds des de la configuraci\u00f3 del navegador.');
    }
    this.updateBellState();
  }

  async unsubscribe() {
    const token = this.getStoredToken();
    if (token) {
      if (API.isAuthenticated()) {
        try {
          await API.unregisterPushToken({ pushToken: token });
        } catch (e) {
          console.error('Error unregistering push token:', e);
        }
      }
      this.clearStoredToken();
    }
    this.updateBellState();
  }

  async initialize() {
    this.updateBellState();

    const bellBtn = document.getElementById('push-bell-btn');
    if (bellBtn) {
      bellBtn.addEventListener('click', async () => {
        if (!this.isSupported()) {
          const reason = this.getUnsupportedReason();
          alert('Aquest dispositiu o navegador no permet notificacions push.\n\nMotiu: ' + (reason || 'desconegut') + '.\n\nProva amb Chrome o Edge actualitzats. Si estàs en una finestra incògnit/privada, prova en una finestra normal.');
          return;
        }
        if (this._isIOSSafari() && !this._isStandalone()) {
          alert('Per rebre notificacions a iOS:\n\n1. Toca la icona de compartir (⬆️) a la barra de Safari\n2. Selecciona "Afegir a la pantalla d\'inici"\n3. Obri l\'app des de la pantalla d\'inici\n4. Toca la campaneta per activar les notificacions');
          return;
        }
        if (Notification.permission === 'denied') {
          alert('Les notificacions estan bloquejades.\n\nPer activar-les, ves a la configuració del navegador:\n1. Toca la icona del cadenat (🔒) al costat de la barra d\'adreces\n2. Busca "Notificacions"\n3. Canvia el permís a "Permetre"\n4. Recarrega la pàgina');
        } else if (Notification.permission === 'granted' && this.getStoredToken()) {
          if (confirm('Vols desactivar les notificacions push?')) {
            this._setLoading(true);
            await this.unsubscribe();
            this._setLoading(false);
          }
        } else if (Notification.permission === 'granted') {
          this._setLoading(true);
          await this.subscribeToNotifications();
          this._setLoading(false);
        } else {
          this._setLoading(true);
          await this.requestPermissionAndSubscribe();
          this._setLoading(false);
        }
      });
    }

    if (!this.isSupported()) {
      console.warn('Push notifications not supported. Reason:', this.getUnsupportedReason());
      return;
    }

    if (Notification.permission === 'granted' && !this.getStoredToken() && API.isAuthenticated()) {
      this._setLoading(true);
      await this.subscribeToNotifications({ silent: true });
      this._setLoading(false);
    } else if (Notification.permission === 'granted' && this.getStoredToken()) {
      await this._registerOnMessageHandler();
    }
  }

  updateBellState() {
    const bellBtn = document.getElementById('push-bell-btn');
    if (!bellBtn) return;

    if (!APP.isAuthenticated) {
      bellBtn.style.display = 'none';
      return;
    }

    bellBtn.style.display = '';
    bellBtn.classList.remove('push-bell-btn--granted', 'push-bell-btn--resubscribe', 'push-bell-btn--blocked', 'push-bell-btn--not-requested');

    if (!this.isSupported()) {
      bellBtn.classList.add('push-bell-btn--blocked');
      bellBtn.setAttribute('aria-label', 'Notificacions no disponibles');
      bellBtn.title = 'Notificacions push no disponibles en aquest dispositiu/navegador';
      return;
    }

    const permission = Notification.permission;

    bellBtn.style.display = '';
    bellBtn.classList.remove('push-bell-btn--granted', 'push-bell-btn--resubscribe', 'push-bell-btn--blocked', 'push-bell-btn--not-requested');

    if (permission === 'denied') {
      bellBtn.classList.add('push-bell-btn--blocked');
      bellBtn.setAttribute('aria-label', 'Notificacions bloquejades');
      bellBtn.title = 'Notificacions bloquejades al navegador';
    } else if (permission === 'granted' && this.getStoredToken()) {
      bellBtn.classList.add('push-bell-btn--granted');
      bellBtn.setAttribute('aria-label', 'Desactivar notificacions');
      bellBtn.title = 'Desactivar notificacions push';
    } else if (permission === 'granted') {
      bellBtn.classList.add('push-bell-btn--resubscribe');
      bellBtn.setAttribute('aria-label', 'Reactivar notificacions');
      bellBtn.title = 'Reactivar notificacions push';
    } else {
      bellBtn.classList.add('push-bell-btn--not-requested');
      bellBtn.setAttribute('aria-label', 'Activar notificacions');
      bellBtn.title = 'Toca per activar les notificacions push';
    }
  }
})();
